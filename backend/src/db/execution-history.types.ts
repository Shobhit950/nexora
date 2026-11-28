import type { ExecutionStatus } from '../engine/execution.types';
import type { executions, executionSteps } from './schema';

export type ExecutionPayloadSummary = {
  type: 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object';
  redacted: true;
};

export type StoredExecution = typeof executions.$inferSelect;
export type StoredExecutionStep = typeof executionSteps.$inferSelect;

export type ExecutionHistoryStatusFilter = ExecutionStatus;
export type ExecutionHistoryFilters = {
  workflowId?: string;
  status?: ExecutionHistoryStatusFilter;
  page?: number;
  limit?: number;
};

type SerializedTiming<Row extends { startedAt: Date; finishedAt: Date }> =
  Omit<Row, 'startedAt' | 'finishedAt'> & { startedAt: string; finishedAt: string };

type ExecutionResponse = SerializedTiming<Omit<StoredExecution, 'userId' | 'createdAt'>> & {
  createdAt: string;
};

export type ExecutionHistoryListItem = Omit<ExecutionResponse, 'input' | 'output' | 'errorMessage'>;
export type ExecutionHistoryPagination = { page: number; limit: number; total: number; totalPages: number };

export type ExecutionHistoryListResponse = {
  items: ExecutionHistoryListItem[];
  pagination: ExecutionHistoryPagination;
};

export type ExecutionDetailsResponse = ExecutionResponse & {
  steps: SerializedTiming<Omit<StoredExecutionStep, 'executionId'>>[];
};

export type PreparedExecutionHistory = {
  execution: Omit<StoredExecution, 'id' | 'createdAt'>;
  steps: Omit<StoredExecutionStep, 'id' | 'executionId'>[];
};
