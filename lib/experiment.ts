import source from './materials.json' with { type: 'json' };
import { isStoredProfile, normalizeProfile, validateProfile, type Profile } from './profile.ts';
import { PRETEST_STATE_VERSION, LEGACY_MEASURE_VERSION } from './pretest-state.ts';
import { MEASUREMENT_VERSION, INITIAL_ITEMS, BLOCK_STATE_ITEMS, TASK_ITEMS, BLOCK_AI_USE_ITEMS, INTEGRATION_FIELDS, GOAL_FIELDS, MATERIAL_EVALUATION_ITEMS, OVERALL_ITEMS, attentionItem, emptyAnswers, completeAnswers, isAnswerValid, rawMean, cognitiveClarityReversed, cognitiveResourceDepletionMean, aiTrustChange, type Item, type Answers } from './measurements.ts';
export type { Profile } from './profile.ts';
export type { Item, Answer, Answers } from './measurements.ts';

export const PROTOCOL_VERSION = 'E2-local-demo-20260921-v7';
const IMMEDIATE_PREVIOUS_PROTOCOL_VERSION = 'E2-local-demo-20260910-v5';
const IMMEDIATE_PREVIOUS_MEASURE_VERSION = 'researcher-measurements-20260910-v4';
const PREVIOUS_PROTOCOL_VERSION = 'E2-local-demo-20260910-v4';
const PREVIOUS_MEASURE_VERSION = 'researcher-measurements-20260909-v3';
const PRACTICE_STATE_PROTOCOL_VERSION = 'E2-local-demo-20260909-v2';
const LEGACY_PROTOCOL_VERSION = 'E2-local-demo-20260906-v1';
export const MEASURE_VERSION = MEASUREMENT_VERSION;
export const MATERIAL_VERSION = source.dataset_id;
export const SEQUENCES = ['AX_BY', 'AY_BX', 'BX_AY', 'BY_AX'] as const;
export type Sequence = typeof SEQUENCES[number];
export const ASSIGNMENT_SEQUENCE = { AX_BY: 'A', BX_AY: 'B', AY_BX: 'C', BY_AX: 'D' } as const;
export type Condition = 'A' | 'B';
export type Material = typeof source.events[number];
export const MATERIALS = source.events;
export const REPLY_MIN = 80;
export const REPLY_MAX = 150;
export const TRANSITION_MS = 60_000;
export const CONDITION_NAMES: Record<Condition, string> = { A: '情绪识别辅助', B: '策略供给辅助' };
export function materialGroup(set: string | null | undefined): 0 | 1 | null { return set === 'X' ? 0 : set === 'Y' ? 1 : null; }

export const STATE_ITEMS = BLOCK_STATE_ITEMS;
export const TRIAL_ITEMS = TASK_ITEMS;
export const BLOCK_ITEMS = MATERIAL_EVALUATION_ITEMS;
export const FINAL_ITEMS = OVERALL_ITEMS;

export type Plan = { id: string; phase: 'practice' | 'formal'; block: 1 | 2; ordinal: number; formalOrdinal: number | null; condition: Condition; eventId: string; materialSet: string };
export type StepKind = 'pretest' | 'instructions' | 'trial' | 'trialSurvey' | 'baseline' | 'blockState' | 'integrationCost' | 'attentionCheck' | 'blockReview' | 'transition' | 'conditionIntro' | 'formalIntro' | 'final' | 'complete';
export type MeasurementTime = 'pre' | 'mid' | 'post' | 't0' | 't2' | 't4' | 'post_task';
export type MeasurementTimepoint = 'registration' | 'experiment_pre' | 'block_start' | 'after_task_2' | 'after_task_4' | 'task_post' | 'block_end' | 'experiment_post';
export type Step = { id: string; kind: StepKind; block?: 1 | 2; trialId?: string; condition?: Condition; measurementTime?: MeasurementTime };
export type Trial = Plan & {
  eventText: string; anonymousId: string; cardText: string; cardParagraphs: string[]; cardId: string;
  presentedAt: number; aiOpen: boolean; firstAIOpenedAt: number | null;
  aiViews: { openedAt: number; closedAt: number | null }[];
  replyStartedAt: number | null; sentAt: number | null; inputMS: number | null;
  draft: string; reply: string; draftEdits: number; interrupted: boolean; blindId: string;
};
export type MeasurementMetadata = {
  participant_id: string; schedule_id: Sequence; block_id: number | null; condition: Condition | null;
  material_set: string | null; material_id: string | null; task_position: number | null; completed_formal_tasks: number | null;
  material_group: 0 | 1 | null; block_position: number | null; ai_condition: Condition | null; event_order: number | null; assignment_sequence: typeof ASSIGNMENT_SEQUENCE[Sequence];
  measurement_time: MeasurementTime; schedule_order: Sequence; block_index: number | null; event_id: string | null;
  measurement_timepoint: MeasurementTimepoint; created_at: number | null; updated_at: number | null;
  record_status: 'not_started' | 'draft' | 'submitted'; timing_status: 'scheduled' | 'legacy_session_recollection';
};
export type MeasurementRecord = MeasurementMetadata & Record<string, string | number | boolean | null>;
export type Survey = MeasurementMetadata & { id: string; stage: StepKind; block?: number; trialId?: string; phase: 'practice' | 'formal' | 'session'; openedAt: number; submittedAt: number; lastSubmittedAt: number; items: Item[]; answers: Answers };
type TimeRecords = Record<string, Record<string, MeasurementRecord>>;
export type ExperimentMode = 'local-demo' | 'formal';
export type AllocationSource = 'demo-selected' | 'demo-random' | 'server-schedule';
export type Session = {
  schemaVersion: 3; protocolVersion: string; materialVersion: string; measureVersion: string;
  mode: ExperimentMode; reviewStatus: typeof source.review_status; id: string; profile: Profile;
  seed: number; sequence: Sequence; allocationSource: AllocationSource;
  plan: Plan[]; flow: Step[]; cursor: number; furthestCursor: number; trials: Record<string, Trial>;
  surveys: Survey[]; surveyDrafts: Record<string, Answers>; openedAt: Record<string, number>;
  surveyMeta: Record<string, { created_at: number; updated_at: number }>;
  initial_measurement: MeasurementRecord | null; task_evaluations: Record<string, MeasurementRecord>;
  block_state: TimeRecords; integration_cost: Record<string, MeasurementRecord>; block_evaluation: Record<string, MeasurementRecord>; overall_evaluation: MeasurementRecord | null;
  attention_check_block_1: number | null; attention_check_block_2: number | null;
  attention_check_block_1_passed: boolean | null; attention_check_block_2_passed: boolean | null;
  legacyPretest?: { measureVersion: string; draft: Answers };
  removedPracticeStates?: { migratedAt: number; protocolVersion: string; surveys: Survey[]; surveyDrafts: Record<string, Answers>; surveyMeta: Session['surveyMeta']; openedAt: Record<string, number> };
  legacyMeasurements?: { measureVersion: string; protocolVersion: string; migratedAt: number; surveys: unknown[]; surveyDrafts: Record<string, unknown>; flow: unknown[]; cursor: number; openedAt: Record<string, number>; completedAt: number | null };
  logs: { type: string; at: number; stepId: string; trialId?: string }[];
  createdAt: number; updatedAt: number; completedAt: number | null; revision: number;
  skippedDemoTransition: boolean;
};

export function countCharacters(text: string) { return [...text.replace(/\s/g, '')].length; }
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle<T>(values: T[], random: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

export function makePlan(sequence: Sequence, seed: number): Plan[] {
  const random = rng(seed);
  return sequence.split('_').flatMap((code, i) => {
    const condition = code[0] as Condition;
    const block = (i + 1) as 1 | 2;
    const practice = MATERIALS.find(e => e.phase === 'practice' && e.material_set === code[1])!;
    const events = shuffle(MATERIALS.filter(e => e.phase === 'formal' && e.material_set === code[1]).map(e => e.id), random);
    return [
      { id: `practice-${block}`, phase: 'practice' as const, block, ordinal: 1, formalOrdinal: null, condition, eventId: practice.id, materialSet: code[1] },
      ...events.map((eventId, j) => ({ id: `formal-${i * 3 + j + 1}`, phase: 'formal' as const, block, ordinal: j + 2, formalOrdinal: i * 3 + j + 1, condition, eventId, materialSet: code[1] })),
    ];
  });
}

export function makeFlow(plan: Plan[]): Step[] {
  const flow: Step[] = [{ id: 'pretest', kind: 'pretest', measurementTime: 'pre' }, { id: 'instructions', kind: 'instructions' }];
  for (const block of [1, 2] as const) {
    if (block === 2) flow.push({ id: 'condition-intro-2', kind: 'conditionIntro', block });
    const practice = plan.find(p => p.block === block && p.phase === 'practice')!;
    flow.push({ id: `formal-intro-${block}`, kind: 'formalIntro', block, condition: practice.condition });
    flow.push({ id: `block-state-${block}-pre`, kind: 'blockState', block, condition: practice.condition, measurementTime: 'pre' });
    for (const t of plan.filter(p => p.block === block)) {
      flow.push({ id: t.id, kind: 'trial', block, trialId: t.id });
      if (t.ordinal === 2 || t.ordinal === 4) {
        const measurementTime = t.ordinal === 2 ? 'mid' : 'post';
        flow.push({ id: `block-state-${block}-${measurementTime}`, kind: 'blockState', block, condition: t.condition, measurementTime });
      }
      flow.push({ id: `${t.id}-survey`, kind: 'trialSurvey', block, trialId: t.id, condition: t.condition, measurementTime: 'post_task' });
      if (t.ordinal === 2) flow.push({ id: `attention-${block}`, kind: 'attentionCheck', block, condition: t.condition, measurementTime: 'mid' });
      if (t.ordinal === 4) flow.push({ id: `integration-${block}`, kind: 'integrationCost', block, condition: t.condition, measurementTime: 'post' });
    }
    if (MATERIAL_EVALUATION_ITEMS.length) flow.push({ id: `block-review-${block}`, kind: 'blockReview', block, condition: practice.condition, measurementTime: 'post' });
    if (block === 1) flow.push({ id: 'transition', kind: 'transition', block });
  }
  flow.push({ id: 'final', kind: 'final', measurementTime: 'post' }, { id: 'complete', kind: 'complete' });
  return flow;
}

function makeImmediatePreviousFlow(plan: Plan[]): Step[] {
  const flow = makeFlow(plan);
  // The archived v5 protocol included a material-evaluation page after each
  // integration page; the current finalized questionnaire does not.
  for (const block of [1, 2] as const) {
    const practice = plan.find(p => p.block === block && p.phase === 'practice')!;
    const index = flow.findIndex(step => step.id === `integration-${block}`);
    flow.splice(index + 1, 0, {
      id: `block-review-${block}`, kind: 'blockReview', block,
      condition: practice.condition, measurementTime: 'post',
    });
  }
  return flow;
}

function makePreviousFlow(plan: Plan[], includePracticeStates = false): Step[] {
  const flow: Step[] = [{ id: 'pretest', kind: 'pretest', measurementTime: 'pre' }, { id: 'instructions', kind: 'instructions' }];
  for (const block of [1, 2] as const) {
    if (block === 2) flow.push({ id: 'condition-intro-2', kind: 'conditionIntro', block });
    const practice = plan.find(p => p.block === block && p.phase === 'practice')!;
    flow.push({ id: practice.id, kind: 'trial', block, trialId: practice.id });
    if (includePracticeStates) flow.push({ id: `baseline-${block}`, kind: 'baseline', block, condition: practice.condition, measurementTime: 't0' });
    for (const t of plan.filter(p => p.block === block && p.phase === 'formal')) {
      flow.push({ id: t.id, kind: 'trial', block, trialId: t.id });
      flow.push({ id: `${t.id}-survey`, kind: 'trialSurvey', block, trialId: t.id, condition: t.condition, measurementTime: 'post_task' });
      if (t.ordinal === 2 || t.ordinal === 4) {
        const measurementTime = t.ordinal === 2 ? 't2' : 't4';
        flow.push({ id: `block-state-${block}-${measurementTime}`, kind: 'blockState', block, condition: t.condition, measurementTime });
        flow.push({ id: `integration-${block}-${measurementTime}`, kind: 'integrationCost', block, condition: t.condition, measurementTime });
        if (t.ordinal === 2) flow.push({ id: `attention-${block}`, kind: 'attentionCheck', block, condition: t.condition, measurementTime: 't2' });
      }
    }
    flow.push({ id: `block-review-${block}`, kind: 'blockReview', block, condition: practice.condition, measurementTime: 't4' });
    if (block === 1) flow.push({ id: 'transition', kind: 'transition', block });
  }
  flow.push({ id: 'final', kind: 'final', measurementTime: 'post' }, { id: 'complete', kind: 'complete' });
  return flow;
}

export function currentStep(session: Session): Step { return session.flow[session.cursor]; }
function log(s: Session, type: string, now: number) {
  const step = currentStep(s);
  s.logs.push({ type, at: now, stepId: step.id, ...(step.trialId ? { trialId: step.trialId } : {}) });
  s.updatedAt = now;
}
function enter(s: Session, now: number) {
  const step = currentStep(s);
  s.openedAt[step.id] ??= now;
  if (itemsForStep(step).length) {
    s.surveyDrafts[step.id] ??= emptyAnswers(itemsForStep(step));
    s.surveyMeta[step.id] ??= { created_at: now, updated_at: now };
  }
  if (step.kind === 'trial' && step.trialId && !s.trials[step.trialId]) {
    const p = s.plan.find(t => t.id === step.trialId)!;
    const e = MATERIALS.find(e => e.id === p.eventId)!;
    const card = e.ai_cards[p.condition];
    s.trials[p.id] = { ...p, eventText: e.event_text, anonymousId: e.anonymous_user_id, cardText: card.text, cardParagraphs: card.paragraphs,
      cardId: `${MATERIAL_VERSION}-${e.id}-${p.condition}`, presentedAt: now, aiOpen: false, firstAIOpenedAt: null, aiViews: [],
      replyStartedAt: null, sentAt: null, inputMS: null, draft: '', reply: '', draftEdits: 0, interrupted: false,
      blindId: `R-${crypto.randomUUID()}` };
  }
  if (step.kind === 'complete') s.completedAt ??= now;
  log(s, 'step_enter', now);
  refreshMeasurementData(s);
}
function next(s: Session, now: number) { s.cursor += 1; s.furthestCursor = Math.max(s.furthestCursor, s.cursor); enter(s, now); return s; }
export function createSession(profile: Profile, sequence: Sequence | null, seed: number, now = Date.now(), options: {
  mode?: ExperimentMode;
  allocationSource?: AllocationSource;
  sessionId?: string;
} = {}): Session {
  validateProfile(profile);
  const assigned = sequence ?? SEQUENCES[Math.floor(rng(seed ^ 0x9e3779b9)() * 4)];
  if (!SEQUENCES.includes(assigned)) throw new Error('分配顺序无效。');
  const plan = makePlan(assigned, seed);
  const s: Session = { schemaVersion: 3, protocolVersion: PROTOCOL_VERSION, materialVersion: MATERIAL_VERSION, measureVersion: MEASURE_VERSION,
    mode: options.mode ?? 'local-demo', reviewStatus: source.review_status, id: options.sessionId ?? crypto.randomUUID(), profile: normalizeProfile(profile), seed, sequence: assigned,
    allocationSource: options.allocationSource ?? (sequence ? 'demo-selected' : 'demo-random'), plan, flow: makeFlow(plan), cursor: 0, furthestCursor: 0, trials: {}, surveys: [], surveyDrafts: {}, openedAt: {}, surveyMeta: {},
    initial_measurement: null, task_evaluations: {}, block_state: {}, integration_cost: {}, block_evaluation: {}, overall_evaluation: null,
    attention_check_block_1: null, attention_check_block_2: null, attention_check_block_1_passed: null, attention_check_block_2_passed: null,
    logs: [], createdAt: now, updatedAt: now, completedAt: null, revision: 0, skippedDemoTransition: false };
  for (const step of s.flow) if (itemsForStep(step).length) s.surveyDrafts[step.id] = emptyAnswers(itemsForStep(step));
  enter(s, now); return s;
}
function activeTrial(s: Session): Trial {
  const step = currentStep(s);
  if (step.kind !== 'trial' || !step.trialId) throw new Error('当前不是回复阶段。');
  return s.trials[step.trialId];
}
export function toggleAI(session: Session, open: boolean, now = Date.now()): Session {
  const s = structuredClone(session), t = activeTrial(s);
  if (t.aiOpen === open) return s;
  t.aiOpen = open;
  if (open) { t.firstAIOpenedAt ??= now; t.aiViews.push({ openedAt: now, closedAt: null }); }
  else { const v = t.aiViews.at(-1); if (v) v.closedAt ??= now; }
  log(s, open ? 'ai_open' : 'ai_close', now); return s;
}
export function startReply(session: Session, now = Date.now()): Session {
  const s = structuredClone(session), t = activeTrial(s);
  if (t.firstAIOpenedAt === null) throw new Error('请先查看AI提示。');
  if (t.replyStartedAt === null) { t.replyStartedAt = now; log(s, 'reply_start', now); }
  return s;
}
export function updateDraft(session: Session, text: string, now = Date.now()): Session {
  const s = structuredClone(session), t = activeTrial(s);
  if (t.replyStartedAt === null || t.sentAt !== null) throw new Error('请先开始回复。');
  if (text.length > 5000) throw new Error('输入内容过长，请缩短回复。');
  t.draft = text; t.draftEdits += 1; s.updatedAt = now; return s;
}
export function submitReply(session: Session, trialId: string, now = Date.now()): Session {
  // Stable trial ID makes repeated clicks idempotent, even after the screen advances.
  if (session.trials[trialId]?.sentAt !== null && session.trials[trialId]?.sentAt !== undefined) return session;
  const s = structuredClone(session), t = activeTrial(s);
  if (t.id !== trialId || t.replyStartedAt === null) throw new Error('当前回复尚未开始。');
  const length = countCharacters(t.draft);
  if (length < REPLY_MIN || length > REPLY_MAX) throw new Error(`请将回复调整为${REPLY_MIN}—${REPLY_MAX}字（不计空白）。`);
  if (now < t.replyStartedAt) throw new Error('设备时间异常，请保留页面并联系研究者。');
  t.reply = t.draft.trim(); t.sentAt = now; t.inputMS = now - t.replyStartedAt;
  const view = t.aiViews.at(-1); if (view) view.closedAt ??= now;
  t.aiOpen = false; log(s, 'reply_submit', now); return next(s, now);
}
export function itemsForStep(step: Step): Item[] {
  if (step.kind === 'pretest') return INITIAL_ITEMS;
  if (step.kind === 'baseline' || step.kind === 'blockState') return STATE_ITEMS;
  if (step.kind === 'trialSurvey') return TRIAL_ITEMS;
  if (step.kind === 'integrationCost') return BLOCK_AI_USE_ITEMS;
  if (step.kind === 'attentionCheck' && step.block) return [attentionItem(step.block)];
  if (step.kind === 'blockReview') return BLOCK_ITEMS;
  if (step.kind === 'final') return FINAL_ITEMS;
  return [];
}
export function measurementMetadata(s: Session, step: Step): MeasurementMetadata {
  const trial = step.trialId ? s.plan.find(p => p.id === step.trialId) : undefined;
  // Block material set comes from formal tasks, never the practice set P.
  const blockTask = s.plan.find(p => p.block === step.block && p.phase === 'formal');
  const meta = s.surveyMeta[step.id];
  const taskPosition = trial?.ordinal ?? (step.kind === 'blockState'
    ? step.measurementTime === 'pre' ? 0 : step.measurementTime === 'mid' ? 2 : step.measurementTime === 'post' ? 4 : null
    : step.kind === 'attentionCheck' ? 2
    : step.kind === 'integrationCost' || step.kind === 'blockReview' ? 4 : null);
  const completedFormalTasks = taskPosition === null ? null : s.plan.filter(p => p.block === step.block && p.phase === 'formal' && p.ordinal <= taskPosition).length;
  const measurementTimepoint: MeasurementTimepoint = step.kind === 'pretest' ? 'experiment_pre'
    : step.kind === 'trialSurvey' ? 'task_post'
    : step.kind === 'integrationCost' || step.kind === 'blockReview' ? 'block_end'
    : step.kind === 'attentionCheck' ? 'after_task_2'
    : step.kind === 'blockState' && step.measurementTime === 'pre' ? 'block_start'
    : step.kind === 'blockState' && step.measurementTime === 'mid' ? 'after_task_2'
    : step.kind === 'blockState' && step.measurementTime === 'post' ? 'after_task_4'
    : 'experiment_post';
  const blockIndex = step.block ?? null, eventId = trial?.eventId ?? null;
  return { participant_id: s.profile.participantId, schedule_id: s.sequence, block_id: blockIndex,
    condition: trial?.condition ?? blockTask?.condition ?? null, material_set: trial?.materialSet ?? blockTask?.materialSet ?? null,
    material_id: eventId, task_position: taskPosition, completed_formal_tasks: completedFormalTasks,
    material_group: materialGroup(trial?.materialSet ?? blockTask?.materialSet), block_position: blockIndex,
    ai_condition: trial?.condition ?? blockTask?.condition ?? null, event_order: trial?.ordinal ?? null, assignment_sequence: ASSIGNMENT_SEQUENCE[s.sequence],
    measurement_time: step.measurementTime ?? 'post', schedule_order: s.sequence, block_index: blockIndex, event_id: eventId,
    measurement_timepoint: measurementTimepoint, created_at: meta?.created_at ?? null, updated_at: meta?.updated_at ?? null,
    record_status: s.surveys.some(r => r.id === step.id) ? 'submitted' : meta ? 'draft' : 'not_started',
    timing_status: s.legacyMeasurements ? 'legacy_session_recollection' : 'scheduled' };
}
export function measurementRecord(s: Session, step: Step): MeasurementRecord {
  const answers = s.surveyDrafts[step.id] ?? {};
  return { ...measurementMetadata(s, step), ...Object.fromEntries(itemsForStep(step).map(item => [item.id, answers[item.id] ?? null])) };
}
function refreshMeasurementData(s: Session) {
  s.block_state = {}; s.integration_cost = {}; s.block_evaluation = {}; s.task_evaluations = {};
  for (const step of s.flow) {
    if (!itemsForStep(step).length) continue;
    const record = measurementRecord(s, step);
    if (step.kind === 'pretest') s.initial_measurement = record;
    if (step.kind === 'final') s.overall_evaluation = { ...record, ai_trust_change: aiTrustChange(s.surveyDrafts.pretest ?? {}, s.surveyDrafts[step.id] ?? {}) };
    if (step.kind === 'trialSurvey' && step.trialId) s.task_evaluations[step.trialId] = {
      ...record, goal_attainment_mean: rawMean(s.surveyDrafts[step.id] ?? {}, GOAL_FIELDS),
    };
    if ((step.kind === 'baseline' || step.kind === 'blockState') && step.block && step.measurementTime) {
      const answers = s.surveyDrafts[step.id] ?? {};
      (s.block_state[step.block] ??= {})[step.measurementTime] = {
        ...record, cognitive_clarity_reversed: cognitiveClarityReversed(answers),
        cognitive_resource_depletion_mean: cognitiveResourceDepletionMean(answers),
      };
    }
    if (step.kind === 'integrationCost' && step.block) s.integration_cost[step.block] = {
      ...record, integration_cost_mean: rawMean(s.surveyDrafts[step.id] ?? {}, INTEGRATION_FIELDS),
    };
    if (step.kind === 'blockReview' && step.block) s.block_evaluation[step.block] = record;
    if (step.kind === 'attentionCheck' && step.block) {
      const key = `attention_check_block_${step.block}` as const;
      const value = record[key];
      s[key] = typeof value === 'number' ? value : null;
      s[`${key}_passed`] = record.record_status === 'submitted' && typeof value === 'number' ? value === (step.block === 1 ? 2 : 6) : null;
    }
  }
}
export function setSurveyAnswer(session: Session, itemId: string, value: number | string, now = Date.now()): Session {
  const s = structuredClone(session), step = currentStep(s);
  const item = itemsForStep(step).find(i => i.id === itemId);
  if (!item || !isAnswerValid(item, value)) throw new Error('作答无效，请选择本题提供的选项。');
  s.surveyDrafts[step.id] ??= emptyAnswers(itemsForStep(step)); s.surveyDrafts[step.id][itemId] = value;
  const meta = s.surveyMeta[step.id] ??= { created_at: now, updated_at: now };
  meta.updated_at = Math.max(meta.updated_at, now);
  const submitted = s.surveys.find(r => r.id === step.id);
  if (submitted) { submitted.answers[itemId] = value; submitted.updated_at = meta.updated_at; }
  s.updatedAt = now; refreshMeasurementData(s); return s;
}
export function submitSurvey(session: Session, stepId: string, now = Date.now()): Session {
  if (currentStep(session).id !== stepId && session.surveys.some(r => r.id === stepId)) return session;
  const s = structuredClone(session), step = currentStep(s), items = itemsForStep(step);
  if (!items.length || stepId !== step.id) throw new Error('测量阶段不匹配。');
  const answers = s.surveyDrafts[step.id] ?? {};
  if (!completeAnswers(items, answers)) throw new Error('请完成本页所有必答题后再继续。');
  const submittedAnswers = Object.fromEntries(items.map(i => [i.id, answers[i.id]]));
  const phase = step.trialId ? s.plan.find(p => p.id === step.trialId)!.phase : 'session';
  const previous = s.surveys.findIndex(r => r.id === step.id);
  s.surveyMeta[step.id].updated_at = Math.max(s.surveyMeta[step.id].updated_at, now);
  const record: Survey = { ...measurementMetadata(s, step), record_status: 'submitted', id: step.id, stage: step.kind,
    ...(step.block ? { block: step.block } : {}), ...(step.trialId ? { trialId: step.trialId } : {}), phase,
    openedAt: s.openedAt[step.id], submittedAt: previous >= 0 ? s.surveys[previous].submittedAt : now, lastSubmittedAt: now,
    items: structuredClone(items), answers: submittedAnswers };
  if (previous >= 0) s.surveys[previous] = record; else s.surveys.push(record);
  log(s, 'survey_submit', now); return next(s, now);
}
export function navigateToStep(session: Session, cursor: number, now = Date.now()): Session {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > session.furthestCursor) throw new Error('请按当前任务顺序继续。');
  if (cursor === session.cursor) return session;
  const s = structuredClone(session), previous = currentStep(s);
  if (previous.kind === 'trial' && previous.trialId && s.trials[previous.trialId].sentAt === null) s.trials[previous.trialId].interrupted = true;
  s.cursor = cursor; enter(s, now); log(s, 'page_revisit', now); return s;
}
export function continueSubmittedTrial(session: Session, now = Date.now()): Session {
  const s = structuredClone(session), t = activeTrial(s);
  if (t.sentAt === null) throw new Error('请先完成本项回复。');
  log(s, 'submitted_trial_reviewed', now); return next(s, now);
}
export function continueInfo(session: Session, now = Date.now(), skipTransition = false): Session {
  const s = structuredClone(session), step = currentStep(s);
  if (!['instructions', 'conditionIntro', 'formalIntro', 'transition'].includes(step.kind)) throw new Error('当前阶段不可直接跳过。');
  if (step.kind === 'transition' && now - s.openedAt[step.id] < TRANSITION_MS) {
    if (!skipTransition) throw new Error('过渡尚未结束。');
    if (s.mode === 'local-demo') { s.skippedDemoTransition = true; log(s, 'demo_transition_skipped', now); }
    log(s, 'transition_skipped', now);
  }
  if (step.kind === 'transition') log(s, 'transition_finished', now);
  return next(s, now);
}
export function recordPageEvent(session: Session, type: 'resume' | 'page_hidden' | 'page_visible', now = Date.now()): Session {
  const s = structuredClone(session), step = currentStep(s);
  if (step.kind === 'trial' && step.trialId) {
    const t = s.trials[step.trialId];
    if (type !== 'page_visible') t.interrupted = true;
  }
  log(s, type, now); return s;
}
export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  try {
  return s.schemaVersion === 3 && s.protocolVersion === PROTOCOL_VERSION && ['local-demo', 'formal'].includes(s.mode) && s.reviewStatus === source.review_status
    && s.materialVersion === MATERIAL_VERSION && s.measureVersion === MEASURE_VERSION
    && typeof s.id === 'string' && isStoredProfile(s.profile)
    && SEQUENCES.includes(s.sequence) && ['demo-selected', 'demo-random', 'server-schedule'].includes(s.allocationSource)
    && (s.mode === 'formal' ? s.allocationSource === 'server-schedule' : s.allocationSource !== 'server-schedule')
    && Number.isInteger(s.seed) && Array.isArray(s.plan) && s.plan.length === 8
    && JSON.stringify(s.plan) === JSON.stringify(makePlan(s.sequence, s.seed))
    && Array.isArray(s.flow) && JSON.stringify(s.flow) === JSON.stringify(makeFlow(s.plan)) && Number.isInteger(s.cursor) && s.cursor >= 0 && s.cursor < s.flow.length
    && Number.isInteger(s.furthestCursor) && s.furthestCursor >= s.cursor && s.furthestCursor < s.flow.length
    && Array.isArray(s.surveys) && Array.isArray(s.logs) && !!s.trials && !!s.openedAt && !!s.surveyDrafts
    && !!s.surveyMeta && Number.isInteger(s.revision)
    && s.flow.filter(step => itemsForStep(step).length).every(step => {
      const items = itemsForStep(step), answers = s.surveyDrafts[step.id];
      if (!answers || Object.keys(answers).length !== items.length) return false;
      return items.every(item => Object.hasOwn(answers, item.id) && (answers[item.id] === null || isAnswerValid(item, answers[item.id])));
    })
    && new Set(s.surveys.map(r => r.id)).size === s.surveys.length
    && s.surveys.every(r => {
      const step = s.flow.find(step => step.id === r.id);
      return !!step && completeAnswers(itemsForStep(step), r.answers) && JSON.stringify(r.answers) === JSON.stringify(s.surveyDrafts[r.id]);
    });
  } catch { return false; }
}

export function restoreStoredSession(value: unknown, now = Date.now()): Session | null {
  if (!value || typeof value !== 'object') return null;
  const old = value as Record<string, unknown>;
  if (![1, 2, 3].includes(old.schemaVersion as number)) return null;
  if (!old.profile || typeof old.profile !== 'object' || Array.isArray(old.profile) ||
    typeof (old.profile as Record<string, unknown>).participantId !== 'string') return null;
  const normalized = { ...structuredClone(old), schemaVersion: 3, profile: normalizeProfile(old.profile) } as unknown as Session;
  const immediatePrevious = old.protocolVersion === IMMEDIATE_PREVIOUS_PROTOCOL_VERSION && old.measureVersion === IMMEDIATE_PREVIOUS_MEASURE_VERSION;
  const earlierPrevious = [PREVIOUS_PROTOCOL_VERSION, PRACTICE_STATE_PROTOCOL_VERSION].includes(old.protocolVersion as string) && old.measureVersion === PREVIOUS_MEASURE_VERSION;
  if (immediatePrevious || earlierPrevious) {
    try {
    if (!Array.isArray(normalized.plan) || !Array.isArray(normalized.flow) ||
      JSON.stringify(normalized.flow) !== JSON.stringify(immediatePrevious ? makeImmediatePreviousFlow(normalized.plan) : makePreviousFlow(normalized.plan, old.protocolVersion === PRACTICE_STATE_PROTOCOL_VERSION)) ||
      !Number.isInteger(normalized.cursor) || !Number.isInteger(normalized.furthestCursor) ||
      normalized.cursor < 0 || normalized.furthestCursor < normalized.cursor || normalized.furthestCursor >= normalized.flow.length ||
      old.materialVersion !== MATERIAL_VERSION || !SEQUENCES.includes(normalized.sequence) || normalized.plan.length !== 10 ||
      JSON.stringify(normalized.plan) !== JSON.stringify(makePlan(normalized.sequence, normalized.seed)) ||
      !Array.isArray(normalized.surveys) || !normalized.surveyDrafts || !normalized.surveyMeta || !normalized.openedAt || !normalized.trials || !Array.isArray(normalized.logs)) return null;
    normalized.legacyMeasurements = { measureVersion: old.measureVersion as string, protocolVersion: old.protocolVersion as string,
      migratedAt: now, surveys: structuredClone(normalized.surveys), surveyDrafts: structuredClone(normalized.surveyDrafts),
      flow: structuredClone(normalized.flow), cursor: normalized.cursor, openedAt: structuredClone(normalized.openedAt), completedAt: normalized.completedAt };
    normalized.protocolVersion = PROTOCOL_VERSION; normalized.measureVersion = MEASURE_VERSION;
    normalized.flow = makeFlow(normalized.plan); normalized.cursor = 0; normalized.furthestCursor = 0;
    normalized.surveys = []; normalized.surveyMeta = {}; normalized.completedAt = null;
    normalized.surveyDrafts = Object.fromEntries(normalized.flow.filter(step => itemsForStep(step).length).map(step => [step.id, emptyAnswers(itemsForStep(step))]));
    normalized.openedAt = Object.fromEntries(Object.entries(normalized.openedAt).filter(([id]) => normalized.flow.some(step => step.id === id && !itemsForStep(step).length)));
    enter(normalized, now);
    } catch { return null; }
  }
  if (old.protocolVersion === LEGACY_PROTOCOL_VERSION && [LEGACY_MEASURE_VERSION, PRETEST_STATE_VERSION].includes(old.measureVersion as string)) {
    if (old.materialVersion !== MATERIAL_VERSION || !SEQUENCES.includes(normalized.sequence) || !Array.isArray(old.plan) || old.plan.length !== 10 ||
      !Array.isArray(old.flow) || old.flow.length !== 30 || !Number.isInteger(old.cursor) || (old.cursor as number) < 0 || (old.cursor as number) >= 30 ||
      !Array.isArray(old.surveys) || !old.surveyDrafts || typeof old.surveyDrafts !== 'object' || !old.openedAt || !old.trials || !Array.isArray(old.logs)) return null;
    // Preserve the old evidence under its own version. New measurements start empty;
    // completed replies are review-only and retain their original timing and text.
    normalized.legacyMeasurements = { measureVersion: old.measureVersion as string, protocolVersion: old.protocolVersion,
      migratedAt: now, surveys: structuredClone(old.surveys), surveyDrafts: structuredClone(old.surveyDrafts as Record<string, unknown>),
      flow: structuredClone(old.flow), cursor: old.cursor as number, openedAt: structuredClone(normalized.openedAt), completedAt: normalized.completedAt };
    normalized.protocolVersion = PROTOCOL_VERSION; normalized.measureVersion = MEASURE_VERSION;
    normalized.flow = makeFlow(normalized.plan); normalized.cursor = 0; normalized.furthestCursor = 0;
    normalized.surveys = []; normalized.surveyMeta = {}; normalized.completedAt = null;
    normalized.surveyDrafts = Object.fromEntries(normalized.flow.filter(step => itemsForStep(step).length).map(step => [step.id, emptyAnswers(itemsForStep(step))]));
    normalized.openedAt = Object.fromEntries(Object.entries(normalized.openedAt).filter(([id]) => normalized.flow.some(step => step.id === id && !itemsForStep(step).length)));
    enter(normalized, now);
  }
  if (!validSession(normalized)) return null;
  refreshMeasurementData(normalized);
  return normalized;
}

export function updateRegisteredProfile(session: Session, profile: Profile, now = Date.now()): Session {
  validateProfile(profile);
  if (profile.participantId !== session.profile.participantId) throw new Error('补全旧登记时不能更改原被试编号。');
  const next = structuredClone(session);
  next.profile = normalizeProfile(profile);
  log(next, 'registration_profile_updated', now);
  return next;
}
