export interface LogEvent {
    ts: number;
    line: string;
    stream: {
        level?: string;
        component?: string;
        pod?: string
    };
}

// 'connecting' - initial attempt, not connected yet
// 'connected' - actively receiving data from server
// 'reconnecting - connection dropped/failed. retrying with backoff
// 'error' - server said something is wrong wit the query
export type LogStreamStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function buildLogsUrl(deploymentName: string, params: {
    component?: string;
    search?: string;
    levels?: string[];
    namespace?: string;
}): string {
    const qs = new URLSearchParams({
        component: params.component ?? 'jobmanager',
        ...(params.search && { search: params.search }),
        ...(params.levels?.length && { levels: params.levels.join(',') }),
        ...(params.namespace && { namespace: params.namespace }),
    });
    return `${import.meta.env.VITE_API_BASE_URL}/flink/deployments/${deploymentName}/logs?${qs}`;
}

export function streamDeploymentLogs(
    deploymentName: string,
    params: {
        component?: string;
        search?: string;
        levels?: string[];
        namespace?: string
    },
    onEvent: (e: LogEvent) => void,
    onStatus?: (status: LogStreamStatus, message?: string) => void,
): () => void {
    let stopped = false;
    let controller: AbortController | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function connectOnce() {
        controller = new AbortController();
        onStatus?.(attempt === 0 ? 'connecting' : 'reconnecting');
        const token = localStorage.getItem('jwtToken') || sessionStorage.getItem('jwtToken');
        const url = buildLogsUrl(deploymentName, params);

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });

        if (!res.ok || !res.body) {
            throw new Error(`Log stream request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawAnyFrame = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
                if (!frame.trim()) {
                    continue;        // heartbeat comment frame (":\n\n"); nothing to do
                }

                const eventLine = frame.split('\n').find(l => l.startsWith('event:'));
                const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
                
                if (!dataLine) {
                    continue;
                }

                const eventType = eventLine?.slice(6).trim() ?? 'message';
                let payload: Record<string, unknown>;

                try {
                    payload = JSON.parse(dataLine.slice(5));
                } catch {
                    continue;
                }

                if (eventType === 'status') {
                    const status = payload.status as LogStreamStatus;
                    
                    if (status === 'connected') {
                        attempt = 0;
                    }
                    onStatus?.(status);
                } else if (eventType === 'warning') {
                    // Non fatal (e.g. history backfill unavailable)
                    onStatus?.('connected', payload.message as string | undefined);
                } else if (eventType === 'error') {
                    onStatus?.('error', payload.message as string | undefined);
                } else {
                    if (!sawAnyFrame) {
                        sawAnyFrame = true;
                        attempt = 0;
                        onStatus?.('connected');
                    }
                    onEvent(payload as unknown as LogEvent);
                }
            }
        }

        // Server ended response normally (e.g. restarted)
        if (!stopped) {
            scheduleReconnect();
        }
    }

    function scheduleReconnect() {
        if (stopped) {
            return;
        }
        onStatus?.('reconnecting');
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt += 1;
        retryTimer = setTimeout(run, delay);
    }

    function run() {
        connectOnce().catch(err => {
            if (stopped || err?.name === 'AbortError') {
                return;
            }
            scheduleReconnect();
        });
    }

    run();

    return () => {
        stopped = true;
        controller?.abort();
        if (retryTimer) {
            clearTimeout(retryTimer);
        }
    };
}