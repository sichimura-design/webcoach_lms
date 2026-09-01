import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 「前回の追加先ノート」の記憶。
 *
 * 🔴 これは保存先を"決める"ものではない。ピッカーの先頭に置く"候補"を思い出すだけ。
 *    以前はこのストアが追加先そのものを決めていて、一度選ぶと二度と聞かれなかった。
 *    しかも lastNoteId がレッスンを越えるので、別レッスン・別コース・
 *    AIコーチ（lessonId: null）からの保存まで、最初に選んだ1つのノートへ
 *    吸い込まれていた（多くの人にとっては第1レッスン名の「イントロダクション」）。
 *    保存先は毎回 NoteTargetPicker で選ぶ（hooks/useNoteCapture.ts）。
 *
 * 記憶自体は捨てない。捨てると毎回100件のノートから探すことになる。
 * ピッカーが「前回と同じ『X』に追加」を先頭に置けば、普段は1タップで済む。
 *
 * 端末ごとの好みなのでサーバへ送る意味がなく、localStorage に置く
 * （store/studyTimerStore.ts と同じ流儀）。
 */

/**
 * タイトルまで持つのは、ピッカーが getNote せずに
 * 「前回と同じ『X』に追加」を即描けるようにするため。
 */
export interface NoteTargetRef {
  noteId: string;
  title: string;
}

interface NoteTargetState {
  /** レッスンID → 前回の追加先 */
  byLesson: Record<string, NoteTargetRef>;
  /** レッスンに紐づかない保存（AIコーチ専用ページなど）の受け皿 */
  last: NoteTargetRef | null;
  /** 追加が成功したときに呼ぶ */
  remember: (lessonId: number | null, target: NoteTargetRef) => void;
  /** 削除済みノートを指していたときに掃除する */
  forget: (noteId: string) => void;
  /**
   * ピッカーの先頭に置く候補。“決定”ではなく“提案”。
   * 解決順: そのレッスンの前回 → 直近に使ったノート → 無し。
   * 🔴 保持しているオブジェクトをそのまま返す（内部で複製しない）。
   *    zustand のセレクタとして呼んでも再レンダリングが止まらなくなるため。
   */
  suggestFor: (lessonId: number | null) => NoteTargetRef | null;
}

export const useNoteTargetStore = create<NoteTargetState>()(
  persist(
    (set, get) => ({
      byLesson: {},
      last: null,

      remember: (lessonId, target) =>
        set((s) => ({
          last: target,
          byLesson:
            lessonId == null ? s.byLesson : { ...s.byLesson, [String(lessonId)]: target },
        })),

      forget: (noteId) =>
        set((s) => ({
          last: s.last?.noteId === noteId ? null : s.last,
          byLesson: Object.fromEntries(
            Object.entries(s.byLesson).filter(([, ref]) => ref.noteId !== noteId)
          ),
        })),

      suggestFor: (lessonId) => {
        const s = get();
        if (lessonId != null) {
          const hit = s.byLesson[String(lessonId)];
          if (hit) return hit;
        }
        return s.last;
      },
    }),
    {
      name: 'webcoach-note-target',
      version: 2,
      /*
       * v0/v1 は `byLesson: Record<string, string>` と `lastNoteId: string` で、
       * ノートIDだけを持っていた。そのまま読むと ref.title が undefined になり
       * 「前回と同じ『undefined』に追加」というボタンが出る。
       * この記憶はもうハイライトの材料にすぎないので、捨てても損失がない
       * （次に保存した時点で作り直される）。
       */
      migrate: () => ({ byLesson: {}, last: null }) as unknown as NoteTargetState,
    }
  )
);

export default useNoteTargetStore;
