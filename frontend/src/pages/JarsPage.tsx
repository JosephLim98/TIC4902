import { useEffect, useMemo, useRef, useState } from 'react'
import { listJars, uploadJar, type Jar } from '@/api/jar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from '@/components/MaterialIcon'
import { DeleteJarDialog } from '@/components/DeleteJarDialog'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function JarsPage() {
  const [jars, setJars] = useState<Jar[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Jar | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchJars(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const { jars } = await listJars(signal)
      setJars(jars)
    } catch (err) {
      if ((err as { name?: string })?.name !== 'CanceledError')
        setError('Failed to load jars. Try again later...')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchJars(controller.signal)
    return () => controller.abort()
  }, [])

  const stats = useMemo(() => ({
    total: jars.length,
    totalBytes: jars.reduce((sum, j) => sum + Number(j.sizeBytes), 0),
  }), [jars])

  const filtered = useMemo(() =>
    jars.filter(j => j.name.toLowerCase().includes(search.toLowerCase())),
    [jars, search]
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    setUploadError(null)
    setUploadProgress(0)
    try {
      await uploadJar(file, (pct) => setUploadProgress(pct))
      await fetchJars()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setUploadError(msg ?? 'Upload failed. Only .jar files are accepted.')
    } finally {
      setUploadProgress(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Jars</h1>
          <p className="mt-0.5 text-sm text-zinc-400">JAR files used for Flink application deployments</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="default"
            size="sm"
            disabled={uploadProgress !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadProgress !== null ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Uploading {uploadProgress}%
              </span>
            ) : (
              '+ Upload JAR'
            )}
          </Button>
          {uploadError && (
            <p className="text-xs text-red-500 max-w-xs text-right">{uploadError}</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jar"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Total JARs', value: stats.total, color: 'text-zinc-900' },
          { label: 'Total Size', value: formatBytes(stats.totalBytes), color: 'text-blue-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-medium text-zinc-500 uppercase">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full md:w-72">
        <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <Input
          className="pl-9 h-9"
          placeholder="Search jars..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          <p className="text-sm font-medium">Fetching jars...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
          <MaterialIcon name="inventory_2" className="text-zinc-300 text-5xl mb-3" />
          <h3 className="text-base font-semibold text-zinc-900">No jars found</h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto mt-1">
            {search
              ? `No results for "${search}".`
              : 'Upload a .jar file to get started.'}
          </p>
          {!search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
              + Upload JAR
            </Button>
          )}
        </div>
      ) : (
        <div className="table-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="table-col-header px-4 py-3 text-left">Name</th>
                <th className="table-col-header px-4 py-3 text-left">Size</th>
                <th className="table-col-header px-4 py-3 text-left">Uploaded</th>
                <th className="table-col-header px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((jar) => (
                <tr key={jar.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <MaterialIcon name="inventory_2" className="text-zinc-400 shrink-0" size={16} />
                      <span className="font-medium text-zinc-800 font-mono text-xs truncate max-w-sm">{jar.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 tabular-nums">{formatBytes(Number(jar.sizeBytes))}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(jar.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => setDeleteTarget(jar)}
                    >
                      <MaterialIcon name="delete" size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteJarDialog
        jar={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => fetchJars()}
      />
    </div>
  )
}
