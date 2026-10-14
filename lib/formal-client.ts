import type { Profile } from './profile';
import type { Session } from './experiment';

const CREDENTIAL_KEY = 'ier-e2-formal-credential-v1';
const ACTIVE_KEY = 'ier-e2-formal-active-participant';

export type FormalCredential = { participantId: string; resumeToken: string };
export type ResearchExportFormat = 'json' | 'trials' | 'surveys' | 'blind' | 'all' | 'scales' | 'texts';

async function request<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '服务器暂时无法处理该请求。');
  return data as T;
}

export async function startFormal(profile: Profile) {
  return request<{ ok: true; session: Session; resumeToken: string }>('/api/session/start', { profile });
}

export async function loadFormal(credential: FormalCredential) {
  const data = await request<{ ok: true; session: Session }>('/api/session/load', { participantId: credential.participantId }, credential.resumeToken);
  return data.session;
}

export async function saveFormal(credential: FormalCredential, candidate: Session, expectedRevision: number) {
  const data = await request<{ ok: true; session: Session }>('/api/session/save', {
    participantId: credential.participantId,
    expectedRevision,
    session: candidate,
  }, credential.resumeToken);
  return data.session;
}

export function readFormalCredential(storage: Storage): FormalCredential | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(CREDENTIAL_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<FormalCredential>;
    if (!/^[A-Z][0-9]{3}$/.test(candidate.participantId ?? '') || typeof candidate.resumeToken !== 'string' || candidate.resumeToken.length < 32) return null;
    return { participantId: candidate.participantId!, resumeToken: candidate.resumeToken };
  } catch { return null; }
}

export function writeFormalCredential(storage: Storage, credential: FormalCredential) {
  storage.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
}

export function clearFormalCredential(storage: Storage) { storage.removeItem(CREDENTIAL_KEY); }
export function activeFormalParticipant(storage: Storage) { return storage.getItem(ACTIVE_KEY); }
export function setActiveFormalParticipant(storage: Storage, participantId: string) { storage.setItem(ACTIVE_KEY, participantId); }
export function clearActiveFormalParticipant(storage: Storage) { storage.removeItem(ACTIVE_KEY); }

export async function downloadResearchExport(format: ResearchExportFormat) {
  const response = await fetch('/api/research/export', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }), cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof data?.error === 'string' ? data.error : '数据导出失败，请稍后重试。');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `experiment2-${format}`;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
