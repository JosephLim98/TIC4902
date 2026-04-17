import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDeployment } from '@/api/flink'
import type { Deployment } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import { MaterialIcon } from '@/components/MaterialIcon'
import { DEPLOYMENT_STATUS } from '../../../utils/constants'
import { DeleteDeploymentDialog } from '@/components/DeletePipelineModal'

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

export default function DeploymentDetailPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
            </div>
            <Button
              variant="destructive"
              className="px-6 py-3"
              disabled={deployment.status === DEPLOYMENT_STATUS.DELETING || deployment.status === DEPLOYMENT_STATUS.DELETED}
              onClick={() => setShowDeleteModal(true)}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>

          {deployment.errorMessage && (
            <div className="error-banner">{deployment.errorMessage}</div>
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

            {deployment.flinkDeployment && (
              <Section title="Kubernetes">
                <InfoItem label="Name" value={deployment.flinkDeployment.name} />
                <InfoItem label="UID" value={deployment.flinkDeployment.uid} />
                <InfoItem label="API Version" value={deployment.flinkDeployment.apiVersion} />
              </Section>
            )}
          </div>
        </>
      )}

      <DeleteDeploymentDialog
        deployment={showDeleteModal ? deployment : null}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => navigate('/')}
      />

    </div>
  )
}
