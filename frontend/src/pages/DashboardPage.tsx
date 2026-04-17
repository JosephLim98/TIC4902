import { useEffect, useMemo, useState } from 'react'
import { listDeployments } from '@/api/flink'
import type { Deployment } from '@/types'
import DeploymentTable from '@/components/DeploymentTable'
import CreateUpdatePipelineModal from '@/components/CreateUpdatePipelineModal.js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from '@/components/MaterialIcon'
import { DEPLOYMENT_STATUS, type DeploymentStatus } from '../../../utils/constants.js';

type FilterType = DeploymentStatus | 'all'

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [editDeployment, setEditDeployment] = useState<Deployment | null>(null)
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

  const stats = useMemo(() => {
    return {
      total: deployments.length,
      running: deployments.filter(d => d.status === DEPLOYMENT_STATUS.RUNNING).length,
      stopped: deployments.filter(d => d.status === DEPLOYMENT_STATUS.SUSPENDED).length,
      failed: deployments.filter(d => d.status === DEPLOYMENT_STATUS.FAILED).length,
      deleted: deployments.filter(d => d.status === DEPLOYMENT_STATUS.DELETED).length
    }
  }, [deployments])

  const filtered = useMemo(() => {
    return deployments.filter((d) => {
      const matchesSearch = d.deploymentName.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || d.status === filter;
      return matchesSearch && matchesFilter;
    })
  }, [deployments, search, filter])

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
    <div className="flex flex-col gap-6 flex-1 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Pipelines</h1>
            {/* {!loading && (
              <span className="count-badge">{filtered.length}</span>
            )} */}
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">Apache Flink streaming deployments</p>
        </div>
        <Button variant="default" size="sm" onClick={() => setModalOpen(true)}>
          + Create Pipeline
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Pipelines', value: stats.total, color: 'text-zinc-900' },
          { label: 'Running', value: stats.running, color: 'text-emerald-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
          { label: 'Deleted', value: stats.deleted, color: 'text-zinc-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-medium text-zinc-500 uppercase">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar: Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 w-full md:w-auto overflow-x-auto">
          {(['all', 'creating', 'running', 'failed', 'deleting', 'deleted'] as const).map((t) => {
            const count = t === 'all' 
              ? deployments.length 
              : deployments.filter(d => d.status === t).length;

            return (
              <button
                key={t}
                onClick={() => { setFilter(t); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize whitespace-nowrap flex items-center gap-3 transition-all ${
                  filter === t 
                    ? 'bg-white text-zinc-950 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
                }`}
              >
                {/* Label */}
                <span>{t}</span>
                
                {/* Count Badge - only show if > 0 or if it's the 'all' tab */}
                {(count > 0 || t === 'all') && (
                  <span className={`
                    text-[10px] px-1.5 py-0.5 rounded-full font-bold
                    ${filter === t 
                      ? 'bg-zinc-100 text-zinc-600' 
                      : 'bg-zinc-200/60 text-zinc-400'
                    }
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search */}
        <div className="relative w-full md:w-72">
          <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <Input
            className="pl-9 h-9"
            placeholder="Search pipelines..."
            value={search}
            onChange={(e) => { handleSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl bg-red-50/50">
          <MaterialIcon name="error" className="text-red-300 text-5xl mb-3" />
          <h3 className="text-base font-semibold text-red-900">{error}</h3>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
          <div className="animate-spin h-5 w-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
          <p className="text-sm font-medium">Fetching deployments...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
          <MaterialIcon name="data_object" className="text-zinc-300 text-5xl mb-3" />
          <h3 className="text-base font-semibold text-zinc-900">No pipelines found</h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            {search 
              ? `No results for "${search}". Try a different keywords.` 
              : filter !== 'all' 
              ? `There are currently no pipelines with the status "${filter}".` 
              : "Get started by creating your first Apache Flink pipeline."}
          </p>
          {!search && filter === 'all' && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
              + Create First Pipeline
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <DeploymentTable deployments={paginatedDeployments} 
            onEdit={(d) => {
              setEditDeployment(d);
              setModalOpen(true);
            }} 
            onDeleted={() => fetchDeployments()} />
          
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-zinc-500">
              Showing {startIdx + 1}-{endIdx} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" size="sm" 
                disabled={safePage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" size="sm" 
                disabled={safePage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateUpdatePipelineModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditDeployment(null);
        }}
        onCreated={() => {
          fetchDeployments();
          setEditDeployment(null);
        }}
        initialData={editDeployment}
      />
    </div>
  )
}
