import type { Deployment } from "@/types";
import { useState, useEffect } from "react";
import { resumeDeployment } from '@/api/flink';
import { createPortal } from 'react-dom';
import { MaterialIcon } from "./MaterialIcon";
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/api/client';

interface ResumeProps {
    deployment: Deployment | null
    onClose: () => void
    onSuccess: () => void
}

export function ResumeDeploymentDialog({ deployment, onClose, onSuccess }: ResumeProps) {
    const [isResuming, setIsResuming] = useState(false);
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (deployment) {
            setError(null);
        }
    }, [deployment]);

    async function handleResume() {
        if (!deployment) {
            return;
        }

        setIsResuming(true);
        setError(null);

        try {
            await resumeDeployment(deployment.deploymentName);
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

    const hasSavepoint = deployment.hasSavepoint ?? false;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog Card */}
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
                <div className={`mb-4 flex size-10 items-center justify-center rounded-full ${hasSavepoint ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <MaterialIcon name={hasSavepoint ? 'play_arrow' : 'warning'} className={hasSavepoint ? 'text-emerald-600' : 'text-amber-600'} size={20} />
                </div>

                <h2 className="text-base font-semibold text-zinc-900">
                    {hasSavepoint ? 'Resume this deployment?' : 'No savepoint found'}
                </h2>

                <p className="mt-1.5 text-sm text-zinc-500">
                    <span className="font-mono font-medium text-zinc-800">{deployment.deploymentName}</span>
                    {' '}
                    {hasSavepoint
                    ? 'will resume from the last savepoint and continue processing where it left off.'
                    : 'has no savepoint from the previous stop. Resuming will restart the job from the beginning. Any previous processing state will be lost.'}
                </p>

                {!hasSavepoint && (
                    <p className="mt-1.5 text-xs text-zinc-400">
                        Use the regular Stop action in future to create a savepoint before stopping.
                    </p>
                )}

                {error && (
                    <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={isResuming}>
                        Cancel
                    </Button>

                    <Button size="sm" onClick={handleResume} disabled={isResuming} className={hasSavepoint ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}>
                        {isResuming && (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />
                        )}

                        {isResuming ? 'Resuming...' : hasSavepoint ? 'Resume' : 'Start from Scratch'}
                    </Button>
                </div>
            </div>
        </div>, document.body
    )
}