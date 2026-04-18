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
import { MaterialIcon } from './MaterialIcon'
import { useState } from 'react'
import { DeleteDeploymentDialog } from './DeletePipelineModal'
import { DEPLOYMENT_STATUS } from '../../../utils/constants'
import { Button } from '@/components/ui/button'

interface Props {
  deployments: Deployment[]
  onEdit?: (deployment: Deployment) => void
  onDeleted?: () => void
  // onStart?: (deployment: Deployment) => void
  // onStop?: (deployment: Deployment) => void
  // onForceStop?: (deployment: Deployment) => void
}

// export default function DeploymentTable({ deployments, onEdit, onDeleted, onStart, onStop, onForceStop }: Props) {
export default function DeploymentTable({ deployments, onEdit, onDeleted }: Props) {
  const navigate = useNavigate()

  const [confirmDelete, setConfirmDelete] = useState<Deployment | null>(null)

  if (deployments.length === 0) {
    return (
      <div className="empty-state">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100">
          <MaterialIcon name="dashboard_customize" />
        </div>
        <p className="text-sm font-medium text-zinc-700">No pipelines yet</p>
        <p className="mt-1 text-xs text-zinc-400">Create your first Flink deployment to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="table-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="table-col-header w-[35%]">Name</TableHead>
              <TableHead className="table-col-header">Status</TableHead>
              <TableHead className="table-col-header">Mode</TableHead>
              <TableHead className="table-col-header">Namespace</TableHead>
              <TableHead className="table-col-header">Created</TableHead>
              <TableHead className="table-col-header w-[15%] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => {
              const isActionDisabled = d.status === DEPLOYMENT_STATUS.DELETED || d.status === DEPLOYMENT_STATUS.DELETING;
              return (
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
                
                  <TableCell className="text-left" onClick={ (e) => e.stopPropagation() }>
                    <div className="flex items-center justify-start gap-1 min-w-[140px] w-full">

                      {/* Start Button (only when stopped or suspended) */}
                      {d.status === DEPLOYMENT_STATUS.SUSPENDED && (
                        <Button variant="ghost" disabled={isActionDisabled} onClick={() => alert("Start Pipeline WIP")} title="Start pipeline" 
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed">
                          <MaterialIcon name="play_arrow" size={18} />
                        </Button>
                      )}

                      {/* Stop Button (only when running) */}
                      {d.status === DEPLOYMENT_STATUS.RUNNING && (
                        <Button variant="ghost" disabled={isActionDisabled} onClick={() => alert("Stop Pipeline WIP")} title="Stop pipeline (creates savepoint)" 
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700 disabled:opacity-30 disabled:cursor-not-allowed">
                          <MaterialIcon name="pause" size={18} />
                        </Button>
                      )}

                      {/* Force Stop Button (only when running) */}
                      {d.status === DEPLOYMENT_STATUS.RUNNING && (
                        <Button variant="ghost" disabled={isActionDisabled} onClick={() => alert("Force Stop Pipeline WIP")} title="Force stop pipeline (skips savepoint)"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed">
                          <MaterialIcon name="stop" size={18} />
                        </Button>
                      )}

                      <div className="flex-1" />

                      {/* Edit */}
                      <button disabled={isActionDisabled} onClick={() => onEdit?.(d)} title="Edit deployment" 
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-blue-100 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed">
                        <MaterialIcon name="edit" size={18} />
                      </button>

                      {/* Delete */}
                      <button disabled={isActionDisabled} onClick={() => {
                        setConfirmDelete(d)
                      }} title="Delete deployment" 
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                        <MaterialIcon name="delete" size={18} />
                      </button>
                    </div>
                  </TableCell>

                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteDeploymentDialog
        deployment={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onSuccess={() => onDeleted?.()}
      />
    </>
  )
}
