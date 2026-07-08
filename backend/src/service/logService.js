import WebSocket from 'ws';
import { LOKI_BASE_URL } from '../config/loki.js';
import logger from '../utils/logger.js';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function escapeLogQL(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildLogQL({ deploymentName, component, levels, search }) {
    const matchers = [`app="${deploymentName}"`];
    if (component) {
        matchers.push(`component="${component}"`);
    }
    let query = `{${matchers.join(',')}}`;
    query += ' | regexp `^\\S+\\s+\\S+\\s+(?P<level>[A-Z]+)\\s+\\S+\\s+-\\s+`';
    // query += ' | regexp `^\\S+\\s+\\S+\\s+(?P<level>[A-Z]+)\\s+\\S+\\s+-\\s+.*$`';
    if (levels?.length) {
        const escaped = levels.map(l => l.toUpperCase()).join('|');
        query += ` | level=~"${escaped}"`;
    }
    if (search) {
        query += ` |= "${escapeLogQL(search)}"`;
    }
    return query;
}

export async function queryRange(params, startNs, endNs) {
    const query = buildLogQL(params);
    const url = `${LOKI_BASE_URL}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${startNs}&end=${endNs}&direction=forward&limit=2000`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Loki query_range failed: ${res.status}`);
    }
    const body = await res.json();
    return (body.data?.result ?? []).flatMap(stream =>
        stream.values.map(([ts, line]) => ({ ts: Number(ts) / 1e6, line, stream: stream.stream }))
    ).sort((a, b) => a.ts - b.ts);
}

export function openTailSocket(params, onLine, onStatus) {
    const query = buildLogQL(params);
    const wsUrl = `${LOKI_BASE_URL.replace(/^http/, 'ws')}/loki/api/v1/tail?query=${encodeURIComponent(query)}`;
    
    let closed = false;
    let ws = null;
    let attempt = 0;
    let reconnectTimer = null;

    function scheduleReconnect() {
        if (closed) {
            return;
        }
        onStatus?.('reconnecting');
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
        if (closed) {
            return;
        }

        try {
            ws = new WebSocket(wsUrl);
        } catch (err) {
            logger.warn('Failed to open Loki tail socket', {
                error: err.message
            });
            scheduleReconnect();
            return;
        }
    
        ws.on('open', () => {
            attempt = 0;
            onStatus?.('connected');
        });
    
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                for (const stream of parsed.streams ?? []) {
                    for (const [ts, line] of stream.values) {
                        onLine({ ts: Number(ts) / 1e6, line, stream: stream.stream });
                    }
                }
            } catch (err) {
                logger.warn('Failed to parse Loki tail frame', { error: err.message });
            }
        });

        ws.on('error', (err) => {
            logger.warn('Loki tail socket error', { 
                deploymentName: params.deploymentName,
                error: err.message
            });
        });
        
        ws.on('close', () => {
            if (closed) {
                return;
            }
            scheduleReconnect();
        });
    }

    connect();

    return {
        close() {
            closed = true;
            clearTimeout(reconnectTimer);
            if (ws) {
                ws.removeAllListeners();
                ws.close();
            }
        },
    };


}