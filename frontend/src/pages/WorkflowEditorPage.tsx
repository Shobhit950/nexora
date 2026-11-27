import {
  ReactFlowProvider, useReactFlow,
  type OnEdgesChange, type OnNodesChange, type XYPosition,
} from '@xyflow/react';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check, CircleAlert, Grid2X2, LoaderCircle, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Play, Redo2, Save, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Link, useBlocker, useOutletContext, useParams } from 'react-router-dom';
import { authError, readSession } from '../auth/api';
import { WorkflowStatusBadge } from '../components/dashboard/WorkflowStatusBadge';
import {
  createEdge, createNode, graphDraft, graphSignature, GRID_SPACING, hydrateGraph, isValidConnection, MAX_NODES, prepareGraph,
  type ConnectionEndpoints, type EditorEdge, type EditorGraph, type EditorNode, type NodeKind,
} from '../components/workflow-editor/graph';
import { WorkflowCanvas } from '../components/workflow-editor/WorkflowCanvas';
import { CanvasExecutionContext, type ExecutionPanelState } from '../components/workflow-editor/executionPresentation';
import { EditorDock, InspectorResize, InspectorTabs } from '../components/workflow-editor/EditorDock';
import { WorkflowExecutionInspector, WorkflowRunDialog } from '../components/workflow-editor/WorkflowExecutionPanels';
import { NodeInspector, NodePalette } from '../components/workflow-editor/WorkflowPanels';
import { useGraphHistory } from '../components/workflow-editor/useGraphHistory';
import type { DashboardOutletContext } from '../layouts/DashboardLayout';
import { getWorkflow, updateWorkflow, type Workflow } from '../services/workflowApi';
import { runWorkflow, workflowRunError, type WorkflowJson } from '../services/workflowExecution';
import './workflowEditor.css';
import './workflowExecution.css';

const workflowsPath = '/dashboard/workflows';
const interruptedDrafts = new Map<string, { ownerId: string; graph: EditorGraph }>();
const compactEditor = '(max-width: 1249px)';
const getCompactEditor = () => window.matchMedia(compactEditor).matches;
function subscribeCompactEditor(update: () => void) {
  const media = window.matchMedia(compactEditor);
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}

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
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const tooltips = useId();
  const saving = useRef(false);
  const discarded = useRef(false);
  const [recovered] = useState(() => {
    const draft = interruptedDrafts.get(workflow.id);
    return draft?.ownerId === workflow.userId ? draft.graph : undefined;
  });
  const { graph, signature, changeGraph, finishEdit, undo, redo, canUndo, canRedo } = useGraphHistory(recovered ?? initialGraph);
  const latestGraph = useRef(graph);
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(Boolean(recovered));
  const [savedBaseline, setSavedBaseline] = useState(() => ({
    signature: graphSignature(graphDraft(initialGraph)),
    edges: workflow.edges,
  }));
  const [snap, setSnap] = useState(false);
  const compact = useSyncExternalStore(subscribeCompactEditor, getCompactEditor);
  const [paletteDocked, setPaletteDocked] = useState(true);
  const [inspectorDocked, setInspectorDocked] = useState(true);
  const [drawer, setDrawer] = useState<'palette' | 'inspector' | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(310);
  const [tab, setTab] = useState<'settings' | 'results'>('settings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const runRequest = useRef<AbortController | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runDialog, setRunDialog] = useState(false);
  const [runInput, setRunInput] = useState('{"text":"hello nexora"}');
  const [execution, setExecution] = useState<ExecutionPanelState>();
  const [inspectTarget, setInspectTarget] = useState<{ nodeId: string } | null>(null);
  const { screenToFlowPosition } = useReactFlow<EditorNode, EditorEdge>();
  const { setHasUnsavedChanges, setEditorFocus } = useOutletContext<DashboardOutletContext>();
  const paletteOverlay = compact || focusMode;
  const paletteOpen = paletteOverlay ? drawer === 'palette' : paletteDocked;
  const inspectorOpen = compact ? drawer === 'inspector' : inspectorDocked;

  const dirty = signature !== savedBaseline.signature;
  const report = execution?.phase === 'report' ? execution.report : null;
  const graphChanged = execution?.phase === 'report' && execution.signature !== signature;
  const inspectNode = useCallback((nodeId: string) => {
    setInspectTarget({ nodeId });
    setTab('results');
    if (compact) setDrawer('inspector');
    else setInspectorDocked(true);
  }, [compact]);
  const canvasExecution = useMemo(() => report && !graphChanged ? {
    statuses: new Map(report.nodes.map(node => [node.nodeId, node.status])),
    inspect: inspectNode,
  } : null, [report, graphChanged, inspectNode]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useLayoutEffect(() => { latestGraph.current = graph; }, [graph]);
  useLayoutEffect(() => {
    if (!focusMode) return;
    setEditorFocus(true);
    return () => setEditorFocus(false);
  }, [focusMode, setEditorFocus]);
  useEffect(() => () => runRequest.current?.abort(), []);

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
    const offsets = [[0, 0], [0, 112], [0, -112], [226, 0], [-226, 0], [226, 112], [-226, 112]] as const;
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

  const handleShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (blocker.state === 'blocked' || event.defaultPrevented || event.isComposing || !(event.target instanceof Element) ||
        (event.target !== document.body && !editorRef.current?.contains(event.target)) ||
        event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], dialog, .editor-execution-inspector')) return;

    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const redoShortcut = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey);
      if (redoShortcut) {
        event.preventDefault();
        if (canRedo) redo();
      } else if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) undo();
      }
      return;
    }
    if ((key === 'delete' || key === 'backspace') && !event.altKey && !event.ctrlKey && !event.metaKey &&
        (graph.nodes.some(node => node.selected) || graph.edges.some(edge => edge.selected))) {
      event.preventDefault();
      if (!event.repeat) removeSelection();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleShortcuts(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  async function save() {
    if (!dirty || saving.current) return null;
    const prepared = prepareGraph(graphDraft(graph), savedBaseline.edges);
    if ('error' in prepared) {
      setError(prepared.error);
      return null;
    }

    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await updateWorkflow(workflow.id, prepared.graph);
      const baseline = {
        signature: graphSignature(graphDraft(hydrateGraph(saved))),
        edges: saved.edges,
      };
      setSavedBaseline(baseline);
      setShowRecoveryNotice(false);
      return baseline.signature;
    } catch (error) {
      if (!discarded.current && isAxiosError(error) && error.response?.status === 401 && !readSession().user) {
        // AuthGate can leave the editor when refresh expires. Keep the draft in this tab for the same owner.
        interruptedDrafts.set(workflow.id, { ownerId: workflow.userId, graph: latestGraph.current });
      }
      setError(authError(error, 'Unable to save the workflow. Your changes are still here. Try again.').message);
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function startRun(input: WorkflowJson) {
    if (runRequest.current || saving.current) return;
    const controller = new AbortController();
    runRequest.current = controller;
    setRunBusy(true);
    try {
      const executedSignature = dirty ? await save() : savedBaseline.signature;
      if (executedSignature === null || controller.signal.aborted) return;

      setRunDialog(false);
      setInspectTarget(null);
      setTab('results');
      if (!getCompactEditor()) setInspectorDocked(true);
      setExecution({ phase: 'running' });
      const result = await runWorkflow(workflow.id, input, controller.signal);
      if (!controller.signal.aborted) showFinishedExecution({ phase: 'report', report: result, signature: executedSignature });
    } catch (cause) {
      if (!controller.signal.aborted) showFinishedExecution({ phase: 'error', message: workflowRunError(cause) });
    } finally {
      if (runRequest.current === controller) runRequest.current = null;
      if (!controller.signal.aborted) setRunBusy(false);
    }
  }

  function showFinishedExecution(result: Exclude<ExecutionPanelState, { phase: 'running' }>) {
    setExecution(result);
    setTab('results');
    if (getCompactEditor()) setDrawer('inspector');
    else setInspectorDocked(true);
  }

  return (
    <div className="workflow-editor" ref={editorRef} data-focus-mode={focusMode}>
      <header className="editor-toolbar dashboard-surface">
        <div className="editor-title-group">
          <Link to={workflowsPath} className="editor-back"><ArrowLeft size={16} aria-hidden="true" /> My Workflows</Link>
          <div className="editor-title-line"><h1>{workflow.name}</h1><WorkflowStatusBadge status={workflow.status} /></div>
          {workflow.description && <p className="editor-workflow-description">{workflow.description}</p>}
        </div>
        <div className="editor-toolbar-actions">
          <div className="editor-tools" role="group" aria-label="Editor tools">
            <span className="editor-tool"><button type="button" className="editor-button editor-icon-button" aria-label="Undo" aria-describedby={tooltips + '-undo'}
              aria-keyshortcuts="Control+Z Meta+Z" disabled={!canUndo} onClick={undo}><Undo2 size={17} aria-hidden="true" /></button>
              <span role="tooltip" id={tooltips + '-undo'}>Undo · Ctrl+Z / Cmd+Z</span></span>
            <span className="editor-tool"><button type="button" className="editor-button editor-icon-button" aria-label="Redo" aria-describedby={tooltips + '-redo'}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" disabled={!canRedo} onClick={redo}><Redo2 size={17} aria-hidden="true" /></button>
              <span role="tooltip" id={tooltips + '-redo'}>Redo · Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z</span></span>
            <span className="editor-tool"><button type="button" className="editor-button editor-snap" aria-label="Snap to grid" aria-describedby={tooltips + '-snap'} aria-pressed={snap} onClick={() => setSnap(!snap)}>
              <Grid2X2 size={15} aria-hidden="true" /> Snap
            </button><span role="tooltip" id={tooltips + '-snap'}>Align moved and new nodes to the grid</span></span>
            <span className="editor-tool"><button type="button" className="editor-button editor-icon-button" aria-label={paletteOpen ? 'Hide node palette' : 'Show node palette'}
              aria-expanded={paletteOpen} aria-controls="editor-node-palette"
              onClick={() => paletteOverlay ? setDrawer(paletteOpen ? null : 'palette') : setPaletteDocked(!paletteDocked)}>
              {paletteOpen ? <PanelLeftClose size={17} aria-hidden="true" /> : <PanelLeftOpen size={17} aria-hidden="true" />}
            </button><span role="tooltip" aria-hidden="true">{paletteOpen ? 'Hide node palette' : 'Show node palette'}</span></span>
            <span className="editor-tool"><button type="button" className="editor-button editor-icon-button" aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
              aria-expanded={inspectorOpen} aria-controls="editor-inspector"
              onClick={() => compact ? setDrawer(inspectorOpen ? null : 'inspector') : setInspectorDocked(!inspectorDocked)}>
              {inspectorOpen ? <PanelRightClose size={17} aria-hidden="true" /> : <PanelRightOpen size={17} aria-hidden="true" />}
            </button><span role="tooltip" aria-hidden="true">{inspectorOpen ? 'Hide inspector' : 'Show inspector'}</span></span>
            <button type="button" className="editor-button" aria-pressed={focusMode} onClick={() => { setDrawer(null); setFocusMode(!focusMode); }}>
              {focusMode ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
              {focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
            </button>
          </div>
          <div className="editor-save">
            <span className="editor-save-state" data-dirty={dirty} role="status">
              {busy ? 'Saving changes...' : dirty ? 'Unsaved changes' : <><Check size={15} aria-hidden="true" /> Saved</>}
            </span>
            <button type="button" className="editor-button editor-button-primary" disabled={!dirty || busy || runBusy} onClick={() => void save()}>
              {busy ? <LoaderCircle className="spinner" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
              {busy ? 'Saving...' : 'Save workflow'}
            </button>
            <button type="button" className="editor-button editor-run-primary" disabled={runBusy || busy}
              aria-haspopup="dialog" onClick={() => setRunDialog(true)}>
              {runBusy ? <LoaderCircle className="spinner" size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
              {execution?.phase === 'running' ? 'Running…' : 'Run Workflow'}
            </button>
          </div>
        </div>
      </header>
      {showRecoveryNotice && <p className="editor-alert editor-recovered" role="status">Recovered unsaved changes from before your session expired.</p>}
      {error && !runDialog && <div className="editor-alert" role="alert"><CircleAlert size={18} aria-hidden="true" />{error}</div>}
      <div className="editor-workspace" style={{ '--inspector-width': inspectorWidth + 'px' } as CSSProperties}>
        <EditorDock id="editor-node-palette" label="Node palette" left overlay={paletteOverlay} open={paletteOpen} onClose={() => setDrawer(null)}>
          <NodePalette count={graph.nodes.length} onAdd={kind => { addFromPalette(kind); if (paletteOverlay) setDrawer(null); }} />
        </EditorDock>
        <CanvasExecutionContext.Provider value={canvasExecution}>
          <WorkflowCanvas canvasRef={canvasRef} graph={graph} snap={snap} onAdd={addNode}
            onAddTrigger={() => addFromPalette('manualTrigger')}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={connect} isValidConnection={connection => isValidConnection(connection, graph)} />
        </CanvasExecutionContext.Provider>
        <EditorDock id="editor-inspector" label="Workflow inspector" overlay={compact} open={inspectorOpen} onClose={() => setDrawer(null)}>
          {!compact && <InspectorResize width={inspectorWidth} onChange={setInspectorWidth} />}
          <InspectorTabs tab={tab} onChange={next => { setInspectTarget(null); setTab(next); }}
            settings={<NodeInspector graph={graph} onConnect={connect} onRemove={removeSelection} onFinishEdit={finishEdit}
              onUpdate={updated => changeGraph(current => ({
                ...current, nodes: current.nodes.map(node => node.id === updated.id ? { ...updated, position: node.position } : node),
              }), updated.type === 'delay' ? { group: 'duration-' + updated.id } : {})} />}
            results={<WorkflowExecutionInspector state={execution} workflowName={workflow.name} graphChanged={graphChanged}
              unexecuted={report && !graphChanged ? Math.max(0, graph.nodes.length - report.nodes.length) : 0}
              inspectTarget={inspectTarget} active={inspectorOpen && tab === 'results'} />} />
        </EditorDock>
      </div>
      {runDialog && <WorkflowRunDialog text={runInput} dirty={dirty} saving={runBusy} saveError={dirty ? error : ''}
        onTextChange={setRunInput} onCancel={() => setRunDialog(false)} onRun={input => void startRun(input)} />}
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
