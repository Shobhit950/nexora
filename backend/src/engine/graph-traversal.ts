import type { ConfiguredWorkflowNode } from '../validators/workflow-graph.schema';

// Each node in a path from a root has at most one incoming and one outgoing edge.
export function executionPath(
  root: ConfiguredWorkflowNode,
  successorById: ReadonlyMap<string, ConfiguredWorkflowNode>,
): ConfiguredWorkflowNode[] {
  const path: ConfiguredWorkflowNode[] = [];
  for (let node: ConfiguredWorkflowNode | undefined = root; node; node = successorById.get(node.id)) {
    path.push(node);
  }
  return path;
}
