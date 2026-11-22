import { useCallback, useReducer } from 'react';
import { graphDraft, graphSignature, type EditorGraph } from './graph';

const limit = 60;
type Snapshot = { graph: EditorGraph; signature: string };
type History = {
  present: Snapshot;
  past: Snapshot[];
  future: Snapshot[];
  group: { key: string; before: Snapshot } | null;
};
type ChangeOptions = { viewOnly?: boolean; group?: string; finish?: boolean };
type Action =
  | { type: 'change'; update: (graph: EditorGraph) => EditorGraph; options: ChangeOptions }
  | { type: 'finish' }
  | { type: 'undo' }
  | { type: 'redo' };

function snapshot(graph: EditorGraph): Snapshot {
  return { graph, signature: graphSignature(graphDraft(graph)) };
}

function push(stack: Snapshot[], entry: Snapshot) {
  return [...stack.slice(-(limit - 1)), entry];
}

function finish(state: History): History {
  if (!state.group) return state;
  const { before } = state.group;
  if (before.signature === state.present.signature) return { ...state, group: null };
  return { ...state, group: null, past: push(state.past, before), future: [] };
}

function restore(entry: Snapshot, current: Snapshot): Snapshot {
  const selectedNodes = new Set(current.graph.nodes.filter(node => node.selected).map(node => node.id));
  const selectedEdges = new Set(current.graph.edges.filter(edge => edge.selected).map(edge => edge.id));
  return {
    ...entry,
    graph: {
      nodes: entry.graph.nodes.map(node => ({ ...node, selected: selectedNodes.has(node.id), dragging: false })),
      edges: entry.graph.edges.map(edge => ({ ...edge, selected: selectedEdges.has(edge.id) })),
    },
  };
}

function reducer(state: History, action: Action): History {
  if (action.type === 'change') {
    const { viewOnly, group, finish: finishAfter } = action.options;
    const graph = action.update(state.present.graph);
    if (viewOnly) return { ...state, present: { ...state.present, graph } };

    const base = group && state.group?.key === group ? state : finish(state);
    const present = graph === base.present.graph ? base.present : snapshot(graph);
    if (present.signature === base.present.signature) {
      const next = { ...base, present };
      return finishAfter ? finish(next) : next;
    }
    if (group) {
      const next = { ...base, present, group: base.group ?? { key: group, before: base.present } };
      return finishAfter ? finish(next) : next;
    }
    return { present, past: push(base.past, base.present), future: [], group: null };
  }

  const base = finish(state);
  if (action.type === 'finish') return base;
  if (action.type === 'undo') {
    const entry = base.past.at(-1);
    return entry ? {
      present: restore(entry, base.present),
      past: base.past.slice(0, -1),
      future: push(base.future, base.present),
      group: null,
    } : base;
  }

  const entry = base.future.at(-1);
  return entry ? {
    present: restore(entry, base.present),
    past: push(base.past, base.present),
    future: base.future.slice(0, -1),
    group: null,
  } : base;
}

export function useGraphHistory(initialGraph: EditorGraph) {
  const [state, dispatch] = useReducer(reducer, initialGraph, (graph): History => ({
    present: snapshot(graph), past: [], future: [], group: null,
  }));
  const changeGraph = useCallback((update: (graph: EditorGraph) => EditorGraph, options: ChangeOptions = {}) => {
    dispatch({ type: 'change', update, options });
  }, []);
  const finishEdit = useCallback(() => dispatch({ type: 'finish' }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const editing = state.group !== null && state.group.before.signature !== state.present.signature;
  return {
    ...state.present, changeGraph, finishEdit, undo, redo,
    canUndo: editing || state.past.length > 0,
    canRedo: !editing && state.future.length > 0,
  };
}

