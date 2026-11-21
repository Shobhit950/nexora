import { Hexagon, Menu, Workflow, X } from 'lucide-react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { FeatureGrid, IntegrationPreview, UseCases } from '../components/landing/LandingDetails';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingStory } from '../components/landing/LandingStory';
import { PromptDemo } from '../components/landing/WorkflowDemos';
import './landing.css';

const sections = [
  { name: 'Features', href: '#features' },
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'Use Cases', href: '#use-cases' },
];

function Brand() {
  return <a className="nx-brand" href="#top" aria-label="Nexora home"><span className="nx-mark" aria-hidden="true"><Hexagon size={22} /><Workflow size={12} /></span>Nexora<span>.</span></a>;
}

function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', value => setScrolled(value > 18));

  return (
    <header className="nx-nav" data-scrolled={scrolled} data-open={open} onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        button.current?.focus();
      }
    }}>
      <div className="nx-nav-inner">
        <Brand />
        <button className="nx-menu-button" ref={button} type="button" aria-expanded={open} aria-controls="nx-nav-links" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="nx-nav-links" id="nx-nav-links">
          <nav aria-label="Main navigation">{sections.map(({ name, href }) => <a key={href} href={href} onClick={() => setOpen(false)}>{name}</a>)}</nav>
          <div className="nx-nav-actions">
            {!signedIn && <Link to="/login">Login</Link>}
            <Link to={signedIn ? '/dashboard' : '/signup'} className="nx-button nx-nav-cta">{signedIn ? 'Open Dashboard' : 'Get Started'}</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const signedIn = Boolean(user);

  useEffect(() => { document.title = 'Nexora | AI workflow automation'; }, []);

  return (
    <div className="nx-landing" id="top">
      <a href="#nx-main" className="nx-skip">Skip to content</a>
      <LandingNav signedIn={signedIn} />
      <main id="nx-main" tabIndex={-1}>
        <LandingHero signedIn={signedIn} />
        <PromptDemo />
        <LandingStory />
        <FeatureGrid />
        <UseCases />
        <IntegrationPreview />
        <section className="nx-closing" aria-labelledby="nx-close-title">
          <motion.div className="nx-wrap" initial={reduced ? false : { opacity: .4, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .45 }} transition={{ duration: reduced ? 0 : .52 }}>
            <h2 id="nx-close-title">Build less repetitive work.<br /><span>Build more possibilities.</span></h2>
            <div className="nx-actions">
              <Link className="nx-button nx-primary" to={signedIn ? '/dashboard' : '/signup'}>{signedIn ? 'Open Dashboard' : 'Create Your Account'}</Link>
              {!signedIn && <Link className="nx-button nx-secondary" to="/login">Login</Link>}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
