import { Activity, CircleCheck, CircleX, Plus, Workflow } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ExecutionPreview, WorkflowPreview } from '../components/dashboard/ActivityPreview';
import { AutomationPreview } from '../components/dashboard/AutomationPreview';
import { demoExecutions, demoWorkflows } from '../components/dashboard/demoData';
import { demoExecutionActivity, type ExecutionRange } from '../components/dashboard/executionDemo';
import { HeroWorkflow } from '../components/dashboard/HeroWorkflow';
import { MetricCard } from '../components/dashboard/MetricCard';
import { QuickStart } from '../components/dashboard/QuickStart';
import { moveSpotlight } from '../components/dashboard/spotlight';

const ExecutionAnalytics = lazy(() => import('../components/dashboard/ExecutionAnalytics'));

const demoMetrics = {
  total: demoWorkflows.length,
  active: demoWorkflows.filter(workflow => workflow.status === 'Active').length,
};

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0];
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<ExecutionRange>(7);
  const executions = demoExecutionActivity[range];

  useEffect(() => {
    document.title = 'Dashboard | Nexora';
  }, []);

  return (
    <div className="dashboard-overview">
      <section className="dashboard-hero dashboard-spotlight" aria-labelledby="dashboard-title" onPointerMove={moveSpotlight}>
        <div className="dashboard-hero-content">
          <h1 id="dashboard-title">Welcome back{firstName ? ', ' + firstName : ''}.</h1>
          <p>Keep track of your workflows and how they run.</p>
          <div className="dashboard-create">
            <motion.a
              href="#ai-workflow-preview"
              aria-describedby="dashboard-create-status"
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: .975, y: 0 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            >
              <Plus size={19} aria-hidden="true" />
              Create workflow
            </motion.a>
            <span id="dashboard-create-status">Builder preview · Coming soon</span>
          </div>
        </div>
        <HeroWorkflow />
      </section>

      <section aria-labelledby="workspace-overview-title">
        <div className="dashboard-section-heading dashboard-metric-heading">
          <h2 id="workspace-overview-title">Workspace overview</h2>
          <span className="dashboard-demo-tag">Demo data</span>
          <span className="dashboard-metric-range">Executions · {range} days</span>
        </div>
        <dl className="dashboard-metrics">
          <MetricCard label="Total workflows" value={demoMetrics.total} icon={Workflow} tone="violet" order={0} />
          <MetricCard label="Active workflows" value={demoMetrics.active} icon={Activity} tone="cyan" order={1} />
          <MetricCard label="Successful executions" value={executions.successful} icon={CircleCheck} tone="green" order={2} />
          <MetricCard label="Failed executions" value={executions.failed} icon={CircleX} tone="rose" order={3} />
        </dl>
      </section>

      <Suspense fallback={<p className="dashboard-surface dashboard-analytics-loading" role="status">Loading execution activity…</p>}>
        <ExecutionAnalytics range={range} onRangeChange={setRange} />
      </Suspense>

      <div className="dashboard-activity-grid">
        <WorkflowPreview workflows={demoWorkflows} demo />
        <ExecutionPreview executions={demoExecutions} demo />
      </div>

      <QuickStart />
      <AutomationPreview />
    </div>
  );
}
