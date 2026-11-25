export type WorkflowJsonValue =
  | string
  | number
  | boolean
  | null
  | WorkflowJsonValue[]
  | { [key: string]: WorkflowJsonValue };

/** Persist only non-secret settings. API keys, passwords, and integration credentials belong in separate storage. */
export type WorkflowConfiguration = Record<string, WorkflowJsonValue>;

export type WorkflowNode<TData extends WorkflowConfiguration = WorkflowConfiguration> = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: TData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
};
