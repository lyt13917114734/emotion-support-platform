'use client';

import Link from 'next/link';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  UserRound,
  Check,
  CheckCircle2,
  ChevronDown,
  LockKeyhole,
  Download,
  LogOut,
  AlertCircle,
  Coffee,
  SlidersHorizontal,
  Trash2,
  BookOpenText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RegistrationSelect } from '@/components/registration-select';
import { MeasurementScreen } from '@/components/measurement-screen';
import { AIAssistanceCard } from '@/components/ai-assistance-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  SEQUENCES,
  REPLY_MIN,
  REPLY_MAX,
  TRANSITION_MS,
  currentStep,
  createSession,
  updateRegisteredProfile,
  continueInfo,
  toggleAI,
  startReply,
  updateDraft,
  submitReply,
  itemsForStep,
  navigateToStep,
  continueSubmittedTrial,
  recordPageEvent,
  countCharacters,
  type Session,
  type Sequence,
  type Profile,
} from '@/lib/experiment';
import {
  EMPTY_PROFILE,
  GENDER_OPTIONS,
  AGE_OPTIONS,
  AGE_INELIGIBLE_MESSAGE,
  hasCompleteProfile,
  isEligibleAge,
} from '@/lib/profile';
import { LocalSessionRepository } from '@/lib/storage';
import { PendingSave } from '@/lib/pending-save';
import { cacheFormalDraft, restoreFormalDraft, clearFormalDraft } from '@/lib/formal-draft';
import {
  backupJSON,
  trialCSV,
  surveyCSV,
  blindCSV,
  downloadFile,
} from '@/lib/export';
import { ConsentSummary, ConsentFull } from '@/components/consent-pages';
import {
  resetReading,
  readReceipt,
  guardedEntry,
  entryFromHash,
  canEnterRegistration,
  type EntryStage,
} from '@/lib/consent';
import {
  activeFormalParticipant,
  clearActiveFormalParticipant,
  clearFormalCredential,
  loadFormal,
  readFormalCredential,
  saveFormal,
  setActiveFormalParticipant,
  startFormal,
  writeFormalCredential,
  type FormalCredential,
} from '@/lib/formal-client';

type Commit = (fn: (s: Session) => Session) => boolean;
type RemotePending = {
  candidate: Session;
  previous: Session;
  expectedRevision: number;
};
const SEQUENCE_LABELS: Record<Sequence, string> = {
  AX_BY: '① 情绪 X → 策略 Y',
  AY_BX: '② 情绪 Y → 策略 X',
  BX_AY: '③ 策略 X → 情绪 Y',
  BY_AX: '④ 策略 Y → 情绪 X',
};
const PSYCHOLOGY_STUDY_DURATION_OPTIONS = [
  ['less_than_1_year', '不足1年'],
  ['1_to_2_years', '1～2年'],
  ['3_to_4_years', '3～4年'],
  ['5_years_or_more', '5年及以上'],
].map(([value, label]) => ({ value, label }));
const AI_EXPERIENCE_OPTIONS = [
  ['1', '从不使用'],
  ['2', '很少使用'],
  ['3', '偶尔使用'],
  ['4', '每周使用'],
  ['5', '每天使用'],
].map(([value, label]) => ({ value, label }));
const PREVIEW_SEQUENCE_OPTIONS: { value: Sequence | ''; label: string }[] = [
  { value: '', label: '随机预览（不保证全样本平衡）' },
  ...SEQUENCES.map((value) => ({ value, label: SEQUENCE_LABELS[value] })),
];

export default function ExperimentApp({
  formalMode = false,
}: {
  formalMode?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const repo = useRef<LocalSessionRepository | null>(null);
  const pending = useRef<PendingSave | null>(null);
  const credential = useRef<FormalCredential | null>(null);
  const remotePending = useRef<RemotePending | null>(null);
  const draftDirty = useRef(false);
  const draftCacheFailed = useRef(false);
  const [savePending, setSavePending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<EntryStage>('entry');
  const continuedFromSummary = useRef(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [repairSession, setRepairSession] = useState<Session | null>(null);
  const [ineligible, setIneligible] = useState(false);
  const [sequence, setSequence] = useState<Sequence | ''>('');
  const [researchOpen, setResearchOpen] = useState(false);
  const [openRegistrationSelect, setOpenRegistrationSelect] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pausedSession, setPausedSession] = useState<Session | null>(null);

  const navigateEntry = useCallback(
    (requested: EntryStage, replace = false) => {
      let destination: EntryStage;
      try {
        destination = guardedEntry(
          requested,
          readReceipt(window.sessionStorage),
          continuedFromSummary.current,
        );
      } catch {
        destination = requested === 'entry' ? 'entry' : 'consent-summary';
      }
      if (destination === 'entry') continuedFromSummary.current = false;
      window.history[replace ? 'replaceState' : 'pushState'](
        null,
        '',
        `${window.location.pathname}${window.location.search}${destination === 'entry' ? '' : `#${destination}`}`,
      );
      setEntry(destination);
      setError('');
      setIneligible(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [],
  );

  useEffect(() => {
    const syncEntry = () => {
      if (sessionRef.current) return;
      const requested = entryFromHash(window.location.hash);
      if (requested) navigateEntry(requested, true);
    };
    syncEntry();
    window.addEventListener('hashchange', syncEntry);
    window.addEventListener('popstate', syncEntry);
    return () => {
      window.removeEventListener('hashchange', syncEntry);
      window.removeEventListener('popstate', syncEntry);
    };
  }, [navigateEntry]);

  useEffect(() => {
    if (!session && entry !== 'entry')
      document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [entry, session]);

  function beginParticipation() {
    try {
      resetReading(window.sessionStorage);
      setProfile({ ...(repairSession?.profile ?? EMPTY_PROFILE) });
      navigateEntry('consent-summary');
    } catch {
      setError('无法保存本机阅读状态，请检查浏览器存储设置后重试。');
    }
  }

  function openFullConsent() {
    continuedFromSummary.current = true;
    navigateEntry('consent-full');
  }

  function guardedRegister(event: Parameters<typeof register>[0]) {
    let permitted = false;
    try {
      permitted = canEnterRegistration(readReceipt(window.sessionStorage));
    } catch {
      /* Fail closed. */
    }
    if (!permitted) {
      event.preventDefault();
      navigateEntry('consent-summary', true);
      return;
    }
    void register(event);
  }

  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    async function initialize() {
      if (formalMode) {
        const probe = 'ier-e2-formal-storage-check';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        const savedCredential = readFormalCredential(window.localStorage);
        credential.current = savedCredential;
        if (savedCredential) {
          const serverSaved = await loadFormal(savedCredential);
          const saved = restoreFormalDraft(window.sessionStorage, serverSaved);
          draftDirty.current = saved !== serverSaved;
          if (disposed) return;
          if (
            activeFormalParticipant(window.sessionStorage) ===
            savedCredential.participantId
          ) {
            sessionRef.current = saved;
            setSession(saved);
          } else setPausedSession(saved);
        }
        setReady(true);
        return;
      }
      repo.current = new LocalSessionRepository(window.localStorage);
      setReady(true);
      const activeId = window.sessionStorage.getItem(
        'ier-e2-active-participant',
      );
      const pausedId = window.localStorage.getItem('ier-e2-paused-participant');
      if (!activeId && pausedId)
        setPausedSession(repo.current.findByParticipant(pausedId));
      if (activeId) {
        const saved = repo.current.findByParticipant(activeId);
        if (saved) {
          if (
            !hasCompleteProfile(saved.profile) ||
            !isEligibleAge(saved.profile.ageGroup)
          ) {
            setRepairSession(saved);
            setProfile({ ...saved.profile });
            setSequence(saved.sequence);
            navigateEntry('register', true);
          } else {
            const resumed = repo.current.save(
              recordPageEvent(saved, 'resume'),
              saved.revision,
            );
            sessionRef.current = resumed;
            setSession(resumed);
          }
        }
      }
    }
    if (!navigator.locks && !formalMode) {
      queueMicrotask(() => {
        if (!disposed)
          setError(
            '当前浏览器不支持安全的单窗口试跑，请使用新版浏览器并通过本地网址访问。',
          );
      });
      return () => {
        disposed = true;
      };
    }
    if (!navigator.locks) {
      void initialize().catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : '无法恢复实验记录。');
      });
      return () => {
        disposed = true;
      };
    }
    // One live experiment tab per origin prevents competing writes from the same browser.
    void navigator.locks
      .request(
        formalMode ? 'ier-e2-formal-exclusive' : 'ier-e2-demo-exclusive',
        { ifAvailable: true },
        async (lock) => {
          if (disposed) return;
          if (!lock) {
            setError(
              `另一个标签页已打开${formalMode ? '实验平台' : '试跑平台'}。请关闭重复页面，再刷新本页。`,
            );
            return;
          }
          try {
            await initialize();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : formalMode
                  ? '无法连接实验数据服务，请稍后重试。'
                  : '当前浏览器无法访问本地存储，请更换浏览器后试跑。',
            );
          }
          await new Promise<void>((resolve) => {
            release = resolve;
            if (disposed) resolve();
          });
        },
      )
      .catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : '无法取得会话锁。');
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [formalMode, navigateEntry]);

  const commit = useCallback<Commit>(
    (fn) => {
      const previous = sessionRef.current;
      if (!previous || pending.current || remotePending.current) return false;
      let candidate: Session;
      try {
        candidate = fn(previous);
        if (candidate === previous) return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '当前操作无法完成。');
        return false;
      }
      if (formalMode) {
        if (!credential.current) {
          setError('当前设备缺少有效的恢复凭证，请联系研究人员。');
          return false;
        }
        const transaction: RemotePending = {
          candidate,
          previous,
          expectedRevision: previous.revision,
        };
        remotePending.current = transaction;
        setSavePending(true);
        void saveFormal(credential.current, candidate, previous.revision)
          .then((next) => {
            if (remotePending.current !== transaction) return;
            remotePending.current = null;
            sessionRef.current = next;
            setSession(next);
            setSavePending(false);
            draftDirty.current = false;
            draftCacheFailed.current = false;
            try { clearFormalDraft(window.sessionStorage, next); } catch { /* Stale revisions cannot restore. */ }
            setError('');
          })
          .catch((e) => {
            if (remotePending.current !== transaction) return;
            sessionRef.current = previous;
            setSession(previous);
            setSavePending(true);
            setError(
              `${e instanceof Error ? e.message : '服务器保存失败。'} 当前操作尚未提交，请重试。`,
            );
          });
        return true;
      }
      if (!repo.current) return false;
      const transaction = new PendingSave(candidate, previous.revision);
      try {
        const next = transaction.retry(repo.current);
        sessionRef.current = next;
        setSession(next);
        setError('');
        return true;
      } catch (e) {
        pending.current = transaction;
        setSavePending(true);
        setError(
          `${e instanceof Error ? e.message : '本机保存失败。'} 当前操作已保留在内存，尚未存入本机；请重试或导出应急备份，不要刷新页面。`,
        );
        return false;
      }
    },
    [formalMode],
  );

  const edit = useCallback<Commit>((fn) => {
    if (!formalMode) return commit(fn);
    const previous = sessionRef.current;
    if (!previous || remotePending.current) return false;
    try {
      const next = fn(previous);
      sessionRef.current = next;
      setSession(next);
      draftDirty.current = true;
      try { cacheFormalDraft(window.sessionStorage, next); draftCacheFailed.current = false; }
      catch { draftCacheFailed.current = true; setError('当前页答案保留在内存中，但无法创建刷新恢复副本，请完成本页并提交后再刷新。'); }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '当前作答无法记录。');
      return false;
    }
  }, [formalMode, commit]);

  useEffect(() => {
    if (!session) return;
    const hash = `#task/${encodeURIComponent(currentStep(session).id)}`;
    if (
      window.location.hash === hash &&
      window.history.state?.experimentSessionId === session.id
    )
      return;
    const method =
      window.history.state?.experimentSessionId === session.id
        ? 'pushState'
        : 'replaceState';
    window.history[method](
      { experimentSessionId: session.id },
      '',
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }, [session]);

  useEffect(() => {
    const restorePage = () => {
      const current = sessionRef.current;
      if (!current) return;
      let target = -1;
      try {
        const id = window.location.hash.startsWith('#task/')
          ? decodeURIComponent(window.location.hash.slice(6))
          : '';
        target = current.flow.findIndex((step) => step.id === id);
      } catch {
        /* Invalid hash returns to the persisted page. */
      }
      if (
        target >= 0 &&
        target <= current.furthestCursor &&
        !pending.current &&
        commit((s) => navigateToStep(s, target))
      )
        return;
      window.history.replaceState(
        { experimentSessionId: current.id },
        '',
        `${window.location.pathname}${window.location.search}#task/${encodeURIComponent(currentStep(current).id)}`,
      );
    };
    window.addEventListener('popstate', restorePage);
    window.addEventListener('hashchange', restorePage);
    return () => {
      window.removeEventListener('popstate', restorePage);
      window.removeEventListener('hashchange', restorePage);
    };
  }, [commit]);

  function retrySave() {
    if (formalMode && remotePending.current && credential.current) {
      const transaction = remotePending.current;
      void saveFormal(
        credential.current,
        transaction.candidate,
        transaction.expectedRevision,
      )
        .then((next) => {
          if (remotePending.current !== transaction) return;
          remotePending.current = null;
          sessionRef.current = next;
          setSession(next);
          setSavePending(false);
          draftDirty.current = false;
          draftCacheFailed.current = false;
          try { clearFormalDraft(window.sessionStorage, next); } catch { /* Stale revisions cannot restore. */ }
          setError('');
        })
        .catch((e) => {
          setError(
            `${e instanceof Error ? e.message : '保存仍然失败。'} 请保持本页打开并再次重试。`,
          );
        });
      return;
    }
    if (!pending.current || !repo.current) return;
    try {
      const next = pending.current.retry(repo.current);
      pending.current = null;
      setSavePending(false);
      sessionRef.current = next;
      setSession(next);
      setError('');
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : '保存仍然失败。'} 应急备份包含尚未保存的操作。请先导出，勿刷新页面。`,
      );
    }
  }

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current || remotePending.current || draftCacheFailed.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  useEffect(() => {
    const visibility = () => {
      if (
        sessionRef.current &&
        currentStep(sessionRef.current).kind !== 'complete'
      )
        edit((s) =>
          recordPageEvent(s, document.hidden ? 'page_hidden' : 'page_visible'),
        );
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [edit]);
  const sessionCursor = session?.cursor;
  useEffect(() => {
    if (sessionCursor === undefined) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [sessionCursor]);

  // Read-only researcher aid. No tool can generate answers or submit a trial.
  useEffect(() => {
    if (formalMode) return;
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => object;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'get_local_demo_progress',
            description:
              '只读查看当前本地试跑阶段与完成数量；不返回个人信息、回复或评分，不代替参与者作答。',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object.');
              const s = sessionRef.current;
              return {
                mode: 'local-demo',
                connectedToBackend: false,
                stage: s ? currentStep(s).kind : 'entry',
                formalCompleted: s
                  ? Object.values(s.trials).filter(
                      (t) => t.phase === 'formal' && t.sentAt !== null,
                    ).length
                  : 0,
                formalTotal: 6,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability; the human flow is unaffected. */
    }
    return () => lifecycle.abort();
  }, [formalMode]);

  function openSession(s: Session) {
    if (formalMode)
      setActiveFormalParticipant(
        window.sessionStorage,
        s.profile.participantId,
      );
    else {
      window.sessionStorage.setItem(
        'ier-e2-active-participant',
        s.profile.participantId,
      );
      window.localStorage.removeItem('ier-e2-paused-participant');
    }
    setPausedSession(null);
    sessionRef.current = s;
    setSession(s);
    setError('');
  }
  async function resumePaused() {
    try {
      if (!pausedSession) return;
      if (formalMode) {
        if (!credential.current)
          throw new Error('当前设备缺少有效的恢复凭证，请联系研究人员。');
        const saved = await loadFormal(credential.current);
        const restored = restoreFormalDraft(window.sessionStorage, saved);
        draftDirty.current = restored !== saved;
        openSession(restored);
        return;
      }
      if (!repo.current) return;
      const saved = repo.current.findByParticipant(
        pausedSession.profile.participantId,
      );
      if (!saved) throw new Error('暂存记录不存在，请联系研究人员。');
      if (
        !hasCompleteProfile(saved.profile) ||
        !isEligibleAge(saved.profile.ageGroup)
      ) {
        setRepairSession(saved);
        setProfile({ ...saved.profile });
        setSequence(saved.sequence);
        navigateEntry('register');
        return;
      }
      openSession(
        repo.current.save(recordPageEvent(saved, 'resume'), saved.revision),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '暂存任务无法恢复，请保留浏览器数据。',
      );
    }
  }
  async function register(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      if (hasCompleteProfile(profile) && !isEligibleAge(profile.ageGroup)) {
        setIneligible(true);
        setError('');
        return;
      }
      if (formalMode) {
        setSavePending(true);
        const normalized = {
          ...profile,
          participantId: profile.participantId.trim().toUpperCase(),
        };
        const started = await startFormal(normalized);
        const nextCredential = {
          participantId: started.session.profile.participantId,
          resumeToken: started.resumeToken,
        };
        credential.current = nextCredential;
        try {
          writeFormalCredential(window.localStorage, nextCredential);
        } catch {
          openSession(started.session);
          throw new Error(
            '实验记录已创建，但本机无法保存恢复凭证。请保持本页打开并立即联系研究人员。',
          );
        }
        openSession(started.session);
        setSavePending(false);
        return;
      }
      if (!repo.current) throw new Error('本地存储尚未就绪。');
      if (repairSession) {
        const corrected = updateRegisteredProfile(repairSession, profile);
        const resumed = repo.current.save(
          recordPageEvent(corrected, 'resume'),
          repairSession.revision,
        );
        openSession(resumed);
        setRepairSession(null);
        return;
      }
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const created = createSession(
        {
          ...profile,
          participantId: profile.participantId.trim().toUpperCase(),
        },
        sequence || null,
        seed,
      );
      openSession(repo.current.create(created));
    } catch (e) {
      setSavePending(false);
      setError(e instanceof Error ? e.message : '无法保存登记，请重试。');
    }
  }
  function exportData(kind: 'json' | 'trials' | 'surveys' | 'blind') {
    const s = sessionRef.current;
    if (!s) return;
    const prefix =
      kind === 'blind'
        ? 'demo-blind-responses'
        : `demo-${s.profile.participantId}`;
    const content =
      kind === 'json'
        ? (pending.current?.backup() ?? backupJSON(s))
        : kind === 'trials'
          ? trialCSV(s)
          : kind === 'surveys'
            ? surveyCSV(s)
            : blindCSV(s);
    downloadFile(
      `${prefix}-${kind}.${kind === 'json' ? 'json' : 'csv'}`,
      content,
      kind === 'json' ? 'application/json;charset=utf-8' : undefined,
    );
  }
  async function exitSession(keepPaused = true) {
    if (pending.current || remotePending.current) {
      setError(
        `仍有未成功保存的操作，请先重试${formalMode ? '。' : '或导出应急备份。'}`,
      );
      setExitOpen(false);
      return;
    }
    try {
      if (formalMode) {
        if (keepPaused && draftDirty.current && sessionRef.current && credential.current) {
          const previous = sessionRef.current;
          remotePending.current = { candidate: previous, previous, expectedRevision: previous.revision };
          setSavePending(true);
          const saved = await saveFormal(credential.current, previous, previous.revision);
          remotePending.current = null;
          sessionRef.current = saved;
          setSession(saved);
          draftDirty.current = false;
          draftCacheFailed.current = false;
          setSavePending(false);
          try { clearFormalDraft(window.sessionStorage, saved); } catch { /* Stale revisions cannot restore. */ }
        }
        if (
          keepPaused &&
          sessionRef.current &&
          currentStep(sessionRef.current).kind !== 'complete'
        )
          setPausedSession(sessionRef.current);
        else {
          clearFormalCredential(window.localStorage);
          credential.current = null;
          setPausedSession(null);
        }
        clearActiveFormalParticipant(window.sessionStorage);
      } else if (
        keepPaused &&
        sessionRef.current &&
        currentStep(sessionRef.current).kind !== 'complete'
      ) {
        window.localStorage.setItem(
          'ier-e2-paused-participant',
          sessionRef.current.profile.participantId,
        );
        setPausedSession(sessionRef.current);
      } else {
        window.localStorage.removeItem('ier-e2-paused-participant');
        setPausedSession(null);
      }
      if (!formalMode)
        window.sessionStorage.removeItem('ier-e2-active-participant');
      sessionRef.current = null;
      setSession(null);
      navigateEntry('entry');
      setExitOpen(false);
    } catch {
      setError('当前页尚未保存成功，请保持页面打开并重试保存。');
      setExitOpen(false);
      setExitOpen(false);
    }
  }
  function deleteSession() {
    try {
      if (sessionRef.current) repo.current?.remove(sessionRef.current);
      setDeleteOpen(false);
      void exitSession(false);
    } catch {
      setError('清除失败，原记录可能仍在。');
    }
  }

  const step = session ? currentStep(session) : null;
  const isMeasurementPage = !!step && itemsForStep(step).length > 0;
  const isEntryPage = !session && entry === 'entry';
  const isConsentPage =
    !session && (entry === 'consent-summary' || entry === 'consent-full');
  const done = session
    ? session.surveys.filter(
        (s) => s.stage === 'trialSurvey' && s.phase === 'formal',
      ).length
    : 0;

  return (
    <div
      className={`platform-shell login-shell ${session ? 'state-shell experiment-shell' : ''} ${isMeasurementPage ? 'measurement-shell' : ''} ${isConsentPage ? 'consent-shell' : ''} ${!session && entry === 'register' ? 'registration-shell' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        跳至主要内容
      </a>
      {!isEntryPage && (
        <header className="platform-header">
          <div className="wordmark">
            <MessageCircle aria-hidden="true" />
            <span>公益心理服务平台</span>
          </div>
          <div className="header-actions">
            <span className="demo-pill">
              {formalMode ? '正式实验' : '本地试跑版'}
            </span>
            {session && (
              <>
                <span className="participant-chip">
                  <UserRound size={15} />
                  {session.profile.participantId}
                </span>
                <Button
                  variant="ghost"
                  className="quiet-button"
                  onClick={() => setExitOpen(true)}
                >
                  <LogOut />
                  暂存退出
                </Button>
              </>
            )}
          </div>
        </header>
      )}

      {!session && entry === 'consent-summary' ? (
        <ConsentSummary
          onBack={() => navigateEntry('entry')}
          onContinue={openFullConsent}
        />
      ) : !session && entry === 'consent-full' ? (
        <ConsentFull
          onBack={() => navigateEntry('consent-summary')}
          onContinue={() => navigateEntry('register')}
        />
      ) : !session ? (
        <main
          id="main-content"
          tabIndex={-1}
          className={`entry-layout ${entry === 'register' ? 'registration-layout' : 'login-layout'}`}
        >
          <section className="entry-context">
            {isEntryPage && (
              <p className="research-badge">
                <span aria-hidden="true" />
                模拟实验 · 研究任务
              </p>
            )}
            <h1>公益心理服务平台</h1>
            {isEntryPage && (
              <>
                <p className="login-description">
                  这是一项模拟在线心理支持情境的研究。登录后，你将以‘心理服务志愿者’身份阅读平台呈现的对话信息，并完成相应的文字回复。任务过程中，平台会提供
                  AI 辅助信息，请根据页面提示使用。
                </p>
                <ol className="login-task-flow" aria-label="任务流程">
                  {['确认身份', '阅读实验说明', '完成支持任务', '提交实验'].map(
                    (label, i) => (
                      <li key={label}>
                        <span>{label}</span>
                        {i < 3 && <ArrowRight aria-hidden="true" />}
                      </li>
                    ),
                  )}
                </ol>
              </>
            )}
          </section>
          <section
            className="login-region"
            aria-label={isEntryPage ? '任务入口' : '信息登记'}
          >
            <div className="login-card">
              {entry === 'entry' ? (
                <>
                  <div className="supporter-identity">
                    <div className="supporter-identity-heading">
                      <span className="supporter-avatar">
                        <UserRound aria-hidden="true" />
                      </span>
                      <div>
                        <p className="supporter-identity-label">本次实验身份</p>
                        <h2 className="supporter-role">心理服务志愿者</h2>
                      </div>
                    </div>
                    <p className="supporter-duty">
                      你将负责阅读对话信息并提供文字情绪支持
                    </p>
                  </div>
                  <h3 className="task-entry-title">任务入口</h3>
                  <p className="task-entry-description">
                    首次参与前，请先完成信息登记。
                  </p>
                  {pausedSession && (
                    <div className="paused-task-entry">
                      <p>
                        {formalMode
                          ? '当前设备有一份已暂存的任务。'
                          : '本机有一份已暂存的任务。'}
                      </p>
                      <Button
                        type="button"
                        className="primary-action supporter-entry-button"
                        disabled={!ready || savePending}
                        onClick={() => void resumePaused()}
                      >
                        <span>
                          {formalMode ? '继续暂存任务' : '继续本机暂存任务'}
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    className="primary-action supporter-entry-button"
                    disabled={!ready}
                    onClick={beginParticipation}
                  >
                    <span>首次参与，完成信息登记</span>
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </>
              ) : ineligible ? (
                <section
                  className="registration-ineligible"
                  aria-label="参与条件说明"
                >
                  <p className="eyebrow">首次登记</p>
                  <h2>参与条件说明</h2>
                  <p role="alert">{AGE_INELIGIBLE_MESSAGE}</p>
                  <Button
                    type="button"
                    className="primary-action supporter-entry-button"
                    onClick={() => navigateEntry('entry')}
                  >
                    <span>返回入口</span>
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </section>
              ) : (
                <form className="registration-form" onSubmit={guardedRegister}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="back-button"
                    onClick={() => navigateEntry('entry')}
                  >
                    <ArrowLeft />
                    返回入口
                  </Button>
                  <p className="eyebrow">首次登记</p>
                  <h2>完善基本信息</h2>
                  <p className="registration-description">
                    请根据实际情况填写以下信息。
                  </p>
                  {repairSession && (
                    <p className="notice-text">
                      本机旧登记的性别或年龄需要重新选择。原作答与进度会保留。
                    </p>
                  )}
                  <div className="registration-fields">
                    <div className="registration-field">
                      <label className="field-label" htmlFor="new-code">
                        被试编号
                      </label>
                      <Input
                        className="text-input"
                        id="new-code"
                        value={profile.participantId}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            participantId: e.target.value,
                          })
                        }
                        placeholder="例如 D001"
                        pattern="[A-Za-z][0-9]{3}"
                        maxLength={4}
                        readOnly={!!repairSession}
                        required
                      />
                    </div>
                    <div className="registration-demographics">
                      <RegistrationSelect
                        id="gender"
                        open={openRegistrationSelect === 'gender'}
                        onOpenChange={(open) => setOpenRegistrationSelect(open ? 'gender' : null)}
                        label="性别"
                        value={profile.gender}
                        options={GENDER_OPTIONS}
                        onChange={(gender) =>
                          setProfile({ ...profile, gender })
                        }
                      />
                      <RegistrationSelect
                        id="age-group"
                        open={openRegistrationSelect === 'age-group'}
                        onOpenChange={(open) => setOpenRegistrationSelect(open ? 'age-group' : null)}
                        label="年龄"
                        value={profile.ageGroup}
                        options={AGE_OPTIONS}
                        onChange={(ageGroup) =>
                          setProfile({ ...profile, ageGroup })
                        }
                      />
                    </div>
                    <RegistrationSelect
                      id="psychology-study-duration"
                      open={openRegistrationSelect === 'psychology-study-duration'}
                      onOpenChange={(open) => setOpenRegistrationSelect(open ? 'psychology-study-duration' : null)}
                      label="心理学学习经历"
                      description="截至目前，您接受系统心理学专业教育的累计时间约为多久？"
                      value={profile.psychologyStudyDuration ?? ''}
                      options={PSYCHOLOGY_STUDY_DURATION_OPTIONS}
                      onChange={(psychologyStudyDuration) =>
                        setProfile({ ...profile, psychologyStudyDuration })
                      }
                    />
                    <RegistrationSelect
                      id="ai-experience"
                      open={openRegistrationSelect === 'ai-experience'}
                      onOpenChange={(open) => setOpenRegistrationSelect(open ? 'ai-experience' : null)}
                      label="总体而言，您平时使用生成式AI工具的频率如何？"
                      description="例如 ChatGPT、DeepSeek、Kimi、豆包、通义千问等。"
                      value={profile.aiUseFrequency ? String(profile.aiUseFrequency) : ''}
                      options={AI_EXPERIENCE_OPTIONS}
                      onChange={(value) =>
                        setProfile({ ...profile, aiUseFrequency: value ? Number(value) : null })
                      }
                    />
                  </div>
                  {!formalMode && (
                    <Collapsible
                      className="research-options"
                      open={researchOpen}
                      onOpenChange={setResearchOpen}
                    >
                      <CollapsibleTrigger className="research-trigger">
                        <SlidersHorizontal size={15} />
                        研究者试跑设置
                        <ChevronDown size={15} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="notice-text">
                          仅用于检查四种程序顺序。正式实验由后台分配，不由被试选择。
                        </p>
                        <RegistrationSelect
                          id="sequence"
                          open={openRegistrationSelect === 'sequence'}
                          onOpenChange={(open) => setOpenRegistrationSelect(open ? 'sequence' : null)}
                          label="本次预览顺序"
                          value={sequence}
                          options={PREVIEW_SEQUENCE_OPTIONS}
                          onChange={setSequence}
                          required={false}
                          disabled={!!repairSession}
                          placeholder="随机预览（不保证全样本平衡）"
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  <Button
                    type="submit"
                    className="primary-action supporter-entry-button"
                    disabled={!ready || savePending}
                  >
                    <span>
                      {savePending
                        ? '正在创建实验记录…'
                        : repairSession
                          ? '保存信息，继续实验'
                          : '完成登记，进入前测'}
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </form>
              )}
              {error && (
                <div className="error-box" role="alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
              {entry === 'register' && (
                <div className="entry-footnote">
                  <LockKeyhole size={14} />
                  {formalMode
                    ? '无需真实姓名或密码 · 请准确填写研究人员提供的编号'
                    : '无需真实姓名或密码 · 仅本机保存'}
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        <>
          {!formalMode && (
            <div className="demo-notice">
              <span>试跑提示</span>
              事件、AI卡片与量表尚待审核，本版本不能用于正式采集。
            </div>
          )}
          <main id="main-content" className="workspace-layout">
            <aside className="workspace-sidebar" aria-label="实验进度">
              <p className="eyebrow">当前进度</p>
              <Progress
                value={(done / 6) * 100}
                className="study-progress"
                aria-label={`已完成${done}项正式任务，共6项`}
              />
              <p className="progress-caption">
                正式任务 <strong>{done}</strong> / 6
              </p>
              <ol className="stage-list">
                {[
                  ['登记与前测', 0],
                  ['第一区组', 1],
                  ['第二区组', 2],
                  ['结束评价', 3],
                ].map(([name, group]) => {
                  const currentGroup =
                    step!.kind === 'complete' || step!.kind === 'final'
                      ? 3
                      : (step!.block ??
                        (step!.kind === 'instructions' ? 1 : 0));
                  const active = group === currentGroup,
                    completed = Number(group) < Number(currentGroup);
                  return (
                    <li
                      key={name}
                      className={active ? 'active' : completed ? 'done' : ''}
                    >
                      <span className="stage-dot">
                        {completed ? <Check size={12} /> : Number(group) + 1}
                      </span>
                      <span>{name}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="sidebar-note">
                <MessageCircle size={20} />
                <p>
                  每段经历都独立呈现。
                  <br />
                  请用自己的话回应。
                </p>
              </div>
              <p className="local-save">
                <span />
                {savePending
                  ? '正在保存进度'
                  : formalMode
                    ? '完成本页后保存进度'
                    : '进度在本机暂存'}
              </p>
            </aside>
            <section className="work-content">
              {error && (
                <div className="error-box sticky-error" role="alert">
                  <AlertCircle size={18} />
                  <div>
                    {error}
                    {savePending && (
                      <Button variant="outline" onClick={retrySave}>
                        重试保存
                      </Button>
                    )}
                    {!formalMode && (
                      <Button variant="link" onClick={() => exportData('json')}>
                        {savePending
                          ? '导出应急备份（含未保存操作）'
                          : '导出当前备份'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {!formalMode &&
                session.legacyMeasurements &&
                step!.kind === 'pretest' && (
                  <p className="measurement-update-note">
                    流程与题目已更新，本次试跑从前测重新开始。旧量表答案已归档；原有编号、分配、事件顺序和已提交回复已保留。
                  </p>
                )}
              <fieldset
                disabled={savePending && step!.kind !== 'trial'}
                className="interaction-boundary"
                aria-label="当前实验操作"
              >
                {session.cursor > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="workflow-back"
                      disabled={savePending}
                    onClick={() =>
                      commit((s) => navigateToStep(s, s.cursor - 1))
                    }
                  >
                    <ArrowLeft aria-hidden="true" />
                    上一页
                  </Button>
                )}
                {step!.kind === 'trial' && (
                  <TrialScreen
                    key={step!.id}
                    session={session}
                    commit={commit}
                    edit={edit}
                    savePending={savePending}
                  />
                )}
                {isMeasurementPage && (
                  <MeasurementScreen
                    key={step!.id}
                    session={session}
                    commit={commit}
                    edit={edit}
                    disabled={savePending}
                  />
                )}
                {(step!.kind === 'instructions' ||
                  step!.kind === 'conditionIntro') && (
                  <InstructionScreen
                    session={session}
                    commit={commit}
                    paused={savePending}
                  />
                )}
                {step!.kind === 'formalIntro' && (
                  <FormalStartScreen commit={commit} />
                )}
                {step!.kind === 'transition' && (
                  <TransitionScreen
                    session={session}
                    commit={commit}
                    formalMode={formalMode}
                  />
                )}
                {step!.kind === 'complete' &&
                  (formalMode ? (
                    <section className="complete-panel">
                      <div className="completion-symbol">
                        <CheckCircle2 />
                      </div>
                      <p className="eyebrow">实验已完成</p>
                      <h1>感谢您的认真参与。</h1>
                      <p className="muted">
                        实验数据已成功提交。
                        <br />
                        请按照研究人员的指引完成后续安排。
                      </p>
                      <div className="completion-footer">
                        <Button
                          className="wide-button"
                          onClick={() => exitSession(false)}
                        >
                          结束并返回入口
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </div>
                    </section>
                  ) : (
                    <section className="complete-panel">
                      <div className="completion-symbol">
                        <CheckCircle2 />
                      </div>
                      <p className="eyebrow">本次试跑已完成</p>
                      <h1>感谢你的认真回应。</h1>
                      <p className="muted">
                        已完成2项练习与6项正式任务。
                        <br />
                        数据目前只在这台设备上，请导出后妥善保存。
                      </p>
                      <div className="export-actions">
                        <Button
                          className="wide-button"
                          onClick={() => exportData('json')}
                        >
                          <Download />
                          完整备份 JSON
                        </Button>
                        <Button
                          variant="outline"
                          className="wide-button"
                          onClick={() => exportData('trials')}
                        >
                          <Download />
                          回复与计时 CSV
                        </Button>
                        <Button
                          variant="outline"
                          className="wide-button"
                          onClick={() => exportData('surveys')}
                        >
                          <Download />
                          测量长表 CSV
                        </Button>
                        <Button
                          variant="outline"
                          className="wide-button"
                          onClick={() => exportData('blind')}
                        >
                          <Download />
                          盲评回复 CSV
                        </Button>
                      </div>
                      <p className="notice-text">
                        盲评文件不包含条件、AI卡片或被试编号。所有导出仍为演示数据，不是正式研究结果。
                      </p>
                      <div className="completion-footer">
                        <Button variant="ghost" onClick={() => exitSession()}>
                          返回入口
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteOpen(true)}
                        >
                          <Trash2 />
                          清除此会话
                        </Button>
                      </div>
                    </section>
                  ))}
              </fieldset>
            </section>
          </main>
        </>
      )}
      <footer
        className={`platform-footer ${isEntryPage || isConsentPage ? 'login-footer' : ''}`}
      >
        {isEntryPage || isConsentPage ? (
          <>
            <span>
              本平台仅用于模拟实验，不提供真实心理咨询或危机干预服务。
            </span>
            {formalMode && isEntryPage && (
              <Link className="researcher-export-link" href="/research">研究者登录</Link>
            )}
          </>
        ) : (
          <>
            <span>模拟支持场景，不提供临床诊断或心理治疗。</span>
            <span>
              {formalMode
                ? '正式实验 · 进度已连接研究数据后台'
                : '演示版 · 未连接研究数据后台'}
            </span>
          </>
        )}
      </footer>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>暂存并返回入口？</AlertDialogTitle>
            <AlertDialogDescription>
              {formalMode
                ? '已成功提交的进度会保存在研究服务器。可在当前设备的入口点击“继续暂存任务”恢复；回复计时会保留原起点，离开期间也会计入，并标记中断。'
                : '已成功保存的进度和草稿留在本机。可在入口点击“继续本机暂存任务”恢复；回复计时会保留原起点，离开期间也会计入，并标记中断。如有保存报错，请先导出备份。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留在当前页面</AlertDialogCancel>
            <AlertDialogAction onClick={() => exitSession()}>
              返回入口
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!formalMode && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>清除本机的这份试跑记录？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作只删除当前会话，不影响其他试跑。没有后台备份，未导出的记录将无法恢复。请先下载完整JSON。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>保留记录</AlertDialogCancel>
              <AlertDialogAction onClick={deleteSession}>
                确认清除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function TrialScreen({
  session,
  commit,
  edit,
  savePending,
}: {
  session: Session;
  commit: Commit;
  edit: Commit;
  savePending: boolean;
}) {
  const step = currentStep(session),
    t = session.trials[step.trialId!];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputText = t.draft;
  const [composing, setComposing] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const length = countCharacters(inputText);
  const isPractice = t.phase === 'practice';
  function changeDraft(value: string) {
    edit((s) => updateDraft(s, value));
  }
  function begin() {
    if (edit((s) => startReply(s)))
      window.setTimeout(
        () => textareaRef.current?.focus(),
        0,
      );
  }
  function send() {
    if (composing || savePending) return;
    const sentAt = Date.now();
    commit((s) =>
      s.trials[t.id]?.sentAt !== null
        ? s
        : submitReply(updateDraft(s, inputText, sentAt), t.id, sentAt),
    );
  }
  return (
    <>
      <TaskInstructionEntry onClick={() => setInstructionOpen(true)} />
      <Dialog open={instructionOpen} onOpenChange={setInstructionOpen}>
        <DialogContent className="instruction-modal" showCloseButton={false}>
          <TaskInstructionContent second={t.block === 2} />
          <DialogFooter>
            <Button
              className="wide-button"
              onClick={() => setInstructionOpen(false)}
            >
              关闭，继续任务
              <ArrowRight aria-hidden="true" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            第{t.block === 1 ? '一' : '二'}区组 ·{' '}
            {isPractice ? '练习任务' : '正式任务'}
          </p>
          <h2>{isPractice ? '先熟悉一下操作' : '阅读这段分享，给予回应'}</h2>
        </div>
        <span className="task-number">
          {isPractice ? '练习任务' : `${t.formalOrdinal} / 6`}
        </span>
      </div>
      {isPractice && (
        <p className="practice-note">
          本题只用于熟悉本区组的提示与操作，不计入正式结果。
        </p>
      )}
      <article className="event-panel">
        <div className="anonymous-profile">
          <span className="anonymous-avatar">
            <UserRound aria-hidden="true" />
          </span>
          <div>
            <h3>匿名用户 {t.anonymousId}#</h3>
            <p>分享了一段最近的经历</p>
          </div>
          <span className="anonymous-label">匿名分享</span>
        </div>
        <div className="event-body">
          <p>{t.eventText}</p>
        </div>
      </article>
      {t.sentAt !== null ? (
        <section className="reply-panel submitted-reply">
          <h3>已提交的回复</h3>
          <p>{t.reply}</p>
          <Button
            className="next-button"
            disabled={savePending}
            onClick={() => commit((s) => continueSubmittedTrial(s))}
          >
            下一步
            <ArrowRight aria-hidden="true" />
          </Button>
        </section>
      ) : (
        <>
          <AIAssistanceCard
            key={t.id}
            trialId={t.id}
            paragraphs={t.cardParagraphs}
            revealed={t.firstAIOpenedAt !== null}
            disabled={savePending}
            onReveal={() => edit((s) => toggleAI(s, true))}
          />
          {t.replyStartedAt === null ? (
            <div className="reply-start">
              <p>
                {t.firstAIOpenedAt === null
                  ? '请先调用AI辅助，再开始回复。'
                  : '你可以采纳、调整或不采用提示，请自主形成最终回复。'}
              </p>
              <Button
                className="start-reply-button"
                disabled={savePending || t.firstAIOpenedAt === null}
                onClick={begin}
              >
                开始回复
                <ArrowRight />
              </Button>
            </div>
          ) : (
            <section className="reply-panel">
              <div className="reply-heading">
                <label htmlFor="reply-input">你的回复</label>
                <span>请用自己的话回应</span>
              </div>
              <Textarea
                ref={textareaRef}
                id="reply-input"
                className="reply-input"
                value={inputText}
                disabled={savePending}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(e) => {
                  setComposing(false);
                  changeDraft(e.currentTarget.value);
                }}
                onChange={(e) => changeDraft(e.target.value)}
                placeholder="在这里写下你想对这位匿名用户说的话…"
                maxLength={1000}
                aria-describedby="reply-length"
              />
              <div className="reply-footer">
                <span
                  id="reply-length"
                  className={length > REPLY_MAX ? 'over-limit' : ''}
                >
                  {length} / {REPLY_MAX} 字
                  <span className="reply-min">
                    至少 {REPLY_MIN} 字，不计空白
                  </span>
                </span>
                <Button
                  className="send-button"
                  disabled={
                    savePending || composing || length < REPLY_MIN || length > REPLY_MAX
                  }
                  onClick={send}
                >
                  发送
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function TaskInstructionEntry({ onClick }: { onClick: () => void }) {
  return (
    <div className="task-instruction-access">
      <Button
        type="button"
        variant="outline"
        className="task-instruction-entry"
        onClick={onClick}
      >
        <BookOpenText aria-hidden="true" />
        任务说明
      </Button>
    </div>
  );
}

function TaskInstructionContent({ second }: { second: boolean }) {
  return (
    <>
      <DialogHeader>
        <div className="instruction-heading">
          <div className="entry-icon">
            <MessageCircle />
          </div>
          <DialogTitle className="instruction-title">
            {second ? '下一组任务说明' : '任务指导语'}
          </DialogTitle>
        </div>
        <DialogDescription>
          {second ? (
            '接下来AI提示提供的信息有所不同，操作方式保持一致。请先完成对应练习。'
          ) : (
            <>
              你将阅读匿名用户分享的日常经历，并以调节者的身份，自主组织一段目的为调节匿名用户情绪的文字回复。
              <br />
              你的任务是通过文字回复，为对方提供适当的情绪支持，尽可能缓解其当前的负性情绪。你不需要解决对方的全部现实问题，也不需要提供专业诊断或治疗建议。
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <ol className="instruction-list">
        <li>
          <span>1</span>
          <div>
            阅读分享<p>每条事件相互独立，请认真理解当前内容。</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            查看AI提示<p>提示仅供参考，你可以采纳、调整或不采用。</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            自主回应
            <p>
              点击“开始回复”后输入{REPLY_MIN}—{REPLY_MAX}
              字，完成后点击“发送”。
            </p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            完成记录
            <p>每项任务发送后，根据页面提示完成当下状态记录或任务评价。</p>
          </div>
        </li>
      </ol>
      <p className="notice-text">
        请勿输入任何真实个人信息。练习不提供优劣反馈，完成后同样需要填写任务评价。
      </p>
    </>
  );
}

function InstructionScreen({
  session,
  commit,
  paused,
}: {
  session: Session;
  commit: Commit;
  paused: boolean;
}) {
  const second = currentStep(session).kind === 'conditionIntro';
  const firstVisit = !second && session.furthestCursor === session.cursor;
  const [closing, setClosing] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const entryRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  function continueTask() {
    if (closing || paused) return;
    if (
      !firstVisit ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      commit((s) => continueInfo(s));
      return;
    }
    const card = document.querySelector<HTMLElement>('.instruction-modal');
    const target = entryRef.current?.querySelector<HTMLElement>(
      '.task-instruction-entry',
    );
    if (!card || !target) {
      commit((s) => continueInfo(s));
      return;
    }
    const sourceRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    card.style.setProperty(
      '--instruction-shift-x',
      `${targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2}px`,
    );
    card.style.setProperty(
      '--instruction-shift-y',
      `${targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2}px`,
    );
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      if (!commit((s) => continueInfo(s))) setClosing(false);
    }, 220);
  }
  return (
    <>
      <div ref={entryRef}>
        <TaskInstructionEntry onClick={() => setReopenOpen(true)} />
      </div>
      <section className="info-panel">
        <p className="eyebrow">{second ? '第二区组' : '正式开始之前'}</p>
        <h2>{second ? '准备体验下一组任务' : '接下来，你将作为心理服务志愿者'}</h2>
        <p className="muted">先完成一次练习，熟悉本区组的AI提示与操作。</p>
        {second && (
          <p className="muted">
            接下来AI提示提供的信息有所不同，操作方式保持一致。请先完成对应练习。
          </p>
        )}
      </section>
      {firstVisit ? (
        <Dialog open={!paused} onOpenChange={() => {}}>
          <DialogContent
            className={`instruction-modal${closing ? ' instruction-closing' : ''}`}
            showCloseButton={false}
          >
            <TaskInstructionContent second={second} />
            <DialogFooter>
              <Button
                className="wide-button"
                disabled={closing}
                onClick={continueTask}
              >
                我已了解，开始任务
                <ArrowRight aria-hidden="true" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="instruction-inline">
          <Button
            className="wide-button"
            onClick={continueTask}
            disabled={paused}
          >
            我已了解，开始任务
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
      {!firstVisit && (
        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent className="instruction-modal" showCloseButton={false}>
            <TaskInstructionContent second={second} />
            <DialogFooter>
              <Button
                className="wide-button"
                onClick={() => setReopenOpen(false)}
              >
                关闭，继续任务
                <ArrowRight aria-hidden="true" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function FormalStartScreen({ commit }: { commit: Commit }) {
  return (
    <section className="transition-panel">
      <div className="entry-icon">
        <MessageCircle />
      </div>
      <p className="eyebrow">区组任务</p>
      <h1>本区组任务即将开始</h1>
      <p className="muted">
        接下来将进入本区组的任务。开始前，请先记录您此刻的状态。
      </p>
      <Button
        className="wide-button"
        onClick={() => commit((s) => continueInfo(s))}
      >
        开始状态记录
        <ArrowRight />
      </Button>
    </section>
  );
}

function TransitionScreen({
  session,
  commit,
  formalMode,
}: {
  session: Session;
  commit: Commit;
  formalMode: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(
    0,
    Math.ceil(
      (TRANSITION_MS - (now - session.openedAt[currentStep(session).id])) /
        1000,
    ),
  );
  return (
    <section className="transition-panel">
      <div className="entry-icon">
        <Coffee />
      </div>
      <p className="eyebrow">第一区组已完成</p>
      <h1>稍作停顿。</h1>
      <p className="muted">
        请留在当前页面，暂时放下上一组的内容。
        <br />
        过渡结束后，将先进行下一组的练习。
      </p>
      <div className="transition-status">
        {remaining > 0
          ? `过渡剩余 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
          : '可以继续了'}
      </div>
      <Button
        className="wide-button"
        disabled={remaining > 0}
        onClick={() => commit((s) => continueInfo(s))}
      >
        进入第二组练习
        <ArrowRight />
      </Button>
      {remaining > 0 && (
        <Button
          variant="link"
          className="demo-skip"
          onClick={() => commit((s) => continueInfo(s, Date.now(), true))}
        >
          {formalMode ? '跳过休息，继续' : '仅试跑：跳过等待（会记录标记）'}
        </Button>
      )}
      <p className="notice-text">
        过渡时长为当前程序参数，尚待试跑确认；不代表可以消除策略迁移。
      </p>
    </section>
  );
}
