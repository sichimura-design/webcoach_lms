import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { color, font } from '../../theme/webcoachTheme';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLessonDoc } from '../../hooks/useLessonDoc';
import { useLessonCompletion } from '../../hooks/useLessonCompletion';
import { useLessonAi, LessonAiMessage, LessonAiQuote } from '../../hooks/useLessonAi';
import { useNotes } from '../../hooks/useNotes';
import { useTextSelection } from '../../hooks/useTextSelection';
import { NAV_WIDTH, useLearningWorkspaceStore } from '../../store/learningWorkspaceStore';
import { NoteItem } from '../../types/notes';
import { AiSkillId } from '../../types/aiSkill';
import { ClipAnchor } from './clipHighlight';
import LessonTopBar from './LessonTopBar';
import LessonNavDrawer from './LessonNavDrawer';
import LessonArticle from './LessonArticle';
import SupportPanel from './SupportPanel';
import AiCoachPane from './AiCoachPane';
import MemoPane from './MemoPane';
import SelectionToolbar from './SelectionToolbar';
import ExplainPopover from './ExplainPopover';

/**
 * レッスン学習ワークスペース（/course/:courseId?module=<lessonId>）。
 * 階層上は「コース ＞ 単元 ＞ レッスン」のレッスンを開く画面で、
 * レッスン本文を構成するコンテンツが教材（LessonBlock）にあたる。
 *
 * 旧 CourseContentPage の置き換え。「レッスン本文を主役にしながら、左の目次と
 * 右のAI・メモを必要なときだけ並列表示する」ことがこの画面の設計意図。
 * 左右のパネルは本文に重ねず、グリッドの列として開閉することで
 * 本文領域が自動的に伸縮する（要件§12の4状態）。
 *
 * このファイル自体は状態の集約に徹し、描画は learning/ 配下の各ペインへ委譲する。
 */
interface LearningWorkspacePageProps {
  courseId: number;
  initialModuleId?: number;
  onBack: () => void;
}

/** PCの並列表示に切り替える幅。これ未満はオーバーレイドロワー。 */
const DESKTOP_MIN_WIDTH = 1024;

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN_WIDTH
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isDesktop;
}

export function LearningWorkspacePage({ courseId, initialModuleId, onBack }: LearningWorkspacePageProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  const [lessonId, setLessonId] = useState<number | null>(initialModuleId ?? null);
  // SPの目次はオーバーレイなので、PCの「開いたまま」の好み（store の navOpen）とは別に持つ。
  // 共有すると、SPでは初期表示から本文がドロワーで覆われてしまう。
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [flashBlockId, setFlashBlockId] = useState<string | null>(null);
  const [explainState, setExplainState] = useState<
    { anchor: { top: number; left: number }; quote: LessonAiQuote; text: string | null } | null
  >(null);

  const scrollRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const navOpen = useLearningWorkspaceStore((s) => s.navOpen);
  const supportOpen = useLearningWorkspaceStore((s) => s.supportOpen);
  const supportWidth = useLearningWorkspaceStore((s) => s.supportWidth);
  const toggleNav = useLearningWorkspaceStore((s) => s.toggleNav);
  const setNavOpen = useLearningWorkspaceStore((s) => s.setNavOpen);
  const toggleSupport = useLearningWorkspaceStore((s) => s.toggleSupport);
  const setSupportOpen = useLearningWorkspaceStore((s) => s.setSupportOpen);
  const openSupport = useLearningWorkspaceStore((s) => s.openSupport);

  const { outline, doc, allLessonIds, loading, error, videoUrl } = useLessonDoc(courseId, lessonId);
  const ai = useLessonAi(doc);

  // 目次はPCでは常時表示（列として並ぶ）、SPではオーバーレイ。開閉の入口は
  // トップバーのボタン1つに集約する。
  const navShown = isDesktop ? navOpen : mobileNavOpen;
  const handleToggleNav = useCallback(() => {
    if (isDesktop) toggleNav();
    else setMobileNavOpen((v) => !v);
  }, [isDesktop, toggleNav]);
  const closeNav = useCallback(() => {
    if (isDesktop) setNavOpen(false);
    else setMobileNavOpen(false);
  }, [isDesktop, setNavOpen]);

  const notes = useNotes({
    lessonId: doc?.lessonId ?? null,
    query: useMemo(() => ({ lessonId: doc?.lessonId }), [doc?.lessonId]),
    withMemoDraft: true,
    context: doc
      ? {
          courseId: doc.courseId,
          courseName: doc.courseName,
          lessonId: doc.lessonId,
          lessonTitle: doc.title,
          heading: ai.contextHeading,
        }
      : undefined,
  });

  // 縮退モード（Moodleフォールバック）では本文が iframe の中にあり、
  // 選択範囲もブロックIDも取れないので選択操作そのものを無効にする。
  const selectionEnabled = doc?.source === 'structured';
  const { selection, clear: clearSelection } = useTextSelection(articleRef, selectionEnabled);

  const navigateToLesson = useCallback(
    (nextLessonId: number) => {
      setLessonId(nextLessonId);
      const next = new URLSearchParams(searchParams);
      next.set('module', String(nextLessonId));
      next.delete('block');
      setSearchParams(next, { replace: true });
      // SPのオーバーレイは選んだら閉じる。PCの目次は列なので開いたままでよい。
      if (!isDesktop) setMobileNavOpen(false);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [searchParams, setSearchParams, isDesktop]
  );

  const completion = useLessonCompletion(courseId, doc?.lessonId ?? null, allLessonIds, navigateToLesson);

  // ── この画面はビューポート高に固定するのでページスクロールを止める ──
  useEffect(() => {
    document.body.classList.add('learning-workspace');
    return () => document.body.classList.remove('learning-workspace');
  }, []);

  // ── スクロールに追従して「いま読んでいる見出し」を更新する ──
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !doc || doc.source !== 'structured') return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'));
    if (blocks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
        if (visible) ai.setContextHeading(visible.target.getAttribute('data-heading'));
      },
      { root, rootMargin: '-12% 0px -68% 0px', threshold: [0, 0.1, 0.5] }
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.lessonId, doc?.source]);

  // ── 指定ブロックへスクロールして一瞬光らせる ──
  const jumpToBlock = useCallback((blockId: string) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashBlockId(blockId);
    window.setTimeout(() => setFlashBlockId((id) => (id === blockId ? null : id)), 1400);
  }, []);

  // ── マイノートから ?block= 付きで戻ってきたときの復帰 ──
  const pendingBlock = searchParams.get('block');
  useEffect(() => {
    if (!pendingBlock || !doc || loading) return;
    const timer = window.setTimeout(() => {
      jumpToBlock(pendingBlock);
      const next = new URLSearchParams(searchParams);
      next.delete('block');
      setSearchParams(next, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBlock, doc?.lessonId, loading]);

  // ── 選択操作 ──
  const selectionToQuote = useCallback(
    (): LessonAiQuote | null =>
      selection
        ? {
            text: selection.text,
            blockId: selection.blockId,
            heading: selection.heading,
            contextBefore: selection.contextBefore,
            contextAfter: selection.contextAfter,
          }
        : null,
    [selection]
  );

  const handleExplain = useCallback(async () => {
    const quote = selectionToQuote();
    if (!selection || !quote) return;
    setExplainState({
      anchor: { top: selection.rect.bottom + 10, left: selection.rect.left },
      quote,
      text: null,
    });
    clearSelection();
    const text = await ai.explain(quote);
    setExplainState((prev) => (prev ? { ...prev, text } : prev));
  }, [selection, selectionToQuote, clearSelection, ai]);

  const handleAsk = useCallback(
    (quoteOverride?: LessonAiQuote) => {
      const quote = quoteOverride ?? selectionToQuote();
      if (!quote) return;
      ai.setQuote(quote);
      openSupport('ai');
      clearSelection();
      setExplainState(null);
      window.getSelection()?.removeAllRanges();
    },
    [selectionToQuote, ai, openSupport, clearSelection]
  );

  const handleClip = useCallback(async () => {
    if (!selection || !doc) return;
    const created = await notes.createNote({
      kind: 'clip',
      courseId: doc.courseId,
      courseName: doc.courseName,
      lessonId: doc.lessonId,
      lessonTitle: doc.title,
      blockId: selection.blockId,
      heading: selection.heading,
      text: selection.text,
      question: null,
      selectedText: null,
      image: null,
      offset: selection.offset,
    });
    clearSelection();
    window.getSelection()?.removeAllRanges();
    showToast(created ? '教材をクリップしました' : 'クリップに失敗しました', created ? 'success' : 'error');
  }, [selection, doc, notes, clearSelection, showToast]);

  // ── AI回答の保存／メモ追加 ──
  const questionFor = useCallback(
    (message: LessonAiMessage): { question: string; quote: string | null; image: string | null } => {
      const index = ai.messages.findIndex((m) => m.id === message.id);
      for (let i = index - 1; i >= 0; i -= 1) {
        if (ai.messages[i].role === 'user') {
          return {
            question: ai.messages[i].content,
            quote: ai.messages[i].quote ?? null,
            image: ai.messages[i].image ?? null,
          };
        }
      }
      return { question: '', quote: null, image: null };
    },
    [ai.messages]
  );

  // 通常回答と専門モードの結果は形が違うので、ノートへ残すテキストもそれぞれ組み立てる。
  const answerToText = useCallback((message: LessonAiMessage): string => {
    const a = message.answer;
    if (a) {
      return [
        `結論：${a.conclusion}`,
        a.basis && `教材の根拠：${a.basis}`,
        a.apply && `今回のケースへの当てはめ：${a.apply}`,
        a.next && `次にやること：${a.next}`,
        a.generalNote && `教材外の一般的な補足：${a.generalNote}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const s = message.skillResult;
    if (!s) return '';
    return [
      `全体講評：${s.summary}`,
      ...s.findings.map((f) => `【${f.label}】${f.comment}${f.basis ? `\n  ${f.basis}` : ''}`),
      s.revision && `修正案：\n${s.revision}`,
      s.next && `次にやること：${s.next}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, []);

  const handleSaveAnswer = useCallback(
    async (message: LessonAiMessage) => {
      if (!doc || (!message.answer && !message.skillResult)) return;
      const { question, quote, image } = questionFor(message);
      const sources = message.answer?.sources ?? message.skillResult?.sources ?? [];
      const created = await notes.createNote({
        kind: 'answer',
        courseId: doc.courseId,
        courseName: doc.courseName,
        lessonId: doc.lessonId,
        lessonTitle: doc.title,
        blockId: sources[0]?.blockId ?? null,
        heading: sources[0]?.heading ?? ai.contextHeading,
        text: answerToText(message),
        question,
        selectedText: quote,
        image,
        offset: null,
      });
      showToast(created ? '質問と回答を保存しました' : '保存に失敗しました', created ? 'success' : 'error');
    },
    [doc, questionFor, notes, ai.contextHeading, answerToText, showToast]
  );

  const handleAppendToMemo = useCallback(
    (message: LessonAiMessage) => {
      const { question } = questionFor(message);
      notes.appendToMemo(question, answerToText(message));
      openSupport('split');
      showToast('AI回答をメモへ追加しました', 'success');
    },
    [questionFor, notes, answerToText, openSupport, showToast]
  );

  /**
   * AI専用ページへ拡大する（要件§5）。
   * 会話は aiCoachStore にあるので、セッションIDだけ渡せば会話・添付画像・
   * 専門モードがそのまま引き継がれる。SPA遷移なのでメモリ上の状態は生きたまま。
   */
  const handleExpandToAiPage = useCallback(() => {
    navigate(`/ai-coach?session=${encodeURIComponent(ai.sessionId)}`);
  }, [navigate, ai.sessionId]);

  /**
   * 提案カードの「広い画面で開く」（要件§「教材学習画面との接続」）。
   * ここでは実行せず、モードだけ切り替えてAI専用ページへ渡す。
   * 教材・課題の評価基準・添付画像・直前の会話はセッションに載っているので、
   * 向こう側は「制作物添削を選択済み・参照済み」の状態で開く。
   */
  const handleOpenWideWithSkill = useCallback(
    (skillId: AiSkillId) => {
      ai.selectSkill(skillId);
      navigate(`/ai-coach?session=${encodeURIComponent(ai.sessionId)}`);
    },
    [ai, navigate]
  );

  const handleJumpToClip = useCallback(
    (note: NoteItem) => {
      if (note.blockId) jumpToBlock(note.blockId);
    },
    [jumpToBlock]
  );

  // ── 完了ボタン。完了済みなら次へ進むだけにする（旧実装と同じ挙動）──
  const handleComplete = useCallback(() => {
    if (completion.isCompleted) {
      if (doc?.next) navigateToLesson(doc.next.lessonId);
      else onBack();
      return;
    }
    void completion.toggleComplete(true);
  }, [completion, doc?.next, navigateToLesson, onBack]);

  // ── Esc でオーバーレイを閉じる ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setExplainState(null);
      clearSelection();
      if (!isDesktop) {
        setMobileNavOpen(false);
        setSupportOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, isDesktop, setSupportOpen]);

  const clipAnchors: ClipAnchor[] = useMemo(
    () =>
      notes.items
        .filter((n) => n.kind === 'clip' && n.blockId && n.lessonId === doc?.lessonId)
        .map((n) => ({ id: n.id, blockId: n.blockId as string, text: n.text, offset: n.offset })),
    [notes.items, doc?.lessonId]
  );

  const flatLessons = outline?.sections.flatMap((s) => s.lessons) ?? [];
  const doneCount = flatLessons.filter(
    (l) => completion.completedIds.has(l.lessonId) || l.state === 'done'
  ).length;
  const progressPercent = flatLessons.length ? Math.round((doneCount / flatLessons.length) * 100) : 0;

  // パンくずに出す単元名。いま開いているレッスンが属する単元を目次から引く。
  const currentUnitName =
    outline?.sections.find((s) => s.lessons.some((l) => l.lessonId === doc?.lessonId))?.name ?? '';

  // 要件§12の4状態は、この1行のグリッド定義がすべて担う。
  const gridTemplateColumns = isDesktop
    ? `${navShown ? NAV_WIDTH : 0}px minmax(0, 1fr) ${supportOpen ? supportWidth : 0}px`
    : 'minmax(0, 1fr)';

  const navDrawer = (
    <LessonNavDrawer
      outline={outline}
      currentLessonId={doc?.lessonId ?? null}
      completedIds={completion.completedIds}
      onSelect={navigateToLesson}
      onClose={closeNav}
      mobile={!isDesktop}
    />
  );

  const supportPanel = (
    <SupportPanel
      mobile={!isDesktop}
      onClose={() => setSupportOpen(false)}
      aiPane={
        <AiCoachPane
          ai={ai}
          onSaveAnswer={handleSaveAnswer}
          onAppendToMemo={handleAppendToMemo}
          onJumpToBlock={jumpToBlock}
          disabled={!selectionEnabled}
          onExpand={handleExpandToAiPage}
          onOpenWide={handleOpenWideWithSkill}
        />
      }
      memoPane={
        <MemoPane notes={notes} lessonTitle={doc?.title ?? ''} onJumpToClip={handleJumpToClip} />
      }
    />
  );

  return (
    <div style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="wc-learning-shell" style={{ display: 'grid', gridTemplateRows: '56px minmax(0, 1fr)' }}>
        <LessonTopBar
          courseName={outline?.courseName ?? doc?.courseName ?? ''}
          unitName={currentUnitName}
          lessonTitle={doc?.title ?? ''}
          progressPercent={progressPercent}
          doneCount={doneCount}
          totalCount={flatLessons.length}
          navOpen={navShown}
          supportOpen={supportOpen}
          isCompleted={completion.isCompleted}
          completing={completion.completing}
          courseId={courseId}
          lessonId={doc?.lessonId ?? null}
          onToggleNav={handleToggleNav}
          onToggleSupport={toggleSupport}
          onComplete={handleComplete}
          onBackToCourse={onBack}
        />

        <div style={{ display: 'grid', gridTemplateColumns, minHeight: 0, transition: 'grid-template-columns .24s ease' }}>
          {isDesktop && <div style={{ overflow: 'hidden', minWidth: 0 }}>{navShown && navDrawer}</div>}

          <main ref={scrollRef} style={{ overflowY: 'auto', minWidth: 0, scrollBehavior: 'smooth' }}>
            {loading && (
              <div className="flex items-center justify-center" style={{ height: '100%' }}>
                <span
                  className="animate-spin rounded-full"
                  style={{ width: 34, height: 34, borderBottom: `2px solid ${color.primary}` }}
                />
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 14 }}>
                <p style={{ ...font.label, color: color.primary, margin: 0 }}>{error}</p>
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    padding: '10px 22px', borderRadius: 999, border: 'none',
                    background: color.primary, color: '#fff', ...font.buttonSm, cursor: 'pointer',
                  }}
                >
                  コースに戻る
                </button>
              </div>
            )}

            {!loading && !error && doc && (
              <LessonArticle
                doc={doc}
                articleRef={articleRef}
                clips={clipAnchors}
                flashBlockId={flashBlockId}
                videoUrl={videoUrl}
                isCompleted={completion.isCompleted}
                completing={completion.completing}
                onComplete={handleComplete}
                onUndoComplete={() => void completion.toggleComplete(false)}
                onNavigate={navigateToLesson}
                onBackToCourse={onBack}
              />
            )}
          </main>

          {isDesktop && <div style={{ overflow: 'hidden', minWidth: 0 }}>{supportOpen && supportPanel}</div>}
        </div>
      </div>

      {/* ── SP: 左右ともオーバーレイドロワー ── */}
      {!isDesktop && (mobileNavOpen || supportOpen) && (
        <div
          role="presentation"
          onClick={() => { setMobileNavOpen(false); setSupportOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'rgba(28,34,44,.22)' }}
        />
      )}
      {!isDesktop && mobileNavOpen && (
        <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 45, width: 'min(330px, 88vw)' }}>
          {navDrawer}
        </div>
      )}
      {!isDesktop && supportOpen && (
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 45, width: 'min(430px, 100vw)' }}>
          {supportPanel}
        </div>
      )}

      {/* ── 選択ツールバーと解説ポップオーバー ── */}
      {selection && !explainState && (
        <SelectionToolbar
          selection={selection}
          onExplain={() => void handleExplain()}
          onAsk={() => handleAsk()}
          onClip={() => void handleClip()}
        />
      )}
      {explainState && (
        <ExplainPopover
          anchor={explainState.anchor}
          text={explainState.text}
          loading={explainState.text === null}
          onClose={() => setExplainState(null)}
          onAskMore={() => handleAsk(explainState.quote)}
        />
      )}
    </div>
  );
}

export default LearningWorkspacePage;
