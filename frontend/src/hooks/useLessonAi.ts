import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { LessonAiRequest, LessonAiResponse, LessonDoc } from '../types/lesson';
import {
  AiCoachContext,
  AiCoachMessage,
  AiCoachQuote,
  AiCoachSession,
  EMPTY_AI_COACH_CONTEXT,
  lessonSessionId,
} from '../types/aiCoach';
import {
  AiSkillId,
  AiSkillRequest,
  AI_SKILL_SHORT_LABEL,
  isSpecialistSkill,
  SkillSuggestion,
} from '../types/aiSkill';
import { detectSkill } from '../utils/aiSkillRouting';
import { toHistory } from '../utils/aiCoachText';
import { useAiCoachStore } from '../store/aiCoachStore';

/**
 * AIコーチ（教材ページの右パネル／AI専用ページの中央）。
 *
 * 既存の useAiChat は使わない。理由は2つ:
 *   1. useAiChat はグローバルな chatStore を1本しか持たないため、
 *      レッスンをまたいで会話が混ざる。教材ごとの文脈が壊れる。
 *   2. 返り値が素のテキストで、「結論／根拠／当てはめ／次にやること／参照箇所」
 *      という構造と参照blockIdを持てない。
 *
 * 会話の実体は store/aiCoachStore.ts にある。このフックは
 *   「教材の文脈をセッションへ流し込み、送信の手順を組み立てる」
 * ことだけを担う薄い層で、状態は持たない。こうしておくと、教材ページの右パネルと
 * AI専用ページが同じ会話オブジェクトを見られる（仕様§5の拡大表示）。
 */

// 旧名のまま import している箇所があるのでエイリアスを維持する
export type LessonAiQuote = AiCoachQuote;
export type LessonAiMessage = AiCoachMessage;

export interface UseLessonAi {
  /** 会話しているセッションのID。'lesson:123' など */
  sessionId: string;
  messages: AiCoachMessage[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  quote: AiCoachQuote | null;
  setQuote: (q: AiCoachQuote | null) => void;
  image: string | null;
  attachImageFile: (file: File) => void;
  clearImage: () => void;
  /** リロードで添付画像が失われたか（再添付を促すため） */
  imageDropped: boolean;
  send: (overrideQuestion?: string) => Promise<void>;
  /** 選択文章の「💡かんたん解説」。会話履歴には残さない */
  explain: (quote: AiCoachQuote) => Promise<string>;

  // ── 専門モード（仕様§3・§4） ──
  /** 現在のモード。'auto' は「おまかせ」 */
  skillId: AiSkillId;
  /** セレクタからの手動指定。ユーザーが明確な目的を持っているとき用 */
  selectSkill: (skillId: AiSkillId) => void;
  /** 未回答の確認カード。あるときは送信を止めてユーザーの選択を待っている */
  pendingProposal: { messageId: string; suggestion: SkillSuggestion } | null;
  /** 確認カードを受け入れて専門モードを実行する */
  acceptProposal: (messageId: string) => Promise<void>;
  /** 提案を断り、通常のAIコーチとして回答する */
  dismissProposal: (messageId: string) => Promise<void>;

  /** 現在参照している見出し（AIヘッダーの表示用） */
  contextHeading: string | null;
  setContextHeading: (heading: string | null) => void;
  /** 参照中として並べるラベル（見出し／課題の評価基準／添付画像） */
  references: string[];
  context: AiCoachContext;
  scrollAnchorRef: React.RefObject<HTMLDivElement>;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(seq += 1)}`;

/** セッションが未作成のあいだの既定値。毎レンダーで新しい参照を作らないよう定数にする */
const EMPTY_MESSAGES: AiCoachMessage[] = [];

const errorAnswer = (): LessonAiResponse => ({
  conclusion: '一時的なエラーで回答を取得できませんでした。',
  basis: '',
  apply: '',
  next: 'しばらく時間をおいてから、もう一度お試しください。',
  sources: [],
  groundedInMaterial: false,
  generalNote: null,
});

/**
 * @param doc 教材本文。null なら教材の文脈を持たない単独の会話
 * @param sessionIdOverride AI専用ページのように、外からセッションを指定する場合
 */
export function useLessonAi(doc: LessonDoc | null, sessionIdOverride?: string): UseLessonAi {
  const sessionId = sessionIdOverride ?? lessonSessionId(doc?.lessonId);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // 送信中フラグはUIの都合なので store には置かない（画面を跨いで共有する意味がない）。
  // ref と state を両方持つのは、send() 内の多重送信判定には同期的な値が必要な一方、
  // 描画には state が必要なため。
  const loadingRef = useRef(false);
  const [loading, setLoadingState] = useState(false);
  const setLoading = useCallback((v: boolean) => {
    loadingRef.current = v;
    setLoadingState(v);
  }, []);

  const ensureSession = useAiCoachStore((s) => s.ensureSession);
  const patchContext = useAiCoachStore((s) => s.patchContext);
  const appendMessage = useAiCoachStore((s) => s.appendMessage);
  const patchMessage = useAiCoachStore((s) => s.patchMessage);
  const setSkillInStore = useAiCoachStore((s) => s.setSkill);
  const setInputInStore = useAiCoachStore((s) => s.setInput);
  const setQuoteInStore = useAiCoachStore((s) => s.setQuote);
  const setImageInStore = useAiCoachStore((s) => s.setImage);
  const session = useAiCoachStore((s) => s.sessions[sessionId]) as AiCoachSession | undefined;

  // ── 教材の文脈をセッションへ流し込む ──
  // レッスンが変わると sessionId 自体が変わるので、会話のリセットは自然に起きる。
  useEffect(() => {
    if (doc) {
      ensureSession(sessionId, {
        courseId: doc.courseId,
        courseName: doc.courseName,
        lessonId: doc.lessonId,
        lessonTitle: doc.title,
        taskHeading: doc.blocks.find((b) => b.kind === 'task')?.heading ?? null,
        structured: doc.source === 'structured',
      });
    } else {
      // 教材を持たない呼び出し（AI専用ページで既存の会話を開く場合など）では
      // 保存済みの文脈を null で上書きしない。上書きすると拡大表示した瞬間に
      // 「どの教材の話だったか」が失われる。
      ensureSession(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, doc?.lessonId, doc?.source]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [session?.messages, loading]);

  // 既定値はモジュールスコープの定数を使う。ここで {} や [] を書くと毎レンダーで
  // 参照が変わり、下の useCallback / useMemo がすべて作り直される。
  const messages = session?.messages ?? EMPTY_MESSAGES;
  const context = session?.context ?? EMPTY_AI_COACH_CONTEXT;
  const skillId = session?.skillId ?? 'auto';

  const setContextHeading = useCallback(
    (heading: string | null) => patchContext(sessionId, { heading }),
    [patchContext, sessionId]
  );

  const setInput = useCallback(
    (v: string) => setInputInStore(sessionId, v),
    [setInputInStore, sessionId]
  );

  const setQuote = useCallback(
    (q: AiCoachQuote | null) => setQuoteInStore(sessionId, q),
    [setQuoteInStore, sessionId]
  );

  const attachImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () =>
        setImageInStore(sessionId, typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(file);
    },
    [setImageInStore, sessionId]
  );

  const clearImage = useCallback(() => setImageInStore(sessionId, null), [setImageInStore, sessionId]);

  const buildRequest = useCallback(
    (
      question: string,
      mode: 'chat' | 'brief',
      q: AiCoachQuote | null,
      img: string | null
    ): LessonAiRequest | null => {
      if (!context.courseId || !context.lessonId) return null;
      return {
        courseId: context.courseId,
        lessonId: context.lessonId,
        blockId: q?.blockId ?? null,
        heading: q?.heading ?? context.heading,
        selectedText: q?.text ?? null,
        contextBefore: q?.contextBefore ?? null,
        contextAfter: q?.contextAfter ?? null,
        question,
        image: img ?? undefined,
        history: toHistory(messages),
        mode,
        skillId,
      };
    },
    [context, messages, skillId]
  );

  /** 通常のAIコーチとして回答する（教材準拠の構造化回答） */
  const runLessonAi = useCallback(
    async (question: string, q: AiCoachQuote | null, img: string | null) => {
      const request = buildRequest(question, 'chat', q, img);

      // 教材の文脈が無い会話（常駐ドロワー・集中ブース・AI専用ページの新規相談）は
      // 教材準拠APIを呼べないので、従来からある汎用AIエンドポイントで応答する。
      // 教材の根拠が無いのは当然なので、ここでは警告扱いにしない
      // （UI側も教材の文脈が無いときは「教材だけでは判断できません」を出さない）。
      if (!request) {
        try {
          const res = await bffClient.sendAIMessage({ message: question, image: img ?? undefined });
          appendMessage(sessionId, {
            id: nextId('a'),
            role: 'assistant',
            content: '',
            answer: {
              conclusion: res.message || '回答を取得できませんでした。',
              basis: '',
              apply: '',
              next: '',
              sources: [],
              groundedInMaterial: false,
              generalNote: null,
            },
            createdAt: new Date().toISOString(),
          });
        } catch {
          appendMessage(sessionId, {
            id: nextId('a'),
            role: 'assistant',
            content: '',
            answer: errorAnswer(),
            createdAt: new Date().toISOString(),
          });
        }
        return;
      }

      try {
        const answer = await bffClient.askLessonAi(request);
        appendMessage(sessionId, {
          id: nextId('a'),
          role: 'assistant',
          content: '',
          answer,
          // 仕様§4-2: 回答の下に控えめに提案する。'none' は捨てる。
          suggestion:
            answer.suggestion && answer.suggestion.strength !== 'none' ? answer.suggestion : null,
          createdAt: new Date().toISOString(),
        });
      } catch {
        appendMessage(sessionId, {
          id: nextId('a'),
          role: 'assistant',
          content: '',
          answer: errorAnswer(),
          createdAt: new Date().toISOString(),
        });
      }
    },
    [appendMessage, buildRequest, sessionId]
  );

  /** 専門モードを実行する（裏でDifyアプリが呼ばれる箇所） */
  const runSkill = useCallback(
    async (targetSkill: AiSkillId, question: string, q: AiCoachQuote | null, img: string | null) => {
      if (!isSpecialistSkill(targetSkill)) {
        await runLessonAi(question, q, img);
        return;
      }
      const request: AiSkillRequest = {
        skillId: targetSkill,
        question,
        image: img ?? undefined,
        quote: q?.text ?? null,
        courseId: context.courseId,
        lessonId: context.lessonId,
        blockIds: q?.blockId ? [q.blockId] : [],
        history: toHistory(messages),
      };
      try {
        const skillResult = await bffClient.runAiSkill(request);
        appendMessage(sessionId, {
          id: nextId('a'),
          role: 'assistant',
          content: '',
          skillResult,
          createdAt: new Date().toISOString(),
        });
      } catch {
        appendMessage(sessionId, {
          id: nextId('a'),
          role: 'assistant',
          content: '',
          answer: errorAnswer(),
          createdAt: new Date().toISOString(),
        });
      }
    },
    [appendMessage, context, messages, runLessonAi, sessionId]
  );

  /** 未回答の確認カードを探す。最後の1件だけを見る */
  const pendingProposal = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === 'proposal' && m.resolution == null && m.proposal) {
        return { messageId: m.id, suggestion: m.proposal };
      }
      // proposal より後に発言があれば、その提案はもう流れたものとして扱う
      if (m.role === 'user' || m.role === 'assistant') return null;
    }
    return null;
  }, [messages]);

  /** 直前のユーザー発言（提案を受け入れたときに再利用する） */
  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }, [messages]);

  const send = useCallback(
    async (overrideQuestion?: string) => {
      if (!session || loadingRef.current) return;
      // 未回答の確認カードがあるうちは送らせない。UI側でもボタンを無効化しているが、
      // Ctrl+Enter のような別経路があるのでここでも止める。
      if (pendingProposal) return;
      const question =
        (overrideQuestion ?? session.input).trim() ||
        (session.image ? '添付した画像について、この教材の基準で添削してください' : '') ||
        (session.quote ? 'この文章を教材に沿って説明してください' : '');
      if (!question) return;

      const currentQuote = session.quote;
      const currentImage = session.image;

      appendMessage(sessionId, {
        id: nextId('u'),
        role: 'user',
        content: question,
        quote: currentQuote?.text,
        image: currentImage ?? undefined,
        createdAt: new Date().toISOString(),
      });
      setInput('');
      setImageInStore(sessionId, null);

      // ── 意図判定（仕様§4） ──
      // explicit のときは専門処理の前に確認カードを出し、ここで止める。
      // AIが勝手に画面や挙動を変える違和感を防ぐため、実行はユーザーの操作を待つ。
      const suggestion = detectSkill({
        question,
        hasImage: !!currentImage,
        quote: currentQuote?.text ?? null,
        currentSkillId: skillId,
        contextHeading: context.heading ?? context.lessonTitle,
        taskHeading: context.taskHeading,
      });

      if (suggestion.strength === 'explicit' && isSpecialistSkill(suggestion.skillId)) {
        appendMessage(sessionId, {
          id: nextId('p'),
          role: 'proposal',
          content: '',
          proposal: suggestion,
          resolution: null,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      setLoading(true);
      try {
        // すでに専門モードに入っているならそのまま専門処理を続ける（追従）
        if (isSpecialistSkill(skillId)) {
          await runSkill(skillId, question, currentQuote, currentImage);
        } else {
          await runLessonAi(question, currentQuote, currentImage);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessage,
      context,
      loadingRef,
      pendingProposal,
      runLessonAi,
      runSkill,
      session,
      sessionId,
      setImageInStore,
      setInput,
      setLoading,
      skillId,
    ]
  );

  const acceptProposal = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      const suggestion = target?.proposal ?? target?.suggestion;
      if (!suggestion || !isSpecialistSkill(suggestion.skillId) || loadingRef.current) return;

      patchMessage(sessionId, messageId, { resolution: 'accepted' });
      setSkillInStore(sessionId, suggestion.skillId);
      appendMessage(sessionId, {
        id: nextId('s'),
        role: 'system',
        content: `${AI_SKILL_SHORT_LABEL[suggestion.skillId]}モードに切り替えました。`,
        createdAt: new Date().toISOString(),
      });

      const question = lastUserMessage?.content ?? '';
      const image = lastUserMessage?.image ?? null;
      const quote = session?.quote ?? null;

      setLoading(true);
      try {
        await runSkill(suggestion.skillId, question, quote, image);
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessage,
      lastUserMessage,
      loadingRef,
      messages,
      patchMessage,
      runSkill,
      session,
      sessionId,
      setLoading,
      setSkillInStore,
    ]
  );

  const dismissProposal = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || loadingRef.current) return;
      patchMessage(sessionId, messageId, { resolution: 'dismissed' });

      // 確認カード（role:'proposal'）を断った場合は、まだ回答が無いので通常回答を出す。
      // 回答下の控えめな提案（role:'assistant'）を断った場合は、もう回答済みなので何もしない。
      if (target.role !== 'proposal') return;

      setLoading(true);
      try {
        await runLessonAi(
          lastUserMessage?.content ?? '',
          session?.quote ?? null,
          lastUserMessage?.image ?? null
        );
      } finally {
        setLoading(false);
      }
    },
    [lastUserMessage, loadingRef, messages, patchMessage, runLessonAi, session, sessionId, setLoading]
  );

  const selectSkill = useCallback(
    (next: AiSkillId) => {
      if (next === skillId) return;
      setSkillInStore(sessionId, next);
      appendMessage(sessionId, {
        id: nextId('s'),
        role: 'system',
        content:
          next === 'auto'
            ? 'おまかせに戻しました。内容に応じて適したモードを提案します。'
            : `${AI_SKILL_SHORT_LABEL[next]}モードに切り替えました。`,
        createdAt: new Date().toISOString(),
      });
    },
    [appendMessage, sessionId, setSkillInStore, skillId]
  );

  const explain = useCallback(
    async (q: AiCoachQuote): Promise<string> => {
      const request = buildRequest('この文章を短く説明してください', 'brief', q, null);
      if (!request) return '教材を読み込み中です。';
      try {
        const answer = await bffClient.askLessonAi(request);
        return answer.groundedInMaterial
          ? answer.conclusion
          : `${answer.conclusion}\n${answer.generalNote ?? ''}`;
      } catch {
        return '解説を取得できませんでした。時間をおいてお試しください。';
      }
    },
    [buildRequest]
  );

  /** ヘッダーの「現在参照中」に並べるラベル（仕様§3・§7） */
  const references = useMemo(() => {
    const refs: string[] = [];
    const heading = context.heading ?? context.lessonTitle;
    if (heading) refs.push(heading);
    if (skillId === 'design-review' && context.taskHeading) {
      refs.push(`${context.taskHeading}の評価基準`);
    }
    if (session?.image) refs.push('添付画像');
    if (session?.quote) refs.push('選択した教材本文');
    return refs;
  }, [context, session?.image, session?.quote, skillId]);

  return {
    sessionId,
    messages,
    loading,
    input: session?.input ?? '',
    setInput,
    quote: session?.quote ?? null,
    setQuote,
    image: session?.image ?? null,
    attachImageFile,
    clearImage,
    imageDropped: session?.imageDropped ?? false,
    send,
    explain,
    skillId,
    selectSkill,
    pendingProposal,
    acceptProposal,
    dismissProposal,
    contextHeading: context.heading,
    setContextHeading,
    references,
    context,
    scrollAnchorRef,
  };
}

export default useLessonAi;
