export const GENDER_OPTIONS = [{ value: '女', label: '女' }, { value: '男', label: '男' }] as const;
export const AGE_OPTIONS = [
  { value: 'under_18', label: '未满18岁' },
  { value: '18_25', label: '18–25岁' },
  { value: '26_30', label: '26–30岁' },
  { value: '31_plus', label: '31岁及以上' },
] as const;
export type Gender = typeof GENDER_OPTIONS[number]['value'];
export type AgeGroup = typeof AGE_OPTIONS[number]['value'];
export type Profile = { participantId: string; gender: Gender | ''; ageGroup: AgeGroup | ''; aiUseFrequency?: number | null; aiExperience?: string; psychologyStudyDuration?: string; psychologyTaskKnowledgeFamiliarity?: number | null; training?: string };
export const EMPTY_PROFILE: Profile = { participantId: '', gender: '', ageGroup: '', aiUseFrequency: null, psychologyStudyDuration: '' };
export const AGE_INELIGIBLE_MESSAGE = '很抱歉，您的年龄不符合本研究的参与条件。感谢您的关注。';

export function isGender(value: unknown): value is Gender { return value === '女' || value === '男'; }
export function isAgeGroup(value: unknown): value is AgeGroup { return AGE_OPTIONS.some(option => option.value === value); }
export function ageGroupLabel(value: unknown) { return AGE_OPTIONS.find(option => option.value === value)?.label ?? ''; }
// Confirmed recruitment criterion: 18 and above, with no upper age limit.
export function isEligibleAge(value: unknown) { return isAgeGroup(value) && value !== 'under_18'; }

export function normalizeProfile(value: unknown): Profile {
  const old = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof old[key] === 'string' ? old[key] as string : '';
  // Legacy adult/age values cannot identify a non-overlapping age band.
  // Never infer a specific age or band; invalid/removed values need reselection.
  return { participantId: text('participantId'), gender: isGender(old.gender) ? old.gender : '',
    ageGroup: isAgeGroup(old.ageGroup) ? old.ageGroup : '',
    aiUseFrequency: typeof old.aiUseFrequency === 'number' && Number.isInteger(old.aiUseFrequency) && old.aiUseFrequency >= 1 && old.aiUseFrequency <= 5 ? old.aiUseFrequency : null,
    ...(text('aiExperience') ? { aiExperience: text('aiExperience') } : {}),
    ...(text('training') ? { training: text('training') } : {}),
    psychologyStudyDuration: text('psychologyStudyDuration'),
    psychologyTaskKnowledgeFamiliarity: typeof old.psychologyTaskKnowledgeFamiliarity === 'number' && Number.isInteger(old.psychologyTaskKnowledgeFamiliarity) && old.psychologyTaskKnowledgeFamiliarity >= 1 && old.psychologyTaskKnowledgeFamiliarity <= 7 ? old.psychologyTaskKnowledgeFamiliarity : null };
}

export function hasCompleteProfile(profile: Profile) {
  const newFields = !!profile.psychologyStudyDuration;
  const legacyFields = !!profile.training;
  const aiFrequency = profile.aiUseFrequency;
  const hasAIUse = typeof aiFrequency === 'number' && Number.isInteger(aiFrequency) && aiFrequency >= 1 && aiFrequency <= 5;
  return /^[A-Za-z][0-9]{3}$/.test(profile.participantId) && isGender(profile.gender) &&
    isAgeGroup(profile.ageGroup) && (hasAIUse || !!profile.aiExperience) && (newFields || legacyFields);
}

export function isStoredProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const stored = value as Record<string, unknown>;
  const allowed = new Set(['participantId', 'gender', 'ageGroup', 'aiUseFrequency', 'aiExperience', 'psychologyStudyDuration', 'psychologyTaskKnowledgeFamiliarity', 'training']);
  if (Object.keys(stored).some(key => !allowed.has(key))) return false;
  const normalized = normalizeProfile(stored) as Record<string, unknown>;
  return Object.keys(stored).every(key => JSON.stringify(stored[key]) === JSON.stringify(normalized[key]));
}

export function validateProfile(profile: Profile) {
  if (!/^[A-Za-z][0-9]{3}$/.test(profile.participantId)) throw new Error('参与者编号格式无效，请使用1个英文字母和3位数字，例如D001。');
  if (!hasCompleteProfile(profile)) throw new Error('请完成全部登记信息，并选择性别和年龄。');
  if (!isEligibleAge(profile.ageGroup)) throw new Error(AGE_INELIGIBLE_MESSAGE);
}

export function exportProfile(profile: Profile) {
  const normalized = normalizeProfile(profile);
  return { ...normalized, ageGroupLabel: ageGroupLabel(normalized.ageGroup) };
}
