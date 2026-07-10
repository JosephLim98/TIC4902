import { useEffect, useState } from 'react'
import { getDashboardUrl } from '@/api/flink'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from '@/components/MaterialIcon'

interface FlinkDashboardPanelProps {
  deploymentName: string
  isOpen: boolean
  onClose: () => void
}

export default function FlinkDashboardPanel({
  deploymentName,
  isOpen,
  onClose,
}: FlinkDashboardPanelProps) {
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setDashboardUrl(null)

    getDashboardUrl(deploymentName, controller.signal)
      .then((response) => {
        if (!response.available || !response.url) {
          setError(response.error ?? 'Flink dashboard is not available yet.')
          return
        }
        setDashboardUrl(response.url)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load Flink dashboard'
        setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [deploymentName, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

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
        aria-label="Flink dashboard"
        className="fixed left-1/2 top-1/2 z-50 flex h-[90vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <MaterialIcon name="dashboard" size={20} className="text-zinc-500" />
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-semibold text-zinc-900">
                {deploymentName}
              </h2>
              <p className="text-xs text-zinc-400">Apache Flink Web Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dashboardUrl && (
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <MaterialIcon name="open_in_new" size={16} />
                <span className="hidden sm:inline">Open in new tab</span>
              </a>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              <MaterialIcon name="close" size={16} className="mr-1" />
              Close
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-zinc-50">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <Spinner message="Loading Flink dashboard…" />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white p-6">
              <div className="error-banner max-w-lg">{error}</div>
            </div>
          )}
          {dashboardUrl && !loading && !error && (
            <iframe
              title="Flink Dashboard"
              src={dashboardUrl}
              className="h-full w-full border-0 bg-white"
              referrerPolicy="same-origin"
            />
          )}
        </div>
      </div>
    </>
  )
}
