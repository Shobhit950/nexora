import { Bot, Check, Database, GitBranch, Webhook } from 'lucide-react';
import { useState } from 'react';

const steps = [
  { id: 'trigger', category: 'Trigger', title: 'Webhook', icon: Webhook, detail: 'Receives a new lead from an incoming webhook.' },
  { id: 'ai', category: 'AI agent', title: 'Enrich lead', icon: Bot, detail: 'Adds company and contact context to the lead.' },
  { id: 'route', category: 'Logic', title: 'Route lead', icon: GitBranch, detail: 'Routes the enriched lead to the right team.' },
  { id: 'sync', category: 'Action', title: 'Sync to CRM', icon: Database, detail: 'Saves the enriched lead to the CRM.' },
] as const;

export function Workflow() {
  const [selected, setSelected] = useState<(typeof steps)[number] | null>(null);

  return (
    <figure className="workflow">
      <div className="workflow-grid" aria-hidden="true" />
      <figcaption>
        <span className="workflow-title"><GitBranch size={15} aria-hidden="true" /> Lead enrichment</span>
        <span className="workflow-status">Example workflow</span>
      </figcaption>
      <div className="diagram">
        <div className="circuit" aria-hidden="true">
          <i className="wire wire-out" />
          <i className="wire wire-down" />
          <i className="wire wire-back" />
          <i className="wire wire-up" />
        </div>
        {steps.map(step => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              className={`node node-${step.id}`}
              aria-pressed={selected === step}
              onClick={() => setSelected(selected === step ? null : step)}
            >
              <span className="node-icon" aria-hidden="true"><Icon size={17} /></span>
              <span><small>{step.category}</small>{step.title}</span>
            </button>
          );
        })}
      </div>
      <div className="workflow-footer" aria-live="polite">
        {selected ? <selected.icon size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
        {selected?.detail ?? 'Example run completed'}
      </div>
    </figure>
  );
}
