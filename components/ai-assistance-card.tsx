'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type AssistanceSection = { title: string; content: string };
type AssistanceCardContent = {
  instructionTitle: string;
  instructionContent: string;
  buttonText: string;
  loadingText: string;
  sectionOneTitle: string;
  sectionOneContent: string;
  sectionTwoTitle: string;
  sectionTwoContent: string;
};

type AIAssistanceCardProps = {
  trialId: string;
  paragraphs: string[];
  revealed: boolean;
  disabled?: boolean;
  onReveal: () => void;
};

const AI_LOADING_MS = 1500;

function splitSection(paragraph = ''): AssistanceSection {
  const split = paragraph.indexOf('：');
  return split < 0
    ? { title: '', content: paragraph }
    : { title: paragraph.slice(0, split), content: paragraph.slice(split + 1) };
}

export function assistanceCardContent(
  paragraphs: string[],
): AssistanceCardContent {
  const sectionOne = splitSection(paragraphs[0]);
  const sectionTwo = splitSection(paragraphs[1]);
  const instruction = splitSection(paragraphs[2]);
  return {
    instructionTitle: instruction.title,
    instructionContent: instruction.content,
    buttonText: '调用AI辅助',
    loadingText: 'AI正在思考……',
    sectionOneTitle: sectionOne.title,
    sectionOneContent: sectionOne.content,
    sectionTwoTitle: sectionTwo.title,
    sectionTwoContent: sectionTwo.content,
  };
}

export function AIAssistanceCard({
  trialId,
  paragraphs,
  revealed,
  disabled = false,
  onReveal,
}: AIAssistanceCardProps) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);
  const content = assistanceCardContent(paragraphs);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function requestAssistance() {
    if (disabled || loading || revealed || timer.current !== null) return;
    setLoading(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setLoading(false);
      onReveal();
    }, AI_LOADING_MS);
  }

  return (
    <div className="ai-assistance-area">
      <section
        className="ai-instruction-card"
        aria-labelledby={`ai-instruction-${trialId}`}
      >
        <div className="ai-instruction">
          <div className="ai-instruction-heading">
            <Sparkles size={18} aria-hidden="true" />
            <h3 id={`ai-instruction-${trialId}`}>{content.instructionTitle}</h3>
          </div>
          <p>{content.instructionContent}</p>
        </div>
        {!revealed && (
          <div className="ai-call-area" aria-live="polite">
            {loading ? (
              <output className="ai-loading">
                <Spinner aria-hidden="true" />
                <span>{content.loadingText}</span>
              </output>
            ) : (
              <Button
                type="button"
                className="ai-call-button"
                disabled={disabled}
                onClick={requestAssistance}
              >
                {content.buttonText}
                <Sparkles size={17} aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </section>
      {revealed && (
        <section className="ai-content-card" aria-live="polite">
          <div className="ai-result">
            {[
              {
                title: content.sectionOneTitle,
                body: content.sectionOneContent,
              },
              {
                title: content.sectionTwoTitle,
                body: content.sectionTwoContent,
              },
            ].map((section, index) => (
              <section className="ai-result-section" key={index}>
                <h4>{section.title}</h4>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
