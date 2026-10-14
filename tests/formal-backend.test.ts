import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, continueInfo, currentStep, validSession } from '../lib/experiment.ts';
import { cacheFormalDraft, restoreFormalDraft, clearFormalDraft } from '../lib/formal-draft.ts';
import { allDataRow, surveyRows, trialRows, toCSV, scaleStageRows, textTaskRows } from '../lib/export.ts';
import { createSession as createV6, MATERIALS as oldMaterials } from '../lib/archive-v6/experiment.ts';
import { scaleStageRows as oldScales } from '../lib/archive-v6/export.ts';
import { validResearchSession } from '../lib/research-history.ts';
import { MATERIALS, itemsForStep, restoreStoredSession } from '../lib/experiment.ts';

const profile = { participantId: 'D001', gender: '女' as const, ageGroup: '18_25' as const, training: '正在学习基础课程', aiExperience: '偶尔使用' };

void test('historical exports stay valid and remaining material text stays byte-identical', () => {
  const old = createV6(profile, 'AX_BY', 42, 1000);
  assert.ok(validResearchSession(old));
  assert.equal(restoreStoredSession(old), null);
  assert.equal(oldScales(old).filter(row => 'ai_adoption_level' in row).length, 2);
  for (const event of MATERIALS) {
    const previous = oldMaterials.find(item => item.id === event.id)!;
    assert.equal(event.event_text, previous.event_text);
    assert.deepEqual(event.ai_cards, previous.ai_cards);
  }
  assert.equal(MATERIALS.some(e => ['C11', 'C39'].includes(e.id)), false);
});

void test('researcher view accepts records saved before profile fields changed', () => {
  const historical = createSession(profile, 'AX_BY', 44, 1000, { mode: 'formal', allocationSource: 'server-schedule' });
  historical.profile = { participantId: profile.participantId, gender: profile.gender, ageGroup: profile.ageGroup, training: profile.training, aiExperience: profile.aiExperience };
  assert.equal(validResearchSession(historical), true);
});

void test('each of eight tasks has adoption first and independent phase/event-linked answers', () => {
  const session = createSession(profile, 'AX_BY', 42, 1000);
  const steps = session.flow.filter(step => step.kind === 'trialSurvey');
  assert.equal(steps.length, 8);
  assert.equal(session.flow.filter(step => itemsForStep(step).some(item => item.id === 'ai_adoption_level')).length, 8);
  steps.forEach((step, index) => {
    assert.equal(itemsForStep(step)[0].id, 'ai_adoption_level');
    session.surveyDrafts[step.id].ai_adoption_level = index % 7 + 1;
  });
  const restored = restoreStoredSession(JSON.parse(JSON.stringify(session)))!;
  assert.ok(restored);
  for (const row of scaleStageRows(restored).filter(row => row.stage === 'trialSurvey')) {
    const plan = restored.plan.find(p => `${p.id}-survey` === row.survey_id)!;
    assert.equal(row.event_id, plan.eventId);
    assert.equal(row.phase, plan.phase);
    assert.equal(row.ai_adoption_level, session.surveyDrafts[String(row.survey_id)].ai_adoption_level);
  }
});

void test('stage exports separate all questionnaire answers from text tasks and timing', () => {
  const s = createSession(profile, 'AX_BY', 42, 1000);
  const scales = scaleStageRows(s), texts = textTaskRows(s);
  for (const item of surveyRows(s)) {
    const stage = scales.find(row => row.survey_id === item.survey_id)!;
    assert.ok(stage);
    assert.equal(stage[String(item.item_id)], item.value);
    for (const task of texts) assert.equal(String(item.item_id) in task, false);
  }
  assert.equal(texts.length, 8);
  assert.equal(texts.filter(row => row.phase === 'practice').length, 2);
  for (const stage of scales) {
    for (const field of ['reply', 'draft', 'event_text', 'card_text', 'inputMS', 'ai_views_json', 'session_backup_json']) assert.equal(field in stage, false);
  }
  assert.equal(texts[0].session_id, scales[0].session_id);
  assert.ok('inputMS' in texts[0]);
});

void test('all-data export preserves each stage, formal task, practice and raw backup in one row', () => {
  const session = createSession(profile, 'AX_BY', 123456, 1000, { mode: 'formal', allocationSource: 'server-schedule', sessionId: 'wide-export' });
  const row = allDataRow(session);
  assert.equal(row.session_id, session.id);
  assert.equal(row.age_group, '18_25');
  for (const item of surveyRows(session)) {
    assert.equal(row[`${String(item.survey_id).replaceAll('-', '_')}__${item.item_id}`], item.value);
  }
  for (const trial of trialRows(session)) {
    assert.equal(row[`${String(trial.trial_id).replaceAll('-', '_')}__event_id`], trial.event_id);
  }
  assert.equal(row.practice_1__phase, 'practice');
  assert.equal(row.formal_1__reply, undefined);
  assert.equal(JSON.parse(String(row.session_backup_json)).id, session.id);
  assert.ok(toCSV([row]).startsWith('\uFEFF'));
  assert.ok(toCSV([{ ...row, example_reply: '包含逗号,引号"与\n换行' }]).includes('引号""与'));
});

void test('page recovery preserves unsubmitted answers but cannot replace a newer server revision or another session', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } as unknown as Storage;
  const saved = createSession(profile, 'AX_BY', 123456, 1000, { mode: 'formal', allocationSource: 'server-schedule', sessionId: 'page-cache-test' });
  const draft = structuredClone(saved);
  const page = currentStep(draft).id;
  const field = Object.keys(draft.surveyDrafts[page])[0];
  draft.surveyDrafts[page][field] = 5;
  cacheFormalDraft(storage, draft);
  assert.equal(restoreFormalDraft(storage, saved).surveyDrafts[page][field], 5);
  const newer = { ...saved, revision: saved.revision + 1 };
  assert.equal(restoreFormalDraft(storage, newer), newer);
  const other = { ...saved, id: 'another-session' };
  assert.equal(restoreFormalDraft(storage, other), other);
  clearFormalDraft(storage, saved);
  assert.equal(restoreFormalDraft(storage, saved), saved);
});

void test('formal transition permits an explicit skip and records it without a demo flag', () => {
  let session = createSession(profile, 'AX_BY', 123456, 1000, { mode: 'formal', allocationSource: 'server-schedule', sessionId: 'formal-test-session' });
  assert.equal(validSession(session), true);
  assert.equal(session.mode, 'formal');
  assert.equal(session.sequence, 'AX_BY');
  assert.equal(session.allocationSource, 'server-schedule');
  const transition = session.flow.findIndex(step => step.kind === 'transition');
  const transitionId = session.flow[transition].id;
  session = { ...session, cursor: transition, furthestCursor: transition, openedAt: { ...session.openedAt, [transitionId]: 2000 } };
  assert.equal(currentStep(session).kind, 'transition');
  assert.throws(() => continueInfo(session, 2001));
  const next = continueInfo(session, 2001, true);
  assert.equal(next.cursor, transition + 1);
  assert.equal(next.skippedDemoTransition, false);
  assert.ok(next.logs.some(event => event.type === 'transition_skipped' && event.at === 2001));
  assert.ok(next.logs.some(event => event.type === 'transition_finished' && event.at === 2001));
});

void test('hosting and migration artifact define D1-backed formal persistence', () => {
  const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
  assert.equal(hosting.d1, 'DB');
  assert.equal('static' in hosting, false);
  const migration = readFileSync('drizzle/0000_shallow_multiple_man.sql', 'utf8');
  for (const table of ['experiment_sessions', 'session_events']) assert.ok(migration.includes(`CREATE TABLE \`${table}\``));
  for (const key of ['resume_token_hash', 'session_json', 'revision']) assert.ok(migration.includes(`\`${key}\``));
  const schema = readFileSync('db/schema.ts', 'utf8');
  assert.equal(schema.includes('participantCodes'), false);
  const store = readFileSync('lib/server/session-store.ts', 'utf8');
  assert.equal(store.includes('participant_codes'), false);
  assert.ok(store.includes("if (!/^[A-Z][0-9]{3}$/.test(id))"));
  assert.ok(store.includes('ORDER BY COALESCE(usage.used, 0)'));
  assert.ok(store.includes('allocationSource: \'server-schedule\''));
});

void test('research data requires a server-validated researcher session', () => {
  const app = readFileSync('components/experiment-app.tsx', 'utf8');
  const route = readFileSync('app/api/research/export/route.ts', 'utf8');
  const service = readFileSync('lib/server/research-export.ts', 'utf8');
  const migration = readFileSync('drizzle/0002_flimsy_amphibian.sql', 'utf8');
  assert.ok(app.includes('href="/research"'));
  assert.equal(app.includes('research-export-dialog'), false);
  const dashboard = readFileSync('components/research-dashboard.tsx', 'utf8');
  assert.ok(dashboard.includes('<Button type="submit" className="primary-action supporter-entry-button"'));
  assert.ok(dashboard.includes('<Button type="submit" variant="outline" disabled={busy}>搜索</Button>'));
  assert.ok(route.includes('requireResearcher(request)'));
  const auth = readFileSync('lib/server/research-auth.ts', 'utf8');
  assert.ok(auth.includes('HttpOnly; SameSite=Strict'));
  assert.ok(auth.includes('row.expires_at <= Date.now()'));
  assert.ok(service.includes('ADMIN_EXPORT_PASSWORD_HASH'));
  assert.ok(service.includes('MAX_FAILURES = 5'));
  assert.ok(migration.includes('CREATE TABLE `research_export_attempts`'));
  assert.ok(service.includes('secureHexEqual(supplied, expected)'));
});
