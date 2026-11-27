import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CaseSensitive, Check, CircleAlert, CircleMinus, Timer, Zap } from 'lucide-react';
import { memo, useContext } from 'react';
import { CanvasExecutionContext, runStatusLabel } from './executionPresentation';
import { nodeCatalog, parseDuration, type EditorNode, type NodeKind } from './graph';

const icons = { manualTrigger: Zap, transform: CaseSensitive, delay: Timer };
const number = new Intl.NumberFormat();
const statusIcons = { success: Check, failed: CircleAlert, cancelled: CircleMinus };

export function WorkflowNodeIcon({ kind, size = 19 }: { kind: NodeKind; size?: number }) {
  const Icon = icons[kind];
  return <span className="editor-node-icon" data-kind={kind} aria-hidden="true"><Icon size={size} /></span>;
}

export const WorkflowNodeCard = memo(function WorkflowNodeCard(props: NodeProps<EditorNode>) {
  const { id, type, data, selected, isConnectable } = props;
  const execution = useContext(CanvasExecutionContext);
  const status = execution?.statuses.get(id);
  const StatusIcon = status ? statusIcons[status] : null;
  const { label, description } = nodeCatalog[type];
  const duration = type === 'delay' ? parseDuration(data.durationMs) : null;
  const detail = type === 'manualTrigger' ? description
    : type === 'transform' ? 'Operation: ' + data.operation
      : duration === null ? 'Set a valid duration' : number.format(duration) + ' ms';

  return (
    <div className="editor-node-card" data-kind={type} data-selected={Boolean(selected)} data-run-status={status}>
      {/* A disabled hidden input port preserves edges to triggers already saved through the API. */}
      <Handle type="target" position={Position.Left} isConnectable={isConnectable && type !== 'manualTrigger'}
        className={type === 'manualTrigger' ? 'editor-legacy-handle' : undefined} aria-label={label + ' input'} />
      <WorkflowNodeIcon kind={type} />
      <div className="editor-node-label"><strong>{label}</strong><span>{detail}</span></div>
      {status && StatusIcon && <button type="button" className="editor-node-run-status nodrag nopan"
        aria-label={label + ' ' + runStatusLabel[status].toLowerCase() + '. Inspect result'}
        onClick={event => { event.stopPropagation(); execution?.inspect(id); }}>
        <StatusIcon size={14} aria-hidden="true" />
      </button>}
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} aria-label={label + ' output'} />
    </div>
  );
});
