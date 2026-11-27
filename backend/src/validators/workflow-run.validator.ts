import { z } from 'zod';
import type { WorkflowJsonValue } from '../db/workflow.types';

const maxInputDepth = 24;
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeJson(value: unknown, depth = 0): value is WorkflowJsonValue {
  if (depth > maxInputDepth) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(entry => isSafeJson(entry, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;

  return Object.entries(value).every(([key, entry]) => !unsafeKeys.has(key) && isSafeJson(entry, depth + 1));
}

export const runWorkflowSchema = z.strictObject({
  input: z.custom<WorkflowJsonValue>(value => isSafeJson(value)),
});
