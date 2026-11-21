import { Database, Sparkles, Webhook } from 'lucide-react';
import type { ExecutionPreviewItem, WorkflowPreviewItem } from './ActivityPreview';

export const demoWorkflows: readonly WorkflowPreviewItem[] = [
  {
    id: 'lead',
    name: 'Lead intake & routing',
    description: 'Qualify new leads and route them to the right team.',
    status: 'Active',
    updatedAt: '2026-11-20T09:10:00Z',
    icon: Webhook,
  },
  {
    id: 'support',
    name: 'Support ticket triage',
    description: 'Summarize and categorize incoming support requests.',
    status: 'Active',
    updatedAt: '2026-11-20T07:45:00Z',
    icon: Sparkles,
  },
  {
    id: 'report',
    name: 'Weekly operations digest',
    description: 'Collect weekly activity into a single team update.',
    status: 'Draft',
    updatedAt: '2026-11-19T11:30:00Z',
    icon: Database,
  },
];

export const demoExecutions: readonly ExecutionPreviewItem[] = [
  { id: 'lead-2', workflowName: 'Lead intake & routing', status: 'Success', executedAt: '2026-11-20T09:21:00Z' },
  { id: 'support-1', workflowName: 'Support ticket triage', status: 'Failed', executedAt: '2026-11-20T08:42:00Z' },
  { id: 'lead-1', workflowName: 'Lead intake & routing', status: 'Success', executedAt: '2026-11-20T07:34:00Z' },
];
