import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AiCoachContext,
  AiCoachMessage,
  AiCoachQuote,
  AiCoachSession,
  EMPTY_AI_COACH_CONTEXT,
} from '../types/aiCoach';
import { AiSkillId, AI_SKILL_SHORT_LABEL, ConcreteAiSkillId } from '../types/aiSkill';

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

/**
 * 「広い画面で続ける」で拡大する前に居た場所。
 *
 * 拡大は一方通行にしない。押した側（右下ドロワー・教材ページの右パネル）は
 * 自分がどこに居たかを知っているが、遷移先のAI専用ページは知らないので、
 * ここに預けて戻り導線（AiCoachReturnBar）を描けるようにする。
 * ブラウザバックでも戻れるが、それだとドロワーが閉じたままになり、
 * 画面上に畳む手掛かりが無い状態が残る。
 *
 * 🔴 これは「セッションの戻り先」ではなく「AI専用ページに入る前の居場所」。
 *    以前はセッション単位に見ていたので、ホームへ移る・別の相談を開くだけで
 *    戻り導線が消え、出口の無い画面になっていた。
 */
export interface AiCoachExpandOrigin {
  /**
   * 拡大したセッション。戻り導線を出すかどうかの条件ではなく、
   * 押したときの挙動の出し分け（畳む＝ドロワーを開き直す／ただ戻る）に使う。
   */
  sessionId: string;
  /** 戻り先（pathname + search） */
  path: string;
  /** 戻り導線に出す呼び名。例:「『Webデザイン基礎』に戻る」 */
  label: string;
  /** 常駐ドロワーからの拡大。畳んだらドロワーを開き直す */
  fromDrawer: boolean;
}

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
    parentId: null,
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
  /** 「広い画面で続ける」の戻り先。拡大していないときは null */
  expandOrigin: AiCoachExpandOrigin | null;

  /** 無ければ作る。あれば context だけ最新に更新する */
  ensureSession: (id: string, context?: Partial<AiCoachContext>) => void;
  setDrawerOpen: (open: boolean) => void;
  /** 拡大時に呼ぶ。戻り先を覚えて「元の画面に戻す」を出せるようにする */
  setExpandOrigin: (origin: AiCoachExpandOrigin) => void;
  /** 畳んだ／別の相談に移ったので戻り先を捨てる */
  clearExpandOrigin: () => void;
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
  /**
   * 専門モードのセッションを始める。作ったセッションIDを返す。
   * 親会話から起動した場合は parentId を持たせ、必要な文脈だけをコピーする。
   */
  createSkillSession: (args: CreateSkillSessionArgs) => string;
  deleteSession: (id: string) => void;
}

export interface CreateSkillSessionArgs {
  skillId: ConcreteAiSkillId;
  /** 親会話。ホームから直接選んだ場合は null */
  parentId?: string | null;
  /** 引き継ぐ文脈（教材・課題の評価基準） */
  context?: Partial<AiCoachContext>;
  /** 入力欄へ流し込む下書き */
  input?: string;
  /** 引き継ぐ添付画像（dataURL） */
  image?: string | null;
  /** 引き継ぐ引用中の教材本文 */
  quote?: AiCoachQuote | null;
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
      expandOrigin: null,

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

      setExpandOrigin: (expandOrigin) => set({ expandOrigin }),
      clearExpandOrigin: () => set({ expandOrigin: null }),

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

      createSkillSession: ({ skillId, parentId = null, context, input, image, quote }) => {
        const seq = get().pageSeq + 1;
        const id = `page:${seq}`;
        set((state) => {
          const base = newSession(id, context);
          return {
            pageSeq: seq,
            sessions: {
              ...state.sessions,
              [id]: {
                ...base,
                parentId,
                skillId,
                // 一覧では子を「└ 制作物添削」と見せたいので、既定名を機能名にしておく。
                // 発言があれば deriveTitle が相談内容に置き換える。
                title: AI_SKILL_SHORT_LABEL[skillId],
                input: input ?? '',
                image: image ?? null,
                quote: quote ?? null,
              },
            },
            order: touch(state.order, id),
          };
        });
        return id;
      },

      deleteSession: (id) =>
        set((state) => {
          // 専門セッションは親の文脈を引いて始まっているので、親だけ消して
          // 子を宙に浮かせない。一覧に親のない「└ 制作物添削」が残るのを避ける。
          const removing = new Set([
            id,
            ...Object.values(state.sessions)
              .filter((s) => s.parentId === id)
              .map((s) => s.id),
          ]);
          return {
            sessions: Object.fromEntries(
              Object.entries(state.sessions).filter(([key]) => !removing.has(key))
            ),
            order: state.order.filter((x) => !removing.has(x)),
            // 🔴 expandOrigin はここで消さない。会話を消しても「元居た画面」は
            //    そのまま有効で、消すとAI専用ページから出る手段ごと失われる。
            //    畳む先の会話が無いときは、戻り導線が「ただ戻る」に変わるだけ。
          };
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
        // 拡大したまま再読み込みしても畳めるように、戻り先だけは保存する
        expandOrigin: state.expandOrigin,
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
