import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow,
  useReactFlow, type IsValidConnection, type OnConnect, type OnConnectEnd, type OnEdgesChange, type OnNodesChange, type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Focus, Map, Plus, Workflow as WorkflowIcon } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useContext, useEffect, useId, useState, type DragEvent, type RefObject } from 'react';
import { CanvasExecutionContext } from './executionPresentation';
import {
  connectionError, GRID_SPACING, isNodeKind, MAX_COORDINATE, MAX_NODES, NODE_DRAG_TYPE, nodeCatalog, type EditorEdge, type EditorGraph, type EditorNode, type NodeKind,
} from './graph';
import { WorkflowNodeCard } from './WorkflowNodes';

const nodeTypes = { manualTrigger: WorkflowNodeCard, transform: WorkflowNodeCard, delay: WorkflowNodeCard };
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 17, height: 17, color: '#a984df' } };
const extent: [[number, number], [number, number]] = [[-MAX_COORDINATE, -MAX_COORDINATE], [MAX_COORDINATE, MAX_COORDINATE]];
const fitOptions = { padding: .24, maxZoom: 1 };

type CanvasProps = {
  canvasRef: RefObject<HTMLDivElement | null>;
  graph: EditorGraph;
  snap: boolean;
  onAddTrigger: () => void;
  onAdd: (kind: NodeKind, position: XYPosition) => void;
  onNodesChange: OnNodesChange<EditorNode>;
  onEdgesChange: OnEdgesChange<EditorEdge>;
  onConnect: OnConnect;
  isValidConnection: IsValidConnection<EditorEdge>;
};

export function WorkflowCanvas({ canvasRef, graph, snap, onAddTrigger, onAdd, onNodesChange, onEdgesChange, onConnect, isValidConnection }: CanvasProps) {
  const instructions = useId();
  const [connectionFeedback, setConnectionFeedback] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const flow = useReactFlow<EditorNode, EditorEdge>();
  const { getNodes, getNodesBounds, getViewport, setViewport, fitView, viewportInitialized } = flow;
  const reduce = useReducedMotion();
  const execution = useContext(CanvasExecutionContext);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewportInitialized) return;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextWidth = canvas.clientWidth;
        const nextHeight = canvas.clientHeight;
        if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
        const view = getViewport();
        const margin = 16;
        const nodes = getNodes();
        const bounds = getNodesBounds(nodes);
        const left = bounds.x * view.zoom;
        const right = (bounds.x + bounds.width) * view.zoom;
        const top = bounds.y * view.zoom;
        const bottom = (bounds.y + bounds.height) * view.zoom;
        const wasVisible = nodes.length > 0 && left + view.x >= 0 && right + view.x <= width &&
          top + view.y >= 0 && bottom + view.y <= height;
        const centeredX = view.x + (nextWidth - width) / 2;
        const centeredY = view.y + (nextHeight - height) / 2;
        width = nextWidth;
        height = nextHeight;
        if (wasVisible && (right - left > width - margin * 2 || bottom - top > height - margin * 2)) {
          void fitView({ ...fitOptions, duration: 0 });
          return;
        }
        // Keep the current zoom and center unless translating the graph avoids clipping.
        void setViewport({
          x: wasVisible ? Math.max(margin - left, Math.min(centeredX, width - margin - right)) : centeredX,
          y: wasVisible ? Math.max(margin - top, Math.min(centeredY, height - margin - bottom)) : centeredY,
          zoom: view.zoom,
        });
      });
    });
    observer.observe(canvas);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [canvasRef, viewportInitialized, getViewport, getNodes, getNodesBounds, fitView, setViewport]);

  const finishConnection: OnConnectEnd = (_, state) => {
    if (!state.fromNode || state.isValid) return;
    if (state.toNode && state.fromHandle?.type !== state.toHandle?.type) {
      const fromSource = state.fromHandle?.type === 'source';
      const source = fromSource ? state.fromNode.id : state.toNode.id;
      const target = fromSource ? state.toNode.id : state.fromNode.id;
      const error = connectionError({ source, target }, graph);
      if (error) {
        setConnectionFeedback(error);
        return;
      }
    }
    setConnectionFeedback('Connect an output handle to an input handle on another node.');
  };

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const kind = event.dataTransfer.getData(NODE_DRAG_TYPE);
    if (isNodeKind(kind)) onAdd(kind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false }));
  }

  return (
    <section className="editor-canvas" aria-label="Workflow canvas" aria-describedby={instructions} tabIndex={0} ref={canvasRef}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(NODE_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = graph.nodes.length >= MAX_NODES ? 'none' : 'copy';
      }}
      onDrop={drop}
    >
      <p className="sr-only" id={instructions}>Select nodes or connections on the canvas. Use Delete or Backspace to remove the selection.</p>
      <ReactFlow<EditorNode, EditorEdge>
        nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes}
        {...{ onNodesChange, onEdgesChange, onConnect, isValidConnection }}
        onConnectStart={() => setConnectionFeedback('')} onConnectEnd={finishConnection}
        onClickConnectStart={() => setConnectionFeedback('')} onClickConnectEnd={finishConnection}
        onPaneClick={() => setConnectionFeedback('')}
        onNodeClick={(_, node) => { if (execution?.statuses.has(node.id)) execution.inspect(node.id); }}
        nodeExtent={extent} defaultEdgeOptions={edgeOptions}
        forceColorMode="dark" minZoom={.25} maxZoom={2} fitView fitViewOptions={fitOptions}
        edgesReconnectable={false} zoomOnScroll={false} snapToGrid={snap} snapGrid={[GRID_SPACING, GRID_SPACING]}
        deleteKeyCode={null} connectionRadius={23}
        aria-label="Workflow graph"
      >
        <Background variant={BackgroundVariant.Dots} color={snap ? "#6a508b" : "#554372"} gap={GRID_SPACING} size={1.15} />
        <Controls showInteractive={false} showFitView={false} aria-label="Canvas controls" />
        {mapOpen && <MiniMap<EditorNode> pannable zoomable ariaLabel="Workflow overview map" nodeColor={node => nodeCatalog[node.type].color} />}
      </ReactFlow>
      <div className="editor-canvas-tools">
        <button type="button" className="editor-button" disabled={!graph.nodes.length}
          onClick={() => void fitView({ ...fitOptions, duration: reduce ? 0 : 200 })}><Focus size={15} aria-hidden="true" /> Fit workflow</button>
        <button type="button" className="editor-button" aria-label="Minimap" aria-pressed={mapOpen} onClick={() => setMapOpen(!mapOpen)}>
          <Map size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="editor-connection-feedback" role="status">{connectionFeedback}</div>
      {graph.nodes.length === 0 && (
        <div className="editor-canvas-empty">
          <span className="editor-canvas-empty-icon" aria-hidden="true"><WorkflowIcon size={27} /></span>
          <strong>Add your first node</strong>
          <p>Start with a Manual Trigger, then add a step. Drag from an output handle to an input to connect them.</p>
          <button type="button" className="editor-button editor-button-primary" onClick={onAddTrigger}>
            <Plus size={16} aria-hidden="true" /> Add Manual Trigger
          </button>
          <span>You can also drag nodes here from the palette.</span>
        </div>
      )}
    </section>
  );
}
