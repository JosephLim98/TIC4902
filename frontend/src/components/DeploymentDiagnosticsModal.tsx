import { useEffect, useState } from 'react'
import { getDeploymentDiagnostics } from '@/api/flink'
import type { DeploymentDiagnostics } from '@/types'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from '@/components/MaterialIcon'
import type { ApiError } from '@/api/client'

interface Props {
  isOpen: boolean
  deploymentName: string | null
  onClose: () => void
}

function severityClass(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'border-red-200 bg-red-50 text-red-800'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-800'
}

function severityIcon(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'
  return 'check_circle'
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function getContainerStateLabel(state: Record<string, unknown> | null) {
  if (!state) return 'Unknown'

  if ('running' in state) return 'Running'
  if ('waiting' in state) return 'Waiting'
  if ('terminated' in state) return 'Terminated'

  return 'Unknown'
}

function getJobStatusState(jobStatus: Record<string, unknown> | null) {
  const state = jobStatus?.state;

  return typeof state === 'string' ? state : 'Unknown';
}

export default function DeploymentDiagnosticsModal({
  isOpen,
  deploymentName,
  onClose,
}: Props) {
  const [diagnostics, setDiagnostics] = useState<DeploymentDiagnostics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !deploymentName) return

    const activeDeploymentName = deploymentName
    const controller = new AbortController()
    let cancelled = false
    
    async function fetchDiagnostics(isInitial = false) {
        if (isInitial) {
          setDiagnostics(null)
          setError(null)
          setLoading(true)
        }
    
        try {
            const result = await getDeploymentDiagnostics(activeDeploymentName, controller.signal)

            if (!cancelled) {
                setDiagnostics(result)
                setError(null)
            }
        } catch (err) {
          if (controller.signal.aborted || cancelled) return
    
          const apiErr = err as ApiError
          setError(apiErr.message || 'Unable to load diagnostics')
        } finally {
          if (!controller.signal.aborted && !cancelled) {
            setLoading(false)
          }
        }
    }

    fetchDiagnostics(true)

    const interval = window.setInterval(() => {
        fetchDiagnostics(false)
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      controller.abort()
    }
  }, [isOpen, deploymentName])

  if (!isOpen) return null

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deployment diagnostics"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              Deployment diagnostics
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {deploymentName}
              {diagnostics ? ` · namespace: ${diagnostics.namespace}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close diagnostics"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <div className="mb-4 size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
              <p className="text-sm font-medium text-zinc-800">
                Checking deployment health...
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Waiting for Kubernetes to report pod and event status.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && diagnostics && (
            <div className="space-y-6">
              {diagnostics.recommendations.length > 0 && (
                <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Recommendations
                    </h3>

                    <div className="space-y-2">
                    {diagnostics.recommendations.map((rec, idx) => (
                        <div
                        key={`${rec.reason}-${idx}`}
                        className={`rounded-md border px-4 py-3 ${severityClass(rec.severity)}`}
                        >
                        <div className="flex gap-3">
                            <MaterialIcon name={severityIcon(rec.severity)} size={18} />
                            <div>
                            <p className="text-sm font-semibold">{rec.reason}</p>
                            <p className="mt-1 text-sm opacity-90">{rec.message}</p>
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>
                </section>
                )}

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Status
                </h3>

                <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile
                    label="Lifecycle"
                    value={diagnostics.status.lifecycleState || 'Unknown'}
                    tone={lifecycleTone(diagnostics.status.lifecycleState)}
                />
                <InfoTile
                    label="JobManager"
                    value={diagnostics.status.jobManagerDeploymentStatus || 'Unknown'}
                    tone={jobManagerTone(diagnostics.status.jobManagerDeploymentStatus)}
                />
                <InfoTile
                    label="Job Status"
                    value={getJobStatusState(diagnostics.status.jobStatus)}
                    tone={jobStatusTone(getJobStatusState(diagnostics.status.jobStatus))}
                />
                </div>

                {diagnostics.status.error ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
                    {JSON.stringify(diagnostics.status.error, null, 2)}
                  </pre>
                ) : null}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Pods
                </h3>

                {diagnostics.pods.length === 0 ? (
                  <EmptyState text="No related pods found yet." />
                ) : (
                  <div className="overflow-hidden rounded-md border border-zinc-200">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="w-28 px-3 py-2">Phase</th>
                          <th className="w-24 px-3 py-2">Restarts</th>
                          <th className="w-32 px-3 py-2">Container</th>
                          <th className="w-36 px-3 py-2">Started</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {diagnostics.pods.map((pod,idx) => {
                          const firstContainer = pod.containers[0]
                          return (
                            <tr key={pod.name || `pod-${idx}`} className="align-top">
                              <td className="break-words px-3 py-2 font-mono text-xs text-zinc-700">
                                {pod.name || '—'}
                              </td>
                              <td className="px-3 py-2 text-zinc-700">{pod.phase || '—'}</td>
                              <td className="px-3 py-2 text-zinc-700">{pod.restartCount}</td>
                              <td className="px-3 py-2 text-zinc-700">
                                {getContainerStateLabel(firstContainer?.state ?? null)}
                              </td>
                              <td className="px-3 py-2 text-xs text-zinc-500">
                                {formatDate(pod.startTime)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Recent events
                </h3>

                {diagnostics.events.length === 0 ? (
                  <EmptyState text="No related events found." />
                ) : (
                  <div className="space-y-2">
                    {diagnostics.events.slice(0, 8).map((event, idx) => (
                      <div
                        key={`${event.reason}-${event.objectName}-${idx}`}
                        className="rounded-md border border-zinc-200 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-800">
                              {event.reason || 'Event'}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {event.message || 'No event message'}
                            </p>
                            <p className="mt-2 text-xs text-zinc-400">
                              {event.objectKind || 'Object'} / {event.objectName || 'unknown'}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                event.type === 'Warning'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {event.type || 'Normal'}
                            </span>
                            <p className="mt-2 text-xs text-zinc-400">
                              {formatDate(event.lastSeen)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {diagnostics.conditions.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Conditions
                  </h3>

                  <div className="space-y-2">
                    {diagnostics.conditions.map((condition, idx) => (
                      <div
                        key={`${condition.type}-${idx}`}
                        className="rounded-md border border-zinc-200 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-zinc-800">
                            {condition.type || 'Condition'}
                          </p>
                          <span className="text-xs text-zinc-400">
                            {condition.status || 'Unknown'}
                          </span>
                        </div>

                        {condition.message && (
                          <p className="mt-1 text-sm text-zinc-500">
                            {condition.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-100 px-6 py-4">
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}

type InfoTone = 'neutral' | 'success' | 'warning' | 'danger'

function toneTextClass(tone: InfoTone) {
  if (tone === 'success') return 'text-emerald-600'
  if (tone === 'warning') return 'text-amber-600'
  if (tone === 'danger') return 'text-red-600'
  return 'text-zinc-800'    
}

function lifecycleTone(value: string | null): InfoTone {
  if (value === 'STABLE' || value === 'DEPLOYED') return 'success'
  if (value === 'CREATED' || value === 'RECONCILING') return 'warning'
  if (value === 'FAILED' || value === 'ROLLING_BACK') return 'danger'
  return 'neutral'
}

function jobManagerTone(value: string | null): InfoTone {
  if (value === 'READY') return 'success'
  if (value === 'DEPLOYING') return 'warning'
  if (value === 'ERROR' || value === 'MISSING') return 'danger'
  return 'neutral'
}

function jobStatusTone(value: string | null): InfoTone {
  if (value === 'RUNNING' || value === 'FINISHED') return 'success';
  if (value === 'CREATED' || value === 'INITIALIZING' || value === 'RESTARTING' || value === 'RECONCILING') return 'warning';
  if (value === 'FAILED' || value === 'FAILING' || value === 'CANCELED') return 'danger';
  return 'neutral';
}

function InfoTile({label,value,tone = 'neutral'}: {label: string;value: string;tone?: InfoTone}) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className={`mt-1 break-words text-sm font-semibold ${toneTextClass(tone)}`}>
          {value}
        </p>
      </div>
    )
  }

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  )
}