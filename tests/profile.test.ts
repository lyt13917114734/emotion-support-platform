import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGE_OPTIONS, GENDER_OPTIONS, EMPTY_PROFILE, AGE_INELIGIBLE_MESSAGE, normalizeProfile, hasCompleteProfile, isStoredProfile, validateProfile, isEligibleAge, ageGroupLabel, type Profile } from '../lib/profile.ts';
import { createSession, updateRegisteredProfile, currentStep, continueInfo, itemsForStep, setSurveyAnswer, submitSurvey, toggleAI, startReply, updateDraft, restoreStoredSession } from '../lib/experiment.ts';
import { LocalSessionRepository } from '../lib/storage.ts';
import { trialCSV, surveyCSV, backupJSON, blindCSV } from '../lib/export.ts';
import { PendingSave } from '../lib/pending-save.ts';

const profile: Profile = { participantId: 'P901', gender: '女', ageGroup: '18_25', training: '正在学习基础课程', aiExperience: '偶尔使用' };
function storageFixture() {
  const data = new Map<string, string>();
  return { data, storage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } } };
}
function draftSession() {
  let session = createSession(profile, 'BY_AX', 772, 1000);
  for (const item of itemsForStep(currentStep(session))) session = setSurveyAnswer(session, item.id, 4);
  session = continueInfo(submitSurvey(session, 'pretest', 1100), 1200);
  session = continueInfo(session, 1210);
  for (const item of itemsForStep(currentStep(session))) session = setSurveyAnswer(session, item.id, 4, 1220);
  session = submitSurvey(session, currentStep(session).id, 1230);
  return updateDraft(startReply(toggleAI(session, true, 1300), 1400), '保留原来的回复草稿', 1500);
}

void test('gender has two options; age has four ordered, non-overlapping bands with no defaults', () => {
  assert.deepEqual(GENDER_OPTIONS.map(option => option.value), ['女', '男']);
  assert.deepEqual(AGE_OPTIONS, [
    { value: 'under_18', label: '未满18岁' }, { value: '18_25', label: '18–25岁' },
    { value: '26_30', label: '26–30岁' }, { value: '31_plus', label: '31岁及以上' },
  ]);
  assert.equal(EMPTY_PROFILE.gender, ''); assert.equal(EMPTY_PROFILE.ageGroup, '');
  assert.equal(hasCompleteProfile(EMPTY_PROFILE), false);
});

void test('eligibility is 18 and above without upper limit; no consent/adult flag remains required', () => {
  for (const ageGroup of ['18_25', '26_30', '31_plus'] as const) {
    assert.equal(isEligibleAge(ageGroup), true);
    assert.equal(currentStep(createSession({ ...profile, ageGroup }, null, 4)).kind, 'pretest');
  }
  assert.equal(isEligibleAge('under_18'), false);
  assert.throws(() => createSession({ ...profile, ageGroup: 'under_18' }, null, 4), { message: AGE_INELIGIBLE_MESSAGE });
  assert.throws(() => validateProfile({ ...profile, ageGroup: '' }));
  assert.throws(() => validateProfile({ ...profile, gender: '' }));
  assert.throws(() => validateProfile({ ...profile, gender: '其他' } as unknown as Profile));
  assert.throws(() => validateProfile({ ...profile, participantId: '?' }));
  const fresh = createSession(profile, null, 4);
  assert.equal('adult' in fresh.profile, false); assert.equal('consent' in fresh.profile, false);
});

void test('participant numbers use one letter followed by exactly three digits', () => {
  for (const participantId of ['D001', 'd002', 'A999']) {
    assert.doesNotThrow(() => validateProfile({ ...profile, participantId }));
  }
  for (const participantId of ['D01', 'DD01', 'D0001', '001D', 'D00A', ' D001 ']) {
    assert.throws(() => validateProfile({ ...profile, participantId }), /D001/);
  }
});

void test('old gender and ambiguous age values reset, without guessing from adult or numerical ages', () => {
  for (const gender of ['其他', '不愿透露', null, true]) {
    assert.equal(normalizeProfile({ ...profile, gender }).gender, '');
  }
  for (const ageGroup of [undefined, true, 18, '18岁及以下', '30岁及以上', 'adult']) {
    const normalized = normalizeProfile({ ...profile, ageGroup, age: 25, adult: true, consent: true });
    assert.equal(normalized.ageGroup, ''); assert.equal(normalized.participantId, profile.participantId);
    assert.equal(normalized.training, profile.training); assert.equal(normalized.aiExperience, profile.aiExperience);
    assert.equal('adult' in normalized, false); assert.equal('consent' in normalized, false);
  }
});

void test('legacy migration persists empty demographics once and preserves allocation, answers and timing', () => {
  const { data, storage } = storageFixture();
  const original = draftSession();
  const legacy = { ...original, schemaVersion: 1, profile: { participantId: profile.participantId, gender: '不愿透露', training: profile.training, aiExperience: profile.aiExperience, adult: true, consent: true } };
  const key = `ier-e2-demo-v1:${original.id}`;
  data.set('ier-e2-demo-v1:index', JSON.stringify({ [profile.participantId]: original.id }));
  data.set(key, JSON.stringify(legacy)); data.set('unrelated', 'keep');
  const repo = new LocalSessionRepository(storage);
  const migrated = repo.findByParticipant(profile.participantId)!;
  assert.equal(migrated.schemaVersion, 3); assert.equal(migrated.profile.gender, ''); assert.equal(migrated.profile.ageGroup, '');
  assert.equal(hasCompleteProfile(migrated.profile), false);
  assert.equal(migrated.revision, original.revision + 1);
  for (const property of ['id', 'seed', 'sequence', 'plan', 'flow', 'cursor', 'trials', 'surveys', 'surveyDrafts', 'openedAt', 'logs', 'createdAt', 'updatedAt'] as const) {
    assert.deepEqual(migrated[property], original[property]);
  }
  assert.deepEqual(JSON.parse(data.get(key)!).profile, migrated.profile);
  assert.deepEqual(repo.findByParticipant(profile.participantId), migrated);
  const corrected = repo.save(updateRegisteredProfile(migrated, { ...migrated.profile, gender: '男', ageGroup: '31_plus' }, 1600), migrated.revision);
  assert.equal(corrected.id, original.id); assert.equal(corrected.cursor, original.cursor);
  assert.deepEqual(corrected.plan, original.plan); assert.deepEqual(corrected.trials, original.trials);
  assert.deepEqual(corrected.surveys, original.surveys); assert.equal(data.get('unrelated'), 'keep');
  assert.throws(() => repo.save(migrated, migrated.revision), /另一窗口/);
  assert.throws(() => updateRegisteredProfile(corrected, { ...profile, participantId: 'N901' }));
});

void test('migration storage failure leaves source intact; incompatible/corrupt sessions remain rejected', () => {
  const { data, storage } = storageFixture();
  const session = draftSession();
  const key = `ier-e2-demo-v1:${session.id}`;
  const legacy = JSON.stringify({ ...session, schemaVersion: 1, profile: { ...profile, gender: '其他', ageGroup: null, adult: true } });
  data.set(key, legacy); data.set('ier-e2-demo-v1:index', JSON.stringify({ [profile.participantId]: session.id }));
  const repo = new LocalSessionRepository({ ...storage, setItem: () => { throw new Error('quota'); } });
  assert.throws(() => repo.findByParticipant(profile.participantId), /quota/); assert.equal(data.get(key), legacy);
  assert.equal(restoreStoredSession({ ...session, materialVersion: 'other' }), null);
  assert.equal(restoreStoredSession({ ...session, schemaVersion: 99 }), null);
  assert.equal(restoreStoredSession({ ...session, profile: null }), null);
});

void test('JSON, emergency backup and non-blind CSV include age code and label; blind CSV does not', () => {
  let session = draftSession(); session = updateRegisteredProfile(session, { ...profile, ageGroup: '31_plus' });
  assert.equal(ageGroupLabel('31_plus'), '31岁及以上'); assert.equal(ageGroupLabel('ambiguous'), '');
  for (const csv of [trialCSV(session), surveyCSV(session)]) {
    assert.ok(csv.includes('age_group')); assert.ok(csv.includes('age_group_label'));
    assert.ok(csv.includes('31_plus')); assert.ok(csv.includes('31岁及以上'));
  }
  for (const json of [backupJSON(session), new PendingSave(session, session.revision).backup()]) {
    const exported = JSON.parse(json);
    assert.equal(exported.profile.ageGroup, '31_plus'); assert.equal(exported.profile.ageGroupLabel, '31岁及以上');
    assert.equal('adult' in exported.profile, false); assert.equal('consent' in exported.profile, false);
  }
  assert.equal(blindCSV(session).includes('age_group'), false); assert.equal(blindCSV(session).includes('gender'), false);
});

void test('registration no longer contains old checkboxes or native menu components', () => {
  const app = readFileSync(new URL('../components/experiment-app.tsx', import.meta.url), 'utf8');
  for (const obsolete of ['我已年满18周岁', '我已了解，并同意进行本地试跑', 'profile.adult', 'profile.consent', 'NativeSelect']) assert.equal(app.includes(obsolete), false);
  assert.ok(app.includes('placeholder="例如 D001"'));
  assert.ok(app.includes('pattern="[A-Za-z][0-9]{3}"'));
  assert.ok(app.includes('maxLength={4}'));
});

void test('registration captures psychology education duration and coded AI use frequency', () => {
  const app = readFileSync(new URL('../components/experiment-app.tsx', import.meta.url), 'utf8');
  for (const text of ['心理学学习经历', '截至目前，您接受系统心理学专业教育的累计时间约为多久？', '不足1年', '1～2年', '3～4年', '5年及以上', '总体而言，您平时使用生成式AI工具的频率如何？', '例如 ChatGPT、DeepSeek、Kimi、豆包、通义千问等。', '从不使用', '很少使用', '偶尔使用', '每周使用', '每天使用']) {
    assert.ok(app.includes(text), `missing registration text: ${text}`);
  }
  assert.ok(app.includes('psychologyStudyDuration'));
  assert.ok(app.includes('aiUseFrequency: value ? Number(value) : null'));
  for (const removed of ['任务相关心理学知识熟悉度', '总体而言，您对本任务所涉及的心理学知识有多熟悉？', '例如理解他人的情绪、分析情绪产生的原因，以及形成合适的支持性回应。']) assert.equal(app.includes(removed), false);

  const complete = { ...EMPTY_PROFILE, participantId: 'P902', gender: '女' as const, ageGroup: '18_25' as const, psychologyStudyDuration: '1_to_2_years', aiUseFrequency: 3 };
  assert.equal(hasCompleteProfile(complete), true);
  assert.equal(hasCompleteProfile({ ...complete, aiUseFrequency: null }), false);
  assert.equal(hasCompleteProfile({ ...complete, psychologyStudyDuration: '' }), false);
  assert.equal(isStoredProfile(complete), true);
  assert.equal(isStoredProfile(profile), true);
  assert.equal(isStoredProfile({ ...complete, unexpected: true }), false);
});
