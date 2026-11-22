import { CircleAlert, LoaderCircle, Trash2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { authError } from '../../auth/api';
import { createWorkflow, deleteWorkflow, getWorkflow, updateWorkflow, type Workflow, type WorkflowSummary } from '../../services/workflowApi';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';

export type WorkflowDialogMode =
  | { mode: 'create' }
  | { mode: 'view' | 'edit' | 'delete'; workflow: WorkflowSummary };

function WorkflowDetails({ id }: { id: string }) {
  const [workflow, setWorkflow] = useState<Workflow>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getWorkflow(id, controller.signal).then(setWorkflow, error => {
      if (!controller.signal.aborted) setError(authError(error, 'Unable to load workflow details.').message);
    });
    return () => controller.abort();
  }, [id, attempt]);

  if (error) return <div className="workflow-dialog-error">
    <p role="alert">{error}</p>
    <button type="button" className="workflow-button" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Retry</button>
  </div>;
  if (!workflow) return <p className="workflow-muted" role="status">Loading workflow details...</p>;

  return <>
    <p className="workflow-description">{workflow.description || 'No description'}</p>
    <dl className="workflow-facts">
      <div><dt>Status</dt><dd><WorkflowStatusBadge status={workflow.status} /></dd></div>
      <div><dt>Last updated</dt><dd><time dateTime={workflow.updatedAt}>{new Date(workflow.updatedAt).toLocaleString()}</time></dd></div>
      <div><dt>Nodes</dt><dd>{workflow.nodes.length}</dd></div>
      <div><dt>Connections</dt><dd>{workflow.edges.length}</dd></div>
    </dl>
  </>;
}

export function WorkflowDialog({ selection, onClose, onSaved }: {
  selection: WorkflowDialogMode;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { mode } = selection;
  const workflow = selection.mode === 'create' ? undefined : selection.workflow;
  const dialog = useRef<HTMLDialogElement>(null);
  const outcome = useRef<string | undefined>(undefined);
  const titleId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const saving = useRef(false);
  const title = { create: 'Create workflow', edit: 'Edit workflow', delete: 'Delete workflow?', view: workflow?.name }[mode];
  const pending = busy || closing;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function close(message?: string) {
    outcome.current = message;
    setClosing(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || closing || mode === 'view') return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (mode !== 'delete' && (!trimmedName || trimmedName.length > 120 || trimmedName.includes('\0'))) {
      setNameError('Enter a workflow name of 1 to 120 characters.');
      dialog.current?.querySelector<HTMLInputElement>('input[name="workflowName"]')?.focus();
      return;
    }
    if (mode !== 'delete' && (trimmedDescription.length > 2000 || trimmedDescription.includes('\0'))) {
      setError('Enter a description of up to 2,000 characters.');
      return;
    }

    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (selection.mode === 'create') {
        await createWorkflow({ name: trimmedName, ...(trimmedDescription && { description: trimmedDescription }) });
        close('Workflow created.');
      } else if (selection.mode === 'edit') {
        await updateWorkflow(selection.workflow.id, { name: trimmedName, description: trimmedDescription || null });
        close('Workflow updated.');
      } else if (selection.mode === 'delete') {
        await deleteWorkflow(selection.workflow.id);
        close('Workflow deleted.');
      }
    } catch (error) {
      setError(authError(error, 'Unable to ' + mode + ' the workflow. Try again.').message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <motion.dialog
      ref={dialog}
      className="workflow-dialog"
      aria-labelledby={titleId}
      data-closing={closing}
      onCancel={event => { event.preventDefault(); if (!pending) close(); }}
      initial={reducedMotion ? false : 'closed'}
      animate={closing ? 'closed' : 'open'}
      variants={{
        open: {
          opacity: 1, y: 0, scale: 1,
          transition: reducedMotion ? { duration: 0 } : {
            type: 'spring', stiffness: 380, damping: 30, opacity: { duration: .16 },
          },
        },
        closed: {
          opacity: 0, y: reducedMotion ? 0 : 9, scale: reducedMotion ? 1 : .98,
          transition: reducedMotion ? { duration: 0 } : {
            type: 'spring', stiffness: 465, damping: 39, opacity: { duration: .14 },
          },
        },
      }}
      onAnimationComplete={variant => {
        if (!closing || variant !== 'closed') return;
        dialog.current?.close();
        if (outcome.current) onSaved(outcome.current);
        else onClose();
      }}
    >
      <div className="workflow-dialog-content">
        <header className="workflow-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {mode === 'create' && <p>Create a draft in your workspace.</p>}
          </div>
          <button type="button" className="dashboard-icon-button" aria-label="Close dialog" disabled={pending} onClick={() => close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {selection.mode === 'view' ? <WorkflowDetails id={selection.workflow.id} /> : (
          <form noValidate onSubmit={submit} aria-busy={busy}>
            {mode === 'delete' ? (
              <p className="workflow-description">Delete <strong>{workflow?.name}</strong>? This permanently removes the workflow and its saved graph.</p>
            ) : (
              <div className="workflow-form-fields">
                <div className="workflow-field">
                  <label htmlFor={nameId}>Workflow name</label>
                  <input id={nameId} name="workflowName" value={name} required maxLength={120} autoFocus
                    placeholder="e.g. Lead enrichment" disabled={pending}
                    aria-invalid={Boolean(nameError)} aria-describedby={nameError ? nameId + '-error' : undefined}
                    onChange={event => { setName(event.target.value); setNameError(''); setError(''); }} />
                  {nameError && <p id={nameId + '-error'} className="workflow-danger-text">{nameError}</p>}
                </div>
                <div className="workflow-field">
                  <label htmlFor={descriptionId}>Description <span>Optional</span></label>
                  <textarea id={descriptionId} value={description} maxLength={2000} rows={3}
                    disabled={pending} placeholder="What will this workflow do?"
                    onChange={event => { setDescription(event.target.value); setError(''); }} />
                </div>
              </div>
            )}
            {error && <p className="workflow-inline-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}
            <footer className="workflow-dialog-footer">
              <button type="button" className="workflow-button" autoFocus={mode === 'delete'} disabled={pending} onClick={() => close()}>Cancel</button>
              <button type="submit" className={'workflow-button ' + (mode === 'delete' ? 'workflow-button-danger' : 'workflow-button-primary')} disabled={pending}>
                {busy ? <LoaderCircle className="spinner" size={17} aria-hidden="true" /> : mode === 'delete' && <Trash2 size={16} aria-hidden="true" />}
                {busy ? (mode === 'delete' ? 'Deleting...' : 'Saving...') : (mode === 'delete' ? 'Delete workflow' : mode === 'edit' ? 'Save changes' : 'Create workflow')}
              </button>
            </footer>
          </form>
        )}
      </div>
    </motion.dialog>
  );
}
