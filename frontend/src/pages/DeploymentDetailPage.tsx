import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDeployment, stopDeployment, triggerSavepoint, listSavepoints } from '@/api/flink'
import type { Deployment, Savepoint } from '@/types'
import type { ApiError } from '@/api/client'
import { formatDate } from '@/lib/utils'
import { DEPLOYMENT_STATUS, FLINK_MODE, type DeploymentStatus } from '@/utils/constants'
import StatusBadge from '@/components/StatusBadge'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MaterialIcon } from '@/components/MaterialIcon'
import { DeleteDeploymentDialog } from '@/components/DeletePipelineModal'
import CreateUpdatePipelineModal from '@/components/CreateUpdatePipelineModal'
import { ForceStopDeploymentDialog } from '@/components/ForceStopPipelineModal'
import { ResumeDeploymentDialog } from '@/components/ResumePipelineModal'
import LogViewer from '@/components/LogViewer'

interface InfoItemProps {
  label: string
  value: React.ReactNode
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="info-label">{label}</span>
      <span className="info-value">
        {value ?? <span className="text-zinc-300 font-sans">—</span>}
      </span>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <Card className="border-zinc-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </CardTitle>
      </CardHeader>
      <Separator className="mb-4" />
      <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
        {children}
      </CardContent>
    </Card>
  )
}

// Statuses where the K8s operator is actively reconciling — worth polling.
// Once a deployment settles into running/suspended/failed/deleted AND has no
// pendingAction, nothing will change on its own, so we stop polling.
const TRANSITIONING_STATUSES: DeploymentStatus[] = [
  DEPLOYMENT_STATUS.CREATING,
  DEPLOYMENT_STATUS.ROLLING_BACK,
  DEPLOYMENT_STATUS.DELETING,
  DEPLOYMENT_STATUS.UNKNOWN,
]

const POLL_INTERVAL_MS = 4000

export default function DeploymentDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showForceStopModal, setShowForceStopModal] = useState(false);

  // Only used to disable the Stop button the instant it's clicked, before the
  // next refetch comes back with the real pendingAction from the backend.
  const [stopping, setStopping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [savepointLoading, setSavepointLoading] = useState(false);
  const [savepointError, setSavepointError] = useState<string | null>(null);
  const [savepoints, setSavepoints] = useState<Savepoint[]>([]);

  function refetchSavepoints() {
    if (!name) {
      return
    }
    listSavepoints(name)
      .then((res) => setSavepoints(res.savepoints))
      .catch(() => {
        // keep showing the last known history on transient refetch failure
      })
  }

  function refetch() {
    if (!name) {
      return
    }
    getDeployment(name)
      .then(setDeployment)
      .catch(() => {
        // keep showing the last known state on transient refetch failure
      })
  }

  async function handleStop() {
    if (!deployment) {
      return
    }
    setStopping(true)
    setActionError(null)
    try {
      const updated = await stopDeployment(deployment.deploymentName)
      setDeployment(updated)
    } catch (err) {
      setActionError((err as ApiError).message ?? 'Failed to stop deployment. Please try again.')
    } finally {
      setStopping(false)
    }
  }

  useEffect(() => {
    if (!name) return
    const controller = new AbortController()
    getDeployment(name, controller.signal)
      .then(setDeployment)
      .catch((err) => {
        if (err?.name !== 'CanceledError') setError(`Could not load deployment "${name}".`)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [name])

  useEffect(() => {
    if (!name) return
    const controller = new AbortController()
    listSavepoints(name, controller.signal)
      .then((res) => setSavepoints(res.savepoints))
      .catch(() => {
        // non-fatal — State Storage section just shows no history
      })
    return () => controller.abort()
  }, [name])

  // pendingAction (from the backend) is the single source of truth for "an
  // operation is in flight" — it can never get permanently stuck the way
  // purely client-side state could, since it's whatever the server actually
  // reports right now. We poll whenever either the K8s lifecycle is actively
  // reconciling, OR the backend says an action is still pending.
  useEffect(() => {
    if (!name || !deployment) return

    const isTransitioning = TRANSITIONING_STATUSES.includes(deployment.status)
    const hasPendingAction = !!deployment.pendingAction

    if (!isTransitioning && !hasPendingAction) return

    const interval = setInterval(() => {
      refetch()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [name, deployment?.status, deployment?.pendingAction])

  const hasPendingAction = !!deployment?.pendingAction || stopping
  const pendingActionLabel = stopping
    ? 'Stopping...'
    : deployment?.pendingAction === 'stop' ? 'Stopping...'
    : deployment?.pendingAction === 'force_stop' ? 'Force stopping...'
    : deployment?.pendingAction === 'resume' ? 'Resuming...'
    : deployment?.pendingAction === 'delete' ? 'Deleting...'
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-1.5 text-zinc-500 hover:text-zinc-900 -ml-2 h-8"
        >
          <MaterialIcon name="chevron_backward" size={18} />
          Pipelines
        </Button>
      </div>

      {loading && (
        <div className="loading-row">
          <div className="spinner" />
          Loading…
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {deployment && (
        <>
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-semibold tracking-tight text-zinc-900">
                {deployment.deploymentName}
              </h1>
              <StatusBadge status={deployment.status} />
              {pendingActionLabel && (
                <Spinner message={pendingActionLabel} />
              )}
            </div>

            <div className="flex items-center gap-2">
              {deployment.deploymentMode === FLINK_MODE.APPLICATION && (
                <>

                {/* Resume — only when stopped/force stopped or failed, and nothing else in flight */}
                {deployment.status === DEPLOYMENT_STATUS.SUSPENDED && (
                  <Button variant="outline" className="px-6 py-3 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    disabled={hasPendingAction} onClick={() => setShowResumeModal(true)}>
                    <MaterialIcon name="play_arrow" size={18} className="mr-2" />
                    Resume
                  </Button>
                )}

                {/* {([DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.FAILED] as DeploymentStatus[]).includes(deployment.status) && (
                  <Button variant="outline" className="px-6 py-3 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    disabled={hasPendingAction} onClick={() => setShowResumeModal(true)}>
                    <MaterialIcon name="play_arrow" size={18} className="mr-2" />
                    Resume
                  </Button>
                )} */}

                {/* Run (for failed pipelines and those with unknown status which can be (re)started). Succeeded pipelines are completed and are intentionally excluded */}
                {([DEPLOYMENT_STATUS.FAILED, DEPLOYMENT_STATUS.UNKNOWN] as DeploymentStatus[]).includes(deployment.status) && (
                  <Button variant="outline" className="px-6 py-3 text-emerald-700 border-emerald-200 hover:bg-emerald-50" disabled={hasPendingAction} onClick={() => setShowResumeModal(true)}>
                    <MaterialIcon name="play_arrow" size={18} className="mr-2" />
                    Run
                  </Button>
                )}

                {/* Stop — only when running */}
                {([DEPLOYMENT_STATUS.RUNNING] as DeploymentStatus[]).includes(deployment.status) && (
                  <Button
                    variant="outline"
                    className="px-6 py-3"
                    disabled={hasPendingAction}
                    onClick={handleStop}
                  >
                    {stopping ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-600 mr-2" />
                    ) : (
                      <MaterialIcon name="pause" size={18} className="mr-2" />
                    )}
                    Stop
                  </Button>
                )}

                {/* Force Stop — only when running */}
                {([DEPLOYMENT_STATUS.RUNNING] as DeploymentStatus[]).includes(deployment.status) && (
                  <Button
                    variant="outline"
                    className="px-6 py-3 text-red-700 border-red-200 hover:bg-red-50"
                    disabled={hasPendingAction}
                    onClick={() => setShowForceStopModal(true)}
                  >
                    <MaterialIcon name="power_settings_new" size={18} className="mr-2" />
                    Force Stop
                  </Button>
                )}

                {/* Take Savepoint — only when running */}
                <Button
                  variant="outline"
                  className="px-6 py-3"
                  disabled={deployment.status !== DEPLOYMENT_STATUS.RUNNING || savepointLoading}
                  onClick={async () => {
                    setSavepointLoading(true);
                    setSavepointError(null);
                    try {
                      await triggerSavepoint(deployment.deploymentName);
                      refetchSavepoints();
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Savepoint failed';
                      setSavepointError(msg);
                    } finally {
                      setSavepointLoading(false);
                    }
                  }}
                >
                  {savepointLoading ? (
                    <>
                      <span className="size-3.5 rounded-full border-2 border-zinc-400 border-t-zinc-900 animate-spin mr-2" />
                      Taking Savepoint…
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="save" size={18} className="mr-2" />
                      Take Savepoint
                    </>
                  )}
                </Button>
                </>
              )}

              {/* Edit Button */}

              <Button
                variant="outline"
                className="px-6 py-3"
                disabled={hasPendingAction || !([DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.FAILED] as DeploymentStatus[]).includes(deployment.status)}
                onClick={() => { setShowEditModal(true) }}
              >
                <MaterialIcon name="edit" size={18} className="mr-2" />
                Edit
              </Button>

              <Button
                variant="destructive"
                className="px-6 py-3"
                disabled={hasPendingAction || ([DEPLOYMENT_STATUS.DELETING, DEPLOYMENT_STATUS.DELETED] as DeploymentStatus[]).includes(deployment.status)}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </Button>
            </div>
          </div>

          {actionError && (
            <div className="error-banner">{actionError}</div>
          )}

          {deployment.status === DEPLOYMENT_STATUS.FAILED && deployment.errorMessage && (
            <div className="error-banner">{deployment.errorMessage}</div>
          )}

          {savepointError && (
            <div className="error-banner">{savepointError}</div>
          )}

          <div className="flex flex-col gap-3">
            <Section title="Overview">
              <InfoItem label="Mode" value={deployment.deploymentMode} />
              <InfoItem label="Namespace" value={deployment.namespace} />
              <InfoItem label="Created" value={formatDate(deployment.createdAt, 'long')} />
              <InfoItem label="Parallelism" value={deployment.jobParallelism} />
            </Section>

            <Section title="Flink Config">
              <InfoItem label="Image" value={deployment.config?.image} />
              <InfoItem label="Version" value={deployment.config?.flinkVersion} />
              <InfoItem label="Service Account" value={deployment.config?.serviceAccount} />
            </Section>

            <Section title="Job Manager">
              <InfoItem label="Memory" value={deployment.config?.jobManager?.memory} />
              <InfoItem label="CPU" value={deployment.config?.jobManager?.cpu} />
              <InfoItem label="Replicas" value={deployment.config?.jobManager?.replicas} />
            </Section>

            <Section title="Task Manager">
              <InfoItem label="Memory" value={deployment.config?.taskManager?.memory} />
              <InfoItem label="CPU" value={deployment.config?.taskManager?.cpu} />
              <InfoItem label="Replicas" value={deployment.config?.taskManager?.replicas} />
              <InfoItem label="Task Slots" value={deployment.config?.taskManager?.taskSlots} />
            </Section>

            <LogViewer deploymentName={deployment.deploymentName} />

            {deployment.flinkDeployment && (
              <Section title="Kubernetes">
                <InfoItem label="Name" value={deployment.flinkDeployment.name} />
                <InfoItem label="UID" value={deployment.flinkDeployment.uid} />
                <InfoItem label="API Version" value={deployment.flinkDeployment.apiVersion} />
              </Section>
            )}

            {deployment.deploymentMode === 'application' && (
              <Section title="State Storage">
                <InfoItem label="State Bucket" value={deployment.stateBucketName} />
                <div className="col-span-2 flex flex-col gap-2">
                  <span className="info-label">Savepoint History</span>
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-auto">Path</TableHead>
                        <TableHead className="w-24">Source</TableHead>
                        <TableHead className="w-36">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savepoints.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-zinc-300">
                            No savepoints yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        savepoints.map((sp) => (
                          <TableRow key={sp.id}>
                            <TableCell
                              title={sp.path}
                              className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-zinc-700"
                            >
                              {sp.path}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600">
                                {sp.source}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-zinc-400">
                              {formatDate(sp.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Section>
            )}
          </div>
        </>
      )}

      <CreateUpdatePipelineModal 
        isOpen={showEditModal}
        initialData={showEditModal ? deployment : null}
        onClose={() => setShowEditModal(false)}
        onCreated={() => {
          setShowEditModal(false)
          navigate('/')
        }
        }
      />
      
      <DeleteDeploymentDialog
        deployment={showDeleteModal ? deployment : null}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => navigate('/')}
      />

      <ForceStopDeploymentDialog 
        deployment={showForceStopModal ? deployment : null}
        onClose={() => setShowForceStopModal(false)}
        onSuccess={() => {
          setShowForceStopModal(false)
          refetch()
        }}
      />

      <ResumeDeploymentDialog 
        deployment={showResumeModal ? deployment : null}
        onClose={() => setShowResumeModal(false)}
        onSuccess={() => {
          setShowResumeModal(false)
          refetch()
        }}
      />

    </div>
  )
}