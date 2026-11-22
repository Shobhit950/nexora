import { Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleMinus, FileText, Grid2X2, List, ListFilter, Plus, Search, Workflow as WorkflowIcon, X, Zap } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authError } from '../auth/api';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { moveSpotlight } from '../components/dashboard/spotlight';
import { WorkflowActions } from '../components/dashboard/WorkflowActions';
import { WorkflowDialog, type WorkflowDialogMode } from '../components/dashboard/WorkflowDialog';
import { WorkflowStatusBadge } from '../components/dashboard/WorkflowStatusBadge';
import { listWorkflows, type WorkflowList, type WorkflowStatus } from '../services/workflowApi';
import './workflows.css';

const pageSize = 10;
const toastDuration = 4500;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const layoutSpring = { type: 'spring' as const, stiffness: 345, damping: 34 };
const views = [{ id: 'grid', label: 'Grid view', icon: Grid2X2 }, { id: 'list', label: 'List view', icon: List }] as const;

type Filters = { search: string; status: WorkflowStatus | ''; page: number };
type ListResult = { key: string; data: WorkflowList } | { key: string; error: string };

const statusOptions = [
  { value: '', label: 'Any status', icon: ListFilter, tone: 'neutral' },
  { value: 'draft', label: 'Draft', icon: FileText, tone: 'violet' },
  { value: 'active', label: 'Active', icon: CircleCheck, tone: 'green' },
  { value: 'inactive', label: 'Inactive', icon: CircleMinus, tone: 'muted' },
] satisfies readonly DropdownOption<Filters['status']>[];

function EmptyWorkflowVisual() {
  return (
    <div className="workflow-empty-visual" aria-hidden="true">
      <span className="workflow-empty-node"><Zap size={16} /></span>
      <i className="workflow-empty-wire" />
      <span className="workflow-empty-node"><WorkflowIcon size={18} /></span>
      <i className="workflow-empty-wire" />
      <span className="workflow-empty-node"><Check size={16} /></span>
    </div>
  );
}

export function WorkflowsPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [{ search, status, page }, setFilters] = useState<Filters>({ search: '', status: '', page: 1 });
  const [view, setView] = useState<(typeof views)[number]['id']>('grid');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ListResult>();
  const [selection, setSelection] = useState<WorkflowDialogMode>();
  const [toast, setToast] = useState<{ id: number; message: string }>();
  const createButton = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const requestKey = JSON.stringify([search, status, page]);
  const current = result?.key === requestKey ? result : undefined;
  const data = current && 'data' in current ? current.data : undefined;
  const error = current && 'error' in current ? current.error : '';
  const activeDialog = urlParams.get('create') === '1' ? { mode: 'create' as const } : selection;

  useEffect(() => {
    document.title = 'My Workflows | Nexora';
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setFilters(current => current.search === next ? current : { ...current, search: next, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    listWorkflows({ page, limit: pageSize, ...(search && { search }), ...(status && { status }) }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, data.pagination.totalPages);
        if (page > lastPage) {
          setFilters(current => ({ ...current, page: lastPage }));
          return;
        }
        setResult({ key: requestKey, data });
      }, error => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: authError(error, 'Unable to load workflows.').message });
      });
    return () => controller.abort();
  }, [requestKey, page, search, status, revision]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), toastDuration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openCreate() {
    setSelection({ mode: 'create' });
  }

  function closeDialog() {
    setSelection(undefined);
    if (urlParams.has('create')) {
      const next = new URLSearchParams(urlParams);
      next.delete('create');
      setUrlParams(next, { replace: true });
      createButton.current?.focus();
    }
  }

  function retryList() {
    setResult(undefined);
    setRevision(value => value + 1);
  }

  function handleSaved(message: string) {
    if (activeDialog?.mode === 'create') {
      clearFilters();
      setResult(undefined);
      createButton.current?.focus();
    } else if (activeDialog?.mode === 'delete') {
      const deletedId = activeDialog.workflow.id;
      // Update the displayed list after the API succeeds so the card can exit before the fresh list arrives.
      setResult(previous => {
        if (previous?.key !== requestKey || !('data' in previous)) return previous;
        const { items, pagination } = previous.data;
        const remaining = items.filter(item => item.id !== deletedId);
        if (remaining.length === items.length) return previous;
        const total = pagination.total - 1;
        return { key: requestKey, data: {
          items: remaining,
          pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.limit) },
        } };
      });
      createButton.current?.focus();
    }
    closeDialog();
    setToast({ id: Date.now(), message });
    setRevision(value => value + 1);
  }

  function clearFilters() {
    setSearchInput('');
    setFilters({ search: '', status: '', page: 1 });
  }

  return (
    <div className="workflows-page">
      <header className="workflows-heading">
        <div><h1>My Workflows</h1><p>Create and manage the workflows in your workspace.</p></div>
        <button ref={createButton} type="button" className="workflow-button workflow-button-primary" onClick={openCreate}>
          <Plus size={18} aria-hidden="true" /> Create workflow
        </button>
      </header>

      <div className="workflows-toolbar dashboard-surface">
        <label className="workflow-filter workflow-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search workflows</span>
          <input type="search" value={searchInput} maxLength={120} placeholder="Search by name"
            onChange={event => setSearchInput(event.target.value)} />
        </label>
        <Dropdown label="Filter by status" value={status} options={statusOptions} className="workflow-status-filter"
          onChange={nextStatus => setFilters(current => ({ ...current, status: nextStatus, page: 1 }))} />
        <div className="workflow-view-toggle" role="group" aria-label="Workflow view">
          {views.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-label={label} title={label} aria-pressed={view === id} onClick={() => setView(id)}>
              <Icon size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {data && data.items.length > 0 && (
        <p className="workflow-results" role="status">{data.pagination.total} {data.pagination.total === 1 ? 'workflow' : 'workflows'}</p>
      )}
      <div className="workflow-content">
        <ul className="workflows-grid" data-view={view} aria-label="Saved workflows">
          <AnimatePresence mode="popLayout">
            {data?.items.map((workflow, index) => (
              <motion.li
                className="workflow-card dashboard-surface"
                key={workflow.id}
                onPointerMove={reducedMotion ? undefined : moveSpotlight}
                layout={!reducedMotion}
                initial={reducedMotion ? false : { opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0, transition: reducedMotion ? { duration: 0 } : { duration: .24, delay: Math.min(index, 6) * .035 } }}
                exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .965, y: -5, transition: { duration: .18 } }}
                transition={{ layout: reducedMotion ? { duration: 0 } : layoutSpring }}
              >
                <span className="dashboard-activity-icon workflow-card-icon" aria-hidden="true"><WorkflowIcon size={18} /></span>
                <WorkflowActions workflow={workflow} onAction={mode => setSelection({ mode, workflow })} />
                <div className="workflow-card-copy">
                  <h2><Link to={`/dashboard/workflows/${workflow.id}`}>{workflow.name}</Link></h2>
                  <p>{workflow.description || 'No description'}</p>
                </div>
                <div className="workflow-card-footer">
                  <WorkflowStatusBadge status={workflow.status} />
                  <time dateTime={workflow.updatedAt}>Updated {dateFormat.format(new Date(workflow.updatedAt))}</time>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!current ? (
          <div className="workflows-grid" data-view={view} role="status" aria-label="Loading workflows">
            {[0, 1, 2].map(item => <div className="dashboard-surface workflow-skeleton" key={item} aria-hidden="true"><i /><i /><i /></div>)}
          </div>
        ) : error ? (
          <div className="dashboard-surface workflow-empty">
            <CircleAlert size={28} aria-hidden="true" />
            <h2>Could not load workflows</h2>
            <p role="alert">{error}</p>
            <button type="button" className="workflow-button" onClick={retryList}>Retry</button>
          </div>
        ) : data && data.items.length === 0 && (
          <motion.div className="dashboard-surface workflow-empty"
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .22 }}>
            <EmptyWorkflowVisual />
            <h2>{search || status ? 'No matching workflows' : 'No workflows yet'}</h2>
            <p>{search || status ? 'Try a different name or status.' : 'Create a draft to start organizing an automation.'}</p>
            {search || status
              ? <button type="button" className="workflow-button" onClick={clearFilters}>Clear filters</button>
              : <button type="button" className="workflow-button workflow-button-primary" onClick={openCreate}><Plus size={17} aria-hidden="true" /> Create workflow</button>}
          </motion.div>
        )}
      </div>
      {data && data.pagination.totalPages > 1 && (
        <nav className="workflow-pagination" aria-label="Workflow pages">
          <button type="button" className="workflow-button" disabled={page <= 1}
            onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>
            <ChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span>Page {page} of {data.pagination.totalPages}</span>
          <button type="button" className="workflow-button" disabled={page >= Math.min(data.pagination.totalPages, 10_000)}
            onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>
            Next <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      <div className="workflow-toast-region" role="status">
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div className="workflow-toast" key={toast.id}
              initial={reducedMotion ? false : { opacity: 0, y: 10, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : 5, transition: { duration: reducedMotion ? 0 : .16 } }}
              transition={reducedMotion ? { duration: 0 } : layoutSpring}>
              <span className="workflow-toast-icon"><Check size={17} aria-hidden="true" /></span>
              <span>{toast.message}</span>
              <button type="button" className="dashboard-icon-button" aria-label="Dismiss notification" onClick={() => setToast(undefined)}><X size={17} aria-hidden="true" /></button>
              {!reducedMotion && <motion.span className="workflow-toast-progress" aria-hidden="true" initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }} transition={{ duration: toastDuration / 1000, ease: 'linear' }} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {activeDialog && <WorkflowDialog
        key={activeDialog.mode === 'create' ? 'create' : activeDialog.mode + activeDialog.workflow.id}
        selection={activeDialog} onClose={closeDialog} onSaved={handleSaved}
      />}
    </div>
  );
}
