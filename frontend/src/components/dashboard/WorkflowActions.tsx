import { Ellipsis, Eye, Pencil, Trash2 } from 'lucide-react';
import type { WorkflowSummary } from '../../services/workflowApi';

export type WorkflowAction = 'view' | 'edit' | 'delete';

export function WorkflowActions({ workflow, onAction }: {
  workflow: WorkflowSummary;
  onAction: (action: WorkflowAction) => void;
}) {
  return (
    <details
      className="workflow-actions"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="dashboard-icon-button" aria-label={'Actions for ' + workflow.name} title="Workflow actions">
        <Ellipsis size={20} aria-hidden="true" />
      </summary>
      <div className="workflow-actions-panel" onClick={event => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (button) {
          const details = event.currentTarget.closest('details');
          if (details) {
            details.open = false;
            details.querySelector('summary')?.focus();
          }
        }
      }}>
        <button type="button" onClick={() => onAction('view')}><Eye size={16} aria-hidden="true" /> View details</button>
        <button type="button" onClick={() => onAction('edit')}><Pencil size={16} aria-hidden="true" /> Edit details</button>
        <button type="button" className="workflow-danger-text" onClick={() => onAction('delete')}><Trash2 size={16} aria-hidden="true" /> Delete workflow</button>
      </div>
    </details>
  );
}
