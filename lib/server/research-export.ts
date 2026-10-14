import { env } from 'cloudflare:workers';
import { getD1 } from '@/db';
import { toCSV, type ExportRow } from '@/lib/export';
import { validResearchSession as validSession } from '@/lib/research-history';
import * as currentExport from '@/lib/export';
import * as archivedExport from '@/lib/archive-v6/export';
import { hashText } from './session-auth';

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export type ResearchExportFormat = 'json' | 'trials' | 'surveys' | 'blind' | 'all' | 'scales' | 'texts';
type AttemptRow = { window_started_at: number; failed_count: number; blocked_until: number | null };
type StoredSessionRow = { id: string; participant_id: string; status: string; revision: number; created_at: number; updated_at: number; completed_at: number | null; session_json: string };

export class ResearchExportError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: number) { super(message); }
}

function secureHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function actorHash(request: Request) {
  return hashText(`research-export:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`);
}

export async function authorizeResearchExport(request: Request, password: unknown) {
  const expected = env.ADMIN_EXPORT_PASSWORD_HASH?.trim().toLowerCase() ?? '';
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new ResearchExportError('研究者导出密码尚未在服务器配置。', 503);
  const db = getD1(), now = Date.now(), actor = await actorHash(request);
  const attempt = await db.prepare('SELECT window_started_at, failed_count, blocked_until FROM research_export_attempts WHERE actor_hash = ?')
    .bind(actor).first<AttemptRow>();
  if (attempt?.blocked_until && attempt.blocked_until > now) {
    throw new ResearchExportError('尝试次数过多，请稍后再试。', 429, Math.ceil((attempt.blocked_until - now) / 1000));
  }
  const supplied = typeof password === 'string' ? await hashText(password) : '';
  if (secureHexEqual(supplied, expected)) {
    await db.prepare('DELETE FROM research_export_attempts WHERE actor_hash = ?').bind(actor).run();
    return;
  }
  const inWindow = !!attempt && now - attempt.window_started_at < ATTEMPT_WINDOW_MS;
  const failedCount = inWindow ? attempt!.failed_count + 1 : 1;
  const windowStartedAt = inWindow ? attempt!.window_started_at : now;
  const blockedUntil = failedCount >= MAX_FAILURES ? now + BLOCK_MS : null;
  await db.prepare(`INSERT INTO research_export_attempts (actor_hash, window_started_at, failed_count, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(actor_hash) DO UPDATE SET window_started_at = excluded.window_started_at, failed_count = excluded.failed_count,
      blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`)
    .bind(actor, windowStartedAt, failedCount, blockedUntil, now).run();
  throw new ResearchExportError(failedCount >= MAX_FAILURES ? '尝试次数过多，请稍后再试。' : '密码不正确。', failedCount >= MAX_FAILURES ? 429 : 401, blockedUntil ? Math.ceil(BLOCK_MS / 1000) : undefined);
}

function loadSession(row: StoredSessionRow) {
  const session: unknown = JSON.parse(row.session_json);
  if (!validSession(session) || session.mode !== 'formal' || session.id !== row.id || session.profile.participantId !== row.participant_id) {
    throw new ResearchExportError(`服务器中的实验记录无法通过完整性检查：${row.id}`, 500);
  }
  return session;
}

function serverMetadata(row: StoredSessionRow): ExportRow {
  return { database_status: row.status, server_revision: row.revision, server_created_at: row.created_at,
    server_updated_at: row.updated_at, server_completed_at: row.completed_at };
}

export async function createResearchExport(format: ResearchExportFormat) {
  const result = await getD1().prepare(`SELECT id, participant_id, status, revision, created_at, updated_at, completed_at, session_json
    FROM experiment_sessions ORDER BY created_at, participant_id`).all<StoredSessionRow>();
  const stored = result.results.map(row => ({ row, session: loadSession(row) }));
  const exportsFor = (session: ReturnType<typeof loadSession>) => session.protocolVersion === 'E2-local-demo-20260911-v6' ? archivedExport as unknown as typeof currentExport : currentExport;
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  if (format === 'json') {
    const data = JSON.stringify({ exported_at: new Date().toISOString(), session_count: stored.length,
      sessions: stored.map(({ row, session }) => ({ ...serverMetadata(row), session: JSON.parse(exportsFor(session).backupJSON(session)) })) }, null, 2);
    return { data, contentType: 'application/json;charset=utf-8', filename: `experiment2-full-${date}.json` };
  }
  let rows: ExportRow[], filename: string;
  if (format === 'scales') {
    rows = stored.flatMap(({ session }) => exportsFor(session).scaleStageRows(session));
    filename = `experiment2-scales-by-stage-${date}.csv`;
  } else if (format === 'texts') {
    rows = stored.flatMap(({ session }) => exportsFor(session).textTaskRows(session));
    filename = `experiment2-text-tasks-${date}.csv`;
  } else if (format === 'all') {
    rows = stored.map(({ row, session }) => ({ ...serverMetadata(row), ...exportsFor(session).allDataRow(session) }));
    filename = `experiment2-all-data-${date}.csv`;
  } else if (format === 'trials') {
    rows = stored.flatMap(({ row, session }) => exportsFor(session).trialRows(session).map(item => ({ ...serverMetadata(row), ...item })));
    filename = `experiment2-trials-${date}.csv`;
  } else if (format === 'surveys') {
    rows = stored.flatMap(({ row, session }) => exportsFor(session).surveyRows(session).map(item => ({ ...serverMetadata(row), ...item })));
    filename = `experiment2-measurements-${date}.csv`;
  } else {
    rows = stored.flatMap(({ session }) => exportsFor(session).blindRows(session));
    filename = `experiment2-blind-responses-${date}.csv`;
  }
  const headers = rows.length ? [...new Set(rows.flatMap(row => Object.keys(row)))] : format === 'blind' ? ['response_id', 'event_text', 'reply'] : ['session_id'];
  return { data: toCSV(rows, headers), contentType: 'text/csv;charset=utf-8', filename };
}
