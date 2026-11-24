import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow,
  useReactFlow, type IsValidConnection, type OnConnect, type OnConnectEnd, type OnEdgesChange, type OnNodesChange, type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import { useId, useState, type DragEvent, type RefObject } from 'react';
import {
  connectionError, GRID_SPACING, isNodeKind, MAX_COORDINATE, MAX_NODES, NODE_DRAG_TYPE, nodeCatalog, type EditorEdge, type EditorGraph, type EditorNode, type NodeKind,
} from './graph';
import { WorkflowNodeCard } from './WorkflowNodes';

const nodeTypes = { manualTrigger: WorkflowNodeCard, transform: WorkflowNodeCard, delay: WorkflowNodeCard };
const edgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, width: 17, height: 17, color: '#a984df' } };
const extent: [[number, number], [number, number]] = [[-MAX_COORDINATE, -MAX_COORDINATE], [MAX_COORDINATE, MAX_COORDINATE]];

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
  const { screenToFlowPosition } = useReactFlow<EditorNode, EditorEdge>();

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
    if (isNodeKind(kind)) onAdd(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false }));
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
        nodeExtent={extent} defaultEdgeOptions={edgeOptions}
        forceColorMode="dark" minZoom={.25} maxZoom={2} fitView fitViewOptions={{ padding: .24, maxZoom: 1 }}
        edgesReconnectable={false} zoomOnScroll={false} snapToGrid={snap} snapGrid={[GRID_SPACING, GRID_SPACING]}
        deleteKeyCode={null} connectionRadius={23}
        aria-label="Workflow graph"
      >
        <Background variant={BackgroundVariant.Dots} color={snap ? "#6a508b" : "#554372"} gap={GRID_SPACING} size={1.15} />
        <Controls showInteractive={false} aria-label="Canvas controls" />
        <MiniMap<EditorNode> pannable zoomable ariaLabel="Workflow overview map" nodeColor={node => nodeCatalog[node.type].color} />
      </ReactFlow>
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
