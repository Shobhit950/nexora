import { Activity, Bot, Cable, Code2, Database, GitBranch, Inbox, LayoutGrid, LockKeyhole, Mail, MessageSquare, Sheet, Sparkles, Webhook, Zap } from 'lucide-react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { WorkflowStrip } from './WorkflowDemos';
import type { FlowStep } from './WorkflowDemos';

const features = [
  { title: 'AI workflow generation', detail: 'Turn a plain-language request into a draft you can refine.', icon: Sparkles, visual: ['Prompt', 'Draft'] },
  { title: 'Visual builder', detail: 'Connect and rearrange steps on a drag-and-drop canvas.', icon: LayoutGrid, visual: ['Trigger', 'Action', 'Result'] },
  { title: 'Smart triggers', detail: 'Start a workflow when a form, webhook, or app event arrives.', icon: Zap },
  { title: 'Conditional logic', detail: 'Send different inputs down different paths.', icon: GitBranch, visual: ['Check', 'Route'] },
  { title: 'Application integrations', detail: 'Move information between the tools your team uses.', icon: Cable },
  { title: 'Execution monitoring', detail: 'See which steps completed and where a run stopped.', icon: Activity, visual: ['Received', 'Processed', 'Complete'] },
  { title: 'Protected workspace', detail: 'Create an account and sign in to your own dashboard.', icon: LockKeyhole, available: true },
];

export function FeatureGrid() {
  return (
    <section className="nx-section" id="features" aria-labelledby="nx-features-title">
      <div className="nx-section-heading nx-split-heading">
        <div><p className="nx-kicker">FEATURES</p><h2 id="nx-features-title">The parts of a workflow.</h2></div>
        <p>From the first trigger to the last action, see what Nexora is designed to put in your hands.</p>
      </div>
      <div className="nx-bento">
        {features.map(({ title, detail, icon: Icon, visual, available }, index) => (
          <article className="nx-feature" data-feature={index} key={title}>
            <div className="nx-feature-top"><span className="nx-node-icon"><Icon size={20} aria-hidden="true" /></span><span className="nx-preview-label" data-available={available}>{available ? 'Available' : 'Planned'}</span></div>
            <h3>{title}</h3><p>{detail}</p>
            {visual && <div className="nx-mini-flow" aria-hidden="true">{visual.map(node => <span key={node}>{node}</span>)}</div>}
          </article>
        ))}
      </div>
    </section>
  );
}

const cases: {name: string; title: string; summary: string; steps: FlowStep[]}[] = [
  { name: 'Sales', title: 'Follow up as soon as a lead comes in.', summary: 'Capture the inquiry, send a welcome note, and route qualified leads to the sales team.', steps: [{name:'New inquiry',icon:Webhook},{name:'Save contact',icon:Database},{name:'Route to sales',icon:GitBranch}] },
  { name: 'Support', title: 'Get new tickets to the right queue.', summary: 'Summarize each request and route it based on topic and urgency.', steps: [{name:'New ticket',icon:Inbox},{name:'Summarize',icon:Bot},{name:'Assign queue',icon:GitBranch}] },
  { name: 'Marketing', title: 'Keep your campaign reports current.', summary: 'Gather performance figures, keep a record, and send the team a recap.', steps: [{name:'Campaign update',icon:Activity},{name:'Record metrics',icon:Sheet},{name:'Send recap',icon:Mail}] },
  { name: 'Developer ops', title: 'Give deployment events a clear trail.', summary: 'Capture an event, check its outcome, and notify the channel that owns the service.', steps: [{name:'Deployment event',icon:Code2},{name:'Check result',icon:GitBranch},{name:'Notify channel',icon:MessageSquare}] },
  { name: 'Productivity', title: 'Put the weekly team digest on a schedule.', summary: 'Collect updates, assemble a summary, and deliver it to the team.', steps: [{name:'Weekly trigger',icon:Zap},{name:'Collect updates',icon:Database},{name:'Send digest',icon:Mail}] },
];

export function UseCases() {
  const [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = cases[selected];

  return (
    <section className="nx-section" id="use-cases" aria-labelledby="nx-cases-title">
      <div className="nx-section-heading"><p className="nx-kicker">USE CASES</p><h2 id="nx-cases-title">Put repetition to work.</h2></div>
      <div className="nx-cases">
        <div className="nx-tabs" role="tablist" aria-label="Workflow use cases">
          {cases.map(({ name }, index) => (
            <button key={name} type="button" ref={node => { tabs.current[index] = node; }}
              id={id + '-tab-' + index} aria-controls={id + '-panel'} role="tab"
              aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={event => {
                let next: number;
                switch (event.key) {
                  case 'ArrowRight': next = (index + 1) % cases.length; break;
                  case 'ArrowLeft': next = (index + cases.length - 1) % cases.length; break;
                  case 'Home': next = 0; break;
                  case 'End': next = cases.length - 1; break;
                  default: return;
                }
                event.preventDefault();
                setSelected(next);
                tabs.current[next]?.focus();
              }}
            >
              {selected === index && <motion.span layoutId={id + '-selection'} className="nx-tab-indicator" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 35 }} />}
              <span>{name}</span>
            </button>
          ))}
        </div>
        <div className="nx-case-panel" id={id + '-panel'} role="tabpanel" aria-labelledby={id + '-tab-' + selected} tabIndex={0}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={current.name} initial={{opacity: 0, y: reduced ? 0 : 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} transition={{ duration: reduced ? 0 : .2 }}>
              <span className="nx-preview-label">Example workflow</span>
              <h3>{current.title}</h3><p>{current.summary}</p>
              <WorkflowStrip steps={current.steps} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const tools = [
  { name: 'Gmail', icon: Mail, path: 'M16 18Q30 18 50 50' },
  { name: 'Slack', icon: MessageSquare, path: 'M50 18V50' },
  { name: 'Google Sheets', icon: Sheet, path: 'M84 18Q70 18 50 50' },
  { name: 'Webhooks', icon: Webhook, path: 'M16 82Q30 82 50 50' },
  { name: 'HTTP APIs', icon: Code2, path: 'M50 82V50' },
  { name: 'PostgreSQL', icon: Database, path: 'M84 82Q70 82 50 50' },
];

export function IntegrationPreview() {
  const map = useRef<HTMLDivElement>(null);
  const visible = useInView(map, { amount: .25 });
  const reduced = useReducedMotion();
  return (
    <section className="nx-section nx-integrations" aria-labelledby="nx-integrations-title">
      <div className="nx-section-heading">
        <p className="nx-kicker">PLANNED INTEGRATIONS</p><h2 id="nx-integrations-title">Connect the tools you use.</h2>
        <p>Examples of the apps and endpoints Nexora is designed to connect.</p>
      </div>
      <div className="nx-integration-map" ref={map} data-flowing={visible && !reduced}>
        <svg className="nx-integration-edges" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
          {tools.map(({ name, path }) => <path className="nx-integration-track" key={name} d={path} />)}
          {!reduced && tools.map(({ name, path }, index) => (
            <path className="nx-integration-pulse" key={name} d={path} pathLength={1} style={{ animationDelay: index * .48 + 's' }} />
          ))}
        </svg>
        <span className="nx-integration-core"><Cable size={21} aria-hidden="true" /> Nexora</span>
        {tools.map(({ name, icon: Icon }) => <span className="nx-integration-node" key={name}><Icon size={18} aria-hidden="true" />{name}</span>)}
      </div>
    </section>
  );
}
