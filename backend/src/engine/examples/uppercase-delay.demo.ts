import type { WorkflowEdge, WorkflowJsonValue } from '../../db/workflow.types';
import type { ConfiguredWorkflowNode } from '../../validators/workflow-graph.schema';
import { executeWorkflow } from '../execution-engine';

const nodes: ConfiguredWorkflowNode[] = [
  { id: 'start', type: 'manualTrigger', position: { x: 0, y: 0 }, data: {} },
  { id: 'uppercase', type: 'transform', position: { x: 200, y: 0 }, data: { operation: 'uppercase' } },
  { id: 'wait', type: 'delay', position: { x: 400, y: 0 }, data: { durationMs: 1000 } },
];
const edges: WorkflowEdge[] = [
  { id: 'start-to-uppercase', source: 'start', target: 'uppercase' },
  { id: 'uppercase-to-wait', source: 'uppercase', target: 'wait' },
];
const input: WorkflowJsonValue = { text: 'hello nexora' };
const labels: Record<ConfiguredWorkflowNode['type'], string> = {
  manualTrigger: 'Manual Trigger',
  transform: 'Transform (uppercase)',
  delay: 'Delay (1000 ms)',
};

async function main() {
  console.log('Nexora Phase 3A execution demo\n');
  const result = await executeWorkflow({ nodes, edges }, input);
  const order = result.nodes.map(node => labels[node.nodeType]).join(' → ');
  console.log('Execution order: %s\n', order || '(no nodes ran)');

  for (const [index, node] of result.nodes.entries()) {
    console.log('%d. %s — %s (%s ms)', index + 1, labels[node.nodeType], node.status, node.durationMs.toFixed(2));
    console.log('   Input:  %s', JSON.stringify(node.input));
    if (node.status === 'success') {
      console.log('   Output: %s\n', JSON.stringify(node.output));
    } else {
      console.log('   Error:  %s (%s)\n', node.error.message, node.error.code);
    }
  }

  console.log('Overall status: %s', result.status);
  console.log('Total duration: %s ms', result.durationMs.toFixed(2));
  console.log('Final output:   %s', JSON.stringify(result.output));
  if (result.status !== 'success') {
    console.error('%s (%s)', result.error.message, result.error.code);
    process.exitCode = 1;
  }
}

void main().catch(error => {
  console.error('Demo failed:', error);
  process.exitCode = 1;
});
