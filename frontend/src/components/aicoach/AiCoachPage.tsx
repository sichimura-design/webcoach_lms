import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PanelLeft, PanelRight } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLessonAi, LessonAiMessage } from '../../hooks/useLessonAi';
import { useNotes } from '../../hooks/useNotes';
import { useAiCoachStore } from '../../store/aiCoachStore';
import { bffClient } from '../../services/bffClient';
import { LessonBlock } from '../../types/lesson';
import AiCoachPane from '../learning/AiCoachPane';
import ConversationList from './ConversationList';
import ReferencePanel from './ReferencePanel';

/**
 * AI専用ページ（/ai-coach）。
 *
 * 「AIアプリを選ぶページ」ではなく、**AIコーチを拡大した作業画面**（要件§5）。
 * 別のアプリを開いた感覚にせず、教材ページの右パネルと同じ会話をそのまま広げる。
 * 会話の実体は store/aiCoachStore.ts にあるので、?session= で開くだけで
 * 会話・添付画像・専門モードが引き継がれる。
 *
 * 中央は教材ページと同じ AiCoachPane を variant="page" で描く。
 * ここで別のチャットUIを作らないのが要点。作ると挙動が2系統に分かれて必ずズレる。
 *
 * 旧 AIAppsPage（アプリのカード一覧＋別タブ起動）はこのページに置き換わった。
 */
const DESKTOP_MIN_WIDTH = 1024;
const LIST_WIDTH = 260;
const REFERENCE_WIDTH = 300;

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

export function AiCoachPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  const [listOpen, setListOpen] = useState(true);
  const [referenceOpen, setReferenceOpen] = useState(true);

  const sessions = useAiCoachStore((s) => s.sessions);
  const order = useAiCoachStore((s) => s.order);
  const createPageSession = useAiCoachStore((s) => s.createPageSession);
  const deleteSession = useAiCoachStore((s) => s.deleteSession);

  const requestedSession = searchParams.get('session');

  // 開くセッションを決める。
  //   ?session= があればそれ（教材ページからの拡大）
  //   無ければ直近の会話。会話が1つも無ければ新規に作る
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (requestedSession) {
      setSessionId(requestedSession);
      return;
    }
    if (sessionId) return;
    setSessionId(order[0] ?? createPageSession());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSession]);

  const activeId = sessionId ?? '';
  const session = activeId ? sessions[activeId] : undefined;

  // この画面もビューポート高に固定するのでページスクロールを止める
  // （.wc-learning-shell の高さ指定は body.learning-workspace と対で効く）
  useEffect(() => {
    document.body.classList.add('learning-workspace');
    return () => document.body.classList.remove('learning-workspace');
  }, []);

  // 教材を持たない呼び出しなので doc は渡さない。文脈は store 側が保持している。
  const ai = useLessonAi(null, activeId || undefined);

  // ── 参照情報に出す教材ブロックを取る ──
  // 表示のためだけなので、失敗しても会話は続けられるように黙って空にする。
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const { courseId, lessonId } = ai.context;
  useEffect(() => {
    if (!courseId || !lessonId) {
      setBlocks([]);
      return;
    }
    let cancelled = false;
    bffClient
      .getLessonDoc(courseId, lessonId)
      .then((doc) => {
        if (!cancelled) setBlocks(doc.blocks ?? []);
      })
      .catch(() => {
        if (!cancelled) setBlocks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  // ノートは教材と同じ仕組みを使う（保存・メモ追加の行き先を分けない）。
  // withMemoDraft は教材に紐づく相談のときだけ true。false のままだと
  // appendToMemo がローカル state を書くだけで保存されず、成功したように見えてしまう。
  const notes = useNotes({
    lessonId: lessonId ?? null,
    query: useMemo(() => ({ lessonId: lessonId ?? undefined }), [lessonId]),
    withMemoDraft: !!lessonId,
    context:
      courseId && lessonId
        ? {
            courseId,
            courseName: ai.context.courseName ?? '',
            lessonId,
            lessonTitle: ai.context.lessonTitle ?? '',
            heading: ai.context.heading,
          }
        : undefined,
  });

  const selectSession = useCallback(
    (id: string) => {
      setSessionId(id);
      const next = new URLSearchParams(searchParams);
      next.set('session', id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleCreate = useCallback(() => {
    selectSession(createPageSession());
  }, [createPageSession, selectSession]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteSession(id);
      if (id === activeId) {
        const remaining = order.filter((x) => x !== id);
        selectSession(remaining[0] ?? createPageSession());
      }
    },
    [activeId, createPageSession, deleteSession, order, selectSession]
  );

  /**
   * 教材へ戻る。ブロックIDを渡すと該当箇所まで飛ぶ（?block= は
   * LearningWorkspacePage 側が復帰処理として既に持っている）。
   */
  const openLesson = useCallback(
    (blockId?: string) => {
      if (!courseId || !lessonId) return;
      const query = new URLSearchParams({ module: String(lessonId) });
      if (blockId) query.set('block', blockId);
      navigate(`/course/${courseId}?${query.toString()}`);
    },
    [courseId, lessonId, navigate]
  );

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

  const questionFor = useCallback(
    (message: LessonAiMessage) => {
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

  const handleSaveAnswer = useCallback(
    async (message: LessonAiMessage) => {
      if (!courseId || !lessonId) {
        showToast('教材に紐づく相談だけ保存できます', 'error');
        return;
      }
      const { question, quote, image } = questionFor(message);
      const sources = message.answer?.sources ?? message.skillResult?.sources ?? [];
      const created = await notes.createNote({
        kind: 'answer',
        courseId,
        courseName: ai.context.courseName ?? '',
        lessonId,
        lessonTitle: ai.context.lessonTitle ?? '',
        blockId: sources[0]?.blockId ?? null,
        heading: sources[0]?.heading ?? ai.context.heading,
        text: answerToText(message),
        question,
        selectedText: quote,
        image,
        offset: null,
      });
      showToast(created ? '質問と回答を保存しました' : '保存に失敗しました', created ? 'success' : 'error');
    },
    [answerToText, ai.context, courseId, lessonId, notes, questionFor, showToast]
  );

  const handleAppendToMemo = useCallback(
    (message: LessonAiMessage) => {
      if (!lessonId) {
        showToast('教材に紐づく相談だけメモへ追加できます', 'error');
        return;
      }
      const { question } = questionFor(message);
      notes.appendToMemo(question, answerToText(message));
      showToast('AI回答をメモへ追加しました', 'success');
    },
    [answerToText, lessonId, notes, questionFor, showToast]
  );

  const sessionList = useMemo(
    () => order.map((id) => sessions[id]).filter(Boolean),
    [order, sessions]
  );

  const latestImage = useMemo(() => {
    if (ai.image) return ai.image;
    for (let i = ai.messages.length - 1; i >= 0; i -= 1) {
      if (ai.messages[i].image) return ai.messages[i].image as string;
    }
    return null;
  }, [ai.image, ai.messages]);

  const showList = isDesktop && listOpen;
  const showReference = isDesktop && referenceOpen;
  const gridTemplateColumns = isDesktop
    ? `${showList ? LIST_WIDTH : 0}px minmax(0, 1fr) ${showReference ? REFERENCE_WIDTH : 0}px`
    : 'minmax(0, 1fr)';

  const coachPane = (
    <AiCoachPane
      ai={ai}
      variant="page"
      onSaveAnswer={handleSaveAnswer}
      onAppendToMemo={handleAppendToMemo}
      onJumpToBlock={openLesson}
      disabled={!ai.context.structured}
    />
  );

  return (
    <div style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="wc-learning-shell" style={{ display: 'grid', gridTemplateRows: '52px minmax(0, 1fr)' }}>
        {/* ── 上部バー ── */}
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '0 16px',
            borderBottom: `1px solid ${color.border}`,
            background: color.surface,
          }}
        >
          <h1 style={{ ...font.rowTitle, color: color.text, margin: 0, whiteSpace: 'nowrap' }}>
            ✦ AIコーチ
          </h1>
          <span
            style={{
              minWidth: 0,
              fontSize: 11,
              color: color.textFaint,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session?.title ?? '新しい相談'}
          </span>
          <div style={{ flex: 1 }} />
          {isDesktop && (
            <>
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                aria-pressed={listOpen}
                aria-label="会話履歴の表示を切り替える"
                title="会話履歴"
                style={toggleStyle(listOpen)}
              >
                <PanelLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setReferenceOpen((v) => !v)}
                aria-pressed={referenceOpen}
                aria-label="参照情報の表示を切り替える"
                title="参照情報"
                style={toggleStyle(referenceOpen)}
              >
                <PanelRight size={14} />
              </button>
            </>
          )}
        </div>

        {/* ── 3カラム ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns,
            minHeight: 0,
            transition: 'grid-template-columns .24s ease',
          }}
        >
          {isDesktop && (
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              {showList && (
                <ConversationList
                  sessions={sessionList}
                  activeId={activeId}
                  onSelect={selectSession}
                  onCreate={handleCreate}
                  onDelete={handleDelete}
                />
              )}
            </div>
          )}

          <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden' }}>{coachPane}</div>

          {isDesktop && (
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              {showReference && (
                <ReferencePanel
                  context={ai.context}
                  skillId={ai.skillId}
                  image={latestImage}
                  blocks={blocks}
                  quoteText={ai.quote?.text ?? null}
                  onOpenLesson={openLesson}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const toggleStyle = (active: boolean): React.CSSProperties => ({
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  border: `1px solid ${active ? color.primaryBorder : color.borderStrong}`,
  borderRadius: 8,
  background: active ? color.primarySoft : color.surface,
  color: active ? color.primary : color.iconMuted,
  cursor: 'pointer',
  flexShrink: 0,
});

export default AiCoachPage;
