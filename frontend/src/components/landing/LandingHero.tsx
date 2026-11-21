import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { EditorPreview } from './WorkflowDemos';

const lines = ['Make work flow.', 'Let AI do the rest.'];

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 1], [0, 44]);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const buttonX = useSpring(x, { stiffness: 290, damping: 23 });
  const buttonY = useSpring(y, { stiffness: 290, damping: 23 });

  return (
    <section className="nx-hero" ref={ref} data-visible={visible}
      onPointerMove={event => {
        if (reduced || event.pointerType !== 'mouse') return;
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--nx-x', event.clientX - box.left + 'px');
        event.currentTarget.style.setProperty('--nx-y', event.clientY - box.top + 'px');
      }}
    >
      <div className="nx-hero-light" />
      <div className="nx-wrap nx-hero-grid">
        <div className="nx-hero-copy">
          <p className="nx-kicker">AI WORKFLOW AUTOMATION</p>
          <h1 aria-label={lines.join(' ')}>
            {lines.map((line, row) => <span className="nx-hero-line" key={line} aria-hidden="true">
              {line.split(' ').map((word, index) => <motion.span
                key={word}
                initial={reduced ? false : { opacity: .15, y: 15, filter: 'blur(7px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: reduced ? 0 : .56, delay: reduced ? 0 : (row * 3 + index) * .055, ease: 'easeOut' }}
              >{word}</motion.span>)}
            </span>)}
          </h1>
          <p className="nx-hero-description">Turn everyday tasks into intelligent automated workflows. Describe what you want to automate, connect your tools, and let Nexora handle the repetitive work.</p>
          <div className="nx-actions">
            <motion.span style={reduced ? undefined : { x: buttonX, y: buttonY }}
              onPointerMove={event => {
                if (reduced || event.pointerType !== 'mouse') return;
                const box = event.currentTarget.getBoundingClientRect();
                x.set((event.clientX - box.left - box.width / 2) * .12);
                y.set((event.clientY - box.top - box.height / 2) * .16);
              }}
              onPointerLeave={() => { x.set(0); y.set(0); }}
            ><Link className="nx-button nx-primary" to={signedIn ? '/dashboard' : '/signup'}>{signedIn ? 'Open Dashboard' : 'Get Started'}</Link></motion.span>
            <a className="nx-button nx-secondary" href="#prompt-demo">Explore Nexora</a>
          </div>
        </div>
        <motion.div className="nx-hero-canvas" style={reduced ? undefined : { y: drift }}><EditorPreview /></motion.div>
      </div>
    </section>
  );
}
