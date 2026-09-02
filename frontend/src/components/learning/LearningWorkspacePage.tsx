import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { color, font } from '../../theme/webcoachTheme';
import { useToast } from '../../contexts/ToastContext';
import { useLessonDoc } from '../../hooks/useLessonDoc';
import { useLessonCompletion } from '../../hooks/useLessonCompletion';
import { useLessonCheer } from '../../hooks/useLessonCheer';
import { useLessonAi, LessonAiMessage, LessonAiQuote } from '../../hooks/useLessonAi';
import { useNotes } from '../../hooks/useNotes';
import { useNoteCapture, BackTo } from '../../hooks/useNoteCapture';
import { useNoteList } from '../../hooks/useNoteList';
import { useTextSelection } from '../../hooks/useTextSelection';
import bffClient from '../../services/bffClient';
import { NoteSourceRef } from '../../types/notes';
import { AiSkillId } from '../../types/aiSkill';
import { useAiCoachStore } from '../../store/aiCoachStore';
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
 *   ・AI/メモは右下のフローティングから必要なときだけ開く
 *
 * 【デザイン案 2a「ドキュメント型 ＋ 開閉式サイドパネル」の反映】
 * 上の方針は保ったまま、開いたパネルの見せ方だけを変えた。
 *   ・1280px以上ではパネルが本文の上に重ならず、横に並んで本文を押しのける
 *     （ドラッグで 320〜560px に可変）。読みながら書ける・読みながら聞ける。
 *   ・1280px未満は従来どおり暗幕付きのオーバーレイ、SPはボトムシート。
 *     ノートPCで並べると本文が600px台まで潰れて、案の狙い自体が崩れるため。
 *   ・本文は白いカードに戻した（案 2a）。枠なしの全幅版は別案 3a にあたる。
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const setExpandOrigin = useAiCoachStore((s) => s.setExpandOrigin);

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
  /**
   * ドッキング時のパネル幅（デザイン 2a の既定 400px、320〜560で可変）。
   * 🔴 SupportPanel ではなくここに置く。パネルは閉じるとアンマウントするので、
   *    向こうに持つと開き直すたびに 400px へ戻ってしまう。
   *    ただし localStorage には出さない（開閉状態と同じ理由。§support のコメント参照）。
   */
  const [supportWidth, setSupportWidth] = useState(400);
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

  /**
   * ノートから この教材へ戻るための行き先。
   * 開いているパネルを ?panel= に載せるのが要点。載せないと、ノートを見て
   * 帰ってきたときにメモ／AIが閉じた教材ページになり、開き直す手間が毎回かかる
   * （パネルの開閉は永続化していないので、URLに書くしか復元手段がない）。
   */
  const backToLesson = useCallback(
    (tab?: SupportTab): BackTo | undefined => {
      if (!doc) return undefined;
      const params = new URLSearchParams(location.search);
      const panel = tab ?? (support.open ? support.tab : null);
      if (panel) params.set('panel', panel);
      else params.delete('panel');
      return { to: `${location.pathname}?${params.toString()}`, label: `「${doc.title}」に戻る` };
    },
    [doc, location.pathname, location.search, support.open, support.tab]
  );

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

  /**
   * 🔴 第4引数（onAdvance）を渡さない＝完了しても自動で次へ飛ばさない。
   *    デザイン案 2a の終点は「完了 → 緑の達成カードを見せる → 次のレッスンへを押させる」。
   *    自動遷移すると達成カードが一瞬も見えず、祝う面が死ぬ。
   *    次へ進む動線は達成カードの中の「次のレッスンへ」が持つ。
   */
  const completion = useLessonCompletion(courseId, doc?.lessonId ?? null, allLessonIds);

  /**
   * 完了時のAIコーチのひと言。
   * 「このレッスンで何回聞いたか」だけは画面しか知らないので数えて渡す
   * （進捗・単元・ノート・連続日数はサーバ側が自分で見る）。
   */
  const askedCount = useMemo(() => ai.messages.filter((m) => m.role === 'user').length, [ai.messages]);
  const { cheer, loading: cheerLoading } = useLessonCheer(
    courseId,
    doc?.lessonId ?? null,
    completion.isCompleted,
    askedCount
  );

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

  // ── AI専用ページ／マイノートから戻ってきたときの復帰 ──
  // 出ていったときと同じ状態（AIコーチ or メモのパネルが開いている）に戻す。
  // メモも対象にしているのは、ノートを見て帰ってきたときにメモ欄が閉じていると
  // 開き直す手間が毎回かかるため。一度使ったらURLからは消す
  // （リロードや共有で毎回開かせない）。
  const pendingPanel = searchParams.get('panel');
  useEffect(() => {
    if (pendingPanel !== 'ai' && pendingPanel !== 'notes') return;
    openSupport(pendingPanel);
    const next = new URLSearchParams(searchParams);
    next.delete('panel');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPanel]);

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
    // 追加先はピッカーで選ぶ（capture は pending を立てるだけ）
    capture.capture({
      block: { kind: 'clip', text: selection.text, source },
      suggestedTitle: doc.title,
      source,
      lessonId: doc.lessonId,
      backTo: backToLesson(),
    });
  }, [selection, doc, sourceOf, capture, clearSelection, backToLesson]);

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
      capture.capture({
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
        backTo: backToLesson('ai'),
      });
    },
    [doc, questionFor, sourceOf, ai.contextHeading, answerToText, capture, backToLesson]
  );

  /** 下書きをノートの本文として残す。編集してから取り込みたい人の経路 */
  const handleKeepDraft = useCallback(() => {
    const text = notes.memoDraft.trim();
    if (!text || !doc) return;
    const source = sourceOf();
    capture.capture({
      block: { kind: 'text', text },
      suggestedTitle: doc.title,
      source,
      lessonId: doc.lessonId,
      backTo: backToLesson('notes'),
      // ピッカーが出ている間・やめたときは下書きを消さない。
      // 追加が成功したときにだけ呼ばれるので、内容を失わせない
      onSaved: () => notes.setMemoDraft(''),
    });
  }, [notes, doc, sourceOf, capture, backToLesson]);

  /**
   * メモ欄の「このレッスンのノート」からノートを開く。
   * 戻り先を預けるので、向こう側に「〜に戻る」が出る（メモ欄を開いた状態で戻る）。
   */
  const handleOpenNote = useCallback(
    (noteId: string) => {
      capture.openNotes(noteId, backToLesson('notes'));
    },
    [capture, backToLesson]
  );

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
   *
   * 戻り先（このレッスンのURL）も預ける。拡大が一方通行だと、
   * 向こう側に「元の画面に戻す」を描けない。
   */
  const handleExpandToAiPage = useCallback(() => {
    // 戻り先には ?panel=ai を足す。パネルの開閉は永続化していないので、
    // これが無いと畳んだ先が「AIコーチが閉じた教材ページ」になり、
    // せっかく引き継いだ会話がまた見えなくなる。
    const back = new URLSearchParams(location.search);
    back.set('panel', 'ai');
    setExpandOrigin({
      sessionId: ai.sessionId,
      path: `${location.pathname}?${back.toString()}`,
      // 戻り先を名指しする（backToLesson と同じ書式）。「元の画面」より、
      // どの教材へ帰るのかが読めるほうが押す前に分かる。
      label: doc ? `「${doc.title}」に戻る` : '教材に戻る',
      fromDrawer: false,
    });
    navigate(`/ai-coach?session=${encodeURIComponent(ai.sessionId)}`);
  }, [ai.sessionId, doc, location.pathname, location.search, navigate, setExpandOrigin]);

  /**
   * 提案カードの「広い画面で開く」（要件§「教材学習画面との接続」）。
   * ここでは実行せず、モードだけ切り替えてAI専用ページへ渡す。
   * 教材・課題の評価基準・添付画像・直前の会話はセッションに載っているので、
   * 向こう側は「制作物添削を選択済み・参照済み」の状態で開く。
   */
  const handleOpenWideWithSkill = useCallback(
    (skillId: AiSkillId) => {
      ai.selectSkill(skillId);
      handleExpandToAiPage();
    },
    [ai, handleExpandToAiPage]
  );

  /**
   * 「このレッスンを完了する」。
   * 完了済みのときの分岐は持たない。完了後は本文末尾が緑の達成カードに変わり、
   * 次へ進むのはそのカードの中の「次のレッスンへ」（onNavigate）が担うため、
   * このボタン自体が完了済みの状態では描かれない。
   */
  const handleComplete = useCallback(() => {
    void completion.toggleComplete(true);
  }, [completion]);

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

  /**
   * 終点の「次のレッスン」カードに添えるメタ情報。
   * doc.next は lessonId と title しか持たないので、所要時間と学習タイプは
   * 目次から引く。デザイン 2a はここに説明文を置いているが、
   * 説明文はどこにも無いデータなので作らない（作文はしない）。
   */
  const nextMeta = useMemo(() => {
    const nextId = doc?.next?.lessonId;
    if (!nextId) return undefined;
    const found = flatLessons.find((l) => l.lessonId === nextId);
    return found ? { minutes: found.minutes, learningType: found.learningType } : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.next?.lessonId, outline]);

  return (
    <div style={{ background: color.pageBg }}>
      {/* 🔴 AppHeader（LMSのサイドバー）はここでは描かない。
          教材に入ったらLMSの外枠は不要、というレビュー方針。
          サイドバーの余白は AppHeader 自身の effect が付けているので、
          描かなければ自動的に消える。 */}
      {/* 🔴 上部バーはこのシェルの全幅ではなく、本文カラム（.wc-lesson-main）の中に置く。
             全幅に渡していたころは、1280px以上でドッキングしたAIコーチが
             「ヘッダーの下から」始まっていた。AIコーチの上にレッスンのバーは要らない、
             というレビュー指摘への対応（1280px未満はパネルが position:fixed で
             もともと全高なので、見た目は変わらない）。 */}
      <div
        className="wc-learning-shell"
        // 読み幅の切替をCSS側で拾うための印。パネルが並んでいる間だけ本文を狭める
        data-support-open={support.open ? 'true' : 'false'}
      >
        <div className="wc-lesson-main">
          <LessonTopBar
            courseName={outline?.courseName ?? doc?.courseName ?? ''}
            lessonTitle={doc?.title ?? ''}
            lessonIndex={lessonIndex > 0 ? lessonIndex : null}
            lessonTotal={flatLessons.length}
            courseId={courseId}
            lessonId={doc?.lessonId ?? null}
            onBackToCourse={onBack}
          />

          {/* 目次の列は無くなったので、本文が唯一のスクロールコンテナ */}
          {/* 左右のガターはここが持つ。本文カードの幅は LessonArticle 側の
              --wc-reading-max が「カードの外寸」として決めるので、
              あちらにパディングを足さない（index.css のコメント参照） */}
          <main
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              minWidth: 0,
              padding: '0 clamp(16px, 3vw, 32px)',
              scrollBehavior: 'smooth',
            }}
          >
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
                nextMeta={nextMeta}
                cheer={cheer}
                cheerLoading={cheerLoading}
                onComplete={handleComplete}
                onUndoComplete={() => void completion.toggleComplete(false)}
                onNavigate={navigateToLesson}
                onBackToCourse={onBack}
              />
            )}
          </main>
        </div>

        {/* ── AI／メモのパネル。1280px以上では本文と並ぶドッキング型、
              それ未満は右からのドロワー、SPはボトムシート（index.css で分岐）──
            シェルの直下に置くので、ドッキング時はビューポートの最上部から始まる。 */}
        {support.open && (
          <SupportPanel
            tab={support.tab}
            onTabChange={(tab) => setSupport({ open: true, tab })}
            onClose={closeSupport}
            width={supportWidth}
            onWidthChange={setSupportWidth}
            onExpand={handleExpandToAiPage}
            aiPane={
              <AiCoachPane
                ai={ai}
                onSaveAnswer={handleSaveAnswer}
                onAppendToMemo={handleAppendToMemo}
                onJumpToBlock={jumpToBlock}
                disabled={!selectionEnabled}
                onOpenWide={handleOpenWideWithSkill}
              />
            }
            memoPane={
              <MemoPane
                notes={notes}
                lessonTitle={doc?.title ?? ''}
                relatedNotes={relatedNotes.items}
                onKeepDraft={handleKeepDraft}
                onOpenNote={handleOpenNote}
              />
            }
          />
        )}
      </div>

      {/* ── 右下の常設アクション。教材を読みながらAI・メモへ入る唯一の入口 ──
          パネルが開いている間は引っ込むので、パネルと重なることはない */}
      {!loading && !error && doc && (
        <LessonFloatingActions
          hidden={support.open || !!selection || !!explainState}
          onOpenAi={() => openSupport('ai')}
          onOpenMemo={() => openSupport('notes')}
        />
      )}

      {/* 保存のたびに出る。どのノートに入れるかは毎回ここで選ぶ */}
      {capture.pending && (
        <NoteTargetPicker
          pending={capture.pending}
          busy={capture.saving}
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
