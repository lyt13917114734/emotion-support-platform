import { validSession, restoreStoredSession, type Session } from './experiment.ts';
import { validateProfile } from './profile.ts';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const PREFIX = 'ier-e2-demo-v1:';
const INDEX = `${PREFIX}index`;
export interface SessionRepository {
  create(session: Session): Session;
  save(session: Session, expectedRevision: number): Session;
  findByParticipant(participantId: string): Session | null;
  remove(session: Session): void;
}
export class LocalSessionRepository implements SessionRepository {
  private storage: StorageLike;
  constructor(storage: StorageLike) { this.storage = storage; }
  private index(): Record<string, string> {
    const raw = this.storage.getItem(INDEX);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(v => typeof v !== 'string')) throw new Error('本机记录索引损坏。请勿清理浏览器，联系研究者。');
    return parsed as Record<string, string>;
  }
  findByParticipant(id: string): Session | null {
    const key = this.index()[id.toUpperCase()];
    if (!key) return null;
    const raw = this.storage.getItem(`${PREFIX}${key}`);
    if (!raw) throw new Error('找到了登记，但会话数据缺失，请联系研究者。');
    const parsed: unknown = JSON.parse(raw);
    const normalized = restoreStoredSession(parsed);
    if (!normalized) throw new Error('会话版本不匹配或记录损坏，请保留浏览器数据并联系研究者。');
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        // Atomically replace only this session; keep ID, allocation and responses.
        // Measurement-version migration restarts the new questionnaire, archiving old answers.
      // Invalid demographic values become empty, never guessed from old flags.
      const migrated = { ...normalized, revision: normalized.revision + 1 };
      this.storage.setItem(`${PREFIX}${key}`, JSON.stringify(migrated));
      return migrated;
    }
    return normalized;
  }
  create(session: Session): Session {
    if (!validSession(session)) throw new Error('登记数据格式无效。');
    validateProfile(session.profile);
    const index = this.index(), id = session.profile.participantId.toUpperCase();
    if (index[id]) throw new Error('此编号已有本地记录，请返回登录恢复，或换一个试跑编号。');
    const key = `${PREFIX}${session.id}`;
    this.storage.setItem(key, JSON.stringify(session));
    try { this.storage.setItem(INDEX, JSON.stringify({ ...index, [id]: session.id })); }
    catch (error) { this.storage.removeItem(key); throw error; }
    return session;
  }
  save(session: Session, expectedRevision: number): Session {
    const raw = this.storage.getItem(`${PREFIX}${session.id}`);
    const old = raw ? restoreStoredSession(JSON.parse(raw)) : null;
    if (!old || !validSession(session)) throw new Error('本地存储已被清除或不可读。请勿关闭页面，先导出当前备份。');
    if (old.revision !== expectedRevision) throw new Error('另一窗口已更新此会话。请关闭重复窗口，再从入口恢复；当前页面未覆盖新记录。');
    const next = { ...session, revision: expectedRevision + 1, updatedAt: Date.now() };
    this.storage.setItem(`${PREFIX}${session.id}`, JSON.stringify(next));
    return next;
  }
  remove(session: Session) {
    const index = this.index(), id = session.profile.participantId.toUpperCase();
    if (index[id] === session.id) delete index[id];
    this.storage.setItem(INDEX, JSON.stringify(index));
    this.storage.removeItem(`${PREFIX}${session.id}`);
  }
}
