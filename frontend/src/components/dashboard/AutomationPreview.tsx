import { Database, Mail, MessageSquare, Sparkles } from 'lucide-react';

const prompts = [
  { example: 'Summarize new support tickets and send a daily digest.', icon: MessageSquare },
  { example: 'Send a welcome email when a new lead fills out a form.', icon: Mail },
  { example: 'Collect weekly metrics and save them to a spreadsheet.', icon: Database },
];

export function AutomationPreview() {
  return (
    <section className="dashboard-surface dashboard-automation" id="ai-workflow-preview" aria-labelledby="ai-workflow-title" tabIndex={-1}>
      <div className="dashboard-automation-heading">
        <span className="dashboard-automation-icon" aria-hidden="true"><Sparkles size={22} /></span>
        <div className="min-w-0">
          <h2 id="ai-workflow-title">What would you like to automate?</h2>
          <p>AI workflow generation is coming soon. These examples show what you’ll be able to describe.</p>
        </div>
      </div>
      <ul className="dashboard-prompts" aria-label="Example automation prompts">
        {prompts.map(({ example, icon: Icon }) => (
          <li key={example}>
            <Icon size={17} aria-hidden="true" />
            <span>“{example}”</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
