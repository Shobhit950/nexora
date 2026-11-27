import { Check, ChevronDown, CircleAlert, Clipboard, LoaderCircle, Play, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { RunError, RunNodeResult, RunStatus, WorkflowJson } from '../../services/workflowExecution';
import { nodeCatalog } from './graph';
import { copyRunJson, parseRunInput, runDuration, runStatusLabel, runTime, shortRunTime, type ExecutionPanelState } from './executionPresentation';

export function WorkflowRunDialog({ text, dirty, saving, saveError, onTextChange, onCancel, onRun }: {
  text: string;
  dirty: boolean;
  saving: boolean;
  saveError: string;
  onTextChange: (value: string) => void;
  onCancel: () => void;
  onRun: (input: WorkflowJson) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const [validationError, setValidationError] = useState('');

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    input.current?.focus();
    return () => element?.close();
  }, []);

  return (
    <dialog className="editor-run-dialog" ref={dialog} aria-labelledby={id + '-title'}
      onCancel={event => { event.preventDefault(); if (!saving) onCancel(); }}>
      <motion.form className="editor-run-form" initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .18 }}
        onSubmit={event => {
          event.preventDefault();
          if (saving) return;
          const result = parseRunInput(text);
          if ('error' in result) {
            setValidationError(result.error);
            input.current?.focus();
            return;
          }
          setValidationError('');
          onRun(result.input);
        }}>
        <header className="editor-run-header">
          <div><h2 id={id + '-title'}>Run workflow</h2><p>Set the input for this execution.</p></div>
          <button type="button" className="editor-button editor-run-icon" aria-label="Close run input" disabled={saving} onClick={onCancel}><X size={18} aria-hidden="true" /></button>
        </header>
        {dirty && <p className="editor-run-warning"><CircleAlert size={17} aria-hidden="true" />
          You have unsaved canvas changes. Save them before running this workflow.</p>}
        <div className="editor-run-field">
          <label htmlFor={id + '-input'}>JSON input</label>
          <textarea id={id + '-input'} ref={input} spellCheck={false} disabled={saving} value={text}
            onChange={event => { onTextChange(event.target.value); setValidationError(''); }}
            aria-invalid={Boolean(validationError)}
            aria-describedby={id + '-hint' + (validationError ? ' ' + id + '-error' : '')} />
          <p id={id + '-hint'}>For a Transform node, include a string in <code>text</code>.</p>
          {validationError && <p className="editor-run-field-error" role="alert" id={id + '-error'}>{validationError}</p>}
        </div>
        {saveError && <p className="editor-alert" role="alert"><CircleAlert size={17} aria-hidden="true" />{saveError}</p>}
        <footer className="editor-run-dialog-actions">
          <button type="button" className="editor-button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="editor-button editor-run-primary" disabled={saving}>
            {saving ? <LoaderCircle className="spinner" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {saving ? 'Saving…' : dirty ? 'Save and Run' : 'Run Workflow'}
          </button>
        </footer>
      </motion.form>
    </dialog>
  );
}

function Status({ status, timeout }: { status: RunStatus; timeout?: boolean }) {
  return <span className="editor-run-status" data-run-status={status}>{timeout ? 'Timed out' : runStatusLabel[status]}</span>;
}

function ErrorDetails({ error }: { error: RunError }) {
  return (
    <div className="editor-run-error">
      <code>{error.code}</code>
      <p>{error.message}</p>
      {Boolean(error.issues?.length) && <ul>
        {error.issues?.map((issue, index) => (
          <li key={index}>{issue.message}{issue.nodeId && <> <code>{issue.nodeId}</code></>}</li>
        ))}
      </ul>}
    </div>
  );
}

function highlightJson(text: string): ReactNode {
  if (text.length > 50_000) return text;
  const tokens = /"(?:\\.|[^"\\])*"(?:\s*(?=:))?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  const content: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(tokens)) {
    const start = match.index;
    const token = match[0];
    const kind = token.startsWith('"') ? (text[start + token.length] === ':' ? 'key' : 'string')
      : /^[a-z]/.test(token) ? 'literal' : 'number';
    content.push(text.slice(end, start), <span key={start} className={'editor-json-' + kind}>{token}</span>);
    end = start + token.length;
  }
  content.push(text.slice(end));
  return content;
}

function Output({ label, value, allowCopy = false }: { label: string; value: WorkflowJson; allowCopy?: boolean }) {
  const [feedback, setFeedback] = useState<'copied' | 'failed'>();
  const text = JSON.stringify(value, null, 2);

  return (
    <div className="editor-run-io">
      <div>
        <strong>{label}</strong>
        {allowCopy && <button className="editor-button editor-run-copy" type="button" data-copied={feedback === 'copied'}
          onClick={event => { void copyRunJson(text, event.currentTarget).then(ok => setFeedback(ok ? 'copied' : 'failed')); }}>
          {feedback === 'copied' ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
          {feedback === 'copied' ? 'Copied!' : 'Copy JSON'}
        </button>}
      </div>
      <pre tabIndex={0} aria-label={label}><code>{highlightJson(text)}</code></pre>
      {allowCopy && <p role="status">{feedback === 'copied' ? <span className="sr-only">{label} copied.</span>
        : feedback === 'failed' ? 'Clipboard access failed. Select the JSON and copy it manually.' : null}</p>}
    </div>
  );
}

function NodeResult({ node, id }: { node: RunNodeResult; id: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li data-run-status={node.status}>
      <details id={id} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary>
          <ChevronDown size={15} aria-hidden="true" />
          <span>{nodeCatalog[node.nodeType].label}<small>{runDuration(node.durationMs)}</small></span>
          <Status status={node.status} timeout={node.status !== 'success' && node.error.code === 'TIMEOUT'} />
        </summary>
        {expanded && <div className="editor-run-step-body">
          <p className="editor-run-node-id">Node ID <code>{node.nodeId}</code></p>
          <details className="editor-run-data"><summary>Input JSON</summary><Output label="Node input" value={node.input} /></details>
          {node.status === 'success'
            ? <details className="editor-run-data"><summary>Output JSON</summary><Output label="Node output" value={node.output} allowCopy /></details>
            : <ErrorDetails error={node.error} />}
        </div>}
      </details>
    </li>
  );
}

export function WorkflowExecutionInspector({ state, workflowName, graphChanged, inspectTarget, active, unexecuted }: {
  state: ExecutionPanelState | undefined;
  workflowName: string;
  graphChanged: boolean;
  inspectTarget: { nodeId: string } | null;
  active: boolean;
  unexecuted: number;
}) {
  const id = useId();
  const report = state?.phase === 'report' ? state.report : null;

  useEffect(() => {
    if (active && inspectTarget) {
      const detail = document.getElementById(id + '-' + inspectTarget.nodeId);
      if (detail instanceof HTMLDetailsElement) {
        detail.open = true;
        detail.querySelector('summary')?.focus();
      }
    }
  }, [id, inspectTarget, active]);

  return (
    <section className="editor-execution-inspector" aria-labelledby={id}>
      <header className="editor-run-header">
        <div><h2 id={id}>{report?.workflowName ?? workflowName}</h2></div>
      </header>
      <p className="sr-only" role="status">
        {state?.phase === 'running' ? 'Workflow running' : report ? 'Workflow execution ' + runStatusLabel[report.status].toLowerCase() : state?.phase === 'error' ? 'Workflow request failed' : ''}
      </p>
      {!state && <p className="editor-panel-hint">Run this workflow to inspect its output and node results.</p>}
      {state?.phase === 'running' && <div className="editor-run-wait">
        <LoaderCircle size={20} className="spinner" aria-hidden="true" />
        <div><strong>Running workflow…</strong><p>Results will appear when the server returns its report.</p></div>
      </div>}
      {state?.phase === 'error' && <p className="editor-alert" role="alert"><CircleAlert size={17} aria-hidden="true" />{state.message}</p>}
      {report && (
        <div className="editor-run-result" key={report.startedAt}>
          <div className="editor-run-outcome"><Status status={report.status} timeout={report.status !== 'success' && report.error.code === 'TIMEOUT'} />
            <strong>{runDuration(report.durationMs)}</strong></div>
          {graphChanged && <p className="editor-run-warning">These results reflect an earlier version of the canvas.</p>}
          <dl className="editor-run-timing">
            <div><dt>Started</dt><dd><time dateTime={report.startedAt} title={runTime(report.startedAt)}>{shortRunTime(report.startedAt)}</time></dd></div>
            <div><dt>Finished</dt><dd><time dateTime={report.finishedAt} title={runTime(report.finishedAt)}>{shortRunTime(report.finishedAt)}</time></dd></div>
          </dl>
          {report.status !== 'success' && <ErrorDetails error={report.error} />}
          <Output label="Final output" value={report.output} allowCopy />
          <section aria-labelledby={id + '-nodes'} className="editor-run-steps">
            <h3 id={id + '-nodes'}>Node results <span>{report.nodes.length} attempted</span></h3>
            {unexecuted > 0 && <p>{unexecuted} {unexecuted === 1 ? 'node was' : 'nodes were'} skipped.</p>}
            {!report.nodes.length ? <p>No nodes ran.</p> :
              <ol>{report.nodes.map(node => <NodeResult key={node.nodeId} id={id + '-' + node.nodeId} node={node} />)}</ol>}
          </section>
        </div>
      )}
    </section>
  );
}
