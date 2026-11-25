import { z } from 'zod';
import {
  workflowEdgesSchema, workflowNodesSchema, type ConfiguredWorkflowNode,
} from '../validators/workflow-graph.schema';
import type { GraphIssue } from './execution.types';
import { executionPath } from './graph-traversal';

const graphSchema = z.object({ nodes: workflowNodesSchema, edges: workflowEdgesSchema });

type GraphValidation =
  | { valid: true; orderedNodes: ConfiguredWorkflowNode[] }
  | { valid: false; issues: GraphIssue[] };

function invalid(issue: GraphIssue): GraphValidation {
  return { valid: false, issues: [issue] };
}

export function validateExecutionGraph(graph: unknown): GraphValidation {
  let parsed;
  try {
    parsed = graphSchema.safeParse(graph);
  } catch {
    return invalid({ code: 'INVALID_CONFIGURATION', message: 'Workflow graph must contain readable node and edge data.' });
  }
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(issue => ({
        code: 'INVALID_CONFIGURATION',
        message: issue.code === 'unrecognized_keys' ? 'Unexpected configuration fields.'
          : issue.code === 'invalid_union' ? 'Unsupported node type.' : issue.message,
        path: issue.path.map(String),
      })),
    };
  }

  const { nodes, edges } = parsed.data;
  const nodeById = new Map<string, ConfiguredWorkflowNode>();
  for (const node of nodes) {
    if (nodeById.has(node.id)) {
      return invalid({ code: 'DUPLICATE_NODE_ID', message: 'Node IDs must be unique.', nodeId: node.id });
    }
    nodeById.set(node.id, node);
  }

  const triggers = nodes.filter(node => node.type === 'manualTrigger');
  const [trigger] = triggers;
  if (triggers.length !== 1 || !trigger) {
    return invalid({ code: 'TRIGGER_COUNT', message: 'Exactly one manual trigger is required.' });
  }

  const edgeIds = new Set<string>();
  const hasPredecessor = new Set<string>();
  const successorById = new Map<string, ConfiguredWorkflowNode>();
  for (const edge of edges) {
    const edgeId = edge.id;
    if (edgeIds.has(edgeId)) {
      return invalid({ code: 'DUPLICATE_EDGE_ID', message: 'Edge IDs must be unique.', edgeId });
    }
    edgeIds.add(edgeId);

    const target = nodeById.get(edge.target);
    if (!nodeById.has(edge.source) || !target) {
      return invalid({ code: 'UNKNOWN_NODE', message: 'Every edge must connect two existing nodes.', edgeId });
    }
    if (successorById.has(edge.source)) {
      return invalid({ code: 'BRANCHING', message: 'A node can have at most one outgoing edge.', nodeId: edge.source, edgeId });
    }
    if (hasPredecessor.has(edge.target)) {
      return invalid({ code: 'MERGING', message: 'A node can have at most one incoming edge.', nodeId: edge.target, edgeId });
    }
    successorById.set(edge.source, target);
    hasPredecessor.add(edge.target);
  }

  const roots = nodes.filter(node => !hasPredecessor.has(node.id));
  const paths = roots.map(root => executionPath(root, successorById));
  // In a linear graph, a component without a root is a cycle.
  if (paths.reduce((count, path) => count + path.length, 0) !== nodes.length) {
    return invalid({ code: 'CYCLE', message: 'Execution graphs cannot contain cycles.' });
  }
  if (hasPredecessor.has(trigger.id)) {
    return invalid({ code: 'TRIGGER_HAS_PREDECESSOR', message: 'The manual trigger cannot have an incoming edge.', nodeId: trigger.id });
  }
  const [path] = paths;
  if (paths.length !== 1 || !path) {
    return invalid({ code: 'DISCONNECTED', message: 'Every node must be on the path from the manual trigger.' });
  }
  return { valid: true, orderedNodes: path };
}
