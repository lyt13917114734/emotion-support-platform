'use client';
import { researchItems } from '@/lib/research-history';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Download, LogOut, RefreshCw, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadResearchExport, type ResearchExportFormat } from '@/lib/formal-client';
import { ASSIGNMENT_SEQUENCE, type Session } from '@/lib/experiment';

type Summary = { id: string; participant_id: string; status: string; sequence: Session['sequence']; completed_tasks: number | null; total_tasks: number | null; current_step: string; created_at: number; updated_at: number };
type Listing = { totals: { total: number; completed: number | null; active: number | null }; sessions: Summary[]; matched: number; page: number };
const date = (time: number | null) => time ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : '—';
const status = (value: string) => ({ active: '进行中', completed: '已完成', withdrawn: '已退出' }[value] ?? value);
const formats: [ResearchExportFormat, string][] = [['scales', '量表数据 CSV'], ['texts', '文本任务数据 CSV'], ['blind', '盲评回复 CSV'], ['json', '完整备份 JSON']];

export default function ResearchDashboard() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const generation = useRef(0);

  const clearAccess = useCallback(() => {
    generation.current += 1;
    setExpiresAt(null); setListing(null); setDetail(null); setPassword(''); setNotice('');
  }, []);
  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin' });
    const result = await response.json() as T & { error?: string };
    if (!response.ok) {
      if (response.status === 401) clearAccess();
      throw new Error(result.error ?? '请求未完成，请重试。');
    }
    return result;
  }, [clearAccess]);
  async function load(page = 1, filter = query) {
    const current = generation.current;
    const result = await request<Listing>(`/api/research/sessions?page=${page}&search=${encodeURIComponent(filter)}`);
    if (current === generation.current) setListing(result);
  }
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const auth = await request<{expiresAt: number}>('/api/research/auth');
        if (cancelled) return;
        setExpiresAt(auth.expiresAt);
        const result = await request<Listing>('/api/research/sessions?page=1');
        if (!cancelled) setListing(result);
      } catch { /* A fresh visit starts with the login form. */ }
      finally { if (!cancelled) setChecking(false); }
    })();
    return () => { cancelled = true; generation.current += 1; };
  }, [request]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => { clearAccess(); setError('登录已失效，请重新登录。'); }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, clearAccess]);

  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : '操作未完成，请重试。'); }
    finally { setBusy(false); }
  }
  function login(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void action(async () => {
      const auth = await request<{expiresAt: number}>('/api/research/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setPassword(''); setExpiresAt(auth.expiresAt); await load(1, ''); setQuery(''); setSearch('');
    });
  }
  return <div className="platform-shell login-shell research-shell">
    <header className="platform-header"><Link className="wordmark" href="/">公益心理服务平台</Link><span>研究者端</span>
      {expiresAt && <Button variant="outline" disabled={busy} onClick={() => void action(async () => { await request('/api/research/auth', { method: 'DELETE' }); clearAccess(); })}><LogOut size={16} />退出登录</Button>}
    </header>
    <main className="research-main">
      {error && <p className="error-box" role="alert">{error}</p>}
      {notice && <output>{notice}</output>}
      {checking ? <output>正在检查登录状态…</output> : !expiresAt ? <section className="login-card research-login">
        <LockKeyhole className="research-brand" size={28}/><p className="eyebrow">研究者入口</p><h1>研究者登录</h1>
        <p className="muted">登录后查看实验记录并导出数据。</p>
        <form onSubmit={login}><label htmlFor="research-password">研究者密码</label><Input id="research-password" type="password" autoComplete="off" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
          <Button type="submit" className="primary-action supporter-entry-button" disabled={busy || !password}><span>{busy ? '正在登录…' : '登录数据管理'}</span><ArrowRight/></Button></form>
        <Link href="/">返回实验入口</Link>
      </section> : <>
        <div className="research-heading"><div><p className="eyebrow">研究者数据管理</p><h1>实验数据</h1><p className="muted">查看已保存的实验记录。未提交的当前页作答不会显示在这里。</p></div>
          <Button variant="outline" disabled={busy} onClick={() => void action(async () => { setDetail(null); await load(listing?.page ?? 1); })}><RefreshCw size={16}/>刷新数据</Button></div>
        <section className="research-stats" aria-label="数据概况">{[['总记录', listing?.totals.total ?? 0], ['已完成', listing?.totals.completed ?? 0], ['进行中', listing?.totals.active ?? 0]].map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</section>
        <section className="research-card"><h2>数据导出</h2><p className="muted">导出全部已保存记录，包含进行中与已完成的数据；不受下方编号搜索影响。</p><div className="research-actions">{formats.map(([format, label]) => <Button key={format} variant="outline" disabled={busy} onClick={() => void action(async () => { await request('/api/research/auth'); const file = await downloadResearchExport(format); setNotice(`已开始下载：${file}`); })}><Download size={16}/>{label}</Button>)}</div></section>
        {detail ? <section className="research-card">
          <Button variant="outline" onClick={() => setDetail(null)}><ArrowLeft size={16}/>返回记录列表</Button>
          <h2>被试 {detail.profile.participantId}</h2><p className="muted">会话：{detail.id} · 分配组合：{ASSIGNMENT_SEQUENCE[detail.sequence]} · 更新时间：{date(detail.updatedAt)}</p>
          <h3>任务回复</h3>{detail.plan.map(plan => { const trial = detail.trials[plan.id]; return <details key={plan.id}><summary>{plan.phase === 'practice' ? '练习' : '正式任务'} · 第{plan.block}区组 · {plan.eventId} · {trial.sentAt === null ? '未提交' : '已提交'}</summary><p>辅助条件：{plan.condition === 'A' ? '情绪识别' : plan.condition === 'B' ? '认知重评' : plan.condition}</p><h4>事件</h4><p>{trial.eventText}</p><h4>AI辅助内容</h4><p>{trial.cardText}</p><h4>{trial.sentAt === null ? '已暂存的草稿' : '回复'}</h4><p>{trial.sentAt === null ? trial.draft || '尚无回复' : trial.reply}</p><p className="muted">AI调用：{trial.aiViews.length} 次 · 撰写用时：{trial.inputMS === null ? '—' : `${trial.inputMS} ms`} · 提交：{date(trial.sentAt)}</p></details>; })}
          <h3>测量答案</h3>{detail.flow.filter(step => researchItems(detail, step).length).map(step => <details key={step.id}><summary>{step.id} · {detail.surveys.some(s => s.id === step.id) ? '已提交' : '未提交'}</summary>{researchItems(detail, step).map(item => <div className="research-answer" key={item.id}><p>{item.text}</p><code>{item.id}</code><p>答案：{String(detail.surveyDrafts[step.id]?.[item.id] ?? '未作答')}{item.low || item.high ? `（1＝${item.low}；7＝${item.high}）` : ''}</p></div>)}</details>)}
        </section> : <section className="research-card"><h2>被试记录</h2><form className="research-search" onSubmit={e => { e.preventDefault(); void action(async () => { setQuery(search); await load(1, search); }); }}><label htmlFor="participant-search">搜索被试编号</label><Input id="participant-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="例如 D001"/><Button type="submit" variant="outline" disabled={busy}>搜索</Button></form>
          <div className="research-table-wrap"><table><thead><tr><th>被试编号</th><th>分配组合</th><th>状态</th><th>正式任务</th><th>更新时间</th><th>查看</th></tr></thead><tbody>{listing?.sessions.map(row => <tr key={row.id}><td>{row.participant_id}</td><td>{ASSIGNMENT_SEQUENCE[row.sequence]}</td><td>{status(row.status)}</td><td>{row.completed_tasks ?? '待核查'} / {row.total_tasks ?? '—'}</td><td>{date(row.updated_at)}</td><td><Button variant="outline" disabled={busy} onClick={() => void action(async () => { const current = generation.current; const result = await request<{session:Session}>(`/api/research/sessions?id=${encodeURIComponent(row.id)}`); if (current === generation.current) setDetail(result.session); })}>查看详情</Button></td></tr>)}</tbody></table></div>
          {listing?.sessions.length === 0 && <p>暂无符合条件的记录。</p>}
          <div className="research-actions"><Button variant="outline" disabled={busy || !listing || listing.page <= 1} onClick={() => void action(() => load((listing?.page ?? 1) - 1))}>上一页</Button><span>第 {listing?.page ?? 1} 页 · 共 {listing?.matched ?? 0} 条</span><Button variant="outline" disabled={busy || !listing || listing.page * 50 >= listing.matched} onClick={() => void action(() => load((listing?.page ?? 1) + 1))}>下一页</Button></div>
        </section>}
      </>}
    </main>
  </div>;
}
