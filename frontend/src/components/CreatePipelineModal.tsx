import { useState, useEffect, useRef } from 'react'
import { createDeployment, type CreateDeploymentPayload } from '@/api/flink'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
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

export default function CreatePipelineModal({ isOpen, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL)
      setErrors({})
      setTouched({})
      setShowAdvanced(false)
      setApiError(null)
      setSubmitting(false)
      setTimeout(() => nameRef.current?.focus(), 60)
    }
  }, [isOpen])

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
    setApiError(null)
    try {
      const deployment = await createDeployment(buildPayload(form))
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create pipeline. Check the values and try again.'
      setApiError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Create Pipeline"
        className={`fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Create Pipeline</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Deploy a new Apache Flink job to Kubernetes</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            <section className="space-y-4">
              <SectionHeading icon={<GridIcon />} label="Basic" />

              <Field label="Pipeline Name">
                <Input
                  ref={nameRef}
                  aria-invalid={!!errors.deploymentName}
                  placeholder="my-flink-job"
                  value={form.deploymentName}
                  onChange={e => set('deploymentName', e.target.value)}
                  onBlur={() => blur('deploymentName')}
                  spellCheck={false}
                />
              </Field>

              <Field label="Namespace">
                <Input
                  aria-invalid={!!errors.namespace}
                  placeholder="default"
                  value={form.namespace}
                  onChange={e => set('namespace', e.target.value)}
                  onBlur={() => blur('namespace')}
                  spellCheck={false}
                />
              </Field>

              <Field label="Mode">
                <div className="flex rounded-md border border-zinc-200 overflow-hidden w-fit">
                  {(['session', 'application'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('mode', m)}
                      className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                        form.mode === m
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  {form.mode === 'session'
                    ? 'Shared cluster for multiple jobs, no jar required.'
                    : 'Dedicated cluster per job, jar name required.'}
                </p>
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
                  />
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
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}>
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Advanced
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Flink Version">
                      <Input aria-invalid={!!errors.flinkVersion} placeholder="v1_19"
                        value={form.flinkVersion} onChange={e => set('flinkVersion', e.target.value)}
                        onBlur={() => blur('flinkVersion')} spellCheck={false} />
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
                      onBlur={() => blur('serviceAccount')} spellCheck={false} />
                  </Field>
                </div>
              )}
            </section>

            {apiError && <div className="error-banner">{apiError}</div>}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-2">
              {submitting && <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {submitting ? 'Creating…' : 'Create Pipeline'}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-600">{label}</label>
      {children}
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <rect x="0.5" y="0.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6.5" y="0.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="0.5" y="6.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6.5" y="6.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

