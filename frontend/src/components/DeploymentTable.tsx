import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import StatusBadge from './StatusBadge'
import type { Deployment } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  deployments: Deployment[]
}

export default function DeploymentTable({ deployments }: Props) {
  const navigate = useNavigate()

  if (deployments.length === 0) {
    return (
      <div className="empty-state">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="#71717a" strokeWidth="1.4" />
            <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="#71717a" strokeWidth="1.4" />
            <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="#71717a" strokeWidth="1.4" />
            <path d="M13 10v6M10 13h6" stroke="#71717a" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-700">No pipelines yet</p>
        <p className="mt-1 text-xs text-zinc-400">Create your first Flink deployment to get started</p>
      </div>
    )
  }

  return (
    <div className="table-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-50 hover:bg-zinc-50">
            <TableHead className="table-col-header w-[35%]">Name</TableHead>
            <TableHead className="table-col-header">Status</TableHead>
            <TableHead className="table-col-header">Mode</TableHead>
            <TableHead className="table-col-header">Namespace</TableHead>
            <TableHead className="table-col-header">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map((d) => (
            <TableRow
              key={d.id}
              onClick={() => navigate(`/deployments/${d.deploymentName}`)}
              className="cursor-pointer transition-colors hover:bg-zinc-50/80"
            >
              <TableCell className="font-mono text-sm font-medium text-zinc-900">
                {d.deploymentName}
              </TableCell>
              <TableCell>
                <StatusBadge status={d.status} />
              </TableCell>
              <TableCell>
                <span className="mode-badge">{d.deploymentMode}</span>
              </TableCell>
              <TableCell className="text-sm text-zinc-500">{d.namespace}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-zinc-400">
                {formatDate(d.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
