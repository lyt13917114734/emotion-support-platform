import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const experimentSessions = sqliteTable('experiment_sessions', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull().unique(),
  resumeTokenHash: text('resume_token_hash').notNull(),
  sequence: text('sequence').notNull(),
  seed: integer('seed').notNull(),
  protocolVersion: text('protocol_version').notNull(),
  materialVersion: text('material_version').notNull(),
  measureVersion: text('measure_version').notNull(),
  status: text('status').notNull().default('active'),
  revision: integer('revision').notNull().default(0),
  cursor: integer('cursor').notNull().default(0),
  profileJson: text('profile_json').notNull(),
  sessionJson: text('session_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
  withdrawnAt: integer('withdrawn_at'),
}, table => [
  check('experiment_sessions_sequence_check', sql`${table.sequence} in ('AX_BY','AY_BX','BX_AY','BY_AX')`),
  check('experiment_sessions_status_check', sql`${table.status} in ('active','completed','withdrawn')`),
  index('idx_experiment_sessions_status_updated').on(table.status, table.updatedAt),
]);

export const sessionEvents = sqliteTable('session_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull(),
  revision: integer('revision').notNull(),
  eventType: text('event_type').notNull(),
  payloadHash: text('payload_hash').notNull(),
  receivedAt: integer('received_at').notNull(),
}, table => [
  uniqueIndex('uq_session_events_session_revision').on(table.sessionId, table.revision),
  index('idx_session_events_session').on(table.sessionId, table.revision),
]);

export const researchExportAttempts = sqliteTable('research_export_attempts', {
  actorHash: text('actor_hash').primaryKey(),
  windowStartedAt: integer('window_started_at').notNull(),
  failedCount: integer('failed_count').notNull().default(0),
  blockedUntil: integer('blocked_until'),
  updatedAt: integer('updated_at').notNull(),
});

export const researcherSessions = sqliteTable('researcher_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  credentialVersion: text('credential_version').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
