import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSIGNMENT_SEQUENCE, SEQUENCES, createSession, makePlan, materialGroup, currentStep, continueInfo, toggleAI, startReply, updateDraft, submitReply, setSurveyAnswer, submitSurvey, itemsForStep, recordPageEvent, validSession, MATERIALS, countCharacters, TRANSITION_MS } from '../lib/experiment.ts';
import { LocalSessionRepository } from '../lib/storage.ts';
import { PendingSave } from '../lib/pending-save.ts';
import { trialRows, trialCSV, surveyCSV, blindCSV, csvCell } from '../lib/export.ts';
import type { Profile } from '../lib/profile.ts';
import { emptyAnswers, INITIAL_ITEMS } from '../lib/measurements.ts';

const profile: Profile = { participantId: 'T901', gender: '女', ageGroup: '18_25', training: '基础课程', aiExperience: '偶尔' };
const reply = '我认真读了你分享的这段经历，能看出你为这件事投入了不少时间。结果和期待不一样的时候，确实不容易马上调整过来。你不必急着对自己做出整体判断，可以先允许自己慢慢整理这次经历，再按自己的节奏决定下一步。';
function completeSurvey(s: ReturnType<typeof createSession>, now: number) {
  const id = currentStep(s).id;
  for (const item of itemsForStep(currentStep(s))) s = setSurveyAnswer(s, item.id, item.kind === 'choice' ? item.options![0].value : 4, now);
  return submitSurvey(s, id, now);
}
function firstTrial() {
  let s = createSession(profile, 'AX_BY', 42, 1000);
  s = completeSurvey(s, 1100);
  s = continueInfo(s, 1200); s = continueInfo(s, 1250);
  return completeSurvey(s, 1300);
}
test('four schedules balance condition, material set and block; 2 practices + 6 unique formal events', () => {
  assert.deepEqual(MATERIALS.filter(e => e.phase === 'practice').map(e => e.id).sort(), ['C09', 'C23']);
  assert.deepEqual(MATERIALS.filter(e => e.material_set === 'X').map(e => e.id).sort(), ['C04', 'C22', 'C23', 'C35']);
  assert.deepEqual(MATERIALS.filter(e => e.material_set === 'Y').map(e => e.id).sort(), ['C01', 'C09', 'C14', 'C26']);
  const expected = {
    AX_BY: [[0, 'A'], [1, 'B']], AY_BX: [[1, 'A'], [0, 'B']],
    BX_AY: [[0, 'B'], [1, 'A']], BY_AX: [[1, 'B'], [0, 'A']],
  };
  const rows = SEQUENCES.flatMap(seq => {
    const p = makePlan(seq, 99);
    assert.equal(p.length, 8); assert.equal(p.filter(t => t.phase === 'practice').length, 2);
    assert.equal(new Set(p.filter(t => t.phase === 'formal').map(t => t.eventId)).size, 6);
    for (const b of [1, 2]) assert.equal(new Set(p.filter(t => t.block === b).map(t => t.condition)).size, 1);
    assert.deepEqual([1, 2].map(block => {
      const formal = p.find(t => t.block === block && t.phase === 'formal')!;
      return [materialGroup(formal.materialSet), formal.condition];
    }), expected[seq]);
    assert.deepEqual(p, makePlan(seq, 99)); return p.filter(t => t.phase === 'formal');
  });
  for (const e of MATERIALS.filter(e => e.phase === 'formal')) {
    const relevant = rows.filter(t => t.eventId === e.id);
    assert.equal(relevant.filter(t => t.condition === 'A').length, 2);
    assert.equal(relevant.filter(t => t.block === 1).length, 2);
  }
  const firstBlockOrders = new Set(Array.from({ length: 20 }, (_, seed) =>
    makePlan('AX_BY', seed + 1).filter(t => t.phase === 'formal' && t.block === 1).map(t => t.eventId).join(',')));
  assert.ok(firstBlockOrders.size > 1);
});
test('trial export keeps material group, platform block, AI condition and assignment separate', () => {
  for (const sequence of SEQUENCES) {
    const rows = trialRows(createSession(profile, sequence, 99, 1000));
    assert.equal(rows.length, 6);
    for (const row of rows) {
      assert.equal(row.material_group, materialGroup(row.material_set as string));
      assert.equal(row.block_position, row.block);
      assert.equal(row.ai_condition, row.condition);
      assert.equal(row.event_order, row.within_block_index);
      assert.equal(row.assignment_sequence, ASSIGNMENT_SEQUENCE[sequence]);
    }
  }
});
test('practice leads to formal transition and pre-state; initial baseline remains before all practice', () => {
  const s = createSession(profile, 'BY_AX', 99, 1000);
  assert.ok(validSession(s)); assert.equal(s.flow.length, 34);
  const at = (id: string) => s.flow.findIndex(x => x.id === id);
  assert.ok(at('pretest') < at('practice-1'));
  assert.deepEqual(s.flow.slice(at('practice-1'), at('practice-1') + 4).map(step => step.id), ['practice-1', 'practice-1-survey', 'formal-1', 'block-state-1-mid']);
  assert.ok(at('integration-1') < at('practice-2'));
  assert.deepEqual(s.flow.slice(at('practice-2'), at('practice-2') + 4).map(step => step.id), ['practice-2', 'practice-2-survey', 'formal-4', 'block-state-2-mid']);
  assert.equal(s.flow.filter(x => x.kind === 'trialSurvey').length, 8);
});
test('AI opening required; reply timer persists and invalid sends do not end it', () => {
  let s = firstTrial();
  assert.throws(() => startReply(s, 2000));
  s = toggleAI(s, true, 1500); s = startReply(s, 2000); s = startReply(s, 3000);
  assert.equal(s.trials['practice-1'].replyStartedAt, 2000);
  s = updateDraft(s, '太短', 3100); assert.throws(() => submitReply(s, 'practice-1', 4000));
  assert.equal(s.trials['practice-1'].sentAt, null);
  s = recordPageEvent(s, 'resume', 4500);
  assert.equal(s.trials['practice-1'].replyStartedAt, 2000); assert.ok(s.trials['practice-1'].interrupted);
  s = updateDraft(s, reply, 5000); s = submitReply(s, 'practice-1', 6500);
  assert.equal(s.trials['practice-1'].inputMS, 4500);
  assert.equal(currentStep(s).id, 'practice-1-survey');
  assert.equal(submitReply(s, 'practice-1', 9000), s);
});
test('missing/out-of-range survey ratings cannot advance; no preselected answers', () => {
  let s = createSession(profile, 'AX_BY', 1, 1000);
  assert.deepEqual(s.surveyDrafts.pretest, emptyAnswers(INITIAL_ITEMS));
  assert.throws(() => submitSurvey(s, 'pretest', 2000));
  assert.throws(() => setSurveyAnswer(s, 'baseline_fatigue', 8));
  assert.throws(() => setSurveyAnswer(s, 'unknown', 4));
  s = completeSurvey(s, 2000); assert.equal(submitSurvey(s, 'pretest', 3000), s);
});
test('full sessions in all schedules complete, each trial measured once, with correct exports', () => {
  for (const seq of SEQUENCES) {
    let now = 1000, s = createSession(profile, seq, 41, now);
    let guard = 0;
    while (currentStep(s).kind !== 'complete' && guard++ < 50) {
      now += 10000; const step = currentStep(s);
      if (itemsForStep(step).length) s = completeSurvey(s, now);
      else if (step.kind === 'trial') {
        s = toggleAI(s, true, now); s = startReply(s, now + 500); s = updateDraft(s, reply, now + 1000);
        s = submitReply(s, step.trialId!, now + 5000);
      } else {
        if (step.kind === 'transition') { assert.throws(() => continueInfo(s, now)); now += TRANSITION_MS; }
        s = continueInfo(s, now);
      }
    }
    assert.equal(currentStep(s).kind, 'complete'); assert.ok(s.completedAt); assert.ok(validSession(s));
    assert.equal(Object.keys(s.trials).length, 8); assert.equal(s.surveys.length, 20);
    assert.equal(s.surveys.filter(r => r.stage === 'trialSurvey').length, 8);
    assert.ok(trialCSV(s).includes('inputMS')); assert.ok(trialCSV(s).includes('response_id')); assert.ok(surveyCSV(s).includes('researcher-measurements-20260921-task-adoption-v2'));
    for (const row of trialRows(s)) {
      assert.equal(row.material_group, materialGroup(row.material_set as string));
      assert.equal(row.block_position, row.block);
      assert.equal(row.ai_condition, row.condition);
      assert.equal(row.event_order, row.within_block_index);
      assert.equal(row.assignment_sequence, ASSIGNMENT_SEQUENCE[seq]);
    }
    const blind = blindCSV(s);
    assert.equal(blind.split('\r\n').length, 7); assert.ok(!blind.includes('condition')); assert.ok(!blind.includes('T901')); assert.ok(!blind.includes('共情参与：'));
  }
});
test('local storage: restore stable sequence/draft; refuse stale writes; clear only this session', () => {
  const data = new Map<string, string>([['unrelated-key', 'keep']]);
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  const repo = new LocalSessionRepository(storage);
  let s = repo.create(firstTrial());
  const old = s;
  s = repo.save(toggleAI(s, true, 1500), s.revision);
  assert.throws(() => repo.save(old, old.revision));
  assert.deepEqual(repo.findByParticipant('t901'), s);
  repo.remove(s); assert.equal(repo.findByParticipant('T901'), null); assert.equal(data.get('unrelated-key'), 'keep');
});
test('storage quota errors throw instead of advancing', () => {
  const repo = new LocalSessionRepository({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
  assert.throws(() => repo.create(firstTrial()), /quota/);
});
test('researcher-provided cards keep the fixed instruction and event-specific section structure', () => {
  assert.equal(new Set(MATERIALS.map(e => e.source_id)).size, 8);
  for (const e of MATERIALS) {
    assert.equal(e.review_status, 'user_confirmed_for_platform_integration');
    assert.equal(e.source_candidate_id, e.id);
    assert.match(e.source_id, /^ED:(train|valid|test):hit:/);
    assert.equal(e.ai_cards.A.paragraphs.length, 3); assert.equal(e.ai_cards.B.paragraphs.length, 3);
    assert.match(e.ai_cards.A.paragraphs[0], /^主要情绪：/); assert.match(e.ai_cards.A.paragraphs[1], /^产生原因：/); assert.match(e.ai_cards.A.paragraphs[2], /^AI辅助使用说明：本轮任务中，你可以调用 AI 辅助进行情绪识别。/);
    assert.match(e.ai_cards.B.paragraphs[0], /^用户当前想法：/); assert.match(e.ai_cards.B.paragraphs[1], /^可替代想法：/); assert.match(e.ai_cards.B.paragraphs[2], /^AI辅助使用说明：本轮任务中，你可以调用 AI 辅助进行认知重评。/);
    assert.equal(e.ai_cards.A.text, e.ai_cards.A.paragraphs.join('\n'));
    assert.equal(e.ai_cards.B.text, e.ai_cards.B.paragraphs.join('\n'));
    assert.equal(e.ai_cards.A.character_count, countCharacters(e.ai_cards.A.text));
    assert.equal(e.ai_cards.B.character_count, countCharacters(e.ai_cards.B.text));
  }
});
test('CSV escapes quotes and neutralizes text formulas', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('-12'), '"\'-12"'); assert.equal(csvCell(-12), '"-12"');
});

test('pending save preserves latest draft and first valid send time when storage recovers', () => {
  const data = new Map<string, string>(); let fail = false;
  const repo = new LocalSessionRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (fail) throw new Error('quota'); data.set(k, v); }, removeItem: k => { data.delete(k); } });
  let s = repo.create(firstTrial());
  s = repo.save(startReply(toggleAI(s, true, 1500), 2000), s.revision);
  const pending = new PendingSave(submitReply(updateDraft(s, reply, 6500), 'practice-1', 6500), s.revision);
  fail = true; assert.throws(() => pending.retry(repo), /quota/);
  const backup = JSON.parse(pending.backup());
  assert.equal(backup.trials['practice-1'].reply, reply); assert.equal(backup.emergencyBackup.persisted, false);
  assert.equal(repo.findByParticipant('T901')!.trials['practice-1'].sentAt, null);
  fail = false; const saved = pending.retry(repo);
  assert.equal(saved.trials['practice-1'].sentAt, 6500); assert.equal(saved.trials['practice-1'].inputMS, 4500);
  assert.equal(currentStep(saved).id, 'practice-1-survey');
});

test('old material or measure versions cannot silently resume into newer content', () => {
  const s = firstTrial();
  assert.equal(validSession({ ...s, materialVersion: 'old-material' }), false);
  assert.equal(validSession({ ...s, measureVersion: 'old-measure' }), false);
});

test('registration starts at pretest; unknown records stay missing; recovery keeps saved progress', () => {
  const data = new Map<string, string>();
  const repo = new LocalSessionRepository({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } });
  const registered = repo.create(createSession({ ...profile, participantId: 'd001'.trim().toUpperCase() }, 'BY_AX', 19, 1000));
  assert.equal(currentStep(registered).kind, 'pretest');
  const beforeUnknown = [...data];
  assert.equal(repo.findByParticipant('UNKNOWN'), null); assert.deepEqual([...data], beforeUnknown);
  assert.throws(() => repo.create(createSession({ ...profile, participantId: 'D001' }, 'AX_BY', 20)), /已有本地记录/);
  const advanced = repo.save(completeSurvey(registered, 1500), registered.revision);
  const found = repo.findByParticipant(' d001 '.trim())!;
  const resumed = repo.save(recordPageEvent(found, 'resume', 2000), found.revision);
  assert.equal(resumed.id, registered.id); assert.equal(resumed.cursor, advanced.cursor);
  assert.equal(resumed.sequence, 'BY_AX'); assert.deepEqual(resumed.plan, registered.plan);
  assert.deepEqual(resumed.surveys, advanced.surveys); assert.equal(resumed.logs.at(-1)?.type, 'resume');
});
