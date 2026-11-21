import { Check, GitBranch, Mail, Sparkles, Webhook } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { samplePrompt, WorkflowStrip } from './WorkflowDemos';

const stages = [
  { title: 'Describe your automation.', description: 'Start with the event that should trigger the workflow and what you want to happen next.' },
  { title: 'Build and customize your workflow.', description: 'Shape the draft into a sequence of steps. Add conditions where different inputs need different outcomes.' },
  { title: 'Execute and monitor your automation.', description: 'See which steps ran, where a workflow stopped, and what needs your attention.' },
];

const diagram = [
  { name: 'Form submitted', icon: Webhook },
  { name: 'Check budget', icon: GitBranch },
  { name: 'Notify sales', icon: Mail },
];

function StageVisual({ stage }: { stage: number }) {
  if (stage === 0) return <div className="nx-story-prompt"><Sparkles aria-hidden="true" size={22} /><p>{samplePrompt}</p></div>;
  if (stage === 1) return <WorkflowStrip steps={diagram} />;
  return <ol className="nx-story-log">
    {['Contact received', 'Welcome email prepared', 'Sales notification queued'].map(text => (
      <li key={text}><Check size={17} aria-hidden="true" /><span>{text}</span><small>Sample</small></li>
    ))}
  </ol>;
}

export function LandingStory() {
  const steps = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const { scrollYProgress } = useScroll({ target: steps, offset: ['start center', 'end center'] });
  const scale = useTransform(scrollYProgress, [0, .5, 1], [.975, 1, .985]);
  useMotionValueEvent(scrollYProgress, 'change', value => {
    setStage(Math.max(0, Math.min(stages.length - 1, Math.floor(value * stages.length))));
  });

  return (
    <section className="nx-section nx-story" id="how-it-works" aria-labelledby="nx-story-title">
      <div className="nx-section-heading"><p className="nx-kicker">HOW IT WORKS</p><h2 id="nx-story-title">From intent to outcome.</h2></div>
      <div className="nx-story-grid">
        <div className="nx-story-steps" ref={steps}>
          {stages.map(({ title, description }, index) => (
            <article key={title} className="nx-story-step" data-current={index === stage}>
              <motion.div initial={reduced ? false : { opacity: .45, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }}>
                <span className="nx-story-index">0{index + 1}</span>
                <h3>{title}</h3><p>{description}</p>
              </motion.div>
              <div className="nx-story-mobile-preview"><span className="nx-preview-label">Planned experience</span><StageVisual stage={index} /></div>
            </article>
          ))}
        </div>
        <motion.div className="nx-story-sticky" style={reduced ? undefined : { scale }}>
          <div className="nx-editor">
            <div className="nx-editor-bar"><span>{['Prompt', 'Workflow draft', 'Run history'][stage]}</span><span className="nx-preview-label">Planned experience</span></div>
            <div className="nx-story-display" aria-hidden="true" data-stage={stage + 1}>
              <AnimatePresence initial={false}>
                <motion.div key={stage} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .28 }}>
                  <StageVisual stage={stage} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="nx-story-indicators" aria-hidden="true">{stages.map(({ title }, index) => <i key={title} data-active={index === stage} />)}</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
