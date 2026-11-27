import { createContext } from 'react';
import type { RunStatus, WorkflowJson, WorkflowRunReport } from '../../services/workflowExecution';

export type ExecutionPanelState =
  | { phase: 'running' }
  | { phase: 'report'; report: WorkflowRunReport; signature: string }
  | { phase: 'error'; message: string };

export const runStatusLabel: Record<RunStatus, string> = {
  success: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled',
};

export const CanvasExecutionContext = createContext<{
  statuses: ReadonlyMap<string, RunStatus>;
  inspect: (nodeId: string) => void;
} | null>(null);

const durationNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
export const runDuration = (ms: number) => ms >= 1000 ? durationNumber.format(ms / 1000) + ' s'
  : ms > 0 && ms < .01 ? '< 0.01 ms' : durationNumber.format(ms) + ' ms';

const date = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  fractionalSecondDigits: 3, timeZoneName: 'short',
});
export const runTime = (stamp: string) => date.format(new Date(stamp));
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const shortRunTime = (stamp: string) => time.format(new Date(stamp));

export async function copyRunJson(text: string, trigger: HTMLButtonElement): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Try the synchronous clipboard command if the browser denies Clipboard API access.
    }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.className = 'editor-copy-buffer';
  (trigger.closest('dialog[open]') ?? document.body).append(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, field.value.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    trigger.focus({ preventScroll: true });
  }
}

function inputProblem(value: WorkflowJson, depth = 0): string | undefined {
  if (depth > 24) return 'JSON input can be nested up to 24 levels.';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'Use finite JSON numbers.';
  if (value === null || typeof value !== 'object') return;

  for (const [key, field] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return 'Remove reserved property names (__proto__, constructor, or prototype).';
    }
    const problem = inputProblem(field, depth + 1);
    if (problem) return problem;
  }
}

export function parseRunInput(source: string): { input: WorkflowJson } | { error: string } {
  if (!source.trim()) return { error: 'Enter a JSON value. Use null if this run needs no input.' };
  let input: WorkflowJson;
  try {
    input = JSON.parse(source) as WorkflowJson;
  } catch {
    return { error: 'Enter valid JSON. Use double quotes around keys and strings, and remove trailing commas.' };
  }
  const problem = inputProblem(input);
  if (problem) return { error: problem };
  if (new TextEncoder().encode(JSON.stringify({ input })).length > 16 * 1024) {
    return { error: 'The JSON input and its request wrapper must fit within 16 KB.' };
  }
  return { input };
}
