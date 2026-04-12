import { useEffect, useMemo, useState } from 'react'
import { listDeployments } from '@/api/flink'
import DeploymentTable from '@/components/DeploymentTable'
import CreatePipelineModal from '@/components/CreatePipelineModal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  async function fetchDeployments(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const { deployments } = await listDeployments(signal)
      setDeployments(deployments)
    } catch (err) {
      if ((err as { name?: string })?.name !== 'CanceledError')
        setError('Failed to load pipelines. Try again later...')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchDeployments(controller.signal)
    return () => controller.abort()
  }, [])

  function handleCreated() {
    fetchDeployments()
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return deployments.filter((d) => d.deploymentName.toLowerCase().includes(term))
  }, [deployments, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * itemsPerPage
  const endIdx = Math.min(safePage * itemsPerPage, filtered.length)

  const paginatedDeployments = useMemo(() => {
    return filtered.slice(startIdx, endIdx)
  }, [filtered, startIdx, endIdx])

  function handleSearch(value: string) {
    setSearch(value)
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Pipelines</h1>
            {!loading && (
              <span className="count-badge">{filtered.length}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">Apache Flink streaming deployments</p>
        </div>
        <Button variant="default" size="sm" onClick={() => setModalOpen(true)}>
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
            onChange={(e) => handleSearch(e.target.value)}
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

      {!loading && !error && <DeploymentTable deployments={paginatedDeployments} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            Showing {startIdx + 1} to {endIdx} of {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              ← Previous
            </Button>
            <span className="px-3 text-sm text-zinc-600">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      <CreatePipelineModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
