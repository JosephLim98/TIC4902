import type { Deployment } from "@/types";
import { useState } from "react";
import { deleteDeployment } from '@/api/flink'
import { createPortal } from 'react-dom'
import { MaterialIcon } from "./MaterialIcon";

interface DeleteProps {
    deployment: Deployment | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function DeleteDeploymentDialog({ deployment, onClose, onSuccess }: DeleteProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    async function handleDelete() {       
        if (!deployment) {
            return;
        }

        setIsDeleting(true);
        setError(null);
        
        try {
            await deleteDeployment(deployment.deploymentName);
            onSuccess();
            onClose();
        } catch {
            setError("Failed to delete deployment. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (!deployment) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          {/* Dialog card */}
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-red-100">
              <MaterialIcon name="delete_forever" className="text-red-600" size={20} />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">Are you sure you want to delete this deployment?</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              <span className="font-mono font-medium text-zinc-800">{deployment.deploymentName}</span>{ ' ' } will be permanently removed. 
              This action cannot be undone.
            </p>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose}
              disabled={isDeleting}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                Cancel
              </button>

              <button onClick={handleDelete} disabled={isDeleting} 
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60">
                {isDeleting && (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )

}