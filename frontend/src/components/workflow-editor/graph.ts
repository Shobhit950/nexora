import type { Connection, Edge, Node, XYPosition } from '@xyflow/react';
import type { Workflow, WorkflowEdge, WorkflowNode } from '../../services/workflowApi';

export const MAX_NODES = 100;
export const MAX_EDGES = 200;
export const GRID_SPACING = 20;
export const MAX_COORDINATE = 1_000_000;
export const NODE_DRAG_TYPE = 'application/nexora-workflow-node';

export type NodeKind = WorkflowNode['type'];
export type TransformOperation = Extract<WorkflowNode, { type: 'transform' }>['data']['operation'];
export const operations = ['trim', 'uppercase', 'lowercase'] as const satisfies readonly TransformOperation[];

export const nodeCatalog = {
  manualTrigger: { label: 'Manual Trigger', description: 'Start when triggered manually', color: '#c5a0fc' },
  transform: { label: 'Transform', description: 'Change the format of text', color: '#91ddef' },
  delay: { label: 'Delay', description: 'Wait for a set duration', color: '#f0bc84' },
} satisfies Record<NodeKind, { label: string; description: string; color: string }>;

type DraftNode = Exclude<WorkflowNode, { type: 'delay' }> |
  (Omit<Extract<WorkflowNode, { type: 'delay' }>, 'data'> & { data: { durationMs: string } });

export type EditorNode = Node & DraftNode;
type StoredHandles = Pick<WorkflowEdge, 'sourceHandle' | 'targetHandle'>;
export type EditorEdge = Edge<{ storedHandles: StoredHandles }, NonNullable<WorkflowEdge['type']>>;
export type EditorGraph = { nodes: EditorNode[]; edges: EditorEdge[] };
export type ConnectionEndpoints = Pick<Connection, 'source' | 'target'>;

export function isNodeKind(value: string): value is NodeKind {
  return Object.hasOwn(nodeCatalog, value);
}

function newGraphId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createNode(type: NodeKind, position: XYPosition): EditorNode {
  const base = { id: newGraphId(), position, ariaLabel: nodeCatalog[type].label, selected: true };
  switch (type) {
    case 'manualTrigger': return { ...base, type, data: {} };
    case 'transform': return { ...base, type, data: { operation: 'trim' } };
    case 'delay': return { ...base, type, data: { durationMs: '1000' } };
  }
}

export function createEdge({ source, target }: ConnectionEndpoints): EditorEdge {
  return { id: newGraphId(), source, target, type: 'smoothstep', className: 'editor-edge-new' };
}

export function isValidConnection({ source, target }: ConnectionEndpoints, { nodes, edges }: EditorGraph) {
  return edges.length < MAX_EDGES &&
    source !== target &&
    nodes.some(node => node.id === source) &&
    nodes.some(node => node.id === target && node.type !== 'manualTrigger') &&
    !edges.some(edge => edge.source === source && edge.target === target);
}

export function hydrateGraph(workflow: Workflow): EditorGraph {
  return {
    nodes: workflow.nodes.map(node => {
      if (!isNodeKind(node.type)) throw new Error('This workflow contains a node type this editor cannot open.');
      const ariaLabel = nodeCatalog[node.type].label;
      if (node.type === 'delay') return { ...node, ariaLabel, data: { durationMs: String(node.data.durationMs) } };
      return { ...node, ariaLabel };
    }),
    // The editor shows one port per direction. Preserve handle IDs from existing API graphs on save.
    edges: workflow.edges.map(({ sourceHandle, targetHandle, ...edge }) => ({
      ...edge,
      data: { storedHandles: {
        ...(sourceHandle !== undefined && { sourceHandle }),
        ...(targetHandle !== undefined && { targetHandle }),
      } },
    })),
  };
}

export function graphDraft({ nodes, edges }: EditorGraph) {
  return {
    nodes: nodes.map((node): DraftNode => {
      const { id, type, data, position: { x, y } } = node;
      const base = { id, position: { x, y } };
      switch (type) {
        case 'manualTrigger': return { ...base, type, data: {} };
        case 'transform': return { ...base, type, data: { operation: data.operation } };
        case 'delay': return { ...base, type, data: { durationMs: data.durationMs } };
      }
    }),
    edges: edges.map(({ id, source, target, type, data }): WorkflowEdge => ({
      id, source, target, ...data?.storedHandles, ...(type !== undefined && { type }),
    })),
  };
}

export function parseDuration(value: string) {
  const duration = Number(value);
  return /^\d+$/.test(value) && Number.isInteger(duration) && duration >= 1 && duration <= 60_000
    ? duration : null;
}

export function graphSignature(draft: ReturnType<typeof graphDraft>) {
  const byId = (left: { id: string }, right: { id: string }) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  // Array order and equivalent duration formatting do not change the saved graph.
  return JSON.stringify({
    nodes: [...draft.nodes].sort(byId).map(node => node.type === 'delay'
      ? { ...node, data: { durationMs: parseDuration(node.data.durationMs) ?? node.data.durationMs } }
      : node),
    edges: [...draft.edges].sort(byId),
  });
}

const validGraphId = /^[A-Za-z0-9_.-]{1,64}$/;

export function prepareGraph(draft: ReturnType<typeof graphDraft>): { graph: Pick<Workflow, 'nodes' | 'edges'> } | { error: string } {
  if (draft.nodes.length > MAX_NODES || draft.edges.length > MAX_EDGES) {
    return { error: 'A workflow can have up to 100 nodes and 200 connections.' };
  }

  const ids = new Set<string>();
  const nodes: WorkflowNode[] = [];
  for (const node of draft.nodes) {
    const { x, y } = node.position;
    if (!validGraphId.test(node.id) || ids.has(node.id)) return { error: 'Each node needs a valid, unique ID.' };
    if (![x, y].every(value => Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE)) {
      return { error: 'Move nodes within the allowed canvas bounds before saving.' };
    }
    ids.add(node.id);
    if (node.type === 'delay') {
      const durationMs = parseDuration(node.data.durationMs);
      if (durationMs === null) return { error: 'Each Delay node needs a whole number from 1 to 60,000 ms.' };
      nodes.push({ ...node, data: { durationMs } });
    } else {
      if (node.type === 'transform' && !operations.includes(node.data.operation)) {
        return { error: 'Choose a valid operation for every Transform node.' };
      }
      nodes.push(node);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of draft.edges) {
    if (!validGraphId.test(edge.id) || edgeIds.has(edge.id)) return { error: 'Each connection needs a valid, unique ID.' };
    if (!ids.has(edge.source) || !ids.has(edge.target)) return { error: 'Each connection must link two existing nodes.' };
    edgeIds.add(edge.id);
  }

  const graph = { nodes, edges: draft.edges };
  if (new TextEncoder().encode(JSON.stringify(graph)).length > 102_400) {
    return { error: 'This workflow is too large to save. Remove some connections and try again.' };
  }
  return { graph };
}
