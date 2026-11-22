import { Check, CircleAlert, History, Workflow, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkflowSummary } from '../../services/workflowApi';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';

export type ExecutionPreviewItem = {
  id: string;
  workflowName: string;
  status: 'Success' | 'Failed';
  executedAt: string;
};

const activityDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function WorkflowPreview({ workflows, loading, error, onRetry }: {
  workflows: readonly WorkflowSummary[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="dashboard-surface dashboard-activity" aria-labelledby="recent-workflows-title">
      <div className="dashboard-section-heading">
        <h2 id="recent-workflows-title">Recent workflows</h2>
        <Link className="dashboard-workflows-link" to="/dashboard/workflows">View all</Link>
      </div>

      {loading ? (
        <p className="dashboard-empty" role="status">Loading workflows...</p>
      ) : error ? (
        <div className="dashboard-empty">
          <CircleAlert size={24} aria-hidden="true" />
          <p role="alert">Unable to load workflows.</p>
          <button type="button" className="dashboard-workflows-link" onClick={onRetry}>Retry</button>
        </div>
      ) : workflows.length ? (
        <ul className="dashboard-activity-list">
          {workflows.map(({ id, name, description, status, updatedAt }) => (
            <li className="dashboard-workflow-row" key={id}>
              <span className="dashboard-activity-icon" aria-hidden="true"><Workflow size={19} /></span>
              <div className="dashboard-activity-details">
                <h3>{name}</h3>
                <p>{description || 'No description'}</p>
              </div>
              <div className="dashboard-workflow-meta">
                <WorkflowStatusBadge status={status} />
                <time dateTime={updatedAt}>Updated {activityDate.format(new Date(updatedAt))}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dashboard-empty">
          <Workflow size={28} aria-hidden="true" />
          <h3>No workflows yet</h3>
          <p>New workflows will appear here.</p>
          <Link className="dashboard-workflows-link" to="/dashboard/workflows?create=1">Create a workflow</Link>
        </div>
      )}
    </section>
  );
}

export function ExecutionPreview({ executions, demo = false }: { executions: readonly ExecutionPreviewItem[]; demo?: boolean }) {
  return (
    <section className="dashboard-surface dashboard-activity" aria-labelledby="recent-executions-title">
      <div className="dashboard-section-heading">
        <h2 id="recent-executions-title">Recent executions</h2>
        {demo && <span className="dashboard-demo-tag">Demo data</span>}
      </div>

      {executions.length ? (
        <ul className="dashboard-activity-list">
          {executions.map(({ id, workflowName, executedAt, status }) => {
            const Icon = status === 'Success' ? Check : X;
            return (
              <li className="dashboard-execution-row" key={id}>
                <span className="dashboard-execution-icon" data-status={status} aria-hidden="true"><Icon size={15} strokeWidth={2.2} /></span>
                <div className="dashboard-activity-details">
                  <h3>{workflowName}</h3>
                  <time dateTime={executedAt}>{activityDate.format(new Date(executedAt))}</time>
                </div>
                <span className="dashboard-status dashboard-execution-status" data-status={status}>{status === 'Success' ? 'Succeeded' : status}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dashboard-empty">
          <History size={28} aria-hidden="true" />
          <h3>No executions yet</h3>
          <p>Once a workflow runs, its result and timestamp will appear here.</p>
        </div>
      )}
    </section>
  );
}
