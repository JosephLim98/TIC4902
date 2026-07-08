import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import StatusBadge from './StatusBadge'
import type { Deployment } from '@/types'
import { formatDate } from '@/lib/utils'
import { MaterialIcon } from './MaterialIcon'
import { Spinner } from './Spinner'
import { useState } from 'react'
import { DeleteDeploymentDialog } from './DeletePipelineModal'
import { DEPLOYMENT_STATUS, FLINK_MODE } from '@/utils/constants'
import { Button } from '@/components/ui/button'
import { stopDeployment } from '@/api/flink'
import type { ApiError } from '@/api/client'
import { ForceStopDeploymentDialog } from './ForceStopPipelineModal'
import { ResumeDeploymentDialog } from './ResumePipelineModal'

interface Props {
  deployments: Deployment[]
  onEdit?: (deployment: Deployment) => void
  onDiagnostics?: (deployment: Deployment) => void
  onDeleted?: () => void
}

export default function DeploymentTable({ deployments, onEdit, onDeleted, onDiagnostics}: Props) {
  const navigate = useNavigate()

  const [confirmDelete, setConfirmDelete] = useState<Deployment | null>(null)
  const [resumeTarget, setResumeTarget] = useState<Deployment | null>(null)
  // const [stopping, setStopping] = useState<string | null>(null)   // holds deployment name while stopping
  const [forceStopTarget, setForceStopTarget] = useState<Deployment | null>(null)
  const [stoppingName, setStoppingName] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleStop(d: Deployment) {
    setStoppingName(d.deploymentName)
    setActionError(null)
    try {
      await stopDeployment(d.deploymentName)
      // setStatusOverride(prev => ({ ...prev, [d.deploymentName]: DEPLOYMENT_STATUS.SUSPENDED }))
      onDeleted?.()   // reuse the refresh callback to refetch the list
    } catch (err) {
      setActionError((err as ApiError).message ?? `Failed to stop '${d.deploymentName}'. Please try again.`)
    } finally {
      setStoppingName(null)
    }
  }

  if (deployments.length === 0) {
    return (
      <div className="empty-state">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100">
          <MaterialIcon name="dashboard_customize" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No pipelines yet</p>
        <p className="mt-1 text-xs text-zinc-400">Create your first Flink deployment to get started</p>
      </div>
    )
  }

  return (
    <>
      {actionError && (
        <div className="error-banner mb-3">{actionError}</div>
      )}

      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="table-col-header w-[35%]">Name</TableHead>
              <TableHead className="table-col-header">Status</TableHead>
              <TableHead className="table-col-header">Mode</TableHead>
              <TableHead className="table-col-header">Namespace</TableHead>
              <TableHead className="table-col-header">Created</TableHead>
              <TableHead className="table-col-header w-[15%] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => {
              const status = d.status;
              // Backend's pendingAction is the source of truth for "an operation.  iin flight". It survives refetches/polling and can never get permanently stuck the way local component state could
              // stoppingName only covers the brief window between clicking stop and the first refetch landing
              const hasPendingAction = !!d.pendingAction || stoppingName === d.deploymentName;
              const isTerminal = status === DEPLOYMENT_STATUS.DELETED || status === DEPLOYMENT_STATUS.DELETING;
              const isActionDisabled = isTerminal || hasPendingAction;
              
              // Pipeline operations such as stop, force stop, run adn resume, are only applicable to APPLICATION mode deployments
              const isApplication = d.deploymentMode === FLINK_MODE.APPLICATION;

              // Resume only makes sense from SUSPENDED (stopped/force-stopped), failed
              // unknown can still be (re)run, but it's not the same as "resume" in the savepoint sense
              // succeeded pipelines are done. doesn't make sense to do any operations
              const canResume = isApplication && status === DEPLOYMENT_STATUS.SUSPENDED;
              const canRun = isApplication && (status === DEPLOYMENT_STATUS.FAILED || status === DEPLOYMENT_STATUS.UNKNOWN);
              const runLabel = canResume ? 'Resume' : 'Run';

              // Stop/Force Stop only makes sense while the pipeline is actively running
              const canStop = isApplication && status === DEPLOYMENT_STATUS.RUNNING;

              // Only can edit pipeline once it has settled into a terminal state and not running (excluding succeeded as succeeded is a finished state)
              const canEdit = status === DEPLOYMENT_STATUS.SUSPENDED || status === DEPLOYMENT_STATUS.FAILED;

              return (
                <TableRow
                  key={d.id}
                  onClick={() => navigate(`/deployments/${d.deploymentName}`)}
                  className="cursor-pointer transition-colors hover:bg-zinc-50/80"
                >

                  <TableCell className="font-mono text-sm font-medium text-zinc-900">
                    {d.deploymentName}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      {status === DEPLOYMENT_STATUS.FAILED && d.errorMessage && (
                        <span title={d.errorMessage}>
                          <MaterialIcon name="error" size={16} className="text-red-500" />
                        </span>
                      )}

                      {hasPendingAction && (
                        <span title={d.pendingAction ? `${d.pendingAction.replace('_', ' ')} in progress` : 'in progress'}>
                          <Spinner />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="mode-badge">{d.deploymentMode}</span>
                  </TableCell>
                  
                  <TableCell className="text-sm text-zinc-500">{d.namespace}</TableCell>
                  
                  <TableCell className="whitespace-nowrap text-sm text-zinc-400">
                    {formatDate(d.createdAt)}
                  </TableCell>
                
                  <TableCell className="text-left" onClick={ (e) => e.stopPropagation() }>
                    <div className="flex items-center justify-start gap-1 min-w-[140px] w-full">

                      {/* Resume (if suspended) / Run (if failed or unknown) Button */}
                      {(canResume || canRun) && (
                        <Button
                          variant="ghost"
                          disabled={isActionDisabled}
                          onClick={() => setResumeTarget(d)}
                          title={canResume ? 'Resume pipeline from savepoint' : `${runLabel} pipeline`}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MaterialIcon name="play_arrow" size={18} />
                        </Button>
                      )}

                      {/* Stop Button (only when running) */}
                      {canStop && (
                        <Button
                          variant="ghost"
                          disabled={isActionDisabled}
                          onClick={() => handleStop(d)}
                          title="Stop pipeline (creates savepoint)"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {stoppingName === d.deploymentName ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-300/40 border-t-amber-500 animate-spin" />
                          ) : (
                            <MaterialIcon name="pause" size={18} />
                          )}
                        </Button>
                      )}

                      {/* Force Stop Button (only when running) */}
                      {canStop && (
                        <Button
                          variant="ghost"
                          disabled={isActionDisabled}
                          onClick={() => setForceStopTarget(d)}
                          title="Force stop pipeline (skips savepoint)"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MaterialIcon name="stop" size={18} />
                        </Button>
                      )}

                      <div className="flex-1" />

                      {/* Diagnostics */}
                      {!isTerminal && (
                        <button
                          onClick={() => onDiagnostics?.(d)}
                          title="View diagnostics"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <MaterialIcon name="monitor_heart" size={18} />
                        </button>
                      )}

                      {/* Edit (only when settled into suspended/failed) */}
                      {canEdit && (
                        <button
                          disabled={isActionDisabled}
                          onClick={() => onEdit?.(d)}
                          title="Edit deployment"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-blue-100 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MaterialIcon name="edit" size={18} />
                        </button>
                      )}

                      {/* Delete */}
                      {!isActionDisabled && (
                        <button
                          disabled={isActionDisabled}
                          onClick={() => {
                            setConfirmDelete(d)
                          }}
                          title="Delete deployment"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MaterialIcon name="delete" size={18} />
                        </button>
                      )}
                      {isActionDisabled && d.pendingAction && (
                        <span className="text-[10px] text-zinc-400 px-1">{d.pendingAction.replace('_', ' ')}...</span>
                      )}
                    </div>
                  </TableCell>

                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteDeploymentDialog
        deployment={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onSuccess={() => onDeleted?.()}
      />

      <ResumeDeploymentDialog 
        deployment={resumeTarget} 
        onClose={() => setResumeTarget(null)} 
        onSuccess={() => { 
          setResumeTarget(null); 
          onDeleted?.();
        }}
      />

      <ForceStopDeploymentDialog 
        deployment={forceStopTarget}
        onClose={() => setForceStopTarget(null)}
        onSuccess={() => { 
          setForceStopTarget(null); 
          onDeleted?.(); 
        }}
      />
    </>
  )
}
