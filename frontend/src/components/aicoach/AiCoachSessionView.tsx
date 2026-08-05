import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelRight } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { useToast } from '../../contexts/ToastContext';
import { useLessonAi, LessonAiMessage } from '../../hooks/useLessonAi';
import { useNotes } from '../../hooks/useNotes';
import { useAiCoachStore } from '../../store/aiCoachStore';
import { bffClient } from '../../services/bffClient';
import { LessonBlock } from '../../types/lesson';
import { AI_SKILL_META, ConcreteAiSkillId, isSpecialistSkill } from '../../types/aiSkill';
import AiCoachPane from '../learning/AiCoachPane';
import SkillSelector from '../learning/SkillSelector';
import ReferencePanel from './ReferencePanel';
import SkillModeHeader from './SkillModeHeader';
import AiSkillDock from './AiSkillDock';

/**
 * AI専用ページの「会話している状態」（要件§「画面は3つの状態に分ける」2・3）。
 *
 * 1つのコンポーネントで2状態を描く:
 *   メインチャット状態 … モードは「おまかせ」。機能一覧は入力欄の上に縮めて置く
 *   専門モード状態     … 機能名・必要な入力・クイックアクション・参照情報を出す
 *
 * どちらも中身は教材ページの右パネルと同じ AiCoachPane。
 * ここで別のチャットUIを作らないのが要点で、作ると挙動が2系統に分かれて必ずズレる。
 * 状態の違いはヘッダー（headerSlot）と入力欄の上（footerSlot）の差し替えだけで表す。
 *
 * ホーム状態は AiCoachHome にあり、セッションが無いあいだは
 * このコンポーネント自体を描かない（会話が始まる前に空のセッションを作らないため）。
 */
interface AiCoachSessionViewProps {
  sessionId: string;
  /** ホーム状態（機能一覧）へ戻る */
  onGoHome: () => void;
  /** 別のセッションを開く。専門セッションから親会話へ戻るときに使う */
  onOpenSession: (id: string) => void;
  /**
   * ホームから自由入力で始めた直後だけ true。
   * このとき入力欄に下書きが入った状態で開くので、そのまま1回送信する。
   */
  autoSend?: boolean;
  onAutoSendDone?: () => void;
  isDesktop: boolean;
}

const REFERENCE_WIDTH = 300;

export function AiCoachSessionView({
  sessionId,
  onGoHome,
  onOpenSession,
  autoSend = false,
  onAutoSendDone,
  isDesktop,
}: AiCoachSessionViewProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [referenceOpen, setReferenceOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const session = useAiCoachStore((s) => s.sessions[sessionId]);
  const createSkillSession = useAiCoachStore((s) => s.createSkillSession);
  const appendMessage = useAiCoachStore((s) => s.appendMessage);

  // 教材を持たない呼び出しなので doc は渡さない。文脈は store 側が保持している。
  const ai = useLessonAi(null, sessionId);

  const inSkillMode = isSpecialistSkill(ai.skillId);
  const meta = inSkillMode ? AI_SKILL_META[ai.skillId as ConcreteAiSkillId] : null;

  // ホームの入力欄から始めた分をここで送る。
  // 送信の実体はセッションに紐づくので、ホーム側では下書きを置くだけにしてある。
  //
  // ref で1回に絞るのは StrictMode 対策。開発時は effect が2回走るため、
  // 「確認カードを出して止まる」経路（画像＋『添削して』など）だと
  // ガードが無いと発言とカードが二重に積まれる。
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!autoSend || !session || autoSentRef.current) return;
    autoSentRef.current = true;
    onAutoSendDone?.();
    void ai.send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, sessionId, !!session]);

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

  const latestImage = useMemo(() => {
    if (ai.image) return ai.image;
    for (let i = ai.messages.length - 1; i >= 0; i -= 1) {
      if (ai.messages[i].image) return ai.messages[i].image as string;
    }
    return null;
  }, [ai.image, ai.messages]);

  /**
   * メインチャットから専門モードを始める（要件§「会話履歴の考え方」）。
   * 同じ会話に混ぜず、必要な文脈（教材・課題基準・添付画像・引用）だけを
   * コピーした専門セッションを親会話の下に作る。
   *
   * 会話中の提案カードを受け入れた場合は、同じ会話のまま切り替わる（useLessonAi 側）。
   * そちらは「いまの話の続き」なので、別セッションへ移すと文脈が切れて読みにくい。
   */
  const startSkillSession = useCallback(
    (skillId: ConcreteAiSkillId) => {
      const parentTitle = session?.title ?? 'AIコーチとの会話';
      const childId = createSkillSession({
        skillId,
        parentId: sessionId,
        context: session?.context,
        image: latestImage,
        quote: session?.quote ?? null,
      });
      appendMessage(childId, {
        id: `s-${childId}-${Date.now()}`,
        role: 'system',
        content: `「${parentTitle}」から引き継いで${AI_SKILL_META[skillId].shortLabel}を始めました。`,
        createdAt: new Date().toISOString(),
      });
      onOpenSession(childId);
    },
    [appendMessage, createSkillSession, latestImage, onOpenSession, session, sessionId]
  );

  /** 専門モードから抜ける。親会話があればそこへ、無ければホームへ */
  const backToCoach = useCallback(() => {
    if (session?.parentId) onOpenSession(session.parentId);
    else onGoHome();
  }, [onGoHome, onOpenSession, session?.parentId]);

  const showReference = isDesktop && referenceOpen;

  const headerSlot =
    inSkillMode && meta ? (
      <SkillModeHeader
        skillId={ai.skillId as ConcreteAiSkillId}
        references={ai.references}
        image={ai.image ?? latestImage}
        onBack={backToCoach}
        onOpenLesson={courseId && lessonId ? () => openLesson() : undefined}
        onRequestImage={() => fileInputRef.current?.click()}
        onToggleReference={isDesktop ? () => setReferenceOpen((v) => !v) : undefined}
        referenceOpen={referenceOpen}
      />
    ) : (
      <div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <strong style={{ ...font.label, fontWeight: 800, color: color.text, flexShrink: 0 }}>
            AIコーチ
          </strong>
          <SkillSelector value={ai.skillId} onChange={ai.selectSkill} disabled={ai.loading} />
          <span
            style={{
              minWidth: 0,
              fontSize: 10.5,
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
            <button
              type="button"
              onClick={() => setReferenceOpen((v) => !v)}
              aria-pressed={referenceOpen}
              aria-label="参照情報の表示を切り替える"
              title="参照情報"
              className="grid place-items-center"
              style={{
                width: 28,
                height: 28,
                border: `1px solid ${referenceOpen ? color.primaryBorder : color.borderStrong}`,
                borderRadius: 8,
                background: referenceOpen ? color.primarySoft : color.surface,
                color: referenceOpen ? color.primary : color.iconMuted,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <PanelRight size={13} />
            </button>
          )}
        </div>
        {ai.references.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: 5, marginTop: 7 }}>
            <span style={{ fontSize: 9.5, color: color.textFaint, flexShrink: 0 }}>現在参照中</span>
            {ai.references.map((ref) => (
              <span
                key={ref}
                title={ref}
                style={{
                  maxWidth: 220,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: color.primarySoft,
                  color: color.primary,
                  fontSize: 9.5,
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isDesktop
          ? `minmax(0, 1fr) ${showReference ? REFERENCE_WIDTH : 0}px`
          : 'minmax(0, 1fr)',
        minHeight: 0,
        height: '100%',
        transition: 'grid-template-columns .24s ease',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) ai.attachImageFile(file);
          e.target.value = '';
        }}
      />

      <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <AiCoachPane
          ai={ai}
          variant="page"
          onSaveAnswer={handleSaveAnswer}
          onAppendToMemo={handleAppendToMemo}
          onJumpToBlock={openLesson}
          disabled={!ai.context.structured}
          headerSlot={headerSlot}
          quickPrompts={meta?.quickActions}
          placeholder={meta?.placeholder}
          footerSlot={
            inSkillMode ? undefined : (
              <AiSkillDock onSelectSkill={startSkillSession} onShowAll={onGoHome} />
            )
          }
        />
      </div>

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
  );
}

export default AiCoachSessionView;
