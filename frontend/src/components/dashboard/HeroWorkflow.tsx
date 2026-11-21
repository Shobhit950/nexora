import { Check, Database, Workflow, Zap } from 'lucide-react';

const connections = 'M64 88H148 M200 88H225Q250 88 250 63V60Q250 39 273 39H302 M200 88H225Q250 88 250 112V116Q250 137 273 137H302';

export function HeroWorkflow() {
  return (
    <div className="dashboard-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 370 176" className="dashboard-workflow-figure" fill="none">
        <path d={connections} className="dashboard-workflow-track" />
        <path d={connections} pathLength={1} className="dashboard-workflow-signal" />
        <g className="dashboard-figure-node">
          <rect x="16" y="64" width="48" height="48" rx="12" />
          <Zap x="30" y="78" size={20} strokeWidth={1.55} />
        </g>
        <g className="dashboard-figure-node dashboard-figure-action">
          <rect x="148" y="62" width="52" height="52" rx="13" />
          <Workflow x="162" y="76" size={24} strokeWidth={1.55} />
        </g>
        <g className="dashboard-figure-node dashboard-figure-result">
          <rect x="302" y="17" width="44" height="44" rx="11" />
          <Check x="315" y="30" size={18} strokeWidth={1.65} />
        </g>
        <g className="dashboard-figure-node">
          <rect x="302" y="115" width="44" height="44" rx="11" />
          <Database x="315" y="128" size={18} strokeWidth={1.55} />
        </g>
      </svg>
    </div>
  );
}
