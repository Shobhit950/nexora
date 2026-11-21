import { Check, Database, GitBranch, Mail, Network, RotateCcw, Sparkles, Webhook } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export type FlowStep = { name: string; icon: LucideIcon; detail?: string };

export const samplePrompt = 'Whenever a customer submits a contact form, save their details, send a welcome email, and notify the sales team if their budget exceeds ₹50,000.';

export const sampleSteps: FlowStep[] = [
  { name: 'Webhook', icon: Webhook, detail: 'Contact form submitted' },
  { name: 'Save Contact', icon: Database, detail: 'Store customer details' },
  { name: 'Send Email', icon: Mail, detail: 'Deliver a welcome email' },
  { name: 'Budget Condition', icon: GitBranch, detail: 'Budget exceeds ₹50,000' },
  { name: 'Notify Sales', icon: Network, detail: 'Only when the condition is met' },
];

export function WorkflowStrip({ steps, revealed = steps.length }: { steps: FlowStep[]; revealed?: number }) {
  return (
    <ol className="nx-strip">
      {steps.map(({ name, icon: Icon, detail }, index) => (
        <li className="nx-strip-node" key={name} data-ready={index < revealed} aria-hidden={index >= revealed || undefined}>
          <span className="nx-node-icon"><Icon size={17} aria-hidden="true" /></span>
          <div><strong>{name}</strong>{detail && <small>{detail}</small>}</div>
        </li>
      ))}
    </ol>
  );
}

function useDemoClock(inView: boolean, duration: number) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const finished = elapsed >= duration;

  useEffect(() => {
    if (reduced || !inView || finished) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      setElapsed(current => Math.min(current + delta, duration));
    }, 55);
    return () => window.clearInterval(timer);
  }, [inView, duration, finished, reduced]);

  function replay() { setElapsed(0); }

  return { time: reduced ? duration : elapsed, replay, reduced };
}

const canvasNodes = [
  { name: 'Webhook Trigger', icon: Webhook, x: 19, y: 48 },
  { name: 'AI Processing', icon: Sparkles, x: 51, y: 48 },
  { name: 'Condition', icon: GitBranch, x: 80, y: 26 },
  { name: 'Database', icon: Database, x: 50, y: 80 },
  { name: 'Send Email', icon: Mail, x: 81, y: 70 },
];

const canvasEdges = [
  { path: 'M19 48H51', delay: 0 },
  { path: 'M51 48C65 48 65 26 80 26', delay: .64 },
  { path: 'M51 48L50 80', delay: 1.28 },
  { path: 'M51 48C63 48 65 70 81 70', delay: 1.92 },
];

export function EditorPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: .3 });
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  return (
    <div className="nx-editor" ref={ref}>
      <div className="nx-editor-bar">
        <span><Network size={15} aria-hidden="true" /> Workflow canvas</span>
        <span className="nx-preview-label">Concept preview</span>
      </div>
      <div className="nx-editor-canvas" data-flowing={visible && !reduced} key={cycle}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {canvasEdges.map(({ path }) => <path d={path} className="nx-edge-track" key={path} />)}
          {!reduced && canvasEdges.map(({ path, delay }) => (
            <path d={path} key={'pulse-' + path} pathLength={1} className="nx-edge-pulse" style={{ animationDelay: delay + 's' }} />
          ))}
        </svg>
        {canvasNodes.map(({ name, icon: Icon, x, y }, index) => (
          <div className="nx-editor-node" key={name} style={{ left: x + '%', top: y + '%', animationDelay: index * .64 + 's' }}>
            <span className="nx-node-icon"><Icon size={16} aria-hidden="true" /></span>
            <span>{name}</span>
          </div>
        ))}
      </div>
      <div className="nx-editor-bar nx-editor-footer">
        <span className="nx-demo-status"><i />{reduced ? 'Workflow preview' : 'Looping preview'}</span>
        {!reduced && <button className="nx-replay" type="button" onClick={() => setCycle(current => current + 1)}><RotateCcw size={14} aria-hidden="true" /> Replay canvas</button>}
      </div>
    </div>
  );
}

const typingDuration = 3900;
const planningDuration = 680;
const revealInterval = 340;
const promptEnd = typingDuration + planningDuration + sampleSteps.length * revealInterval;

export function PromptDemo() {
  const ref = useRef<HTMLElement>(null);
  const { time, replay, reduced } = useDemoClock(useInView(ref, { amount: .2 }), promptEnd);
  const characters = Math.min(samplePrompt.length, Math.floor(time / typingDuration * samplePrompt.length));
  const revealed = Math.max(0, Math.min(sampleSteps.length, Math.floor((time - typingDuration - planningDuration) / revealInterval) + 1));
  const status = time >= promptEnd ? 'Example workflow ready' : time >= typingDuration ? 'Assembling the example' : 'Typing the example prompt';

  return (
    <section id="prompt-demo" className="nx-section nx-prompt" ref={ref} aria-labelledby="nx-prompt-title">
      <div className="nx-section-heading nx-split-heading">
        <div><p className="nx-kicker">PROMPT TO WORKFLOW</p><h2 id="nx-prompt-title">Start with a sentence.</h2></div>
        <p>Watch one request become a workflow with a trigger, three actions, and a decision.</p>
      </div>
      <div className="nx-prompt-window">
        <div className="nx-editor-bar">
          <span><Sparkles size={16} aria-hidden="true" /> AI workflow preview</span>
          <span className="nx-preview-label">Planned feature</span>
        </div>
        <div className="nx-prompt-content">
          <div className="nx-prompt-message">
            <p className="nx-prompt-caption">Example prompt</p>
            <p className="sr-only">{samplePrompt}</p>
            <p className="nx-typing" aria-hidden="true">
              <span className="nx-typing-reserve">{samplePrompt}</span>
              <span className="nx-typing-live">{samplePrompt.slice(0, characters)}{characters < samplePrompt.length && <i />}</span>
            </p>
          </div>
          <WorkflowStrip steps={sampleSteps} revealed={revealed} />
        </div>
        <div className="nx-editor-bar nx-editor-footer">
          <span className="nx-demo-status" role="status">{time >= promptEnd ? <Check size={16} aria-hidden="true" /> : <i />}{status}</span>
          {!reduced && <button className="nx-replay" type="button" onClick={replay}><RotateCcw size={14} aria-hidden="true" /> Replay demo</button>}
        </div>
      </div>
      <p className="nx-disclaimer">Illustrative preview of planned AI functionality. The workflow is simulated.</p>
    </section>
  );
}
