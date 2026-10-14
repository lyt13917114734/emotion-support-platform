import { getD1 } from '@/db';
import { createSession, MATERIAL_VERSION, MEASURE_VERSION, PROTOCOL_VERSION, SEQUENCES, validSession, type Sequence, type Session } from '@/lib/experiment';
import { normalizeProfile, validateProfile } from '@/lib/profile';
import { createResumeToken, hashText } from './session-auth';

type SessionRow = { id: string; participant_id: string; resume_token_hash: string; sequence: Sequence; seed: number; revision: number; status: string; session_json: string };

function normalizedParticipantId(value: unknown) {
  if (typeof value !== 'string') throw new Error('参与者编号格式无效。');
  const id = value.trim().toUpperCase();
  if (!/^[A-Z][0-9]{3}$/.test(id)) throw new Error('参与者编号格式无效，请使用1个英文字母和3位数字，例如D001。');
  return id;
}

async function rowForParticipant(participantId: string) {
  return getD1().prepare('SELECT id, participant_id, resume_token_hash, sequence, seed, revision, status, session_json FROM experiment_sessions WHERE participant_id = ?')
    .bind(participantId).first<SessionRow>();
}

async function authenticate(participantId: unknown, token: string) {
  if (!token) throw new Error('未获得有效的会话凭证。');
  const id = normalizedParticipantId(participantId);
  const row = await rowForParticipant(id);
  if (!row || row.status === 'withdrawn' || await hashText(token) !== row.resume_token_hash) throw new Error('未获得有效的会话凭证。');
  return row;
}

export async function startFormalSession(profileInput: unknown) {
  const profile = normalizeProfile(profileInput);
  validateProfile(profile);
  const participantId = normalizedParticipantId(profile.participantId);
  profile.participantId = participantId;
  if (await rowForParticipant(participantId)) throw new Error('此参与者编号已被使用，请在原设备恢复或联系研究人员。');
  const db = getD1();
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const random = crypto.getRandomValues(new Uint32Array(2));
  const seed = (random[0] % 2147483646) + 1;
  const tieOffset = random[1] % SEQUENCES.length;
  const token = createResumeToken();
  const tokenHash = await hashText(token);
  const variants = Object.fromEntries(SEQUENCES.map(sequence => [sequence, JSON.stringify(createSession(profile, sequence, seed, now, {
    mode: 'formal', allocationSource: 'server-schedule', sessionId,
  }))])) as Record<Sequence, string>;
  const eventHash = await hashText(`${sessionId}:${participantId}:${now}`);
  let result: D1Result<unknown>[];
  try {
    result = await db.batch([
      db.prepare(`WITH candidates(sequence, ordinal, session_json) AS (VALUES
          ('AX_BY', 0, ?), ('AY_BX', 1, ?), ('BX_AY', 2, ?), ('BY_AX', 3, ?)
        ), usage AS (
          SELECT sequence, COUNT(*) AS used FROM experiment_sessions WHERE status != 'withdrawn' GROUP BY sequence
        )
        INSERT INTO experiment_sessions
      (id, participant_id, resume_token_hash, sequence, seed, protocol_version, material_version, measure_version, status, revision, cursor, profile_json, session_json, created_at, updated_at)
        SELECT ?, ?, ?, candidates.sequence, ?, ?, ?, ?, 'active', 0, 0, ?, candidates.session_json, ?, ?
        FROM candidates LEFT JOIN usage ON usage.sequence = candidates.sequence
        ORDER BY COALESCE(usage.used, 0), ((candidates.ordinal + ?) % 4)
        LIMIT 1
        RETURNING sequence, session_json`)
        .bind(variants.AX_BY, variants.AY_BX, variants.BX_AY, variants.BY_AX,
          sessionId, participantId, tokenHash, seed,
          PROTOCOL_VERSION, MATERIAL_VERSION, MEASURE_VERSION,
          JSON.stringify(profile), now, now, tieOffset),
      db.prepare("INSERT INTO session_events (session_id, revision, event_type, payload_hash, received_at) SELECT id, 0, 'session_created', ?, ? FROM experiment_sessions WHERE participant_id = ?")
        .bind(eventHash, now, participantId),
    ]);
  } catch {
    if (await rowForParticipant(participantId)) throw new Error('此参与者编号已被使用，请在原设备恢复或联系研究人员。');
    throw new Error('服务器暂时无法创建实验记录。');
  }
  const created = result[0].results[0] as { sequence?: Sequence; session_json?: string } | undefined;
  if (!created?.sequence || !created.session_json) throw new Error('服务器暂时无法创建实验记录。');
  const session = JSON.parse(created.session_json) as Session;
  if (!validSession(session) || session.sequence !== created.sequence) throw new Error('服务器生成的实验记录格式无效。');
  return { session, resumeToken: token };
}

export async function loadFormalSession(participantId: unknown, token: string) {
  const row = await authenticate(participantId, token);
  const session: unknown = JSON.parse(row.session_json);
  if (session && typeof session === 'object' && 'protocolVersion' in session && session.protocolVersion !== PROTOCOL_VERSION) throw new Error('该编号属于旧版实验，原数据已保留。请联系研究者使用新编号开始新版实验。');
  if (!validSession(session) || session.mode !== 'formal') throw new Error('服务器中的实验记录格式无效。');
  return session;
}

export async function saveFormalSession(participantId: unknown, token: string, expectedRevision: unknown, candidate: unknown) {
  const row = await authenticate(participantId, token);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== row.revision) throw new Error('保存版本冲突，请恢复最新进度后重试。');
  if (!validSession(candidate) || candidate.mode !== 'formal') throw new Error('实验记录格式无效。');
  if (candidate.id !== row.id || candidate.profile.participantId !== row.participant_id || candidate.sequence !== row.sequence || candidate.seed !== row.seed) {
    throw new Error('实验分配信息无效。');
  }
  if (candidate.revision !== expectedRevision) throw new Error('保存版本冲突，请恢复最新进度后重试。');

  const now = Date.now();
  const next: Session = { ...candidate, revision: row.revision + 1, updatedAt: now };
  const serialized = JSON.stringify(next);
  const payloadHash = await hashText(serialized);
  const status = next.completedAt === null ? 'active' : 'completed';
  const result = await getD1().batch([
    getD1().prepare(`UPDATE experiment_sessions SET status = ?, revision = ?, cursor = ?, profile_json = ?, session_json = ?, updated_at = ?, completed_at = ?
      WHERE id = ? AND revision = ? AND status = 'active'`)
      .bind(status, next.revision, next.cursor, JSON.stringify(next.profile), serialized, now, next.completedAt, next.id, row.revision),
    getD1().prepare('INSERT INTO session_events (session_id, revision, event_type, payload_hash, received_at) VALUES (?, ?, ?, ?, ?)')
      .bind(next.id, next.revision, status === 'completed' ? 'session_completed' : 'session_saved', payloadHash, now),
  ]);
  if (!result[0].meta.changes) throw new Error('保存版本冲突，请恢复最新进度后重试。');
  return next;
}
