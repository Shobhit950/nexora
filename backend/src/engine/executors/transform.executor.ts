import type { WorkflowJsonValue } from '../../db/workflow.types';
import type { ConfiguredWorkflowNode } from '../../validators/workflow-graph.schema';

type Operation = Extract<ConfiguredWorkflowNode, { type: 'transform' }>['data']['operation'];
const transformText: Record<Operation, (text: string) => string> = {
  trim: text => text.trim(),
  uppercase: text => text.toUpperCase(),
  lowercase: text => text.toLowerCase(),
};

export class InvalidTransformInputError extends Error {
  constructor() {
    super('Transform input must be an object with a string text field.');
  }
}

export function executeTransform(input: WorkflowJsonValue, operation: Operation): WorkflowJsonValue {
  if (input === null || typeof input !== 'object' || Array.isArray(input) || typeof input.text !== 'string') {
    throw new InvalidTransformInputError();
  }
  return { ...input, text: transformText[operation](input.text) };
}
