import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value, index, values) => {
  if (!value.startsWith('--')) return null;
  return [value.slice(2), values[index + 1]];
}).filter(Boolean));

if (!args.cards || !args.sources || !args.output) {
  throw new Error('用法：node scripts/import-approved-materials.mjs --cards <审核稿.json> --sources <完整来源.jsonl> --output <materials.json>');
}

const cards = JSON.parse(await readFile(resolve(args.cards), 'utf8'));
const sourceRows = (await readFile(resolve(args.sources), 'utf8'))
  .split(/\r?\n/)
  .filter(Boolean)
  .map(line => JSON.parse(line));
const sourceById = new Map(sourceRows.map(row => [row.candidate_id, row.source_id]));

const layout = new Map([
  ['C04', { phase: 'practice', material_set: 'P', anonymous_user_id: '9901' }],
  ['C26', { phase: 'practice', material_set: 'P', anonymous_user_id: '9902' }],
  ['C01', { phase: 'formal', material_set: 'X', anonymous_user_id: '9911' }],
  ['C09', { phase: 'formal', material_set: 'X', anonymous_user_id: '9912' }],
  ['C14', { phase: 'formal', material_set: 'X', anonymous_user_id: '9913' }],
  ['C39', { phase: 'formal', material_set: 'X', anonymous_user_id: '9914' }],
  ['C11', { phase: 'formal', material_set: 'Y', anonymous_user_id: '9921' }],
  ['C22', { phase: 'formal', material_set: 'Y', anonymous_user_id: '9922' }],
  ['C23', { phase: 'formal', material_set: 'Y', anonymous_user_id: '9923' }],
  ['C35', { phase: 'formal', material_set: 'Y', anonymous_user_id: '9924' }],
]);

const countCharacters = text => [...text.replace(/\s/g, '')].length;
const status = 'user_confirmed_for_platform_integration';
const provenance = 'EmpatheticDialogues_user_adapted_cn';
const cardProvenance = 'assistant_drafted_user_confirmed_fixed_card';

if (!Array.isArray(cards) || cards.length !== layout.size) throw new Error('审核稿必须恰好包含10条材料。');
if (new Set(cards.map(row => row.id)).size !== cards.length) throw new Error('审核稿中存在重复材料编号。');

const byId = new Map(cards.map(row => [row.id, row]));
const missing = [...layout.keys()].filter(id => !byId.has(id));
const unexpected = cards.map(row => row.id).filter(id => !layout.has(id));
if (missing.length || unexpected.length) throw new Error(`材料编号不匹配；缺少：${missing.join(',') || '无'}；多出：${unexpected.join(',') || '无'}`);

const events = [...layout].map(([id, assignment]) => {
  const row = byId.get(id);
  const sourceId = sourceById.get(id);
  if (!sourceId) throw new Error(`找不到${id}的EmpatheticDialogues来源编号。`);
  const ai_cards = Object.fromEntries(['A', 'B'].map(condition => {
    const card = row[condition];
    const actual = countCharacters(card.text);
    if (actual !== card.character_count) throw new Error(`${id}-${condition}卡片字数记录不一致。`);
    if (actual < 110 || actual > 125) throw new Error(`${id}-${condition}卡片不在110—125字范围内。`);
    if (!Array.isArray(card.paragraphs) || card.paragraphs.length !== 3 || card.paragraphs.join('\n') !== card.text) {
      throw new Error(`${id}-${condition}卡片段落结构不一致。`);
    }
    return [condition, {
      condition: condition === 'A' ? 'emotion_recognition' : 'strategy_supply',
      provenance: cardProvenance,
      review_status: status,
      text: card.text,
      paragraphs: card.paragraphs,
      character_count: actual,
    }];
  }));
  const a = ai_cards.A.character_count;
  const b = ai_cards.B.character_count;
  const difference = Number((Math.abs(a - b) / Math.min(a, b) * 100).toFixed(2));
  if (difference > 5) throw new Error(`${id}的A/B卡片字数差超过5%。`);
  return {
    id,
    source_candidate_id: id,
    source_id: sourceId,
    source_sheet: row.sheet,
    source_row: row.row,
    category: row.category_as_provided,
    ...assignment,
    provenance,
    review_status: status,
    event_text: row.text,
    character_count: countCharacters(row.text),
    ai_cards,
    mechanical_length_check: {
      cards_110_to_125: true,
      pair_difference_percent: difference,
      pair_difference_within_5_percent: true,
    },
  };
});

const output = {
  dataset_id: 'experiment2_ed_cn_selected_20260910_v1',
  provenance,
  review_status: status,
  use_scope: '事件文本、练习/正式用途、X/Y材料集及固定AI卡片已由研究者确认，可用于平台试跑；材料强度、难度及AI输出仍需在正式采集前完成预测试与最终核查。',
  source_note: '事件改写自EmpatheticDialogues讲述者材料；source_id用于回溯原始对话。C39等本土化文本以研究者定稿为准。',
  design_note: 'P含两条练习；X/Y各含四条正式事件。四种顺序交叉平衡材料集与辅助条件，事件不永久绑定A或B。',
  generated_at: '2026-09-10',
  events,
};

await writeFile(resolve(args.output), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`已写入${events.length}条材料：${resolve(args.output)}`);
