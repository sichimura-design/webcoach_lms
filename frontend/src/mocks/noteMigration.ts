/**
 * frontend/src/mocks/noteMigration.ts
 * ノートの保存形式 v1 → v2 → v3 移行と、空のときのデモシード。
 *
 * v1: { notes: NoteItem[]; memos } … メモ/クリップ/AI回答が時系列に並ぶ平坦な履歴
 * v2: { schemaVersion: 2; notes: Note[]; memos } … 器（Note）＋中身（NoteBlock）
 * v3: v2 ＋ Note.origin（出どころ）… 一覧の出どころバッジと絞り込みチップの根拠
 *
 * 🔴 memos（レッスン別の下書き）は触らない。下書きはノートではないし、
 *    MemoPane の自動保存がそこを読み書きしている。
 */
import {
  Note,
  NoteBlock,
  NoteOrigin,
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

export interface NoteStoreV3 {
  schemaVersion: 3;
  notes: Note[];
  memos: Record<string, { text: string; updatedAt: string }>;
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/**
 * 出どころを持っていないノート（v2 以前）に後から付ける。
 * 作成時の文脈は残っていないので、中身の証拠から推定する。
 * 'coaching' は判定材料が無い（コーチング→ノートの導線が未実装）ので出てこない。
 */
export function inferOrigin(note: Note): NoteOrigin {
  if (note.source) return 'material';
  if (note.blocks.some((b) => b.kind === 'clip')) return 'material';
  if (note.blocks.some((b) => b.kind === 'answer')) return 'ai';
  return 'self';
}

/** origin を持たないノートに推定値を入れて返す */
function withOrigin(note: Omit<Note, 'origin'> & { origin?: NoteOrigin }): Note {
  const filled = note as Note;
  return { ...filled, origin: note.origin ?? inferOrigin(filled) };
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
    notes.push(
      withOrigin({
        id: nextId('note'),
        title: head.lessonTitle || '無題のノート',
        blocks: sorted.map(blockOf),
        favorite: false,
        source: sourceOf(head),
        createdAt: head.createdAt,
        updatedAt: sorted[sorted.length - 1].createdAt,
      })
    );
  });

  if (orphans.length > 0) {
    const sorted = [...orphans].sort(asc);
    notes.push(
      withOrigin({
        id: nextId('note'),
        title: '未整理',
        blocks: sorted.map(blockOf),
        favorite: false,
        source: null,
        createdAt: sorted[0].createdAt,
        updatedAt: sorted[sorted.length - 1].createdAt,
      })
    );
  }

  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 一覧のカードだけを見せる軽いデモノート（本文1ブロック）。
 * デザイン『マイノート 3案』1a のカード28枚をそのまま写している。
 *
 * source を持たせないのは、実在しないコース・レッスンIDを捏造すると
 * ノート面の「元のレッスンへ」が行き先の無いリンクになるため。
 * 出どころバッジは origin が持つので、source が無くても表示は正しい。
 */
interface SeedCard {
  /** 一番新しいカード（1a の 8/19）を 0 とした日数 */
  daysAgo: number;
  origin: NoteOrigin;
  title: string;
  text: string;
  /** 1a で「重要」バッジが付いていたカード */
  favorite?: boolean;
}

const SEED_CARDS: SeedCard[] = [
  { daysAgo: 0, origin: 'coaching', favorite: true, title: '8/19 コーチングまとめ', text: 'ターゲットの課題に寄り添ったメッセージ設計が重要。特に「誰に」「どんな価値を」「どう届けるか」の3点を明確にする。' },
  { daysAgo: 1, origin: 'material', favorite: true, title: 'バナー改善の3ポイント', text: '視線の流れ（Zの法則）を意識して、伝えたい情報を優先順位で整理する。余白の使い方とコントラストを意識。' },
  { daysAgo: 2, origin: 'material', title: 'LPファーストビュー設計', text: '最初の3秒で「誰の」「どんな悩みを」「どう解決できるか」を伝える。視線を集めるキャッチコピーとビジュアルが鍵。' },
  { daysAgo: 2, origin: 'ai', favorite: true, title: 'AI回答：応募文の改善ポイント', text: '強みの根拠が具体的で良いです。成果を数字で示すと、説得力がさらに高まります。まずは「結論→根拠→再現性」の順で整理しましょう。' },
  { daysAgo: 3, origin: 'coaching', title: 'キャリアの方向性メモ', text: 'やりたいこと×得意なこと×価値を届けたいことの重なる領域を軸に考える。小さく試して検証していくことが大切。' },
  { daysAgo: 3, origin: 'material', title: '余白の使い方Tips', text: '要素間より外側の余白を広く。グループの関係は余白の差で伝わる。詰まって見えたらまず外側を広げる。' },
  { daysAgo: 4, origin: 'ai', favorite: true, title: 'AI回答：フォント選びの基準', text: 'まず可読性、次に世界観。見出しと本文で役割を分け、使うフォントは2種類までに絞ると整います。' },
  { daysAgo: 4, origin: 'material', title: 'デザイン4大原則の要点', text: '近接・整列・反復・コントラスト。迷ったら整列から見直すと、崩れの原因が見つかりやすい。' },
  { daysAgo: 5, origin: 'self', title: '参考バナーの共通点メモ', text: '目を引くバナーは色数が3色以内。メインコピーが全体の1/3以上の面積を占めている。' },
  { daysAgo: 7, origin: 'coaching', favorite: true, title: '8/12 コーチングまとめ', text: 'Zの法則を意識した構成に改善できた。配色の目的とトーンの統一が次回までの課題。' },
  { daysAgo: 7, origin: 'self', title: 'Figmaショートカット集', text: 'オートレイアウトはShift+A、コンポーネント化はCtrl+Alt+K。Enterで子要素に潜れる。' },
  { daysAgo: 8, origin: 'ai', title: 'AI回答：バナーの文字量', text: '訴求ポイントを1つに絞り、10〜20文字程度に。視線の流れを意識して簡潔に伝えましょう。' },
  { daysAgo: 9, origin: 'material', title: '配色ツールの使い分け', text: 'ベースカラーはブランドから、アクセントは補色から。迷ったらトーンを揃えて彩度だけ変える。' },
  { daysAgo: 14, origin: 'coaching', title: '8/5 コーチングまとめ', text: '「まず1案を最後まで通す」進め方に切り替える。完成の形を作ってから磨く習慣をつける。' },
  { daysAgo: 15, origin: 'self', title: '制作時間の記録', text: 'バナー1案に4時間かかった。ラフに1時間以上使いすぎ。次は30分でラフを固める。' },
  { daysAgo: 16, origin: 'ai', favorite: true, title: 'AI回答：提案文の構成', text: '結論→根拠→再現性の順で。実績は数字で示すと、相手が判断しやすくなります。' },
  { daysAgo: 17, origin: 'material', title: 'Zの法則と視線誘導', text: '視線は左上→右上→左下→右下。一番伝えたい情報は視線の起点か終点に置く。' },
  { daysAgo: 18, origin: 'material', title: '写真素材の選び方', text: '被写体の視線の先に余白を作ると自然。文字を載せる前提なら、背景がシンプルなものを選ぶ。' },
  { daysAgo: 20, origin: 'self', title: '課題の振り返り', text: 'コントラスト不足の指摘が2回続いた。文字と背景の明度差を先にチェックする癖をつける。' },
  { daysAgo: 21, origin: 'coaching', title: '7/29 コーチングまとめ', text: 'ポートフォリオの構成案を確認。作品ごとに「自分の役割」を明記する方針に決定。' },
  { daysAgo: 22, origin: 'ai', favorite: true, title: 'AI回答：配色の比率', text: 'ベース70%・メイン25%・アクセント5%が基本。アクセントは1色に絞ると引き締まります。' },
  { daysAgo: 24, origin: 'material', title: '見出しデザインの型', text: 'サイズ差・太さ・色の3つでコントラストをつける。装飾は最後、まず階層を作る。' },
  { daysAgo: 26, origin: 'self', title: '気になったLPメモ', text: 'ファーストビューに実績数字を置くLPが多い。「誰の悩みをどう解決するか」が3秒で分かる。' },
  { daysAgo: 28, origin: 'material', title: 'ハンズオン①の気づき', text: '手を動かすと理解が変わる。参考デザインの模写は、意図を言葉にしながらやると効果的。' },
  { daysAgo: 35, origin: 'coaching', title: '7/15 コーチングまとめ', text: '学習ペースは週5時間を維持。基礎コース修了後は実践課題に進むことを確認した。' },
];

/**
 * ストアが空のときに置くデモノート（28件）。
 * 🔴 これが無いと新規ブラウザでノート画面が真っ白になり、
 *    カードグリッドも絞り込みチップもページ送りもレビューできない。
 *    studyActivitySeed.ts と同じ「確認できる状態から始める」方針。
 *
 * 先頭3件だけはブロックを持つ厚いノート。クリップ・AI回答・==ハイライト== を
 * 含む唯一のデモで、カードを開いたノート面の確認に要る。
 * 日付を固定日にせず現在からの相対で置くのは、いつ開いても一覧が
 * 「最近の学び」に見えるようにするため。
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
      origin: 'material',
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
      origin: 'material',
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
      origin: 'self',
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
    ...SEED_CARDS.map((card) => {
      const stamp = iso(card.daysAgo * 24 * 60);
      return {
        id: nextId('note'),
        title: card.title,
        favorite: card.favorite ?? false,
        origin: card.origin,
        source: null,
        createdAt: stamp,
        updatedAt: stamp,
        blocks: [
          {
            id: nextId('text'),
            kind: 'text' as const,
            createdAt: stamp,
            updatedAt: stamp,
            text: card.text,
          },
        ],
      };
    }),
  ];
}

/** localStorage から読む。v1・v2 なら移行し、空ならシードを置く */
export function readNoteStore(): NoteStoreV3 {
  const empty: NoteStoreV3 = { schemaVersion: 3, notes: [], memos: {} };
  let parsed: any = null;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    /* 壊れていたら作り直す */
  }

  const memos = parsed?.memos && typeof parsed.memos === 'object' ? parsed.memos : {};

  if (parsed?.schemaVersion === 3 && Array.isArray(parsed.notes)) {
    return { schemaVersion: 3, notes: parsed.notes, memos };
  }

  // v2 → v3。器はそのまま、出どころだけを中身から推定して足す
  if (parsed?.schemaVersion === 2 && Array.isArray(parsed.notes)) {
    const notes = (parsed.notes as Note[]).map((note) => withOrigin(note));
    const upgraded: NoteStoreV3 = { schemaVersion: 3, notes, memos };
    writeNoteStore(upgraded);
    // eslint-disable-next-line no-console
    console.info(`[MSW] ノートに出どころを付けました（v2 → v3）: ${notes.length}ノート`);
    return upgraded;
  }

  // v1（schemaVersion 無し）か、まったくの空
  const legacy: LegacyNoteItem[] = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const notes = legacy.length > 0 ? migrateLegacyNotes(legacy) : buildSeedNotes(new Date());
  const migrated: NoteStoreV3 = { schemaVersion: 3, notes, memos };
  writeNoteStore(migrated);
  if (legacy.length > 0) {
    // eslint-disable-next-line no-console
    console.info(`[MSW] ノートを v3 へ移行しました: ${legacy.length}件 → ${notes.length}ノート`);
  }
  return { ...empty, ...migrated };
}

export function writeNoteStore(store: NoteStoreV3): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(store));
  } catch {
    /* 容量超過などは黙って諦める（モックのため） */
  }
}
