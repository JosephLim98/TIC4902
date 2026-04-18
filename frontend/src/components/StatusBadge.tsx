import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DeploymentStatus } from '@/types'

interface Props {
  status: DeploymentStatus
  className?: string
}

const statusConfig: Record<DeploymentStatus, { label: string; className: string; dotClassName: string }> = {
  running:  {   label: 'Running',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotClassName: 'bg-emerald-500' },
  creating: {   label: 'Creating',    className: 'bg-blue-50 text-blue-700 border-blue-200',          dotClassName: 'bg-blue-500' },
  suspended: {  label: 'Suspended',   className: 'bg-amber-50 text-amber-700 border-amber-200',       dotClassName: 'bg-amber-500' },
  failed:   {   label: 'Failed',      className: 'bg-red-50 text-red-700 border-red-200',             dotClassName: 'bg-red-500' },
  deleting: {   label: 'Deleting',    className: 'bg-amber-50 text-amber-700 border-amber-200',       dotClassName: 'bg-amber-500' },
  deleted:  {   label: 'Deleted',     className: 'bg-zinc-100 text-zinc-500 border-zinc-200',         dotClassName: 'bg-zinc-400' },
}

export default function StatusBadge({ status, className }: Props) {
  const cfg = statusConfig[status] ?? statusConfig.deleted
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-md text-xs font-medium', cfg.className, className)}
    >
      <span className={cn('size-1.5 rounded-full', cfg.dotClassName)} />
      {cfg.label}
    </Badge>
  )
}
