'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { currentStep, itemsForStep, setSurveyAnswer, submitSurvey, type Session, type Item } from '@/lib/experiment';
import { isAnswerValid } from '@/lib/measurements';
import { STATE_REQUIRED_MESSAGE, isStateValue, firstStateKeyboardValue } from '@/lib/pretest-state';

type Commit = (change: (session: Session) => Session) => boolean;
const TICKS = [1, 2, 3, 4, 5, 6, 7];

function StateScale({ item, value, invalid, disabled, onChange }: {
  item: Item & { number: number }; value: number | null; invalid: boolean;
  disabled: boolean; onChange: (value: number) => void;
}) {
  const scaleRef = useRef<HTMLFieldSetElement>(null);
  const initialDrag = useRef<number | null>(null);
  const focusAfterSelection = useRef(false);
  // UI-only modality: pointer selection keeps focus without a keyboard focus ring.
  const [pointerFocus, setPointerFocus] = useState(false);
  const titleId = `${item.id}-title`, helpId = `${item.id}-help`, errorId = `${item.id}-error`;
  useEffect(() => {
    if (value !== null && focusAfterSelection.current) {
      scaleRef.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true });
      focusAfterSelection.current = false;
    }
  }, [value]);

  function positionValue(clientX: number) {
    // Read the actual track so the first drag stays aligned with the mounted slider.
    const track = scaleRef.current!.querySelector<HTMLElement>('.state-empty-track, [data-slot="slider-track"]')!;
    const rect = track.getBoundingClientRect();
    return Math.max(1, Math.min(7, Math.round((clientX - rect.left) / rect.width * 6) + 1));
  }

  return <section id={item.id} className={`state-question ${invalid ? 'state-question-error' : ''}`} aria-labelledby={titleId}>
    <div className="state-question-heading">
      <h3 id={titleId}><span className="state-question-number">{item.number}．</span>{item.text}<span className="state-required" aria-label="必答">*</span></h3>
    </div>
    <p id={helpId} className="sr-only">1，{item.low}；7，{item.high}。{value === null ? '尚未作答，点击或拖动轨道、点击数字或按左右方向键开始选择。' : '拖动滑块、点击轨道或数字、按左右方向键调整。'}</p>
    <div className="state-anchors"><span>{item.low ? `${item.low}（1）` : '1'}</span><span>{item.high ? `${item.high}（7）` : '7'}</span></div>
    <fieldset ref={scaleRef} className="state-scale" aria-labelledby={titleId} data-pointer-focus={pointerFocus}
      onPointerDownCapture={() => setPointerFocus(true)}
      onKeyDownCapture={() => setPointerFocus(false)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPointerFocus(false); }}>
      <button type="button" className="state-empty-control" data-answered={value !== null} tabIndex={value === null ? 0 : -1}
      aria-hidden={value !== null} aria-labelledby={titleId} aria-describedby={`${helpId}${invalid ? ` ${errorId}` : ''}`} disabled={disabled}
      onKeyDown={event => {
        if (value !== null || disabled) return;
        const first = firstStateKeyboardValue(event.key);
        if (first === null) return;
        event.preventDefault(); focusAfterSelection.current = true; onChange(first);
      }}
      onPointerDown={event => {
        if (value !== null || disabled || event.button !== 0) return;
        event.preventDefault(); initialDrag.current = event.pointerId; focusAfterSelection.current = true;
        event.currentTarget.setPointerCapture(event.pointerId); onChange(positionValue(event.clientX));
      }}
      onPointerMove={event => { if (!disabled && initialDrag.current === event.pointerId) onChange(positionValue(event.clientX)); }}
      onPointerUp={event => { if (initialDrag.current === event.pointerId) { initialDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
      onPointerCancel={() => { initialDrag.current = null; }}/>
      {value === null ? <div className="state-empty-track" aria-hidden="true"/> :
        <Slider className="state-slider" min={1} max={7} step={1} largeStep={1} value={[value]} thumbAlignment="center"
          aria-labelledby={titleId} aria-describedby={helpId} disabled={disabled}
          onValueChange={next => { const selected = Array.isArray(next) ? next[0] : next; if (isStateValue(selected)) onChange(selected); }}/>
      }
      <div className="state-ticks">
        {TICKS.map(tick => <button key={tick} type="button" tabIndex={-1} disabled={disabled} style={{ left: `${(tick - 1) / 6 * 100}%` }}
          className={`state-tick ${tick === value ? 'is-selected' : ''}`} aria-label={`第${item.number}题，选择${tick}`} aria-pressed={tick === value}
          onClick={() => {
            onChange(tick);
            requestAnimationFrame(() => scaleRef.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true }));
          }}>
          <span className="state-tick-mark" aria-hidden="true"/><span className="state-tick-number">{tick}</span>
        </button>)}
      </div>
    </fieldset>
    {invalid && <p className="state-field-error" id={errorId} role="alert">{STATE_REQUIRED_MESSAGE}</p>}
  </section>;
}

function ChoiceQuestion({ item, value, invalid, disabled, onChange }: {
  item: Item & { number: number }; value: string | null; invalid: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  const titleId = `${item.id}-title`;
  return <section id={item.id} className={`state-question ${invalid ? 'state-question-error' : ''}`} aria-labelledby={titleId}>
    <div className="state-question-heading"><h3 id={titleId}><span className="state-question-number">{item.number}．</span>{item.text}<span className="state-required" aria-label="必答">*</span></h3></div>
    <RadioGroup className="measurement-choices" value={value} aria-labelledby={titleId} disabled={disabled}
      onValueChange={next => { if (typeof next === 'string') onChange(next); }}>
      {item.options?.map(option => <label key={option.value} className={`measurement-choice ${value === option.value ? 'is-selected' : ''}`}>
          <RadioGroupItem value={option.value} aria-labelledby={`${item.id}-${option.value}-label`}/><span id={`${item.id}-${option.value}-label`}>{option.label}</span>
      </label>)}
    </RadioGroup>
    {invalid && <p className="state-field-error" role="alert">请选择一个选项</p>}
  </section>;
}

function MultiChoiceQuestion({ item, value, invalid, disabled, onChange }: {
  item: Item & { number: number }; value: string | null; invalid: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  let selected: string[] = [];
  try { selected = value ? JSON.parse(value) : []; } catch { selected = []; }
  function toggle(option: string, checked: boolean) {
    const next = checked ? [...new Set([...selected, option])] : selected.filter(value => value !== option);
    onChange(JSON.stringify(next));
  }
  const titleId = `${item.id}-title`;
  return <section id={item.id} className={`state-question ${invalid ? 'state-question-error' : ''}`} aria-labelledby={titleId}>
    <div className="state-question-heading"><h3 id={titleId}><span className="state-question-number">{item.number}．</span>{item.text}<span className="state-required" aria-label="必答">*</span></h3></div>
    <div className="measurement-choices" role="group" aria-labelledby={titleId}>
      {item.options?.map(option => <label key={option.value} className={`measurement-choice ${selected.includes(option.value) ? 'is-selected' : ''}`}>
        <Checkbox checked={selected.includes(option.value)} disabled={disabled} onCheckedChange={checked => toggle(option.value, checked === true)}/><span>{option.label}</span>
      </label>)}
    </div>
    {invalid && <p className="state-field-error" role="alert">请至少选择一个原因</p>}
  </section>;
}

function TextareaQuestion({ item, value, disabled, onChange }: {
  item: Item & { number: number }; value: string | null; disabled: boolean; onChange: (value: string) => void;
}) {
  const titleId = `${item.id}-title`;
  return <section id={item.id} className="state-question" aria-labelledby={titleId}>
    <div className="state-question-heading"><h3 id={titleId}><span className="state-question-number">{item.number}．</span>{item.text}<span className="state-optional">（选填）</span></h3></div>
    <Textarea value={value ?? ''} disabled={disabled} aria-labelledby={titleId} rows={5} onChange={event => onChange(event.target.value)} placeholder="如有需要，请填写您的想法" />
  </section>;
}

function headingFor(session: Session) {
  const step = currentStep(session);
  const eyebrow = step.block ? `第${step.block === 1 ? '一' : '二'}阶段` : step.kind === 'pretest' ? '开始前' : '结束评价';
  if (step.kind === 'pretest') return { eyebrow, title: '开始前，请先回答', description: '请根据您此刻的真实感受和总体看法作答。' };
  if (step.kind === 'baseline' || step.kind === 'blockState') return { eyebrow, title: '记录您此刻的状态', description: '请根据您此刻的真实感受作答。' };
  if (step.kind === 'trialSurvey') return { eyebrow, title: '每项任务后的评价', description: '请仅根据刚才完成的这一项任务作答。' };
  if (step.kind === 'integrationCost') return { eyebrow, title: '区组 AI辅助使用评价', description: '以下题目要求参与者评价刚刚完成的整个区组，而不是其中某一项任务。' };
  if (step.kind === 'blockReview') return { eyebrow, title: '区组AI辅助信息评价', description: '请根据刚刚完成的整个阶段作答。' };
  if (step.kind === 'attentionCheck') return { eyebrow, title: '请完成这一题', description: '请按照题目要求作答。' };
  return { eyebrow, title: '完成前的最后评价', description: '请结合刚才完成的全部任务作答。' };
}

export function MeasurementScreen({ session, commit, edit = commit, disabled }: { session: Session; commit: Commit; edit?: Commit; disabled: boolean }) {
  const step = currentStep(session), items = itemsForStep(step), heading = headingFor(session);
  const answers = session.surveyDrafts[step.id] ?? {};
  const [errors, setErrors] = useState<string[]>([]);
  const answered = items.filter(item => !item.required && item.kind === 'textarea' || isAnswerValid(item, answers[item.id])).length;
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const missing = items.filter(item => item.required !== false && !isAnswerValid(item, answers[item.id]));
    if (missing.length) {
      setErrors(missing.map(item => item.id));
      const question = document.getElementById(missing[0].id);
      question?.scrollIntoView({ behavior: 'instant', block: 'center' });
      question?.querySelector<HTMLElement>('.state-empty-control, [role="radio"]')?.focus({ preventScroll: true });
      return;
    }
    commit(s => submitSurvey(s, step.id));
  }
  return <form className="state-survey-page login-card" onSubmit={submit} noValidate>
    <div className="state-survey-heading">
      <div className="state-heading-line"><p className="eyebrow">{heading.eyebrow}</p><output className="state-completion">已完成 {answered}／{items.length}</output></div>
      <h2>{heading.title}</h2>
      <p className="state-survey-description">{heading.description}</p>
    </div>
    {items.map((item, index) => {
      const invalid = errors.includes(item.id) && item.required !== false && !isAnswerValid(item, answers[item.id]);
      const onChange = (value: number | string) => { if (edit(s => setSurveyAnswer(s, item.id, value))) setErrors(current => current.filter(id => id !== item.id)); };
      return <div className="measurement-item" key={item.id}>
        {item.section && <h3 className="measurement-section-title">{item.section}</h3>}
        {item.kind === 'choice'
          ? <ChoiceQuestion item={{ ...item, number: index + 1 }} value={typeof answers[item.id] === 'string' ? answers[item.id] as string : null} invalid={invalid} disabled={disabled} onChange={onChange}/>
          : item.kind === 'multiChoice'
            ? <MultiChoiceQuestion item={{ ...item, number: index + 1 }} value={typeof answers[item.id] === 'string' ? answers[item.id] as string : null} invalid={invalid} disabled={disabled} onChange={onChange}/>
            : item.kind === 'textarea'
              ? <TextareaQuestion item={{ ...item, number: index + 1 }} value={typeof answers[item.id] === 'string' ? answers[item.id] as string : null} disabled={disabled} onChange={onChange}/>
              : <StateScale item={{ ...item, number: index + 1 }} value={isStateValue(answers[item.id]) ? answers[item.id] as number : null} invalid={invalid} disabled={disabled} onChange={onChange}/>}
      </div>;
    })}
    <div className="state-survey-footer"><Button type="submit" className="primary-action supporter-entry-button" disabled={disabled || answered !== items.length}><span>{step.kind === 'final' ? '完成评价' : '下一步'}</span><ArrowRight aria-hidden="true"/></Button></div>
  </form>;
}
