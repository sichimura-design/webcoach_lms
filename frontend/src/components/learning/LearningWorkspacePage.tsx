import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { color, font } from '../../theme/webcoachTheme';
import { useToast } from '../../contexts/ToastContext';
import { useLessonDoc } from '../../hooks/useLessonDoc';
import { useLessonCompletion } from '../../hooks/useLessonCompletion';
import { useLessonAi, LessonAiMessage, LessonAiQuote } from '../../hooks/useLessonAi';
import { useNotes } from '../../hooks/useNotes';
import { useNoteCapture } from '../../hooks/useNoteCapture';
import { useNoteList } from '../../hooks/useNoteList';
import { useTextSelection } from '../../hooks/useTextSelection';
import bffClient from '../../services/bffClient';
import { NoteSourceRef } from '../../types/notes';
import { AiSkillId } from '../../types/aiSkill';
import NoteTargetPicker from '../notes/NoteTargetPicker';
import { ClipAnchor } from './clipHighlight';
import LessonTopBar from './LessonTopBar';
import LessonArticle from './LessonArticle';
import LessonFloatingActions from './LessonFloatingActions';
import SupportPanel, { SupportTab } from './SupportPanel';
import AiCoachPane from './AiCoachPane';
import MemoPane from './MemoPane';
import SelectionToolbar from './SelectionToolbar';
import ExplainPopover from './ExplainPopover';

/**
 * レッスン学習ワークスペース（/course/:courseId?module=<lessonId>）。
 * 階層上は「コース ＞ 単元 ＞ レッスン」のレッスンを開く画面で、
 * レッスン本文を構成するコンテンツが教材（LessonBlock）にあたる。
 *
 * 【この画面が「ごちゃごちゃしている」と言われた理由と、その解き方】
 * 以前は「LMS全体のサイドバー」「開閉できるコース目次」「開閉できるAI/メモ」の
 * 3つが同時に本文と場所を取り合っていた。やれることが多いほど集中は切れるので、
 * 本文以外の常設要素をすべて外した:
 *   ・LMSのサイドバー（AppHeader）を描かない
 *   ・目次のドロワーを廃止し、「コースに戻る」1本にする
 *   ・AI/メモは右下のフローティングから必要なときだけオーバーレイで開く
 *
 * このファイル自体は状態の集約に徹し、描画は learning/ 配下の各ペインへ委譲する。
 */
interface LearningWorkspacePageProps {
  courseId: number;
  initialModuleId?: number;
  onBack: () => void;
}

export function LearningWorkspacePage({ courseId, initialModuleId, onBack }: LearningWorkspacePageProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lessonId, setLessonId] = useState<number | null>(initialModuleId ?? null);
  /**
   * AI／メモのオーバーレイ。
   * 🔴 永続化しない。以前は store（localStorage）に開閉状態を持っていたが、
   *    開いたまま離脱すると次に来たとき教材がパネルで覆われた状態から始まる。
   *    それがまさに「ごちゃごちゃしている」の正体だった。毎回閉じた状態で始める。
   */
  const [support, setSupport] = useState<{ open: boolean; tab: SupportTab }>({
    open: false,
    tab: 'ai',
  });
  const [flashBlockId, setFlashBlockId] = useState<string | null>(null);
  const [explainState, setExplainState] = useState<
    { anchor: { top: number; left: number }; quote: LessonAiQuote; text: string | null } | null
  >(null);

  const scrollRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const { outline, doc, allLessonIds, loading, error, videoUrl } = useLessonDoc(courseId, lessonId);
  const ai = useLessonAi(doc);

  const openSupport = useCallback((tab: SupportTab) => setSupport({ open: true, tab }), []);
  const closeSupport = useCallback(() => setSupport((s) => ({ ...s, open: false })), []);

  /** レッスンの下書き（自動保存）。ノート本体とは別物 */
  const notes = useNotes({ lessonId: doc?.lessonId ?? null });

  /** 取り込み（クリップ / AI回答 / 下書き）の共通入口。追加先の判断はここが持つ */
  const capture = useNoteCapture();

  /** このレッスンから触ったノート。メモ欄の入口として出す */
  const relatedNotes = useNoteList({ lessonId: doc?.lessonId });

  /** 取り込んだ内容にいつも付ける出どころ */
  const sourceOf = useCallback(
    (over?: Partial<NoteSourceRef>): NoteSourceRef | null =>
      doc
        ? {
            courseId: doc.courseId,
            courseName: doc.courseName,
            lessonId: doc.lessonId,
            lessonTitle: doc.title,
            heading: ai.contextHeading,
            blockId: null,
            offset: null,
            ...over,
          }
        : null,
    [doc, ai.contextHeading]
  );

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
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [searchParams, setSearchParams]
  );

  const completion = useLessonCompletion(courseId, doc?.lessonId ?? null, allLessonIds, navigateToLesson);

  /**
   * ページスクロールを止め、LMSのシェル（サイドバー・SP下部ナビ）ぶんの余白も消す。
   *
   * 🔴 learning-immersive は AppHeader を描かないことの後始末。
   *    index.css の body 余白（SP下部ナビ用の 64px）と .wc-learning-shell の
   *    height 計算はナビがある前提で書かれているので、この画面だけ打ち消す。
   */
  useEffect(() => {
    document.body.classList.add('learning-workspace', 'learning-immersive');
    return () => document.body.classList.remove('learning-workspace', 'learning-immersive');
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
    const source = sourceOf({
      blockId: selection.blockId,
      heading: selection.heading,
      offset: selection.offset,
    });
    if (!source) return;
    clearSelection();
    window.getSelection()?.removeAllRanges();
    // 追加先が未定なら capture.pending が立ち、下でピッカーが出る
    await capture.capture({
      block: { kind: 'clip', text: selection.text, source },
      suggestedTitle: doc.title,
      source,
      lessonId: doc.lessonId,
    });
    void relatedNotes.reload();
  }, [selection, doc, sourceOf, capture, clearSelection, relatedNotes]);

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
      const source = sourceOf({
        blockId: sources[0]?.blockId ?? null,
        heading: sources[0]?.heading ?? ai.contextHeading,
      });
      await capture.capture({
        block: {
          kind: 'answer',
          question,
          answer: answerToText(message),
          selectedText: quote,
          image,
          source,
        },
        suggestedTitle: doc.title,
        source,
        lessonId: doc.lessonId,
      });
      void relatedNotes.reload();
    },
    [doc, questionFor, sourceOf, ai.contextHeading, answerToText, capture, relatedNotes]
  );

  /** 下書きをノートの本文として残す。編集してから取り込みたい人の経路 */
  const handleKeepDraft = useCallback(async () => {
    const text = notes.memoDraft.trim();
    if (!text || !doc) return;
    const source = sourceOf();
    const ok = await capture.capture({
      block: { kind: 'text', text },
      suggestedTitle: doc.title,
      source,
      lessonId: doc.lessonId,
    });
    // ピッカーが出ている間は下書きを消さない。選び終えるまで内容を失わせない
    if (ok) notes.setMemoDraft('');
    void relatedNotes.reload();
  }, [notes, doc, sourceOf, capture, relatedNotes]);

  const handleAppendToMemo = useCallback(
    (message: LessonAiMessage) => {
      const { question } = questionFor(message);
      notes.appendToMemo(question, answerToText(message));
      openSupport('notes');
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

  // ── 完了ボタン。完了済みなら次へ進むだけにする（旧実装と同じ挙動）──
  const handleComplete = useCallback(() => {
    if (completion.isCompleted) {
      if (doc?.next) navigateToLesson(doc.next.lessonId);
      else onBack();
      return;
    }
    void completion.toggleComplete(true);
  }, [completion, doc?.next, navigateToLesson, onBack]);

  // ── Esc でオーバーレイを閉じる（PC/SPで挙動を分けない）──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setExplainState(null);
      clearSelection();
      closeSupport();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, closeSupport]);

  /**
   * 本文に <mark> を当て直すためのクリップ位置。
   * 🔴 専用の軽量エンドポイントから取る。ノートが器＋ブロックになったので、
   *    ハイライトを描くためだけに全ノートの全ブロックを引くのは無駄が大きい。
   */
  const [clipAnchors, setClipAnchors] = useState<ClipAnchor[]>([]);
  useEffect(() => {
    const lessonId = doc?.lessonId;
    if (!lessonId) {
      setClipAnchors([]);
      return;
    }
    let alive = true;
    bffClient
      .listNoteClips(lessonId)
      .then((refs) => {
        if (!alive) return;
        setClipAnchors(
          refs.map((r) => ({ id: r.blockId, blockId: r.sourceBlockId, text: r.text, offset: r.offset }))
        );
      })
      .catch(() => alive && setClipAnchors([]));
    return () => {
      alive = false;
    };
    // relatedNotes.items が変わる＝このレッスンのノートが増減したとき取り直す
  }, [doc?.lessonId, relatedNotes.items]);

  const flatLessons = outline?.sections.flatMap((s) => s.lessons) ?? [];
  /**
   * トップバーの「レッスン 5 / 9」。
   * 🔴 完了数ではなく“位置”で数える。以前は完了数だったので、
   *    5番目を開いていても完了が2件なら「2 / 9」と出て数字と現在地が食い違っていた。
   *    完了率はコーストップ側だけで見せる。
   */
  const lessonIndex = flatLessons.findIndex((l) => l.lessonId === doc?.lessonId) + 1;

  return (
    <div style={{ background: color.pageBg }}>
      {/* 🔴 AppHeader（LMSのサイドバー）はここでは描かない。
          教材に入ったらLMSの外枠は不要、というレビュー方針。
          サイドバーの余白は AppHeader 自身の effect が付けているので、
          描かなければ自動的に消える。 */}
      <div className="wc-learning-shell" style={{ display: 'grid', gridTemplateRows: '56px minmax(0, 1fr)' }}>
        <LessonTopBar
          courseName={outline?.courseName ?? doc?.courseName ?? ''}
          lessonIndex={lessonIndex > 0 ? lessonIndex : null}
          lessonTotal={flatLessons.length}
          courseId={courseId}
          lessonId={doc?.lessonId ?? null}
          onBackToCourse={onBack}
        />

        {/* 目次の列もサポートの列も無くなったので、本文が唯一のスクロールコンテナ */}
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
      </div>

      {/* ── 右下の常設アクション。教材を読みながらAI・メモへ入る唯一の入口 ── */}
      {!loading && !error && doc && (
        <LessonFloatingActions
          hidden={support.open || !!selection || !!explainState}
          onOpenAi={() => openSupport('ai')}
          onOpenMemo={() => openSupport('notes')}
        />
      )}

      {/* ── AI／メモのオーバーレイ。PCは右からのドロワー、SPはボトムシート ── */}
      {support.open && (
        <SupportPanel
          tab={support.tab}
          onTabChange={(tab) => setSupport({ open: true, tab })}
          onClose={closeSupport}
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
            <MemoPane
              notes={notes}
              lessonTitle={doc?.title ?? ''}
              relatedNotes={relatedNotes.items}
              onKeepDraft={() => void handleKeepDraft()}
              onOpenNote={(noteId) => navigate(`/notes?note=${encodeURIComponent(noteId)}`)}
            />
          }
        />
      )}

      {/* 追加先ノートが未定のときだけ出る。一度選べば以後このレッスンでは聞かない */}
      {capture.pending && (
        <NoteTargetPicker
          suggestedTitle={capture.pending.suggestedTitle}
          onPickNote={(noteId) => {
            void capture.resolvePendingWithNote(noteId).then(() => relatedNotes.reload());
          }}
          onCreateNew={() => {
            void capture.resolvePendingWithNewNote().then(() => relatedNotes.reload());
          }}
          onCancel={capture.cancelPending}
        />
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
