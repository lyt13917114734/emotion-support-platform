export const MEASUREMENT_VERSION = 'researcher-measurements-20260921-task-adoption-v2';
export type Answer = number | string | null;
export type Answers = Record<string, Answer>;
export type Item = {
  id: string; text: string; kind: 'scale' | 'choice' | 'multiChoice' | 'textarea'; min: number; max: number;
  low: string; high: string; reference: string; number?: number; section?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};
const source = '《实验二最终版测量题目与计分方案》终版内容（2026年9月）';
function scale(id: string, text: string, low: string, high: string, section?: string): Item {
  return { id, text, kind: 'scale', min: 1, max: 7, low, high, reference: source, ...(section ? { section } : {}) };
}
function choice(id: string, text: string, options: { value: string; label: string }[], section?: string): Item {
  return { id, text, kind: 'choice', min: 1, max: 7, low: '', high: '', options, reference: source, ...(section ? { section } : {}) };
}
function multiChoice(id: string, text: string, options: { value: string; label: string }[], section?: string): Item {
  return { id, text, kind: 'multiChoice', min: 1, max: 7, low: '', high: '', options, required: true, reference: source, ...(section ? { section } : {}) };
}
function textarea(id: string, text: string, section?: string): Item {
  return { id, text, kind: 'textarea', min: 1, max: 7, low: '', high: '', required: false, reference: source, ...(section ? { section } : {}) };
}
const agreement = ['完全不同意', '完全同意'] as const;
const help = ['完全没帮助', '帮助非常大'] as const;
export const TRUST_TEXT = '总体而言，我认为AI在这类情绪调节任务中提供的辅助信息是可信的。';
export const INITIAL_ITEMS: Item[] = [
  scale('ai_trust_pre', TRUST_TEXT, ...agreement, '对AI辅助的看法'),
  scale('baseline_fatigue', '我现在感到的疲惫程度为', '完全不疲惫', '非常疲惫', '此刻的状态'),
  scale('baseline_pressure', '我现在感到的压力程度为', '完全没压力', '非常有压力'),
  scale('baseline_emotional_valence', '我现在的情绪为', '非常消极', '非常积极'),
  scale('baseline_emotional_statue', '我现在的情绪状态为', '非常平静', '非常激动'),
];
export const BLOCK_STATE_ITEMS: Item[] = [
  scale('fatigue', '我现在感到的疲惫程度为', '完全不疲惫', '非常疲惫'),
  scale('pressure', '我现在感到的压力程度为', '完全没压力', '非常有压力'),
  scale('focus_maintenance_effort', '我现在需要付出多少努力才能维持专注？', '完全不需要', '非常需要'),
  scale('cognitive_clarity', '我现在感到思维清晰的程度为', '完全不清晰', '非常清晰'),
  scale('emotional_depletion', '我现在感到情绪消耗的程度为', '完全不消耗', '非常消耗'),
];
export const TASK_ITEMS: Item[] = [
  scale('ai_adoption_level', '在完成刚才这项情绪调节任务时，您在多大程度上采纳了AI提供的信息？', '完全没采纳', '完全采纳', 'AI采纳情况'),
  scale('perceived_emotion_understanding', '我对对方所表达情绪的理解程度为', '非常不理解', '非常理解', '主观情绪与需要理解'),
  scale('perceived_emotion_differentiation', '我能清楚地区分对方所表达的不同情绪。', ...agreement),
  scale('goal_need_capture', '我觉得我准确地捕捉到了对方的需求。', ...agreement),
  scale('goal_task_attainment', '我认为我的回复达到了本次情绪调节任务的主要目的。', ...agreement, '主观目标达成感'),
  scale('goal_support_completion', '我认为本次任务要求的情绪调节工作完成程度为', '非常差', '非常好'),
  scale('goal_intended_achievement', '我认为这次回复实现了我原本想提供的情绪调节。', ...agreement),
  scale('expected_emotion_improvement', '我预计我的回复有助于改善对方当前的情绪。', ...agreement, '主观预期调节效果'),
  scale('expected_negative_emotion_relief', '我预计对方在阅读我的回复后，负性情绪会有所缓解。', ...agreement),
  scale('expected_positive_emotional_impact', '我预计这条回复会让对方感觉更好。', ...agreement),
  scale('goal_soothing', '我认为我成功地安抚了对方的情绪。', ...agreement, '其他任务结果'),
  scale('goal_quality_satisfaction', '我对我的回复质量感到满意。', ...agreement),
  scale('mental_demand', '刚才这项情绪调节任务对我的脑力要求为', '非常低', '非常高', '任务负担'),
  scale('subjective_effort', '完成刚才这项情绪调节任务时，我投入了较大的心理努力。', ...agreement),
  scale('response_difficulty', '刚才，撰写一段合适的情绪调节回复对我来说困难程度为', '非常容易', '非常困难'),
];
// Retained for compatibility with archived exports/tests; no longer presented in the platform.
export const STRATEGY_ITEM = choice('self_reported_strategy', '策略使用情况（已停用）', [
  { value: 'emotional_engagement', label: '情感参与' },
  { value: 'cognitive_engagement', label: '认知参与' },
  { value: 'combined', label: '两种方式结合使用' },
  { value: 'neither', label: '均未采用' },
], '已停用');
export const INTEGRATION_ITEMS: Item[] = [
  scale('ai_integration_checking', '我需要反复核对AI提供的信息是否适合当前事件。', ...agreement, 'AI整合成本'),
  scale('ai_integration_conflict', 'AI提供的信息有时与我自己的判断不一致，需要额外处理。', ...agreement),
  scale('ai_integration_switching', '在事件材料、AI信息和回复编辑之间切换会增加我的负担。', ...agreement),
];
export const AI_USE_ITEMS: Item[] = [
  scale('ai_emotion_understanding_help', '在刚才4项任务中，AI提供的信息在多大程度上帮助您理解对方的主要情绪和情绪状态？', ...help),
  scale('ai_strategy_clarity_help', '在刚才4项任务中，AI提供的信息在多大程度上帮助您确定回应方向和回应方式？', ...help),
];
export const BLOCK_AI_USE_ITEMS: Item[] = [...AI_USE_ITEMS, ...INTEGRATION_ITEMS];
export const MATERIAL_EVALUATION_ITEMS: Item[] = [];
export const OVERALL_ITEMS: Item[] = [
  choice('overall_preference', '在类似的情绪调节任务中，您总体上更偏好哪一种AI辅助方式？', [
    { value: 'emotion_support', label: '情绪识别辅助' },
    { value: 'strategy_support', label: '策略供给辅助' },
    { value: 'no_preference', label: '两者相近，没有明显偏好' },
  ]),
  scale('future_intention_emotion_support', '未来完成类似的情绪调节任务时，我愿意使用情绪识别辅助。', ...agreement),
  scale('future_intention_strategy_support', '未来完成类似的情绪调节任务时，我愿意使用策略供给辅助。', ...agreement),
  scale('ai_trust_post', TRUST_TEXT, ...agreement),
  multiChoice('preference_reasons', '请针对您已经选择的偏好辅助方式，选择所有影响您偏好的原因。', [
    { value: 'emotion_understanding', label: '更容易理解对方的情绪和需要' },
    { value: 'concrete_actionable', label: '提供的信息更具体，更容易直接转化为回复' },
    { value: 'clear_response_plan', label: '更容易形成清晰的回应思路' },
    { value: 'lower_effort', label: '减少自己思考和组织回复的负担' },
    { value: 'autonomy_control', label: '让我感觉更有自主性或控制感' },
    { value: 'appropriate_information', label: '信息量更合适，阅读起来更轻松' },
    { value: 'fit_existing_style', label: '更符合我原本的回应方式' },
    { value: 'trust_information', label: '我更信任 AI 提供的这类信息' },
    { value: 'other', label: '其他原因（请在下一题说明）' },
  ], '偏好原因（探索性）'),
  textarea('preference_reason_open', '请简要说明您为什么更偏好这种辅助方式，或它在哪些方面帮助或妨碍了您的回复。', '偏好原因（探索性）'),
];
export function attentionItem(block: 1 | 2): Item {
  return scale(`attention_check_block_${block}`, `这是一道作答检查题，请将滑块移动到“${block === 1 ? 2 : 6}”。`, '', '');
}
export function isAnswerValid(item: Item, value: unknown): value is number | string {
  if (item.kind === 'choice') return typeof value === 'string' && !!item.options?.some(option => option.value === value);
  if (item.kind === 'multiChoice') {
    if (typeof value !== 'string') return false;
    try {
      const selected = JSON.parse(value);
      if (Array.isArray(selected)) return selected.length > 0 && selected.every(v => item.options?.some(option => option.value === v));
      return !!item.options?.some(option => option.value === value);
    }
    catch { return !!item.options?.some(option => option.value === value); }
  }
  if (item.kind === 'textarea') return item.required ? typeof value === 'string' && value.trim().length > 0 : value === null || typeof value === 'string';
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}
export function emptyAnswers(items: Item[]): Answers { return Object.fromEntries(items.map(item => [item.id, null])); }
export function completeAnswers(items: Item[], answers: Answers): boolean {
  return items.length > 0 && items.every(item => !item.required && item.kind === 'textarea' ? true : isAnswerValid(item, answers[item.id]));
}
export function rawMean(answers: Answers, fields: string[]): number | null {
  const values = fields.map(field => answers[field]);
  return values.every(value => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7)
    ? (values as number[]).reduce((a, b) => a + b, 0) / values.length : null;
}
export const UNDERSTANDING_FIELDS = ['perceived_emotion_understanding', 'perceived_emotion_differentiation', 'goal_need_capture'];
export const GOAL_FIELDS = ['goal_task_attainment', 'goal_support_completion', 'goal_intended_achievement'];
export const EXPECTED_EFFECT_FIELDS = ['expected_emotion_improvement', 'expected_negative_emotion_relief', 'expected_positive_emotional_impact'];
export const INTEGRATION_FIELDS = INTEGRATION_ITEMS.map(item => item.id);
export function cognitiveClarityReversed(answers: Answers): number | null {
  const value = answers.cognitive_clarity;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7 ? 8 - value : null;
}
export function cognitiveResourceDepletionMean(answers: Answers): number | null {
  const reversed = cognitiveClarityReversed(answers);
  return rawMean({ focus_maintenance_effort: answers.focus_maintenance_effort, cognitive_clarity_reversed: reversed }, ['focus_maintenance_effort', 'cognitive_clarity_reversed']);
}
export function aiTrustChange(pre: Answers, post: Answers): number | null {
  const before = pre.ai_trust_pre, after = post.ai_trust_post;
  return typeof before === 'number' && typeof after === 'number' ? after - before : null;
}
