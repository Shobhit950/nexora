import { Check, Sparkles, Workflow, Zap } from 'lucide-react';

const steps = [
  { title: 'Trigger', detail: 'An event starts the workflow.', icon: Zap },
  { title: 'Action', detail: 'Nexora runs the steps you define.', icon: Workflow },
  { title: 'Result', detail: 'See the outcome of each run.', icon: Check },
];

export function QuickStart() {
  return (
    <section className="dashboard-surface dashboard-quick-start" aria-labelledby="quick-start-title">
      <div className="dashboard-section-heading">
        <h2 id="quick-start-title">Quick start</h2>
      </div>
      <ol className="dashboard-steps" aria-label="How a workflow runs">
        {steps.map(({ title, detail, icon: Icon }) => (
          <li className="dashboard-step" key={title}>
            <span className="dashboard-step-icon" aria-hidden="true"><Icon size={19} /></span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="dashboard-builder-note">
        <Sparkles size={18} aria-hidden="true" />
        <a href="#ai-workflow-preview">Explore examples for the upcoming AI builder</a>
      </p>
    </section>
  );
}
