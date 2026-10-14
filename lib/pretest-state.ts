export const PRETEST_STATE_VERSION = 'pretest-state-13-19-v2+demo-followups-not-validated';
export const LEGACY_MEASURE_VERSION = 'demo-items-v1-not-validated';
export const PRETEST_STATE_DESCRIPTION = '请根据此刻的真实感受，在每道题的1至7之间选择最符合你当前状态的位置。答案没有对错，请按第一感受作答。';
export const STATE_REQUIRED_MESSAGE = '请选择一个符合你当前状态的数值';

export const PRETEST_STATE_ITEMS = [
  { number: 13, id: 'state_q13_valence', text: '我现在的情绪为', low: '非常消极', high: '非常积极' },
  { number: 14, id: 'state_q14_arousal', text: '我现在的情绪状态为', low: '非常平静', high: '非常激动' },
  { number: 15, id: 'state_q15_anxiety', text: '我现在感到的焦虑程度', low: '完全不焦虑', high: '非常焦虑' },
  { number: 16, id: 'state_q16_stress', text: '我现在感到的压力程度', low: '完全没压力', high: '非常有压力' },
  { number: 17, id: 'state_q17_focus_effort', text: '我现在维持专注所需的意志力', low: '完全不需要', high: '非常需要' },
  { number: 18, id: 'state_q18_clarity', text: '我现在感到思维清晰的程度', low: '完全不清晰', high: '非常清晰' },
  { number: 19, id: 'state_q19_emotional_exhaustion', text: '我现在感到情绪消耗的程度', low: '完全不消耗', high: '非常消耗' },
].map(item => ({ ...item, min: 1, max: 7, reference: '研究者提供的前测条目（未作量表效度声明）' }));

export function isStateValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

export function emptyPretestAnswers(): Record<string, number | null> {
  return Object.fromEntries(PRETEST_STATE_ITEMS.map(item => [item.id, null]));
}

export function missingStateItems(answers: Record<string, number | null>) {
  return PRETEST_STATE_ITEMS.filter(item => !isStateValue(answers[item.id]));
}

/** Empty-state keyboard input creates an answer only after an intentional keypress. */
export function firstStateKeyboardValue(key: string): number | null {
  if (['ArrowRight', 'ArrowUp', 'Home'].includes(key)) return 1;
  if (['ArrowLeft', 'ArrowDown', 'End'].includes(key)) return 7;
  return null;
}
