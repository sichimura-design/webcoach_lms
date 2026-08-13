/**
 * frontend/src/mocks/noteMigration.ts
 * ノートの保存形式 v1 → v2 移行と、空のときのデモシード。
 *
 * v1: { notes: NoteItem[]; memos } … メモ/クリップ/AI回答が時系列に並ぶ平坦な履歴
 * v2: { schemaVersion: 2; notes: Note[]; memos } … 器（Note）＋中身（NoteBlock）
 *
 * 🔴 memos（レッスン別の下書き）は触らない。下書きはノートではないし、
 *    MemoPane の自動保存がそこを読み書きしている。
 */
import {
  Note,
  NoteBlock,
  NoteSourceRef,
} from '../types/notes';

export const NOTES_KEY = 'webcoach-lesson-notes';

/** v1 のレコード。移行のためだけに残す最小の形 */
interface LegacyNoteItem {
  id: string;
  kind: 'memo' | 'clip' | 'answer';
  courseId: number;
  courseName: string;
  lessonId: number;
  lessonTitle: string;
  blockId: string | null;
  heading: string | null;
  text: string;
  question: string | null;
  selectedText: string | null;
  image: string | null;
  offset: number | null;
  createdAt: string;
}

export interface NoteStoreV2 {
  schemaVersion: 2;
  notes: Note[];
  memos: Record<string, { text: string; updatedAt: string }>;
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function sourceOf(item: LegacyNoteItem): NoteSourceRef {
  return {
    courseId: item.courseId,
    courseName: item.courseName,
    lessonId: item.lessonId,
    lessonTitle: item.lessonTitle,
    heading: item.heading,
    blockId: item.blockId,
    offset: item.offset,
  };
}

function blockOf(item: LegacyNoteItem): NoteBlock {
  const base = { id: nextId(item.kind), createdAt: item.createdAt, updatedAt: item.createdAt };
  if (item.kind === 'clip') {
    return { ...base, kind: 'clip', text: item.text, source: sourceOf(item) };
  }
  if (item.kind === 'answer') {
    return {
      ...base,
      kind: 'answer',
      question: item.question ?? '',
      answer: item.text,
      selectedText: item.selectedText,
      image: item.image,
      source: sourceOf(item),
    };
  }
  return { ...base, kind: 'text', text: item.text };
}

/**
 * v1 のレコードを「レッスン1つ＝ノート1つ」に畳む。
 *
 * 🔴 全部を1つの「未整理」に入れない。それをやると、新しい画面を開いた瞬間
 *    ノートの中に旧画面（平坦な履歴）がそのまま入っていることになり、
 *    いま置き換えようとしているものを再現してしまう。
 *    レッスン別に畳めば、初日から「このレッスンのノート」という新概念の実物が存在する。
 *    旧レコードは courseName / lessonTitle を持っているのでデータを捏造しない。
 * 🔴 捨てない。ユーザー自身が書いたもの。
 */
export function migrateLegacyNotes(legacy: LegacyNoteItem[]): Note[] {
  const byLesson = new Map<string, LegacyNoteItem[]>();
  const orphans: LegacyNoteItem[] = [];

  for (const item of legacy) {
    if (Number.isFinite(item?.lessonId) && item.lessonId > 0) {
      const key = String(item.lessonId);
      const list = byLesson.get(key);
      if (list) list.push(item);
      else byLesson.set(key, [item]);
    } else {
      orphans.push(item);
    }
  }

  const asc = (a: LegacyNoteItem, b: LegacyNoteItem) => a.createdAt.localeCompare(b.createdAt);
  const notes: Note[] = [];

  byLesson.forEach((items) => {
    const sorted = [...items].sort(asc);
    const head = sorted[0];
    notes.push({
      id: nextId('note'),
      title: head.lessonTitle || '無題のノート',
      blocks: sorted.map(blockOf),
      favorite: false,
      source: sourceOf(head),
      createdAt: head.createdAt,
      updatedAt: sorted[sorted.length - 1].createdAt,
    });
  });

  if (orphans.length > 0) {
    const sorted = [...orphans].sort(asc);
    notes.push({
      id: nextId('note'),
      title: '未整理',
      blocks: sorted.map(blockOf),
      favorite: false,
      source: null,
      createdAt: sorted[0].createdAt,
      updatedAt: sorted[sorted.length - 1].createdAt,
    });
  }

  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * ストアが空のときに置くデモノート。
 * 🔴 これが無いと新規ブラウザでノート画面が真っ白になり、
 *    2カラムのレイアウトもブロックの見分けもレビューできない。
 *    studyActivitySeed.ts と同じ「確認できる状態から始める」方針。
 */
export function buildSeedNotes(now: Date): Note[] {
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const source: NoteSourceRef = {
    courseId: 203,
    courseName: 'バナーを作ってみよう',
    lessonId: 203021,
    lessonTitle: 'ハンズオン①',
    heading: 'バナー制作の基礎',
    blockId: null,
    offset: null,
  };

  return [
    {
      id: nextId('note'),
      title: 'バナー制作の学び',
      favorite: true,
      source,
      createdAt: iso(60 * 26),
      updatedAt: iso(35),
      blocks: [
        {
          id: nextId('text'),
          kind: 'text',
          createdAt: iso(60 * 26),
          updatedAt: iso(60 * 26),
          text:
            '## 1. バナーデザインの目的を明確にする\n' +
            'まず、誰に何を伝えたいのかをはっきりさせることが大事。目的がブレると、デザインの方向性もブレてしまう。\n' +
            '- ターゲットは誰か？\n' +
            '- 伝えたいメッセージは？\n' +
            '- 行動してほしいことは？\n' +
            'この3つが明確になると、==レイアウトや配色も自然と決まってくる==',
        },
        {
          id: nextId('clip'),
          kind: 'clip',
          createdAt: iso(90),
          updatedAt: iso(90),
          text: '余白を意識することで、情報の優先順位が伝わりやすくなる',
          source,
        },
        {
          id: nextId('answer'),
          kind: 'answer',
          createdAt: iso(35),
          updatedAt: iso(35),
          question: 'バナーの文字量はどのくらいが最適ですか？',
          answer:
            'バナーは視認時間が短いため、訴求ポイントを1つに絞り、10〜20文字程度にまとめるのが効果的です。\n' +
            '長い文章は避け、視線の流れを意識して簡潔に伝えましょう。',
          selectedText: null,
          image: null,
          source,
        },
      ],
    },
    {
      id: nextId('note'),
      title: '配色ルールまとめ',
      favorite: false,
      source: {
        ...source,
        courseId: 202,
        courseName: '配色の基本とツール',
        lessonId: 202012,
        lessonTitle: '基本の考え方',
        heading: '配色の役割',
      },
      createdAt: iso(60 * 50),
      updatedAt: iso(60 * 20),
      blocks: [
        {
          id: nextId('text'),
          kind: 'text',
          createdAt: iso(60 * 50),
          updatedAt: iso(60 * 20),
          text:
            '## 配色は70:25:5\n' +
            'ベース70%・メイン25%・アクセント5%。迷ったらこの比率に戻す。\n' +
            '- ベースは背景。主張させない\n' +
            '- アクセントは1箇所だけ。増やすとどれも目立たなくなる',
        },
      ],
    },
    {
      id: nextId('note'),
      title: 'ポートフォリオ改善案',
      favorite: false,
      source: null,
      createdAt: iso(60 * 74),
      updatedAt: iso(60 * 70),
      blocks: [
        {
          id: nextId('text'),
          kind: 'text',
          createdAt: iso(60 * 74),
          updatedAt: iso(60 * 70),
          text: '次のコーチングまでに、作品の並び順を「見せたい順」に直す。制作意図を1作品につき2行だけ添える。',
        },
      ],
    },
  ];
}

/** localStorage から読む。v1 なら移行し、空ならシードを置く */
export function readNoteStore(): NoteStoreV2 {
  const empty: NoteStoreV2 = { schemaVersion: 2, notes: [], memos: {} };
  let parsed: any = null;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    /* 壊れていたら作り直す */
  }

  const memos = parsed?.memos && typeof parsed.memos === 'object' ? parsed.memos : {};

  if (parsed?.schemaVersion === 2 && Array.isArray(parsed.notes)) {
    return { schemaVersion: 2, notes: parsed.notes, memos };
  }

  // v1（schemaVersion 無し）か、まったくの空
  const legacy: LegacyNoteItem[] = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const notes = legacy.length > 0 ? migrateLegacyNotes(legacy) : buildSeedNotes(new Date());
  const migrated: NoteStoreV2 = { schemaVersion: 2, notes, memos };
  writeNoteStore(migrated);
  if (legacy.length > 0) {
    // eslint-disable-next-line no-console
    console.info(`[MSW] ノートを v2 へ移行しました: ${legacy.length}件 → ${notes.length}ノート`);
  }
  return { ...empty, ...migrated };
}

export function writeNoteStore(store: NoteStoreV2): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(store));
  } catch {
    /* 容量超過などは黙って諦める（モックのため） */
  }
}
