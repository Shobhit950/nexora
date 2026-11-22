import { ArrowRight, CircleDot, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Dropdown } from '../Dropdown';
import {
  isValidConnection, MAX_EDGES, MAX_NODES, NODE_DRAG_TYPE, nodeCatalog, operations, parseDuration,
  type ConnectionEndpoints, type EditorGraph, type EditorNode, type NodeKind,
} from './graph';
import { WorkflowNodeIcon } from './WorkflowNodes';

const kinds = ['manualTrigger', 'transform', 'delay'] as const;
const operationLabels = { trim: 'Trim whitespace', uppercase: 'Uppercase', lowercase: 'Lowercase' };
const operationOptions = operations.map(value => ({ value, label: operationLabels[value] }));

export function NodePalette({ count, hidden, onAdd }: { count: number; hidden: boolean; onAdd: (kind: NodeKind) => void }) {
  const disabled = count >= MAX_NODES;
  return (
    <aside id="editor-node-palette" className="editor-panel editor-palette" aria-labelledby="editor-library-title" hidden={hidden}>
      <div className="editor-panel-header"><h2 id="editor-library-title">Node palette</h2><span>{count}/{MAX_NODES}</span></div>
      <p className="editor-panel-hint">Drag or choose a node to add it.</p>
      <div className="editor-palette-list">
        {kinds.map(kind => {
          const { label, description } = nodeCatalog[kind];
          return (
            <button key={kind} type="button" className="editor-palette-option" draggable={!disabled} disabled={disabled}
              aria-label={'Add ' + label} onClick={() => onAdd(kind)}
              onDragStart={event => {
                event.dataTransfer.setData(NODE_DRAG_TYPE, kind);
                event.dataTransfer.effectAllowed = 'copy';
              }}>
              <WorkflowNodeIcon kind={kind} size={17} />
              <span className="editor-palette-copy"><strong>{label}</strong><small>{description}</small></span>
              <Plus size={15} className="editor-add-icon" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {disabled && <p className="editor-panel-hint">Node limit reached.</p>}
    </aside>
  );
}

function Connections({ node, graph, onConnect }: {
  node: EditorNode; graph: EditorGraph; onConnect: (connection: ConnectionEndpoints) => void;
}) {
  const [target, setTarget] = useState('');
  const targets = graph.nodes.flatMap((candidate, index) => (
    isValidConnection({ source: node.id, target: candidate.id }, graph)
      ? [{ value: candidate.id, label: nodeCatalog[candidate.type].label + ' - Node ' + (index + 1) }] : []
  ));
  const available = targets.some(option => option.value === target);
  if (graph.edges.length >= MAX_EDGES) return <p className="editor-panel-hint">Connection limit reached.</p>;
  if (!targets.length) return null;

  return (
    <div className="editor-node-connect">
      <h3>Connect to a node</h3>
      <Dropdown label="Connection target" value={available ? target : ''} options={[{ value: '', label: 'Choose a node' }, ...targets]} onChange={setTarget} />
      <button type="button" className="editor-button" disabled={!available} onClick={() => {
        onConnect({ source: node.id, target });
        setTarget('');
      }}>
        <ArrowRight size={16} aria-hidden="true" /> Connect
      </button>
    </div>
  );
}

export function NodeInspector({ graph, hidden, onUpdate, onConnect, onRemove, onFinishEdit }: {
  graph: EditorGraph;
  hidden: boolean;
  onFinishEdit: () => void;
  onUpdate: (node: EditorNode) => void;
  onConnect: (connection: ConnectionEndpoints) => void;
  onRemove: () => void;
}) {
  const inputId = useId();
  const selectedNodes = graph.nodes.filter(node => node.selected);
  const selectedEdges = graph.edges.filter(edge => edge.selected);
  const count = selectedNodes.length + selectedEdges.length;
  const node = count === 1 ? selectedNodes[0] : undefined;
  const edge = count === 1 ? selectedEdges[0] : undefined;
  const invalidDuration = node?.type === 'delay' && parseDuration(node.data.durationMs) === null;

  return (
    <aside id="editor-node-settings" className="editor-panel editor-inspector" aria-labelledby="editor-settings-title" hidden={hidden}>
      <div className="editor-panel-header"><h2 id="editor-settings-title">Settings</h2><SlidersHorizontal size={16} aria-hidden="true" /></div>
      {node ? <>
        <div className="editor-settings-node">
          <WorkflowNodeIcon kind={node.type} />
          <div><strong>{nodeCatalog[node.type].label}</strong><small>Node {graph.nodes.indexOf(node) + 1}</small></div>
        </div>
        {node.type === 'manualTrigger' && <p className="editor-panel-hint">This node marks the starting point for a manually triggered workflow. Connect its output to the next step.</p>}
        {node.type === 'transform' && (
          <div className="editor-field">
            <span>Operation</span>
            <Dropdown label="Transform operation" value={node.data.operation} options={operationOptions}
              onChange={operation => onUpdate({ ...node, data: { operation } })} />
          </div>
        )}
        {node.type === 'delay' && (
          <div className="editor-field">
            <label htmlFor={inputId}>Duration (ms)</label>
            <input id={inputId} type="number" min={1} max={60000} step={1} value={node.data.durationMs}
              aria-describedby={inputId + '-hint'} aria-invalid={invalidDuration} onBlur={onFinishEdit}
              onChange={event => onUpdate({ ...node, data: { durationMs: event.target.value } })} />
            <p id={inputId + '-hint'} className={invalidDuration ? 'editor-field-error' : 'editor-panel-hint'}>
              Enter a whole number from 1 to 60,000.
            </p>
          </div>
        )}
        <Connections key={node.id} node={node} graph={graph} onConnect={onConnect} />
      </> : edge ? (
        <p className="editor-panel-hint">Connection selected. Use the button below to remove it.</p>
      ) : count ? (
        <p className="editor-panel-hint">{count} items selected. Select one node to edit its settings.</p>
      ) : (
        <div className="editor-inspector-empty"><CircleDot size={23} aria-hidden="true" /><p>Select a node to see its settings.</p></div>
      )}
      {count > 0 && (
        <button className="editor-button editor-delete-selection" type="button" onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />{node ? 'Delete node' : edge ? 'Delete connection' : 'Delete selected'}
        </button>
      )}
    </aside>
  );
}
