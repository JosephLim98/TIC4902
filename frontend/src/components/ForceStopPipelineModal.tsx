import type { Deployment } from "@/types";
import { useState, useEffect } from "react";
import { forceStopDeployment } from '@/api/flink'
import { createPortal } from 'react-dom'
import { MaterialIcon } from "./MaterialIcon";
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/api/client';

interface ForceStopProps {
    deployment: Deployment | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function ForceStopDeploymentDialog({ deployment, onClose, onSuccess }: ForceStopProps) {
    const [isStopping, setIsStopping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (deployment) {
            setError(null);
        }
    }, [deployment]);

    async function handleForceStop() {
        if (!deployment) {
            return;
        }

        setIsStopping(true);
        setError(null);

        try {
            await forceStopDeployment(deployment.deploymentName);
            onSuccess();
            onClose();
        } catch (err) {
            setError((err as ApiError).message ?? 'Failed to force stop deployment. Please try again.');
        } finally {
            setIsStopping(false);
        }
    };

    if (!deployment) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog Card */}
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-amber-100">
                    <MaterialIcon name="power_settings_new" className="text-amber-600" size={20} />
                </div>

                <h2 className="text-base font-semibold text-zinc-900">Force stop this deployment?</h2>

                <p className="mt-1.5 text-sm text-zinc-500">
                    <span className="font-mono font-medium text-zinc-800">{deployment.deploymentName}</span>
                    { ' ' } will be stopped immediately <strong>without</strong> taking a savepoint. Any in-flight state since the last checkpoint will be lost.
                </p>

                <p className="mt-1.5 text-xs text-zinc-400">
                    Use the regular Stop action instead if you want a savepoint taken first.
                </p>

                {error && (
                    <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={isStopping}>Cancel</Button>

                    <Button size="sm" onClick={handleForceStop} disabled={isStopping} className="bg-amber-600 hover:bg-amber-700 text-white">
                        {isStopping && (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />
                        )}
                        {isStopping ? 'Force stopping...' : 'Force Stop'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}