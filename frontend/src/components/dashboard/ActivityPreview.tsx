import { Check, History, Workflow, X, type LucideIcon } from 'lucide-react';

export type WorkflowPreviewItem = {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Draft';
  updatedAt: string;
  icon: LucideIcon;
};

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

export function WorkflowPreview({ workflows, demo = false }: { workflows: readonly WorkflowPreviewItem[]; demo?: boolean }) {
  return (
    <section className="dashboard-surface dashboard-activity" aria-labelledby="recent-workflows-title">
      <div className="dashboard-section-heading">
        <h2 id="recent-workflows-title">Recent workflows</h2>
        {demo && <span className="dashboard-demo-tag">Demo data</span>}
      </div>

      {workflows.length ? (
        <ul className="dashboard-activity-list">
          {workflows.map(({ id, name, description, status, updatedAt, icon: Icon }) => (
            <li className="dashboard-workflow-row" key={id}>
              <span className="dashboard-activity-icon" aria-hidden="true"><Icon size={19} /></span>
              <div className="dashboard-activity-details">
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
              <div className="dashboard-workflow-meta">
                <span className="dashboard-status" data-status={status}><i aria-hidden="true" />{status}</span>
                <time dateTime={updatedAt}>Updated {activityDate.format(new Date(updatedAt))}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dashboard-empty">
          <Workflow size={28} aria-hidden="true" />
          <h3>No workflows yet</h3>
          <p>New workflows will appear here. Start by choosing a trigger and an action in the builder.</p>
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
