import type { WorkflowStatus } from '../../services/workflowApi';

const labels = { active: 'Active', draft: 'Draft', inactive: 'Inactive' } satisfies Record<WorkflowStatus, string>;

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return <span className="dashboard-status" data-status={labels[status]}><i aria-hidden="true" />{labels[status]}</span>;
}
