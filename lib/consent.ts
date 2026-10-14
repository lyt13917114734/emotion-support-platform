// Reading acknowledgement only; never evidence of an externally signed consent form.
export const CONSENT_VERSION = 'portfolio-demo-v1';
export const CONSENT_STORAGE_KEY = 'ier-e2-consent-reading';
export const CONSENT_BRIEF = '这是人机协同情绪支持平台的作品集演示。请使用虚构信息体验任务流程。此版本不开展正式研究、不收集真实参与者资料，也不发放报酬。';
export const EXTERNAL_SIGNING_NOTE = '作品集演示无需签署正式知情同意书。请勿输入真实个人信息。';
export const READING_CONFIRMATION = '我已阅读演示说明，并将使用虚构信息体验。';

export type EntryStage = 'entry' | 'consent-summary' | 'consent-full' | 'register';
export type ReadingReceipt = { viewedFull: boolean; confirmedAt: string | null; version: string };
type ReadingStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readReceipt(storage: ReadingStorage): ReadingReceipt | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(CONSENT_STORAGE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'confirmedAt,version,viewedFull' ||
      record.version !== CONSENT_VERSION || typeof record.viewedFull !== 'boolean' ||
      !(record.confirmedAt === null || (typeof record.confirmedAt === 'string' &&
        Number.isFinite(Date.parse(record.confirmedAt)) && new Date(record.confirmedAt).toISOString() === record.confirmedAt)) ||
      (!record.viewedFull && record.confirmedAt !== null)) return null;
    return record as ReadingReceipt;
  } catch { return null; }
}

function saveReceipt(storage: ReadingStorage, receipt: ReadingReceipt) {
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(receipt));
  return receipt;
}

export function resetReading(storage: ReadingStorage) {
  return saveReceipt(storage, { viewedFull: false, confirmedAt: null, version: CONSENT_VERSION });
}

export function markDocumentEnd(storage: ReadingStorage) {
  const previous = readReceipt(storage);
  return saveReceipt(storage, { viewedFull: true, confirmedAt: previous?.confirmedAt ?? null, version: CONSENT_VERSION });
}

export function confirmReading(storage: ReadingStorage, checked: boolean, reachedEnd: boolean, now = new Date()) {
  if (!checked || !reachedEnd || !readReceipt(storage)?.viewedFull) throw new Error('请先浏览完整版知情同意书至文末，并主动勾选阅读确认。');
  return saveReceipt(storage, { viewedFull: true, confirmedAt: now.toISOString(), version: CONSENT_VERSION });
}

export function canEnterRegistration(receipt: ReadingReceipt | null) {
  return receipt?.version === CONSENT_VERSION && receipt.viewedFull && !!receipt.confirmedAt;
}

export function guardedEntry(stage: EntryStage, receipt: ReadingReceipt | null, continuedFromSummary = false): EntryStage {
  if (stage === 'consent-full' && !continuedFromSummary) return 'consent-summary';
  return stage === 'register' && !canEnterRegistration(receipt) ? 'consent-summary' : stage;
}

export function entryFromHash(hash: string): EntryStage | null {
  const stage = hash.replace(/^#/, '');
  if (!stage) return 'entry';
  return ['entry', 'consent-summary', 'consent-full', 'register'].includes(stage) ? stage as EntryStage : null;
}
