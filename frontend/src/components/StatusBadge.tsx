import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DeploymentStatus } from '@/types'

interface Props {
  status: DeploymentStatus
  className?: string
}

const statusConfig: Record<DeploymentStatus, { label: string; className: string; dotClassName: string }> = {
  running:        {   label: 'Running',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200',   dotClassName: 'bg-emerald-500'  },
  creating:       {   label: 'Creating',      className: 'bg-blue-50 text-blue-700 border-blue-200',            dotClassName: 'bg-blue-500'     },
  suspended:      {   label: 'Suspended',     className: 'bg-amber-50 text-amber-700 border-amber-200',         dotClassName: 'bg-amber-500'    },
  succeeded:      {   label: 'Succeeded',     className: 'bg-green-50 text-green-700 border-green-200',         dotClassName: 'bg-green-500'    },
  failed:         {   label: 'Failed',        className: 'bg-red-50 text-red-700 border-red-200',               dotClassName: 'bg-red-500'      },
  deleting:       {   label: 'Deleting',      className: 'bg-orange-50 text-orange-700 border-orange-200',      dotClassName: 'bg-orange-500'   },
  deleted:        {   label: 'Deleted',       className: 'bg-zinc-100 text-zinc-600 border-zinc-200',           dotClassName: 'bg-zinc-400'     },
  rolling_back:   {   label: 'Rolling Back',  className: 'bg-indigo-50 text-indigo-700 border-indigo-200',      dotClassName: 'bg-indigo-500'   },
  unknown:        {   label: 'Unknown',       className: 'bg-zinc-50 text-zinc-500 border-zinc-200',            dotClassName: 'bg-zinc-300'     },
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
