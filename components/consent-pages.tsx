'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CONSENT_BRIEF, CONSENT_VERSION, EXTERNAL_SIGNING_NOTE, READING_CONFIRMATION, markDocumentEnd, confirmReading } from '@/lib/consent';
import documentContent from '@/lib/consent-document.json';

export function ConsentSummary({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return <main id="main-content" tabIndex={-1} className="consent-page consent-summary">
    <Button type="button" variant="ghost" className="back-button" onClick={onBack}><ArrowLeft aria-hidden="true"/>返回入口</Button>
    <section className="login-region"><div className="login-card">
      <p className="research-badge"><span aria-hidden="true"/>研究参与说明</p>
      <h1>参加研究前，请先了解</h1>
      <p className="consent-brief-text">{CONSENT_BRIEF}</p>
      <p className="consent-signing-note">{EXTERNAL_SIGNING_NOTE}</p>
      <div className="consent-summary-actions">
        <Button type="button" className="primary-action supporter-entry-button" onClick={onContinue}><span>查看完整版知情同意书</span><ArrowRight aria-hidden="true"/></Button>
        <Button type="button" variant="ghost" className="consent-secondary" onClick={onBack}>暂不参与，返回入口</Button>
      </div>
    </div></section>
  </main>;
}

export function ConsentFull({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const articleRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    // Reaching/passing the document end unlocks the checkbox, including End-key
    // navigation on short screens. Downloading the file does not unlock it.
    const updateReading = () => {
      const article = articleRef.current?.getBoundingClientRect();
      const end = endRef.current?.getBoundingClientRect();
      if (!article || !end) return;
      const atEnd = end.bottom <= window.innerHeight;
      if (atEnd && !viewedRef.current) {
        try {
          markDocumentEnd(window.sessionStorage);
          viewedRef.current = true; setReachedEnd(true); setError('');
        } catch { setError('无法保存本机阅读状态，请检查浏览器存储设置后重试。'); }
      }
      setProgress(viewedRef.current ? 100 : Math.max(0, Math.min(99, Math.round((window.innerHeight - article.top) / article.height * 100))));
    };
    const observer = new IntersectionObserver(updateReading, { threshold: 1 });
    if (endRef.current) observer.observe(endRef.current);
    window.addEventListener('scroll', updateReading, { passive: true });
    window.addEventListener('resize', updateReading);
    updateReading();
    return () => { observer.disconnect(); window.removeEventListener('scroll', updateReading); window.removeEventListener('resize', updateReading); };
  }, []);

  function continueToRegistration() {
    try {
      confirmReading(window.sessionStorage, checked, reachedEnd);
      onContinue();
    } catch (e) { setError(e instanceof Error ? e.message : '无法保存阅读确认，请重试。'); }
  }

  return <main id="main-content" tabIndex={-1} className="consent-page consent-full">
    <nav className="consent-toolbar" aria-label="知情同意书阅读工具">
      <Button type="button" variant="ghost" className="consent-back" onClick={onBack}><ArrowLeft aria-hidden="true"/>返回简版说明</Button>
      <div className="consent-progress"><span>阅读进度 {progress}%</span><progress aria-label="知情同意书阅读进度" value={progress} max={100}/></div>
    </nav>
    <header className="consent-heading"><p className="eyebrow">研究参与说明 · 完整版</p><h1>知情同意书</h1><p>{documentContent.subtitle}</p><small>文档版本：{CONSENT_VERSION}</small></header>
    <p className="consent-signing-note consent-outside-note">{EXTERNAL_SIGNING_NOTE}</p>
    <article className="login-card consent-document" ref={articleRef} aria-label="定版知情同意书原文">
      <div className="consent-letterhead">{documentContent.letterhead.map(line => <p key={line}>{line}</p>)}</div>
      {documentContent.paragraphs.map((paragraph, index) => {
        if (index === 0) return <h2 key={index} className="consent-original-title">{paragraph.text}</h2>;
        if (paragraph.type === 'heading') return <h3 key={index}>{paragraph.text}</h3>;
        return <p key={index} className={paragraph.text.trim() ? 'consent-source-paragraph' : 'consent-blank-paragraph'}>{paragraph.text || '\u00a0'}</p>;
      })}
      <div ref={endRef} className="consent-document-end" aria-hidden="true">— 正文结束 —</div>
    </article>
    <section className="login-card consent-reading-confirmation" aria-label="阅读确认">
      <p className="consent-signing-note">{EXTERNAL_SIGNING_NOTE}</p>
      <output className={`consent-reading-status ${reachedEnd ? 'is-complete' : ''}`}>{reachedEnd && <CheckCircle2 aria-hidden="true"/>}{reachedEnd ? '已浏览至文末' : '请先浏览完整版知情同意书至文末，再确认阅读。'}</output>
      <label className="checkbox-line consent-confirm-label"><Checkbox disabled={!reachedEnd} checked={checked} onCheckedChange={value => setChecked(!!value)}/><span>{READING_CONFIRMATION}</span></label>
      {error && <div className="error-box" role="alert"><AlertCircle aria-hidden="true"/><span>{error}</span></div>}
      <Button type="button" className="primary-action supporter-entry-button" disabled={!reachedEnd || !checked} onClick={continueToRegistration}><span>我已阅读，进入信息登记</span><ArrowRight aria-hidden="true"/></Button>
    </section>
  </main>;
}
