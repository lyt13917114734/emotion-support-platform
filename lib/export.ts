import { ASSIGNMENT_SEQUENCE, itemsForStep, materialGroup, measurementMetadata, type Session, type Step } from './experiment.ts';
import { GOAL_FIELDS, INTEGRATION_FIELDS, TASK_ITEMS, rawMean, cognitiveClarityReversed, cognitiveResourceDepletionMean, aiTrustChange } from './measurements.ts';
import { ageGroupLabel, exportProfile } from './profile.ts';

export type Cell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, Cell>;
export function csvCell(value: Cell) {
  let text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet formula injection applies to untrusted text, not numeric negatives.
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCSV(rows: ExportRow[], headers?: string[]): string {
  const keys = headers ?? Object.keys(rows[0] ?? {});
  return '\uFEFF' + [keys.map(csvCell).join(','), ...rows.map(row => keys.map(k => csvCell(row[k])).join(','))].join('\r\n');
}
export function trialRows(s: Session): ExportRow[] {
  return s.plan.filter(p => p.phase === 'formal').map(p => {
    const t = s.trials[p.id];
    const evaluation = s.task_evaluations[p.id];
    const taskAnswers = s.surveyDrafts[`${p.id}-survey`] ?? {};
    return {
      session_id: s.id, participant_id: s.profile.participantId, protocol_version: s.protocolVersion,
      material_version: s.materialVersion, measure_version: s.measureVersion, mode: s.mode, review_status: s.reviewStatus,
      allocation_source: s.allocationSource, sequence: s.sequence, seed: s.seed,
      trial_id: p.id, response_id: t?.blindId, phase: p.phase, block: p.block, within_block_index: p.ordinal,
      formal_index: p.formalOrdinal, condition: p.condition, material_set: p.materialSet, event_id: p.eventId,
      material_group: materialGroup(p.materialSet), block_position: p.block, ai_condition: p.condition,
      event_order: p.ordinal, assignment_sequence: ASSIGNMENT_SEQUENCE[s.sequence],
      card_id: t?.cardId, event_text: t?.eventText, card_text: t?.cardText,
      event_presented_at_ms: t?.presentedAt, first_ai_opened_at_ms: t?.firstAIOpenedAt,
      reply_started_at_ms: t?.replyStartedAt, reply_sent_at_ms: t?.sentAt, inputMS: t?.inputMS,
      reply: t?.reply, ai_open_count: t?.aiViews.length, draft_edit_events: t?.draftEdits,
      interrupted: t?.interrupted, demo_transition_skipped: s.skippedDemoTransition,
      transition_skipped: s.logs.some(event => event.type === 'transition_skipped'),
      transition_duration_ms: (() => {
        const finished = s.logs.find(event => event.type === 'transition_finished');
        const started = s.openedAt.transition;
        return finished && started !== undefined ? Math.max(0, finished.at - started) : null;
      })(),
      gender: s.profile.gender, age_group: s.profile.ageGroup, age_group_label: ageGroupLabel(s.profile.ageGroup), ai_use_frequency: s.profile.aiUseFrequency, ai_experience: s.profile.aiExperience,
      psychology_study_duration: s.profile.psychologyStudyDuration, psychology_task_knowledge_familiarity: s.profile.psychologyTaskKnowledgeFamiliarity,
      schedule_id: s.sequence, block_id: p.block, material_id: p.eventId, task_position: p.ordinal, completed_formal_tasks: p.ordinal - 1,
      measurement_time: evaluation?.measurement_time, schedule_order: s.sequence, block_index: p.block,
      measurement_timepoint: evaluation?.measurement_timepoint ?? 'task_post', created_at: evaluation?.created_at, updated_at: evaluation?.updated_at,
      measurement_status: evaluation?.record_status ?? 'not_applicable', timing_status: evaluation?.timing_status,
      ...Object.fromEntries(TASK_ITEMS.map(item => [item.id, taskAnswers[item.id] ?? null])),
      goal_attainment_mean: p.phase === 'formal' ? rawMean(taskAnswers, GOAL_FIELDS) : null,
    };
  });
}
export function trialCSV(s: Session) { return toCSV(trialRows(s)); }
// One measurement stage per row; no task text, input timing or AI operation data.
export function scaleStageRows(s: Session): ExportRow[] {
  return s.flow.filter(step => itemsForStep(step).length).map(step => {
    const answers = s.surveyDrafts[step.id] ?? {};
    const meta = measurementMetadata(s, step);
    return {
      session_id: s.id, measure_version: s.measureVersion,
      protocol_version: s.protocolVersion,
      survey_id: step.id, stage: step.kind, phase: step.trialId ? s.plan.find(p => p.id === step.trialId)?.phase : 'session', ...meta,
      submission_status: s.surveys.some(record => record.id === step.id) ? 'submitted' : 'not_submitted',
      ...Object.fromEntries(itemsForStep(step).map(item => [item.id, answers[item.id] ?? null])),
      goal_attainment_mean: step.kind === 'trialSurvey' ? rawMean(answers, GOAL_FIELDS) : null,
      integration_cost_mean: step.kind === 'integrationCost' ? rawMean(answers, INTEGRATION_FIELDS) : null,
      cognitive_clarity_reversed: step.kind === 'blockState' ? cognitiveClarityReversed(answers) : null,
      cognitive_resource_depletion_mean: step.kind === 'blockState' ? cognitiveResourceDepletionMean(answers) : null,
      ai_trust_change: step.kind === 'final' ? aiTrustChange(s.surveyDrafts.pretest ?? {}, answers) : null,
    };
  });
}

// One task per row, including clearly labelled practice tasks. No survey answers.
export function textTaskRows(s: Session): ExportRow[] {
  return s.plan.map(p => {
    const t = s.trials[p.id];
    return {
      session_id: s.id, participant_id: s.profile.participantId,
      protocol_version: s.protocolVersion, material_version: s.materialVersion,
      assignment_sequence: ASSIGNMENT_SEQUENCE[s.sequence], seed: s.seed,
      trial_id: p.id, phase: p.phase, block_position: p.block, ai_condition: p.condition,
      material_group: materialGroup(p.materialSet), event_order: p.ordinal,
      formal_index: p.formalOrdinal, event_id: p.eventId, response_id: t?.blindId,
      task_status: !t ? 'not_started' : t.sentAt === null ? 'in_progress' : 'submitted',
      event_text: t?.eventText, card_id: t?.cardId, card_text: t?.cardText,
      reply: t?.reply, draft: t?.draft, inputMS: t?.inputMS,
      event_presented_at_ms: t?.presentedAt, first_ai_opened_at_ms: t?.firstAIOpenedAt,
      reply_started_at_ms: t?.replyStartedAt, reply_sent_at_ms: t?.sentAt,
      ai_open_count: t ? t.aiViews.length : null, ai_views_json: JSON.stringify(t?.aiViews ?? []),
      draft_edit_events: t?.draftEdits, interrupted: t?.interrupted,
    };
  });
}
// One session per row. Stage prefixes keep repeated measurements distinct.
export function allDataRow(s: Session): ExportRow {
  const row: ExportRow = {
    session_id: s.id, participant_id: s.profile.participantId,
    protocol_version: s.protocolVersion, material_version: s.materialVersion,
    measure_version: s.measureVersion, mode: s.mode, sequence: s.sequence,
    assignment_sequence: ASSIGNMENT_SEQUENCE[s.sequence], seed: s.seed,
    allocation_source: s.allocationSource, created_at: s.createdAt, updated_at: s.updatedAt,
    cursor: s.cursor, current_step: s.flow[s.cursor]?.id, furthest_cursor: s.furthestCursor,
    gender: s.profile.gender, age_group: s.profile.ageGroup, age_group_label: ageGroupLabel(s.profile.ageGroup),
    ai_use_frequency: s.profile.aiUseFrequency, ai_experience: s.profile.aiExperience, psychology_study_duration: s.profile.psychologyStudyDuration,
    psychology_task_knowledge_familiarity: s.profile.psychologyTaskKnowledgeFamiliarity,
  };
  const prefix = (id: string) => id.replaceAll('-', '_');
  for (const trial of trialRows(s)) {
    for (const [key, value] of Object.entries(trial)) row[`${prefix(String(trial.trial_id))}__${key}`] = value;
  }
  for (const plan of s.plan) {
    const trial = s.trials[plan.id];
    const id = prefix(plan.id);
    row[`${id}__draft`] = trial?.draft;
    row[`${id}__ai_views_json`] = JSON.stringify(trial?.aiViews ?? []);
    if (plan.phase === 'practice') {
      for (const [key, value] of Object.entries({ phase: plan.phase, block_position: plan.block,
        material_group: materialGroup(plan.materialSet), ai_condition: plan.condition, event_id: plan.eventId,
        event_text: trial?.eventText, card_text: trial?.cardText, reply: trial?.reply, inputMS: trial?.inputMS,
        reply_sent_at_ms: trial?.sentAt })) row[`${id}__${key}`] = value;
    }
  }
  for (const item of surveyRows(s)) {
    const id = prefix(String(item.survey_id));
    row[`${id}__${item.item_id}`] = item.value;
    if (item.item_type === 'choice') row[`${id}__${item.item_id}__label`] = item.value_label;
    for (const key of ['opened_at_ms', 'submitted_at_ms', 'last_submitted_at_ms', 'goal_attainment_mean',
      'integration_cost_mean', 'cognitive_clarity_reversed', 'cognitive_resource_depletion_mean', 'ai_trust_change']) {
      row[`${id}__${key}`] = item[key];
    }
  }
  row.attention_check_block_1_passed = s.attention_check_block_1_passed;
  row.attention_check_block_2_passed = s.attention_check_block_2_passed;
  // Retain full source data, including logs and legacy records, without expanding
  // variable-length event arrays into different analysis columns for each person.
  row.session_backup_json = backupJSON(s);
  return row;
}
export function surveyRows(s: Session): ExportRow[] {
  return s.flow.flatMap(step => {
    const items = itemsForStep(step), meta = measurementMetadata(s, step), answers = s.surveyDrafts[step.id] ?? {};
    const submitted = s.surveys.find(r => r.id === step.id);
    return items.map((item, index) => ({
      session_id: s.id, mode: s.mode, protocol_version: s.protocolVersion, material_version: s.materialVersion, measure_version: s.measureVersion,
      ...meta, gender: s.profile.gender, age_group: s.profile.ageGroup, age_group_label: ageGroupLabel(s.profile.ageGroup),
      sequence: s.sequence, survey_id: step.id, phase: step.trialId ? s.plan.find(p => p.id === step.trialId)?.phase : 'session', stage: step.kind, block: step.block ?? null,
      trial_id: step.trialId ?? null, event_id: meta.material_id, item_id: item.id, item_text: item.text, item_type: item.kind,
      scale_min: item.kind === 'scale' ? 1 : null, scale_max: item.kind === 'scale' ? 7 : null, low_anchor: item.low, high_anchor: item.high,
      source_status: item.reference, value: answers[item.id] ?? null,
      value_label: item.kind === 'choice' ? item.options?.find(option => option.value === answers[item.id])?.label ?? null : null,
      opened_at_ms: s.openedAt[step.id] ?? null, submitted_at_ms: submitted?.submittedAt ?? null, last_submitted_at_ms: submitted?.lastSubmittedAt ?? null,
      item_number: index + 1,
      goal_attainment_mean: step.kind === 'trialSurvey' ? rawMean(answers, GOAL_FIELDS) : null,
      integration_cost_mean: step.kind === 'integrationCost' ? rawMean(answers, INTEGRATION_FIELDS) : null,
      cognitive_clarity_reversed: step.kind === 'blockState' ? cognitiveClarityReversed(answers) : null,
      cognitive_resource_depletion_mean: step.kind === 'blockState' ? cognitiveResourceDepletionMean(answers) : null,
      ai_trust_change: step.kind === 'final' ? aiTrustChange(s.surveyDrafts.pretest ?? {}, answers) : null,
      attention_check_block_1: s.attention_check_block_1, attention_check_block_1_passed: s.attention_check_block_1_passed,
      attention_check_block_2: s.attention_check_block_2, attention_check_block_2_passed: s.attention_check_block_2_passed,
    }));
  });
}
export function surveyCSV(s: Session) {
  const rows = surveyRows(s);
  return toCSV(rows, rows.length ? undefined : ['session_id', 'survey_id', 'item_id', 'value']);
}
export function blindRows(s: Session): ExportRow[] {
  // Opaque per-response IDs and randomized-looking order hide session/trial/condition.
  return Object.values(s.trials).filter(t => t.phase === 'formal' && t.sentAt !== null)
    .sort((a, b) => a.blindId.localeCompare(b.blindId))
    .map(t => ({ response_id: t.blindId, event_text: t.eventText, reply: t.reply }));
}
export function blindCSV(s: Session) { return toCSV(blindRows(s), ['response_id', 'event_text', 'reply']); }
export function backupJSON(s: Session) {
  const answers = (step: Step) => s.surveyDrafts[step.id] ?? {};
  return JSON.stringify({ ...s, profile: exportProfile(s.profile),
    task_evaluations: Object.fromEntries(Object.entries(s.task_evaluations).map(([id, record]) => [id, {
      ...record, goal_attainment_mean: rawMean(s.surveyDrafts[`${id}-survey`] ?? {}, GOAL_FIELDS),
    }])),
    integration_cost: Object.fromEntries(Object.entries(s.integration_cost).map(([block, record]) => [block, {
      ...record, integration_cost_mean: rawMean(answers(s.flow.find(step => step.id === `integration-${block}`)!), INTEGRATION_FIELDS),
    }])),
  }, null, 2);
}
export function downloadFile(name: string, data: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
