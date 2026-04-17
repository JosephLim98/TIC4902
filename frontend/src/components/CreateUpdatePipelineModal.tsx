import { useState, useEffect, useRef } from 'react'
import { createDeployment, type CreateDeploymentPayload, updateDeployment, type UpdateDeploymentPayload } from '@/api/flink'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MaterialIcon } from './MaterialIcon'
import type { Deployment } from '@/types'
import type { FlinkMode } from '../../../utils/constants'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  initialData?: Deployment | null
}

interface FormState {
  deploymentName: string
  namespace: string
  mode: 'session' | 'application'
  jarName: string
  flinkVersion: string
  image: string
  jobParallelism: string
  serviceAccount: string
  jmMemory: string
  jmCpu: string
  tmMemory: string
  tmCpu: string
  tmReplicas: string
  tmTaskSlots: string
}

const INITIAL: FormState = {
  deploymentName: '',
  namespace: '',
  mode: 'session',
  jarName: '',
  flinkVersion: '',
  image: '',
  jobParallelism: '',
  serviceAccount: '',
  jmMemory: '',
  jmCpu: '',
  tmMemory: '',
  tmCpu: '',
  tmReplicas: '',
  tmTaskSlots: '',
}

const ALL_TOUCHED = Object.keys(INITIAL).reduce<Record<string, boolean>>(
  (acc, k) => ({ ...acc, [k]: true }),
  {}
)

const DNS_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
const MEMORY_RE = /^[1-9][0-9]*(m|g|M|G)$/

function validateForm(f: FormState): Record<string, string> {
  const errs: Record<string, string> = {}

  if (!f.deploymentName.trim()) {
    errs.deploymentName = 'Name is required'
  } else if (!DNS_RE.test(f.deploymentName)) {
    errs.deploymentName = 'Lowercase alphanumeric + hyphens, no leading/trailing hyphen'
  }

  if (f.namespace && !DNS_RE.test(f.namespace)) {
    errs.namespace = 'Lowercase alphanumeric + hyphens, no leading/trailing hyphen'
  }

  if (f.mode === 'application' && !f.jarName.trim()) {
    errs.jarName = 'Jar name is required for application mode'
  } else if (f.jarName && !DNS_RE.test(f.jarName)) {
    errs.jarName = 'Lowercase alphanumeric + hyphens, no leading/trailing hyphen'
  }

  if (f.jmMemory && !MEMORY_RE.test(f.jmMemory)) errs.jmMemory = 'e.g. 1600m or 2g'
  if (f.tmMemory && !MEMORY_RE.test(f.tmMemory)) errs.tmMemory = 'e.g. 1600m or 2g'

  if (f.jmCpu && (isNaN(Number(f.jmCpu)) || Number(f.jmCpu) < 0.1)) errs.jmCpu = 'Min 0.1'
  if (f.tmCpu && (isNaN(Number(f.tmCpu)) || Number(f.tmCpu) < 0.1)) errs.tmCpu = 'Min 0.1'

  if (f.tmReplicas && (!Number.isInteger(Number(f.tmReplicas)) || Number(f.tmReplicas) < 1)) {
    errs.tmReplicas = 'Must be a positive integer'
  }
  if (f.tmTaskSlots && (!Number.isInteger(Number(f.tmTaskSlots)) || Number(f.tmTaskSlots) < 1)) {
    errs.tmTaskSlots = 'Must be a positive integer'
  }
  if (f.jobParallelism) {
    const v = Number(f.jobParallelism)
    if (!Number.isInteger(v) || v < 1 || v > 1024) errs.jobParallelism = '1–1024'
  }

  return errs
}

function buildPayload(f: FormState): CreateDeploymentPayload {
  const p: CreateDeploymentPayload = { deploymentName: f.deploymentName }

  if (f.namespace) p.namespace = f.namespace
  if (f.mode === 'application' && f.jarName) p.jarName = f.jarName
  if (f.jobParallelism) p.jobParallelism = Number(f.jobParallelism)

  const cfg: NonNullable<CreateDeploymentPayload['config']> = {}
  if (f.image) cfg.image = f.image
  if (f.flinkVersion) cfg.flinkVersion = f.flinkVersion
  if (f.serviceAccount) cfg.serviceAccount = f.serviceAccount

  const jm: NonNullable<typeof cfg.jobManager> = {}
  if (f.jmMemory) jm.memory = f.jmMemory
  if (f.jmCpu) jm.cpu = Number(f.jmCpu)
  if (Object.keys(jm).length) cfg.jobManager = jm

  const tm: NonNullable<typeof cfg.taskManager> = {}
  if (f.tmMemory) tm.memory = f.tmMemory
  if (f.tmCpu) tm.cpu = Number(f.tmCpu)
  if (f.tmReplicas) tm.replicas = Number(f.tmReplicas)
  if (f.tmTaskSlots) tm.taskSlots = Number(f.tmTaskSlots)
  if (Object.keys(tm).length) cfg.taskManager = tm

  if (Object.keys(cfg).length) p.config = cfg

  return p
}

export default function CreateUpdatePipelineModal({ isOpen, onClose, onCreated, initialData }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Populate form for edit mode
        setForm({
          deploymentName: initialData.deploymentName || '',
          namespace: initialData.namespace || '',
          mode: initialData.deploymentMode as FlinkMode,
          jarName: initialData.jarName || '',
          flinkVersion: initialData.config?.flinkVersion || '',
          image: initialData.config?.image || '',
          jobParallelism: String(initialData.jobParallelism || ''),
          serviceAccount: initialData.config?.serviceAccount || '',
          jmMemory: initialData.config?.jobManager?.memory || '',
          jmCpu: String(initialData.config?.jobManager?.cpu || ''),
          tmMemory: initialData.config?.taskManager?.memory || '',
          tmCpu: String(initialData.config?.taskManager?.cpu || ''),
          tmReplicas: String(initialData.config?.taskManager?.replicas || ''),
          tmTaskSlots: String(initialData.config?.taskManager?.taskSlots || ''),
        })
      } else {
        setForm(INITIAL)
      }
      setErrors({})
      setTouched({})
      setShowAdvanced(false)
      setServerError(null)
      setSubmitting(false)
      setTimeout(() => nameRef.current?.focus(), 60)
    }
  }, [isOpen, initialData])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  function set(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value }
    if (field === 'jobParallelism') next.tmTaskSlots = value
    setForm(next)
    if (touched[field]) {
      const errs = validateForm(next)
      setErrors(prev => ({ ...prev, [field]: errs[field] ?? '' }))
    }
  }

  function blur(field: keyof FormState) {
    setTouched(prev => ({ ...prev, [field]: true }))
    const errs = validateForm(form)
    setErrors(prev => ({ ...prev, [field]: errs[field] ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(ALL_TOUCHED)
    const errs = validateForm(form)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    setSubmitting(true)
    setServerError(null);

    try {
      if (initialData) {
        // Edit mode 
        // Immutable fields such as namespace, flinkVersion, serviceAccount, deploymentName, deploymentMode and jarName are excluded from the payload
        const cfg: UpdateDeploymentPayload['config'] = {}
        
        if (form.image) { cfg.image = form.image }

        const jm: NonNullable<typeof cfg.jobManager> = {}
        if (form.jmMemory) { jm.memory = form.jmMemory }
        if (form.jmCpu) { jm.cpu = Number(form.jmCpu) }
        if (Object.keys(jm).length) { cfg.jobManager = jm }

        const tm: NonNullable<typeof cfg.jobManager> = {}
        if (form.tmMemory) { tm.memory = form.tmMemory; }
        if (form.tmCpu) { tm.cpu = Number(form.tmCpu); }
        if (form.tmReplicas) { tm.replicas = Number(form.tmReplicas) }
        if (form.tmTaskSlots) { tm.taskSlots = Number(form.tmTaskSlots) }
        if (Object.keys(tm).length) { cfg.taskManager = tm }

        const payload: UpdateDeploymentPayload = {}
        if (form.jobParallelism) { payload.jobParallelism = Number(form.jobParallelism) }
        if (Object.keys(cfg).length) { payload.config = cfg }

        console.log('Updating deployment with payload: ', payload)
        await updateDeployment(initialData.deploymentName, payload)
      } else {
        await createDeployment(buildPayload(form))
      }
      onCreated()
      onClose()
    } catch (err: any) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || "An unexpected error occurred";
        // (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        // `Failed to ${initialData ? 'update' : 'create'} pipeline. Check the values and try again.`
      setServerError(message);
        // setServerError(typeof message === 'object' ? JSON.stringify(message) : message);
    } finally { 
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={initialData ? 'Edit Pipeline' : 'Create Pipeline'}
        className={`fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'  // ← shadow only when open
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              {initialData ? 'Edit Pipeline' : 'Create Pipeline'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {initialData
                ? `Update configuration for ${initialData.deploymentName}`
                : 'Deploy a new Apache Flink job to Kubernetes'
              }
            </p>
            {/* <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Create Pipeline</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Deploy a new Apache Flink job to Kubernetes</p> */}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            <section className="space-y-4">
              <SectionHeading icon={<MaterialIcon name="grid_view" size={14} />} label="Basic" />

              <Field label="Pipeline Name" error={errors.deploymentName}>
                {/* Since the Pipeline Name is the unique identifier (PK) in the database and the name of the CRD in K8s, we should not change the name. 
                    Changing the name will result in the patch call trying to find a resource with the new name, which will return a 404 Not Found error
                    Hence, we will disable this field during update. */}
                <Input
                  ref={nameRef}
                  aria-invalid={!!errors.deploymentName}
                  placeholder="my-flink-job"
                  value={form.deploymentName}
                  onChange={e => set('deploymentName', e.target.value)}
                  onBlur={() => blur('deploymentName')}
                  spellCheck={false}
                  disabled={!!initialData}    // Read only if updating
                  className={initialData ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </Field>

              {/* In K8s, we cannot move an existing object from one namespace to another. 
                  Updating this field will result in the backend trying to look for the original namespace in the new namespace. It will fail to find the object and crash. 
                  Hence, we will disable this field during update. */}
              <Field label="Namespace">
                <Input
                  aria-invalid={!!errors.namespace}
                  placeholder="default"
                  value={form.namespace}
                  onChange={e => set('namespace', e.target.value)}
                  onBlur={() => blur('namespace')}
                  spellCheck={false}
                  disabled={!!initialData}
                  className={initialData ? 'opacity-60 cursor-not-allowed' : ''}
                />
              </Field>

              <Field label="Mode">
                <div className="flex rounded-md border border-zinc-200 overflow-hidden w-fit">
                  {(['session', 'application'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => !initialData && set('mode', m)}
                      disabled={!!initialData}
                      className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                        form.mode === m
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                      } ${initialData ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {initialData ? (
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Deployment mode cannot be changed after creation.
                  </p>
                ) : (
                  <p>
                    {/* {form.mode === 'session'
                      ? 'Shared cluster for multiple jobs, no jar required.'
                      : 'Dedicated cluster per job, jar name required.'} */}
                  </p>
                )}
                
              </Field>

              {form.mode === 'application' && (
                <Field label="Jar Name">
                  <Input
                    aria-invalid={!!errors.jarName}
                    placeholder="my-flink-job-1-0"
                    value={form.jarName}
                    onChange={e => set('jarName', e.target.value)}
                    onBlur={() => blur('jarName')}
                    spellCheck={false}
                    disabled={!!initialData}
                    className={initialData ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  {initialData && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">Jar name cannot be changed after creation.</p>
                  )}
                </Field>
              )}

              <Field label="Job Parallelism">
                <Input type="number" step="1" min="1" max="1024" aria-invalid={!!errors.jobParallelism} placeholder="1"
                  value={form.jobParallelism} onChange={e => set('jobParallelism', e.target.value)}
                  onBlur={() => blur('jobParallelism')} />
              </Field>
            </section>

            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex w-full items-center gap-2 rounded-md py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600"
              >
                <span 
                  className={`material-symbols-outlined transition-transform duration-200 ${
                    showAdvanced ? 'rotate-90' : ''
                  }`}
                  style={{ fontSize: '15px' }}
                >
                  chevron_right
                </span>
                Advanced
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Flink Version" error={initialData ? undefined : errors.flinkVersion}>
                      <Input aria-invalid={!!errors.flinkVersion} placeholder="v1_19"
                        value={form.flinkVersion} onChange={e => set('flinkVersion', e.target.value)}
                        onBlur={() => blur('flinkVersion')} spellCheck={false} 
                        disabled={!!initialData}
                        className={initialData ? 'opacity-60 cursor-not-allowed' : ''}
                      />
                      {initialData && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">Changing Flink version requires a new deployment.</p>
                      )}
                    </Field>
                    <Field label="Container Image">
                      <Input aria-invalid={!!errors.image} placeholder="flink:1.19"
                        value={form.image} onChange={e => set('image', e.target.value)}
                        onBlur={() => blur('image')} spellCheck={false} />
                    </Field>
                  </div>

                  <div>
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Job Manager</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Memory">
                        <Input aria-invalid={!!errors.jmMemory} placeholder="1600m"
                          value={form.jmMemory} onChange={e => set('jmMemory', e.target.value)} onBlur={() => blur('jmMemory')} />
                      </Field>
                      <Field label="CPU">
                        <Input type="number" step="0.1" min="0.1" aria-invalid={!!errors.jmCpu} placeholder="0.5"
                          value={form.jmCpu} onChange={e => set('jmCpu', e.target.value)} onBlur={() => blur('jmCpu')} />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Task Manager</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Memory">
                        <Input aria-invalid={!!errors.tmMemory} placeholder="1600m"
                          value={form.tmMemory} onChange={e => set('tmMemory', e.target.value)} onBlur={() => blur('tmMemory')} />
                      </Field>
                      <Field label="CPU">
                        <Input type="number" step="0.1" min="0.1" aria-invalid={!!errors.tmCpu} placeholder="1.0"
                          value={form.tmCpu} onChange={e => set('tmCpu', e.target.value)} onBlur={() => blur('tmCpu')} />
                      </Field>
                      <Field label="Replicas">
                        <Input type="number" step="1" min="1" aria-invalid={!!errors.tmReplicas} placeholder="1"
                          value={form.tmReplicas} onChange={e => set('tmReplicas', e.target.value)} onBlur={() => blur('tmReplicas')} />
                      </Field>
                      <Field label="Task Slots">
                        <Input type="number" step="1" min="1" aria-invalid={!!errors.tmTaskSlots} placeholder="2"
                          value={form.tmTaskSlots} onChange={e => set('tmTaskSlots', e.target.value)} onBlur={() => blur('tmTaskSlots')} />
                      </Field>
                    </div>
                  </div>

                  <Field label="Service Account">
                    <Input aria-invalid={!!errors.serviceAccount} placeholder="flink-service-account"
                      value={form.serviceAccount} onChange={e => set('serviceAccount', e.target.value)}
                      onBlur={() => blur('serviceAccount')} spellCheck={false} 
                      disabled={!!initialData} className={initialData ? 'opacity-60 cursor-not-allowed' : ''}
                    />
                    {initialData && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">Service account is immutable after creation.</p>
                    )}
                  </Field>
                </div>
              )}
            </section>
            
            {serverError && (<div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
              <MaterialIcon name="error" size={14} className="mt-0.5 shrink-0" />
              <span>{serverError}</span>
              </div>
            )}
            
            {/* {serverError && <div className="error-banner">{serverError}</div>} */}

            {/* {serverError && (
              <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2">
                <MaterialIcon name="error" className="size-4 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )} */}
            
            {/* {apiError && <div className="error-banner">{apiError}</div>} */}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting && <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {submitting 
                ? (initialData ? 'Updating...' : 'Creating...') 
                : (initialData ? 'Save Changes' : 'Create Pipeline')
              }
              {/* {submitting ? 'Creating...' : 'Create Pipeline'} */}
            </Button>
          </div>
        </form>
      </aside>
    </>
  )
}

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-0.5">
      <span className="flex size-5 items-center justify-center rounded bg-zinc-100 text-zinc-500">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="h-px flex-1 bg-zinc-100" />
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-600">{label}</label>
      {children}
      {error && (
        <p className="text-[11px] font-medium text-red-500 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  )
}
