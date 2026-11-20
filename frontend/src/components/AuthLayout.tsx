import { Hexagon, Workflow as WorkflowIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Workflow } from './Workflow';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="product-panel" aria-label="About Nexora">
        <div className="wordmark"><span className="brand-mark"><Hexagon size={24} strokeWidth={2.5} /><WorkflowIcon size={13} strokeWidth={2.5} /></span>Nexora<span className="brand-dot">.</span></div>
        <div className="product-content">
          <h1>Make work flow.<br /><span>Let AI do the rest.</span></h1>
          <p>Build AI-powered automations that connect your tools and handle repetitive work for you.</p>
          <Workflow />
        </div>
      </section>
      <section className="form-panel" aria-labelledby="auth-title">{children}</section>
    </main>
  );
}
