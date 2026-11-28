import { relations, sql } from 'drizzle-orm';
import { type AnyPgColumn, check, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { ExecutionError, ExecutionStatus, NodeExecutionResult } from '../engine/execution.types';
import type { ExecutionPayloadSummary } from './execution-history.types';
import type { WorkflowEdge, WorkflowNode } from './workflow.types';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_at_idx').on(table.expiresAt),
]);

export const workflowStatus = pgEnum('workflow_status', ['draft', 'active', 'inactive']);

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: workflowStatus('status').default('draft').notNull(),
  nodes: jsonb('nodes').$type<WorkflowNode[]>().default([]).notNull(),
  edges: jsonb('edges').$type<WorkflowEdge[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index('workflows_user_updated_at_idx').on(table.userId, table.updatedAt.desc()),
  index('workflows_status_idx').on(table.status),
  index('workflows_updated_at_idx').on(table.updatedAt.desc()),
  check('workflows_nodes_is_array', sql`jsonb_typeof(${table.nodes}) = 'array'`),
  check('workflows_edges_is_array', sql`jsonb_typeof(${table.edges}) = 'array'`),
]);

export const executionStatus = pgEnum('execution_status',
  ['success', 'failed', 'cancelled'] as const satisfies readonly ExecutionStatus[]);

function isRedactedPayload(column: AnyPgColumn) {
  return sql`coalesce(
    (${column}->>'type') in ('null', 'boolean', 'number', 'string', 'array', 'object')
    and ${column} = jsonb_build_object('type', ${column}->>'type', 'redacted', true),
    false
  )`;
}

function executionResultChecks(table: {
  status: AnyPgColumn;
  input: AnyPgColumn;
  output: AnyPgColumn;
  errorCode: AnyPgColumn;
  errorMessage: AnyPgColumn;
  durationMs: AnyPgColumn;
}, prefix: 'executions' | 'execution_steps') {
  return [
    check(`${prefix}_input_redacted`, isRedactedPayload(table.input)),
    check(`${prefix}_output_redacted`, sql`${table.output} is null or ${isRedactedPayload(table.output)}`),
    check(`${prefix}_duration_valid`, sql`${table.durationMs} >= 0 and ${table.durationMs} < 'Infinity'::double precision`),
    check(`${prefix}_outcome_consistent`, sql`
      (${table.status} = 'success' and ${table.output} is not null and ${table.errorCode} is null and ${table.errorMessage} is null)
      or (${table.status} <> 'success' and ${table.output} is null and ${table.errorCode} is not null and ${table.errorMessage} is not null)
    `),
  ];
}

export const executions = pgTable('executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  workflowNameSnapshot: varchar('workflow_name_snapshot', { length: 120 }).notNull(),
  status: executionStatus('status').notNull(),
  input: jsonb('input').$type<ExecutionPayloadSummary>().notNull(),
  output: jsonb('output').$type<ExecutionPayloadSummary>(),
  errorCode: varchar('error_code', { length: 64 }).$type<ExecutionError['code']>(),
  errorMessage: varchar('error_message', { length: 160 }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  durationMs: doublePrecision('duration_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('executions_user_started_idx').on(table.userId, table.startedAt.desc(), table.id.desc()),
  index('executions_user_workflow_started_idx').on(table.userId, table.workflowId, table.startedAt.desc(), table.id.desc()),
  index('executions_user_status_started_idx').on(table.userId, table.status, table.startedAt.desc(), table.id.desc()),
  index('executions_workflow_id_idx').on(table.workflowId),
  index('executions_created_at_idx').on(table.createdAt),
  ...executionResultChecks(table, 'executions'),
]);

export const executionSteps = pgTable('execution_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 64 }).notNull(),
  nodeType: varchar('node_type', { length: 64 }).$type<NodeExecutionResult['nodeType']>().notNull(),
  stepOrder: integer('step_order').notNull(),
  status: executionStatus('status').notNull(),
  input: jsonb('input').$type<ExecutionPayloadSummary>().notNull(),
  output: jsonb('output').$type<ExecutionPayloadSummary>(),
  errorCode: varchar('error_code', { length: 64 }).$type<ExecutionError['code']>(),
  errorMessage: varchar('error_message', { length: 160 }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  durationMs: doublePrecision('duration_ms').notNull(),
}, (table) => [
  uniqueIndex('execution_steps_execution_order_unique').on(table.executionId, table.stepOrder),
  check('execution_steps_order_valid', sql`${table.stepOrder} >= 0`),
  ...executionResultChecks(table, 'execution_steps'),
]);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  workflows: many(workflows),
  executions: many(executions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  executions: many(executions),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  user: one(users, { fields: [executions.userId], references: [users.id] }),
  workflow: one(workflows, { fields: [executions.workflowId], references: [workflows.id] }),
  steps: many(executionSteps),
}));

export const executionStepsRelations = relations(executionSteps, ({ one }) => ({
  execution: one(executions, { fields: [executionSteps.executionId], references: [executions.id] }),
}));
