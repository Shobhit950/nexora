import {
  ReactFlowProvider, useReactFlow,
  type OnEdgesChange, type OnNodesChange, type XYPosition,
} from '@xyflow/react';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check, CircleAlert, Grid2X2, LoaderCircle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, Save, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useBlocker, useOutletContext, useParams } from 'react-router-dom';
import { authError, readSession } from '../auth/api';
import { WorkflowStatusBadge } from '../components/dashboard/WorkflowStatusBadge';
import {
  createEdge, createNode, graphDraft, graphSignature, GRID_SPACING, hydrateGraph, isValidConnection, MAX_NODES, prepareGraph,
  type ConnectionEndpoints, type EditorEdge, type EditorGraph, type EditorNode, type NodeKind,
} from '../components/workflow-editor/graph';
import { WorkflowCanvas } from '../components/workflow-editor/WorkflowCanvas';
import { NodeInspector, NodePalette } from '../components/workflow-editor/WorkflowPanels';
import { useGraphHistory } from '../components/workflow-editor/useGraphHistory';
import type { DashboardOutletContext } from '../layouts/DashboardLayout';
import { getWorkflow, updateWorkflow, type Workflow } from '../services/workflowApi';
import './workflowEditor.css';

const workflowsPath = '/dashboard/workflows';
const interruptedDrafts = new Map<string, { ownerId: string; graph: EditorGraph }>();

function LeaveEditorDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="editor-leave-dialog"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onStay(); }}>
      <h2 id={titleId}>Leave with unsaved changes?</h2>
      <p id={descriptionId}>Your changes since the last save will be lost.</p>
      <div>
        <button className="editor-button" type="button" autoFocus onClick={onStay}>Keep editing</button>
        <button className="editor-button editor-button-danger" type="button" onClick={onLeave}>Discard and leave</button>
      </div>
    </dialog>
  );
}

function WorkflowEditor({ workflow, initialGraph }: { workflow: Workflow; initialGraph: EditorGraph }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const discarded = useRef(false);
  const [recovered] = useState(() => {
    const draft = interruptedDrafts.get(workflow.id);
    return draft?.ownerId === workflow.userId ? draft.graph : undefined;
  });
  const { graph, signature, changeGraph, finishEdit, undo, redo, canUndo, canRedo } = useGraphHistory(recovered ?? initialGraph);
  const latestGraph = useRef(graph);
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(Boolean(recovered));
  const [savedSignature, setSavedSignature] = useState(() => graphSignature(graphDraft(initialGraph)));
  const [snap, setSnap] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { screenToFlowPosition } = useReactFlow<EditorNode, EditorEdge>();
  const { setHasUnsavedChanges } = useOutletContext<DashboardOutletContext>();

  const dirty = signature !== savedSignature;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useLayoutEffect(() => { latestGraph.current = graph; }, [graph]);

  useEffect(() => {
    if (recovered) interruptedDrafts.delete(workflow.id);
  }, [recovered, workflow.id]);

  useEffect(() => {
    document.title = workflow.name + ' | Nexora';
  }, [workflow.name]);

  useEffect(() => {
    setHasUnsavedChanges(dirty);
    if (!dirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      setHasUnsavedChanges(false);
    };
  }, [dirty, setHasUnsavedChanges]);

  const onNodesChange: OnNodesChange<EditorNode> = useCallback(changes => {
    const items = [...changes];
    const viewOnly = items.every(change => change.type === 'select' || change.type === 'dimensions');
    const dragging = items.some(change => change.type === 'position' && change.dragging);
    const ended = items.some(change => change.type === 'position' && change.dragging === false);
    const removesNode = items.some(change => change.type === 'remove');
    changeGraph(current => {
      const nodes = changes.applyTo(current.nodes);
      if (!removesNode) return { ...current, nodes };
      const surviving = new Set(nodes.map(node => node.id));
      return { nodes, edges: current.edges.filter(edge => surviving.has(edge.source) && surviving.has(edge.target)) };
    }, { viewOnly, ...(dragging || ended ? { group: 'drag', finish: ended } : {}) });
  }, [changeGraph]);

  const onEdgesChange: OnEdgesChange<EditorEdge> = useCallback(changes => {
    changeGraph(current => ({ ...current, edges: changes.applyTo(current.edges) }), {
      viewOnly: [...changes].every(change => change.type === 'select'),
    });
  }, [changeGraph]);

  function addNode(kind: NodeKind, position: XYPosition) {
    const align = (value: number) => Math.round(value / GRID_SPACING) * GRID_SPACING;
    const node = createNode(kind, snap ? { x: align(position.x), y: align(position.y) } : position);
    changeGraph(current => current.nodes.length >= MAX_NODES ? current : {
      nodes: [...current.nodes.map(node => node.selected ? { ...node, selected: false } : node), node],
      edges: current.edges.map(edge => edge.selected ? { ...edge, selected: false } : edge),
    });
  }

  function addFromPalette(kind: NodeKind) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const center = screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height * .4 }, { snapToGrid: false });
    const origin = { x: center.x - 92, y: center.y - 34 };
    const offsets = [[0, 0], [0, 100], [0, -100], [205, 0], [-205, 0], [205, 100], [-205, 100]] as const;
    const spots = offsets.map(([x, y]) => ({ x: origin.x + x, y: origin.y + y }));
    const position = spots.find(spot => !graph.nodes.some(node =>
      Math.abs(node.position.x - spot.x) < 186 && Math.abs(node.position.y - spot.y) < 76,
    )) ?? { x: origin.x + 22, y: origin.y + 22 };
    addNode(kind, position);
  }

  const connect = useCallback((connection: ConnectionEndpoints) => {
    const edge = createEdge(connection);
    changeGraph(current => isValidConnection(connection, current) ? { ...current, edges: [...current.edges, edge] } : current);
  }, [changeGraph]);

  function removeSelection() {
    changeGraph(current => {
      const nodes = current.nodes.filter(node => !node.selected);
      const remaining = new Set(nodes.map(node => node.id));
      return { nodes, edges: current.edges.filter(edge => !edge.selected && remaining.has(edge.source) && remaining.has(edge.target)) };
    });
  }

  function handleShortcuts(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || !(event.target instanceof Element) ||
        event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], dialog')) return;

    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const redoShortcut = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey);
      if (redoShortcut && canRedo) {
        event.preventDefault();
        redo();
      } else if (key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault();
        undo();
      }
      return;
    }
    if ((key === 'delete' || key === 'backspace') && !event.altKey && canvasRef.current?.contains(event.target) &&
        (graph.nodes.some(node => node.selected) || graph.edges.some(edge => edge.selected))) {
      event.preventDefault();
      if (!event.repeat) removeSelection();
    }
  }

  async function save() {
    if (!dirty || saving.current) return;
    const prepared = prepareGraph(graphDraft(graph));
    if ('error' in prepared) {
      setError(prepared.error);
      return;
    }

    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await updateWorkflow(workflow.id, prepared.graph);
      setSavedSignature(graphSignature(graphDraft(hydrateGraph(saved))));
      setShowRecoveryNotice(false);
    } catch (error) {
      if (!discarded.current && isAxiosError(error) && error.response?.status === 401 && !readSession().user) {
        // AuthGate can leave the editor when refresh expires. Keep the draft in this tab for the same owner.
        interruptedDrafts.set(workflow.id, { ownerId: workflow.userId, graph: latestGraph.current });
      }
      setError(authError(error, 'Unable to save the workflow. Your changes are still here. Try again.').message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="workflow-editor" onKeyDown={handleShortcuts}>
      <header className="editor-toolbar dashboard-surface">
        <div className="editor-title-group">
          <Link to={workflowsPath} className="editor-back"><ArrowLeft size={16} aria-hidden="true" /> My Workflows</Link>
          <div className="editor-title-line"><h1>{workflow.name}</h1><WorkflowStatusBadge status={workflow.status} /></div>
          {workflow.description && <p className="editor-workflow-description">{workflow.description}</p>}
        </div>
        <div className="editor-toolbar-actions">
          <div className="editor-tools" role="group" aria-label="Editor tools">
            <button type="button" className="editor-button editor-icon-button" aria-label="Undo" title="Undo (Ctrl or Cmd+Z)"
              aria-keyshortcuts="Control+Z Meta+Z" disabled={!canUndo} onClick={undo}><Undo2 size={17} aria-hidden="true" /></button>
            <button type="button" className="editor-button editor-icon-button" aria-label="Redo" title="Redo (Ctrl or Cmd+Shift+Z)"
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" disabled={!canRedo} onClick={redo}><Redo2 size={17} aria-hidden="true" /></button>
            <button type="button" className="editor-button editor-snap" aria-label="Snap to grid" aria-pressed={snap} onClick={() => setSnap(!snap)}>
              <Grid2X2 size={15} aria-hidden="true" /> Snap
            </button>
            <button type="button" className="editor-button editor-icon-button" aria-label={paletteOpen ? 'Hide node palette' : 'Show node palette'}
              title="Toggle node palette" aria-expanded={paletteOpen} aria-controls="editor-node-palette" onClick={() => setPaletteOpen(!paletteOpen)}>
              {paletteOpen ? <PanelLeftClose size={17} aria-hidden="true" /> : <PanelLeftOpen size={17} aria-hidden="true" />}
            </button>
            <button type="button" className="editor-button editor-icon-button" aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
              title="Toggle settings" aria-expanded={settingsOpen} aria-controls="editor-node-settings" onClick={() => setSettingsOpen(!settingsOpen)}>
              {settingsOpen ? <PanelRightClose size={17} aria-hidden="true" /> : <PanelRightOpen size={17} aria-hidden="true" />}
            </button>
          </div>
          <div className="editor-save">
            <span className="editor-save-state" data-dirty={dirty} role="status">
              {busy ? 'Saving changes...' : dirty ? 'Unsaved changes' : <><Check size={15} aria-hidden="true" /> Saved</>}
            </span>
            <button type="button" className="editor-button editor-button-primary" disabled={!dirty || busy} onClick={save}>
              {busy ? <LoaderCircle className="spinner" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
              {busy ? 'Saving...' : 'Save workflow'}
            </button>
          </div>
        </div>
      </header>
      {showRecoveryNotice && <p className="editor-alert editor-recovered" role="status">Recovered unsaved changes from before your session expired.</p>}
      {error && <div className="editor-alert" role="alert"><CircleAlert size={18} aria-hidden="true" />{error}</div>}
      <div className="editor-workspace" data-settings-open={settingsOpen}>
        <NodePalette count={graph.nodes.length} onAdd={addFromPalette} hidden={!paletteOpen} />
        <WorkflowCanvas canvasRef={canvasRef} graph={graph} snap={snap} onAdd={addNode}
          onAddTrigger={() => addFromPalette('manualTrigger')}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={connect} isValidConnection={connection => isValidConnection(connection, graph)} />
        <NodeInspector graph={graph} hidden={!settingsOpen} onConnect={connect} onRemove={removeSelection} onFinishEdit={finishEdit}
          onUpdate={updated => changeGraph(current => ({
            ...current, nodes: current.nodes.map(node => node.id === updated.id ? { ...updated, position: node.position } : node),
          }), updated.type === 'delay' ? { group: 'duration-' + updated.id } : {})} />
      </div>
      {blocker.state === 'blocked' && <LeaveEditorDialog onStay={blocker.reset} onLeave={() => {
        discarded.current = true;
        blocker.proceed();
      }} />}
    </div>
  );
}

type LoadResult =
  | { workflow: Workflow; graph: EditorGraph }
  | { title: string; message: string; retry: boolean };

function WorkflowOpenState({ result, onRetry }: { result?: Extract<LoadResult, { title: string }>; onRetry?: () => void }) {
  return (
    <section className="dashboard-surface editor-open-state">
      <Link to={workflowsPath} className="editor-back"><ArrowLeft size={16} aria-hidden="true" /> My Workflows</Link>
      {result ? <><h1>{result.title}</h1><p role="alert">{result.message}</p>
        {result.retry && <button type="button" className="editor-button" onClick={onRetry}>Retry</button>}</> :
        <p role="status"><LoaderCircle size={18} className="spinner" aria-hidden="true" /> Loading workflow...</p>}
    </section>
  );
}

function WorkflowLoader({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult>();

  useEffect(() => {
    document.title = 'Workflow Editor | Nexora';
    const controller = new AbortController();
    getWorkflow(id, controller.signal).then(workflow => {
      if (!controller.signal.aborted) setResult({ workflow, graph: hydrateGraph(workflow) });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 404) {
        setResult({ title: 'Workflow unavailable', message: 'This workflow could not be found in your workspace.', retry: false });
      } else if (status === 401 || status === 403) {
        setResult({ title: 'Access denied', message: 'You need access to this workflow to open it.', retry: false });
      } else if (status === 400) {
        setResult({ title: 'Invalid workflow link', message: 'Open a workflow from My Workflows.', retry: false });
      } else if (!isAxiosError(error)) {
        setResult({ title: 'Unable to open workflow', message: 'The saved graph contains data this editor cannot open.', retry: false });
      } else {
        setResult({ title: 'Unable to load workflow', message: 'Try again to load the saved graph.', retry: true });
      }
    });
    return () => controller.abort();
  }, [id, attempt]);

  if (!result || 'title' in result) return <WorkflowOpenState result={result} onRetry={() => {
    setResult(undefined);
    setAttempt(value => value + 1);
  }} />;

  return <ReactFlowProvider><WorkflowEditor workflow={result.workflow} initialGraph={result.graph} /></ReactFlowProvider>;
}

export function WorkflowEditorPage() {
  const { id } = useParams();
  return id ? <WorkflowLoader key={id} id={id} /> : <WorkflowOpenState result={{
    title: 'Missing workflow', message: 'Choose a workflow from your workspace.', retry: false,
  }} />;
}
