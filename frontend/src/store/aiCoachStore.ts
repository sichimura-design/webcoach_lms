import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AiCoachContext,
  AiCoachMessage,
  AiCoachQuote,
  AiCoachSession,
  EMPTY_AI_COACH_CONTEXT,
} from '../types/aiCoach';
import { AiSkillId } from '../types/aiSkill';

/**
 * AIコーチの会話をセッション単位で保持する。
 *
 * なぜ store に出したか:
 *   会話を useLessonAi のローカル state で持っていると、教材ページの右パネルから
 *   AI専用ページへ「広い画面で続ける」ときに会話・添付画像・専門モードが引き継げない。
 *   同じ会話オブジェクトを両方の画面が見るようにするため、ここへ一本化する。
 *
 * 設計上の判断:
 *  1. セッションキーは教材由来なら 'lesson:{lessonId}'。レッスンを移ると自然に別会話に
 *     なるので、従来 useLessonAi が useEffect で明示的にやっていた
 *     「レッスンが変わったら会話をリセット」がキーの切り替えだけで済む。
 *  2. 永続化は sessionStorage。learningWorkspaceStore.ts は端末の好みなので
 *     localStorage だが、会話は「そのとき相談していた話」なのでタブを閉じたら
 *     残らない方が自然で、かつ容量事故を避けられる。
 *  3. 画像（dataURL）は永続化しない。数MBになり sessionStorage を溢れさせる。
 *     復元時は imageDropped を立て、UIに「再添付してください」を出させる。
 */

/**
 * 常駐ドロワー（教材ページ以外の全画面）と集中ブースのミニチャットが共有するセッション。
 * 「AIコーチは1人」という体験にするため、同じ会話を引き継がせる。
 * 教材ページは 'lesson:{id}' を使うので混ざらない。
 */
export const DRAWER_SESSION_ID = 'drawer';

/** 会話履歴の一覧に出す名前を、最初のユーザー発言から作る */
function deriveTitle(messages: AiCoachMessage[]): string | null {
  const first = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!first) return null;
  const text = first.content.trim().replace(/\s+/g, ' ');
  return text.length > 22 ? `${text.slice(0, 22)}…` : text;
}

function newSession(id: string, context?: Partial<AiCoachContext>): AiCoachSession {
  const now = new Date().toISOString();
  return {
    id,
    title: '新しい相談',
    skillId: 'auto',
    messages: [],
    context: { ...EMPTY_AI_COACH_CONTEXT, ...context },
    input: '',
    quote: null,
    image: null,
    imageDropped: false,
    createdAt: now,
    updatedAt: now,
  };
}

interface AiCoachState {
  sessions: Record<string, AiCoachSession>;
  /** 最後に発言があった順。会話履歴の並び順と、AI専用ページの初期表示に使う */
  order: string[];
  /** 単独会話の連番。'page:1', 'page:2' … */
  pageSeq: number;
  /** 常駐ドロワーの開閉。UI状態だがドロワーを開く操作が各所から呼ばれるのでここに置く */
  drawerOpen: boolean;

  /** 無ければ作る。あれば context だけ最新に更新する */
  ensureSession: (id: string, context?: Partial<AiCoachContext>) => void;
  setDrawerOpen: (open: boolean) => void;
  /** ドロワーを開く。文章を渡すと入力欄に流し込む（なぞって解説からの引用など） */
  openDrawer: (seedInput?: string) => void;
  patchSession: (id: string, patch: Partial<AiCoachSession>) => void;
  patchContext: (id: string, patch: Partial<AiCoachContext>) => void;
  setSkill: (id: string, skillId: AiSkillId) => void;
  setInput: (id: string, input: string) => void;
  setQuote: (id: string, quote: AiCoachQuote | null) => void;
  setImage: (id: string, image: string | null) => void;
  appendMessage: (id: string, message: AiCoachMessage) => void;
  patchMessage: (id: string, messageId: string, patch: Partial<AiCoachMessage>) => void;
  resetSession: (id: string) => void;
  /** AI専用ページで新しい相談を始める。作ったセッションIDを返す */
  createPageSession: () => string;
  deleteSession: (id: string) => void;
}

/** order の先頭へ移す（最近使った会話を上に出す） */
const touch = (order: string[], id: string): string[] => [id, ...order.filter((x) => x !== id)];

export const useAiCoachStore = create<AiCoachState>()(
  persist(
    (set, get) => ({
      sessions: {},
      order: [],
      pageSeq: 0,
      drawerOpen: false,

      ensureSession: (id, context) =>
        set((state) => {
          const existing = state.sessions[id];
          if (existing) {
            // 既にある会話なら、教材の見出しなど変化しうる文脈だけ差し替える。
            // messages を触らないのが重要（開き直しで会話が消えない）。
            if (!context) return state;
            return {
              sessions: {
                ...state.sessions,
                [id]: { ...existing, context: { ...existing.context, ...context } },
              },
            };
          }
          return {
            sessions: { ...state.sessions, [id]: newSession(id, context) },
            order: touch(state.order, id),
          };
        }),

      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

      openDrawer: (seedInput) => {
        get().ensureSession(DRAWER_SESSION_ID);
        if (seedInput) get().setInput(DRAWER_SESSION_ID, seedInput);
        set({ drawerOpen: true });
      },

      patchSession: (id, patch) =>
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, ...patch, updatedAt: new Date().toISOString() },
            },
          };
        }),

      patchContext: (id, patch) =>
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, context: { ...session.context, ...patch } },
            },
          };
        }),

      setSkill: (id, skillId) => get().patchSession(id, { skillId }),
      setInput: (id, input) => get().patchSession(id, { input }),
      setQuote: (id, quote) => get().patchSession(id, { quote }),
      setImage: (id, image) => get().patchSession(id, { image, imageDropped: false }),

      appendMessage: (id, message) =>
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          const messages = [...session.messages, message];
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                messages,
                title: deriveTitle(messages) ?? session.title,
                updatedAt: new Date().toISOString(),
              },
            },
            // 発言があった会話を一覧の先頭へ。AI専用ページを ?session= 無しで開いたときの
            // 初期表示（order[0]）が「直前まで話していた相談」になる。
            order: touch(state.order, id),
          };
        }),

      patchMessage: (id, messageId, patch) =>
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                messages: session.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      resetSession: (id) =>
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: { ...state.sessions, [id]: newSession(id, session.context) },
          };
        }),

      createPageSession: () => {
        const seq = get().pageSeq + 1;
        const id = `page:${seq}`;
        set((state) => ({
          pageSeq: seq,
          sessions: { ...state.sessions, [id]: newSession(id) },
          order: touch(state.order, id),
        }));
        return id;
      },

      deleteSession: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.sessions;
          return { sessions: rest, order: state.order.filter((x) => x !== id) };
        }),
    }),
    {
      name: 'webcoach-ai-coach',
      storage: createJSONStorage(() => sessionStorage),
      // 画像（dataURL）を保存対象から外す。数MBになり容量を溢れさせるため。
      // アクションと drawerOpen は保存しない（データだけを明示的に列挙する）。
      partialize: (state) => ({
        order: state.order,
        pageSeq: state.pageSeq,
        sessions: Object.fromEntries(
          Object.entries(state.sessions).map(([id, session]) => [
            id,
            {
              ...session,
              image: null,
              imageDropped: session.imageDropped || !!session.image,
              messages: session.messages.map(({ image, ...rest }) => rest),
            },
          ])
        ) as Record<string, AiCoachSession>,
      }),
    }
  )
);

export default useAiCoachStore;
