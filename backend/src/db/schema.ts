import { relations, sql } from 'drizzle-orm';
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
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

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  workflows: many(workflows),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
}));
