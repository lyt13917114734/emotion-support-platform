import { env } from 'cloudflare:workers';
import { getD1 } from '@/db';
import { createResumeToken, hashText } from './session-auth';
import { authorizeResearchExport, ResearchExportError } from './research-export';

const COOKIE = 'e2_researcher';
const TTL_SECONDS = 30 * 60;

export function checkResearchOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new ResearchExportError('请求来源无效。', 403);
  }
}

function tokenFrom(request: Request) {
  return (request.headers.get('cookie') ?? '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
}

function cookie(request: Request, token: string, seconds: number) {
  return `${COOKIE}=${token}; Path=/api/research; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export async function loginResearcher(request: Request, password: unknown) {
  checkResearchOrigin(request);
  await authorizeResearchExport(request, password);
  const db = getD1(), now = Date.now();
  await db.prepare('DELETE FROM researcher_sessions WHERE expires_at <= ?').bind(now).run();
  const previous = tokenFrom(request);
  if (previous) await db.prepare('DELETE FROM researcher_sessions WHERE token_hash = ?').bind(await hashText(previous)).run();
  const token = createResumeToken();
  await db.prepare('INSERT INTO researcher_sessions (token_hash, credential_version, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await hashText(token), await hashText(env.ADMIN_EXPORT_PASSWORD_HASH ?? ''), now, now + TTL_SECONDS * 1000).run();
  return { cookie: cookie(request, token, TTL_SECONDS), expiresAt: now + TTL_SECONDS * 1000 };
}

export async function requireResearcher(request: Request) {
  const token = tokenFrom(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ResearchExportError('请先登录研究者账号。', 401);
  const row = await getD1().prepare('SELECT expires_at, credential_version FROM researcher_sessions WHERE token_hash = ?')
    .bind(await hashText(token)).first<{ expires_at: number; credential_version: string }>();
  if (!row || row.expires_at <= Date.now() || row.credential_version !== await hashText(env.ADMIN_EXPORT_PASSWORD_HASH ?? '')) {
    throw new ResearchExportError('登录已失效，请重新登录。', 401);
  }
  return row.expires_at;
}

export async function logoutResearcher(request: Request) {
  checkResearchOrigin(request);
  const token = tokenFrom(request);
  if (token) await getD1().prepare('DELETE FROM researcher_sessions WHERE token_hash = ?').bind(await hashText(token)).run();
  return cookie(request, '', 0);
}

export function researchJSON(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

export function researchError(error: unknown) {
  const known = error instanceof ResearchExportError ? error : new ResearchExportError('暂时无法读取研究数据，请稍后重试。', 503);
  return researchJSON({ error: known.message }, known.status, known.retryAfter ? { 'Retry-After': String(known.retryAfter) } : {});
}
