import { useEffect, useMemo, useState } from 'react'
import { listDeployments } from '@/api/flink'
import type { Deployment } from '@/types'
import DeploymentTable from '@/components/DeploymentTable'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listDeployments(controller.signal)
      .then(({ deployments, total }) => {
        setDeployments(deployments)
        setTotal(total)
      })
      .catch((err) => {
        if (err?.name !== 'CanceledError') setError('Failed to load pipelines. Try again later...')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return deployments.filter((d) => d.deploymentName.toLowerCase().includes(term))
  }, [deployments, search])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Pipelines</h1>
            {!loading && (
              <span className="count-badge">{total}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">Apache Flink streaming deployments</p>
        </div>
        <Button disabled variant="default" size="sm" className="opacity-50 cursor-not-allowed">
          + Create Pipeline
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="m9.5 9.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <Input
            className="pl-8 text-sm h-8 bg-white"
            placeholder="Search pipelines…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="loading-row">
          <div className="spinner" />
          Loading pipelines…
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && <DeploymentTable deployments={filtered} />}
    </div>
  )
}
