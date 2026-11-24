import { Activity, CircleCheck, CircleX, Plus, Workflow } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ExecutionPreview, WorkflowPreview } from '../components/dashboard/ActivityPreview';
import { AutomationPreview } from '../components/dashboard/AutomationPreview';
import { demoExecutions } from '../components/dashboard/demoData';
import { executionRanges, summarizeExecutions, type ExecutionRange } from '../components/dashboard/executionData';
import { demoExecutionActivity } from '../components/dashboard/executionDemo';
import { HeroWorkflow } from '../components/dashboard/HeroWorkflow';
import { MetricCard } from '../components/dashboard/MetricCard';
import { QuickStart } from '../components/dashboard/QuickStart';
import { moveSpotlight } from '../components/dashboard/spotlight';
import { listWorkflows, type WorkflowSummary } from '../services/workflowApi';

const ExecutionAnalytics = lazy(() => import('../components/dashboard/ExecutionAnalytics'));

const MotionLink = motion.create(Link);

type WorkflowOverview = { total: number; active: number; recent: WorkflowSummary[] };

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0];
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<ExecutionRange>(7);
  const dataset = demoExecutionActivity.getDataset(range);
  const executions = summarizeExecutions(dataset.buckets);
  const [overview, setOverview] = useState<WorkflowOverview>();
  const [workflowError, setWorkflowError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listWorkflows({ limit: 4 }, controller.signal),
      listWorkflows({ limit: 1, status: 'active' }, controller.signal),
    ]).then(([recent, active]) => {
      if (!controller.signal.aborted) {
        setOverview({ total: recent.pagination.total, active: active.pagination.total, recent: recent.items });
      }
    }, () => {
      if (!controller.signal.aborted) setWorkflowError(true);
    });
    return () => controller.abort();
  }, [attempt]);

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
            <MotionLink
              to="/dashboard/workflows?create=1"
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: .975, y: 0 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            >
              <Plus size={19} aria-hidden="true" />
              Create workflow
            </MotionLink>
          </div>
        </div>
        <HeroWorkflow />
      </section>

      <section aria-labelledby="workspace-overview-title">
        <div className="dashboard-section-heading dashboard-metric-heading">
          <h2 id="workspace-overview-title">Workspace overview</h2>
          <span className="dashboard-demo-tag">Execution metrics demo</span>
          <span className="dashboard-metric-range">Executions · {executionRanges.find(option => option.value === range)?.description}</span>
        </div>
        <dl className="dashboard-metrics">
          <MetricCard label="Total workflows" value={overview?.total ?? null} icon={Workflow} tone="violet" order={0} />
          <MetricCard label="Active workflows" value={overview?.active ?? null} icon={Activity} tone="cyan" order={1} />
          <MetricCard label="Successful executions" value={executions.successful} icon={CircleCheck} tone="green" order={2} />
          <MetricCard label="Failed executions" value={executions.failed} icon={CircleX} tone="rose" order={3} />
        </dl>
      </section>

      <Suspense fallback={<p className="dashboard-surface dashboard-analytics-loading" role="status">Loading execution activity…</p>}>
        <ExecutionAnalytics range={range} dataset={dataset} onRangeChange={setRange} />
      </Suspense>

      <div className="dashboard-activity-grid">
        <WorkflowPreview workflows={overview?.recent ?? []} loading={!overview && !workflowError} error={workflowError}
          onRetry={() => { setWorkflowError(false); setAttempt(value => value + 1); }} />
        <ExecutionPreview executions={demoExecutions} demo />
      </div>

      <QuickStart />
      <AutomationPreview />
    </div>
  );
}
