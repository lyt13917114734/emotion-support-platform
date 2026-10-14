import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, itemsForStep, setSurveyAnswer, submitSurvey, currentStep, continueInfo, restoreStoredSession, validSession, navigateToStep, continueSubmittedTrial, toggleAI, startReply, updateDraft, submitReply, measurementMetadata, SEQUENCES, type Session, type Sequence } from '../lib/experiment.ts';
import { INITIAL_ITEMS, BLOCK_STATE_ITEMS, TASK_ITEMS, STRATEGY_ITEM, AI_USE_ITEMS, INTEGRATION_ITEMS, BLOCK_AI_USE_ITEMS, MATERIAL_EVALUATION_ITEMS, OVERALL_ITEMS, GOAL_FIELDS, INTEGRATION_FIELDS, attentionItem, emptyAnswers, rawMean, isAnswerValid, completeAnswers } from '../lib/measurements.ts';
import { PRETEST_STATE_VERSION, LEGACY_MEASURE_VERSION, firstStateKeyboardValue } from '../lib/pretest-state.ts';
import { LocalSessionRepository } from '../lib/storage.ts';
import { PendingSave } from '../lib/pending-save.ts';
import { backupJSON, surveyCSV, trialCSV } from '../lib/export.ts';
import type { Profile } from '../lib/profile.ts';

const profile: Profile = { participantId: 'S901', gender: '女', ageGroup: '31_plus', training: '基础课程', aiExperience: '偶尔使用' };
const reply = '这是用于检查程序流程的模拟回复，不属于任何真实参与者的数据。'.repeat(3);
const fresh = (sequence: Sequence = 'BY_AX') => createSession(profile, sequence, 918, 1000);
function fixture() {
  const data = new Map<string, string>(); let fail = false;
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw new Error('quota'); data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  return { data, storage, repo: new LocalSessionRepository(storage), fail: (value: boolean) => { fail = value; } };
}
function finishPage(session: Session, now: number) {
  const step = currentStep(session);
  for (const [index, item] of itemsForStep(step).entries()) {
    // Deliberately wrong attention answers must not trigger blocking/correction.
    session = setSurveyAnswer(session, item.id, item.kind === 'choice' ? item.options![0].value : index % 7 + 1, now + index);
  }
  return submitSurvey(session, step.id, now + 20);
}
function advance(session: Session, now: number) {
  const step = currentStep(session);
  if (itemsForStep(step).length) return finishPage(session, now);
  if (step.kind === 'trial') {
    if (session.trials[step.trialId!].sentAt !== null) return continueSubmittedTrial(session, now);
    return submitReply(updateDraft(startReply(toggleAI(session, true, now), now + 1), reply, now + 2), step.trialId!, now + 500);
  }
  return continueInfo(session, now + 180_000);
}
function atPage(id: string, sequence: Sequence = 'BY_AX') {
  let session = fresh(sequence), guard = 0;
  while (currentStep(session).id !== id && guard++ < 40) session = advance(session, session.updatedAt + 1000);
  assert.equal(currentStep(session).id, id); return session;
}

void test('initial trust plus four states; repeated block states and identical pre/post trust', () => {
  assert.deepEqual(INITIAL_ITEMS.map(item => item.id), ['ai_trust_pre', 'baseline_fatigue', 'baseline_pressure', 'baseline_emotional_valence', 'baseline_emotional_statue']);
  assert.deepEqual(BLOCK_STATE_ITEMS.map(item => [item.id, item.text, item.low, item.high]), [
    ['fatigue', '我现在感到的疲惫程度为', '完全不疲惫', '非常疲惫'],
    ['pressure', '我现在感到的压力程度为', '完全没压力', '非常有压力'],
    ['focus_maintenance_effort', '我现在需要付出多少努力才能维持专注？', '完全不需要', '非常需要'],
    ['cognitive_clarity', '我现在感到思维清晰的程度为', '完全不清晰', '非常清晰'],
    ['emotional_depletion', '我现在感到情绪消耗的程度为', '完全不消耗', '非常消耗'],
  ]);
  const before = INITIAL_ITEMS[0], after = OVERALL_ITEMS.find(item => item.id === 'ai_trust_post')!;
  assert.deepEqual([before.text, before.low, before.high], [after.text, after.low, after.high]);
  const states = fresh().flow.filter(step => step.kind === 'blockState');
  assert.equal(states.length, 6);
  for (const step of states) assert.deepEqual(itemsForStep(step), BLOCK_STATE_ITEMS);
});

void test('all 20 measurement pages start null; only intentional valid answers are accepted', () => {
  const session = fresh(); assert.ok(validSession(session));
  assert.equal(Object.keys(session.surveyDrafts).length, 20);
  assert.deepEqual(session.surveyDrafts.pretest, emptyAnswers(INITIAL_ITEMS));
  for (const answers of Object.values(session.surveyDrafts)) assert.ok(Object.values(answers).every(value => value === null));
  assert.equal(firstStateKeyboardValue('Tab'), null); assert.equal(firstStateKeyboardValue('Enter'), null);
  assert.equal(firstStateKeyboardValue('ArrowRight'), 1); assert.equal(firstStateKeyboardValue('ArrowLeft'), 7);
  for (const value of [null, undefined, NaN, Infinity, 0, 8, 4.5, '4', true]) {
    assert.equal(isAnswerValid(INITIAL_ITEMS[0], value), false);
    assert.throws(() => setSurveyAnswer(session, 'ai_trust_pre', value as number));
  }
  assert.throws(() => submitSurvey(session, 'pretest'));
  const partial = setSurveyAnswer(session, 'ai_trust_pre', 7, 1100);
  assert.equal(completeAnswers(INITIAL_ITEMS, partial.surveyDrafts.pretest), false);
  assert.throws(() => submitSurvey(partial, 'pretest'));
  assert.equal(session.surveyDrafts.pretest.ai_trust_pre, null);
});

void test('all schedules have exact pre/mid/post sequences, one block-level integration page and matching practice evaluation pages', () => {
  for (const sequence of SEQUENCES) {
    const ids = fresh(sequence).flow.map(step => step.id);
    assert.equal(ids.length, 34); assert.equal(new Set(ids).size, 34);
    assert.equal(ids.some(id => /practice-\d-survey/.test(id)), true);
    assert.equal(ids.filter(id => id.startsWith('integration-')).length, 2);
    for (const block of [1, 2]) {
      const task1 = `practice-${block}`, task2 = block === 1 ? 1 : 4, task3 = block === 1 ? 2 : 5, task4 = block === 1 ? 3 : 6;
      assert.deepEqual(ids.slice(ids.indexOf(`practice-${block}`), ids.indexOf(`practice-${block}`) + 4), [
        `practice-${block}`, `practice-${block}-survey`, `formal-${task2}`, `block-state-${block}-mid`,
      ]);
      assert.deepEqual(ids.slice(ids.indexOf(`formal-${task2}`), ids.indexOf(`formal-${task2}`) + 5), [
        `formal-${task2}`, `block-state-${block}-mid`, `formal-${task2}-survey`, `attention-${block}`, `formal-${task3}`,
      ]);
      assert.deepEqual(ids.slice(ids.indexOf(`formal-${task4}`), ids.indexOf(`formal-${task4}`) + 5), [
        `formal-${task4}`, `block-state-${block}-post`, `formal-${task4}-survey`, `integration-${block}`, block === 1 ? 'transition' : 'final',
      ]);
      assert.equal(ids[ids.indexOf(`${task1}-survey`) + 1], `formal-${task2}`);
      assert.equal(ids[ids.indexOf(`formal-${task3}-survey`) + 1], `formal-${task4}`);
    }
  }
});

void test('final document task, block AI, integration and material items remain exact', () => {
  assert.deepEqual(TASK_ITEMS.map(item => [item.id, item.text, item.low, item.high]), [
    ['ai_adoption_level', '在完成刚才这项情绪调节任务时，您在多大程度上采纳了AI提供的信息？', '完全没采纳', '完全采纳'],
    ['perceived_emotion_understanding', '我对对方所表达情绪的理解程度为', '非常不理解', '非常理解'],
    ['perceived_emotion_differentiation', '我能清楚地区分对方所表达的不同情绪。', '完全不同意', '完全同意'],
    ['goal_need_capture', '我觉得我准确地捕捉到了对方的需求。', '完全不同意', '完全同意'],
    ['goal_task_attainment', '我认为我的回复达到了本次情绪调节任务的主要目的。', '完全不同意', '完全同意'],
    ['goal_support_completion', '我认为本次任务要求的情绪调节工作完成程度为', '非常差', '非常好'],
    ['goal_intended_achievement', '我认为这次回复实现了我原本想提供的情绪调节。', '完全不同意', '完全同意'],
    ['expected_emotion_improvement', '我预计我的回复有助于改善对方当前的情绪。', '完全不同意', '完全同意'],
    ['expected_negative_emotion_relief', '我预计对方在阅读我的回复后，负性情绪会有所缓解。', '完全不同意', '完全同意'],
    ['expected_positive_emotional_impact', '我预计这条回复会让对方感觉更好。', '完全不同意', '完全同意'],
    ['goal_soothing', '我认为我成功地安抚了对方的情绪。', '完全不同意', '完全同意'],
    ['goal_quality_satisfaction', '我对我的回复质量感到满意。', '完全不同意', '完全同意'],
    ['mental_demand', '刚才这项情绪调节任务对我的脑力要求为', '非常低', '非常高'],
    ['subjective_effort', '完成刚才这项情绪调节任务时，我投入了较大的心理努力。', '完全不同意', '完全同意'],
    ['response_difficulty', '刚才，撰写一段合适的情绪调节回复对我来说困难程度为', '非常容易', '非常困难'],
  ]);
  assert.deepEqual(AI_USE_ITEMS.map(item => [item.id, item.text, item.low, item.high]), [
    ['ai_emotion_understanding_help', '在刚才4项任务中，AI提供的信息在多大程度上帮助您理解对方的主要情绪和情绪状态？', '完全没帮助', '帮助非常大'],
    ['ai_strategy_clarity_help', '在刚才4项任务中，AI提供的信息在多大程度上帮助您确定回应方向和回应方式？', '完全没帮助', '帮助非常大'],
  ]);
  assert.deepEqual(INTEGRATION_ITEMS.map(item => [item.id, item.text, item.low, item.high]), [
    ['ai_integration_checking', '我需要反复核对AI提供的信息是否适合当前事件。', '完全不同意', '完全同意'],
    ['ai_integration_conflict', 'AI提供的信息有时与我自己的判断不一致，需要额外处理。', '完全不同意', '完全同意'],
    ['ai_integration_switching', '在事件材料、AI信息和回复编辑之间切换会增加我的负担。', '完全不同意', '完全同意'],
  ]);
  assert.deepEqual(BLOCK_AI_USE_ITEMS.map(item => item.id), [...AI_USE_ITEMS, ...INTEGRATION_ITEMS].map(item => item.id));
  assert.deepEqual(STRATEGY_ITEM.options, [
    { value: 'emotional_engagement', label: '情感参与' }, { value: 'cognitive_engagement', label: '认知参与' },
    { value: 'combined', label: '两种方式结合使用' }, { value: 'neither', label: '均未采用' },
  ]);
  assert.deepEqual(MATERIAL_EVALUATION_ITEMS, []);
  assert.deepEqual(OVERALL_ITEMS.map(item => [item.id, item.text, item.low, item.high]), [
    ['overall_preference', '在类似的情绪调节任务中，您总体上更偏好哪一种AI辅助方式？', '', ''],
    ['future_intention_emotion_support', '未来完成类似的情绪调节任务时，我愿意使用情绪识别辅助。', '完全不同意', '完全同意'],
    ['future_intention_strategy_support', '未来完成类似的情绪调节任务时，我愿意使用策略供给辅助。', '完全不同意', '完全同意'],
    ['ai_trust_post', '总体而言，我认为AI在这类情绪调节任务中提供的辅助信息是可信的。', '完全不同意', '完全同意'],
  ]);
  assert.deepEqual(OVERALL_ITEMS[0].options, [
    { value: 'emotion_support', label: '情绪识别辅助' }, { value: 'strategy_support', label: '策略供给辅助' },
    { value: 'no_preference', label: '两者相近，没有明显偏好' },
  ]);
  assert.deepEqual([attentionItem(1).text, attentionItem(2).text], ['这是一道作答检查题，请将滑块移动到“2”。', '这是一道作答检查题，请将滑块移动到“6”。']);
  const app = readFileSync(new URL('../components/experiment-app.tsx', import.meta.url), 'utf8');
  const measurement = readFileSync(new URL('../components/measurement-screen.tsx', import.meta.url), 'utf8');
  for (const text of ['本区组任务即将开始', '接下来将进入本区组的任务。开始前，请先记录您此刻的状态。', '开始状态记录']) assert.ok(app.includes(text));
  for (const text of ['区组 AI辅助使用评价', '以下题目要求参与者评价刚刚完成的整个区组，而不是其中某一项任务。', '区组AI辅助信息评价']) assert.ok(measurement.includes(text));
  assert.equal(measurement.includes('回顾刚才两项任务'), false);
});

void test('document stages place AI adoption at every task and AI use evaluation at block end and expose exact measurement timepoint codes', () => {
  const session = fresh();
  for (const step of session.flow.filter(step => step.kind === 'trialSurvey')) {
    assert.deepEqual(itemsForStep(step).map(item => item.id), TASK_ITEMS.map(item => item.id));
    assert.equal(measurementMetadata(session, step).measurement_timepoint, 'task_post');
  }
  for (const step of session.flow.filter(step => step.kind === 'integrationCost')) {
    assert.deepEqual(itemsForStep(step).map(item => item.id), BLOCK_AI_USE_ITEMS.map(item => item.id));
    assert.equal(measurementMetadata(session, step).measurement_timepoint, 'block_end');
  }
  for (const [time, code] of [['pre', 'block_start'], ['mid', 'after_task_2'], ['post', 'after_task_4']] as const) {
    const states = session.flow.filter(step => step.kind === 'blockState' && step.measurementTime === time);
    assert.equal(states.length, 2);
    for (const step of states) assert.equal(measurementMetadata(session, step).measurement_timepoint, code);
  }
  assert.equal(measurementMetadata(session, session.flow.find(step => step.kind === 'pretest')!).measurement_timepoint, 'experiment_pre');
  assert.equal(measurementMetadata(session, session.flow.find(step => step.kind === 'final')!).measurement_timepoint, 'experiment_post');
});

void test('retired strategy category is absent in both conditions', () => {
  for (const sequence of SEQUENCES) {
    let session = atPage('formal-1-survey', sequence);
    const step = currentStep(session);
    assert.equal(itemsForStep(step).length, TASK_ITEMS.length);
    assert.equal(Object.hasOwn(session.surveyDrafts[step.id], 'self_reported_strategy'), false);
    assert.throws(() => setSurveyAnswer(session, 'self_reported_strategy', 'combined'));
    for (const item of itemsForStep(step).filter(item => item.kind === 'scale')) session = setSurveyAnswer(session, item.id, 4, 500_000);
    session = submitSurvey(session, step.id, 500_010);
    assert.equal(Object.hasOwn(session.task_evaluations['formal-1'], 'self_reported_strategy'), false);
    assert.equal(session.surveys.filter(row => row.id === step.id).length, 1);
  }
});

void test('back and resubmit updates one measurement, preserves context, and never re-sends replies', () => {
  let session = atPage('formal-1-survey');
  session = finishPage(session, session.updatedAt + 1000);
  const original = structuredClone(session.surveys.find(row => row.id === 'formal-1-survey')!);
  const trial = structuredClone(session.trials['formal-1']);
  const index = session.flow.findIndex(step => step.id === original.id);
  session = navigateToStep(session, index, original.updated_at! + 1000);
  session = setSurveyAnswer(session, 'goal_soothing', 7, original.updated_at! + 2000);
  session = submitSurvey(session, original.id, original.updated_at! + 3000);
  const revised = session.surveys.find(row => row.id === original.id)!;
  assert.equal(revised.answers.goal_soothing, 7); assert.ok(revised.updated_at! > original.updated_at!);
  for (const key of ['participant_id', 'schedule_id', 'block_id', 'condition', 'material_set', 'material_id', 'task_position', 'completed_formal_tasks', 'measurement_time', 'created_at', 'submittedAt'] as const) assert.equal(revised[key], original[key]);
  assert.equal(session.surveys.filter(row => row.id === original.id).length, 1);
  assert.equal(submitSurvey(session, original.id), session);
  session = navigateToStep(session, session.flow.findIndex(step => step.id === 'formal-1'), revised.updated_at! + 1000);
  session = continueSubmittedTrial(session, revised.updated_at! + 2000);
  assert.deepEqual(session.trials['formal-1'], trial);
  assert.equal(currentStep(session).id, 'block-state-1-mid');
  assert.throws(() => navigateToStep(session, session.furthestCursor + 1));
  assert.ok(validSession(session));
});

void test('partial answers and current page persist; failed writes retain prior record and recovery candidate', () => {
  const f = fixture(); let session = f.repo.create(atPage('formal-1-survey'));
  session = f.repo.save(setSurveyAnswer(session, 'goal_quality_satisfaction', 2, session.updatedAt + 1000), session.revision);
  const found = f.repo.findByParticipant('S901')!;
  assert.equal(currentStep(found).id, 'formal-1-survey');
  assert.deepEqual(found.surveyDrafts, session.surveyDrafts); assert.deepEqual(found.task_evaluations, session.task_evaluations);
  const pending = new PendingSave(setSurveyAnswer(found, 'goal_task_attainment', 6, found.updatedAt + 1000), found.revision);
  f.fail(true); assert.throws(() => pending.retry(f.repo));
  assert.equal(f.repo.findByParticipant('S901')!.surveyDrafts['formal-1-survey'].goal_task_attainment, null);
  assert.equal(JSON.parse(pending.backup()).task_evaluations['formal-1'].goal_task_attainment, 6);
  f.fail(false); session = pending.retry(f.repo);
  assert.equal(session.task_evaluations['formal-1'].goal_task_attainment, 6);
  const previous = f.repo.save(navigateToStep(session, session.cursor - 1), session.revision);
  assert.equal(f.repo.findByParticipant('S901')!.cursor, previous.cursor);
});

void test('wrong attention answers continue; pass flags update and attention never enters means', () => {
  let session = atPage('attention-1');
  session = setSurveyAnswer(session, 'attention_check_block_1', 7, session.updatedAt + 100);
  assert.equal(session.attention_check_block_1_passed, null);
  session = submitSurvey(session, 'attention-1', session.updatedAt + 100);
  assert.equal(currentStep(session).id, 'formal-2'); assert.equal(session.attention_check_block_1_passed, false);
  session = navigateToStep(session, session.cursor - 1, session.updatedAt + 100);
  session = setSurveyAnswer(session, 'attention_check_block_1', 2, session.updatedAt + 100);
  session = submitSurvey(session, 'attention-1', session.updatedAt + 100);
  assert.equal(session.attention_check_block_1_passed, true);
  assert.deepEqual(GOAL_FIELDS, ['goal_task_attainment', 'goal_support_completion', 'goal_intended_achievement']);
  assert.deepEqual(INTEGRATION_FIELDS, ['ai_integration_checking', 'ai_integration_conflict', 'ai_integration_switching']);
  const a = { goal_task_attainment: 1, goal_support_completion: 4, goal_intended_achievement: 7, attention_check_block_1: 2 };
  assert.equal(rawMean(a, GOAL_FIELDS), 4); assert.equal(rawMean({ ...a, goal_intended_achievement: null }, GOAL_FIELDS), null);
});

void test('exports cover 20 pages / 171 raw responses, exact linkage and document-derived values', () => {
  for (const sequence of SEQUENCES) {
    const session = atPage('complete', sequence);
    assert.equal(session.surveys.length, 20);
    assert.equal(session.attention_check_block_1_passed, false); assert.equal(session.attention_check_block_2_passed, false);
    for (const block of [1, 2]) {
      assert.deepEqual(Object.keys(session.block_state[block]), ['pre', 'mid', 'post']);
      const formal = session.plan.find(t => t.block === block && t.phase === 'formal')!;
      assert.equal(session.block_evaluation[block], undefined);
      assert.equal(session.block_state[block].mid.material_set, formal.materialSet);
      assert.deepEqual(['pre', 'mid', 'post'].map(time => [session.block_state[block][time].measurement_time, session.block_state[block][time].completed_formal_tasks]), [['pre', 0], ['mid', 1], ['post', 3]]);
      assert.equal(session.integration_cost[block].condition, formal.condition);
      assert.equal(session.integration_cost[block].completed_formal_tasks, 3);
      assert.equal(session.integration_cost[block].integration_cost_mean, 4);
      assert.equal(session.block_state[block].mid.cognitive_clarity_reversed, 4);
      assert.equal(session.block_state[block].mid.cognitive_resource_depletion_mean, 3.5);
    }
    for (const row of session.surveys.filter(row => row.stage === 'trialSurvey')) {
      const trial = session.plan.find(t => t.id === row.trialId)!;
      assert.deepEqual([row.schedule_id, row.schedule_order, row.block_id, row.block_index, row.condition, row.material_set, row.material_id, row.event_id, row.task_position, row.completed_formal_tasks, row.measurement_time, row.measurement_timepoint], [sequence, sequence, trial.block, trial.block, trial.condition, trial.materialSet, trial.eventId, trial.eventId, trial.ordinal, trial.ordinal - 1, 'post_task', 'task_post']);
      assert.ok(row.created_at); assert.ok(row.updated_at);
    }
    const json = JSON.parse(backupJSON(session));
    assert.equal(Object.keys(json.task_evaluations).length, 8);
    assert.equal(json.task_evaluations['formal-1'].goal_attainment_mean, 6);
    assert.equal(json.integration_cost['1'].integration_cost_mean, 4);
    assert.equal(session.task_evaluations['formal-1'].goal_attainment_mean, 6);
    assert.equal(json.overall_evaluation.ai_trust_change, 3);
    assert.deepEqual(json.surveys, session.surveys);
    const csv = surveyCSV(session);
    assert.equal(csv.split('\r\n').length, 172);
    for (const key of ['participant_id', 'schedule_order', 'block_index', 'condition', 'material_set', 'event_id', 'task_position', 'measurement_timepoint', 'created_at', 'updated_at', 'goal_attainment_mean', 'integration_cost_mean', 'cognitive_clarity_reversed', 'cognitive_resource_depletion_mean', 'ai_trust_change']) assert.ok(csv.includes(`"${key}"`));
    assert.equal(trialCSV(session).split('\r\n').length, 7);
    assert.equal(Object.values(json.task_evaluations).filter((row: unknown) => Object.hasOwn(row as object, 'self_reported_strategy')).length, 0);
  }
});


void test('old protocol records cannot resume or be silently relabelled into the new protocol', () => {
  const old = fresh(); old.protocolVersion = 'E2-local-demo-20260911-v6';
  const snapshot = JSON.stringify(old);
  assert.equal(restoreStoredSession(old), null);
  assert.equal(JSON.stringify(old), snapshot);
  for (const invalid of [{ ...fresh(), measureVersion: 'unknown' }, { ...fresh(), materialVersion: 'other' }, { ...fresh(), surveys: [null] }, { ...fresh(), flow: [] }]) assert.equal(restoreStoredSession(invalid), null);
});
