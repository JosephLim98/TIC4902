import type { Deployment, Savepoint } from "@/types";
import { useState, useEffect } from "react";
import { resumeDeployment, listSavepoints } from '@/api/flink';
import { createPortal } from 'react-dom';
import { MaterialIcon } from "./MaterialIcon";
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/api/client';
import { formatDate } from '@/lib/utils';

interface ResumeProps {
    deployment: Deployment | null
    onClose: () => void
    onSuccess: () => void
}

const SOURCE_LABEL: Record<Savepoint['source'], string> = {
    manual: 'Manual',
    stop: 'Auto (Stop)',
};

export function ResumeDeploymentDialog({ deployment, onClose, onSuccess }: ResumeProps) {
    const [isResuming, setIsResuming] = useState(false);
    const [error, setError] = useState<string | null>(null)
    const [savepoints, setSavepoints] = useState<Savepoint[]>([]);
    const [savepointsLoading, setSavepointsLoading] = useState(false);
    const [selectedSavepointId, setSelectedSavepointId] = useState<number | null>(null);
    const [skipSavepoint, setSkipSavepoint] = useState(false);

    useEffect(() => {
        if (!deployment) {
            return;
        }
        setError(null);
        setSkipSavepoint(false);
        setSavepointsLoading(true);

        const controller = new AbortController();
        listSavepoints(deployment.deploymentName, controller.signal)
            .then((res) => {
                setSavepoints(res.savepoints);
                setSelectedSavepointId(res.savepoints[0]?.id ?? null);
            })
            .catch(() => {
                setSavepoints([]);
                setSelectedSavepointId(null);
            })
            .finally(() => setSavepointsLoading(false));

        return () => controller.abort();
    }, [deployment]);

    async function handleResume() {
        if (!deployment) {
            return;
        }

        setIsResuming(true);
        setError(null);

        try {
            if (skipSavepoint || savepoints.length === 0) {
                await resumeDeployment(deployment.deploymentName, { skipSavepoint: true });
            } else {
                await resumeDeployment(deployment.deploymentName, { savepointId: selectedSavepointId ?? undefined });
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError((err as ApiError).message ?? 'Failed to resume deployment. Please try again.');
        } finally {
            setIsResuming(false);
        }
    }

    if (!deployment) {
        return null;
    }

    const hasSavepoint = savepoints.length > 0;
    const isLatestSelected = savepoints[0]?.id === selectedSavepointId;
    const willSkip = skipSavepoint || !hasSavepoint;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog Card */}
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
                <div className={`mb-4 flex size-10 items-center justify-center rounded-full ${!willSkip ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <MaterialIcon name={!willSkip ? 'play_arrow' : 'warning'} className={!willSkip ? 'text-emerald-600' : 'text-amber-600'} size={20} />
                </div>

                <h2 className="text-base font-semibold text-zinc-900">
                    {hasSavepoint ? 'Resume this deployment?' : 'No savepoint found'}
                </h2>

                <p className="mt-1.5 text-sm text-zinc-500">
                    <span className="font-mono font-medium text-zinc-800">{deployment.deploymentName}</span>
                    {' '}
                    {hasSavepoint
                    ? 'can resume from a savepoint below and continue processing where it left off.'
                    : 'has no savepoint from the previous stop. Resuming will restart the job from the beginning. Any previous processing state will be lost.'}
                </p>

                {!hasSavepoint && (
                    <p className="mt-1.5 text-xs text-zinc-400">
                        Use the regular Stop action in future to create a savepoint before stopping.
                    </p>
                )}

                {savepointsLoading && (
                    <p className="mt-3 text-xs text-zinc-400">Loading savepoint history...</p>
                )}

                {hasSavepoint && !savepointsLoading && (
                    <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-zinc-200">
                        {savepoints.map((sp) => (
                            <label
                                key={sp.id}
                                className={`flex cursor-pointer items-start gap-2 border-b border-zinc-100 px-3 py-2 text-xs last:border-b-0 ${
                                    !skipSavepoint && selectedSavepointId === sp.id ? 'bg-emerald-50' : ''
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="savepoint"
                                    className="mt-0.5"
                                    checked={!skipSavepoint && selectedSavepointId === sp.id}
                                    onChange={() => {
                                        setSkipSavepoint(false);
                                        setSelectedSavepointId(sp.id);
                                    }}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-mono text-zinc-700">{sp.path}</div>
                                    <div className="text-zinc-400">{SOURCE_LABEL[sp.source]} · {formatDate(sp.createdAt)}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                {hasSavepoint && !skipSavepoint && !isLatestSelected && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Resuming from an older savepoint may replay data already processed since this point.
                    </p>
                )}

                {hasSavepoint && (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
                        <input
                            type="checkbox"
                            checked={skipSavepoint}
                            onChange={(e) => setSkipSavepoint(e.target.checked)}
                        />
                        Start without savepoint (discard all state and restart from scratch)
                    </label>
                )}

                {error && (
                    <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={isResuming}>
                        Cancel
                    </Button>

                    <Button size="sm" onClick={handleResume} disabled={isResuming || savepointsLoading} className={!willSkip ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}>
                        {isResuming && (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />
                        )}

                        {isResuming ? 'Resuming...' : willSkip ? 'Start from Scratch' : 'Resume'}
                    </Button>
                </div>
            </div>
        </div>, document.body
    )
}