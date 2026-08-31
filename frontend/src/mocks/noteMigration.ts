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
  /**
   * デモノートを一度でも置いたか。
   * 0件のときにシードを置き直すかどうかの判断に使う。これが無いと
   * 「自分で全部消した0件」と「置かれないままの0件」を区別できず、
   * 消したそばから28件戻ってくるか、真っ白のまま直らないかのどちらかになる。
   */
  seeded?: boolean;
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
 * ダミーの水増し用。テーマ（何について書いたか）と切り口（どう書いたか）を
 * 掛け合わせて、重複しないタイトルを作る。24テーマ × 6切り口 = 144通り。
 *
 * 🔴 「サンプル1」「サンプル2」のような連番タイトルにはしない。
 *    ページ送りの操作性を見るための水増しでも、カードの見え方（タイトルの
 *    長さのばらつき、書き出しの読めなさ）が本物と違うと判断を誤らせる。
 */
const DUMMY_TOPICS: { topic: string; text: string }[] = [
  { topic: '配色', text: 'ベース・メイン・アクセントの3層で考える。色を足したくなったら、まず明度と彩度で差をつけられないか試す。' },
  { topic: '余白', text: '要素の間より、グループの外側を広く取る。詰まって見えるときは大抵、外側が足りていない。' },
  { topic: 'フォント選び', text: '見出しと本文で役割を分け、使うのは2書体まで。可読性を最優先に、世界観はその次。' },
  { topic: '文字組み', text: '行間は文字サイズの1.6〜1.8倍。1行が長いときは行間を広げるより、幅を詰めるほうが読みやすい。' },
  { topic: '写真の選び方', text: '被写体の視線の先に余白を残す。文字を載せる前提なら、背景がうるさくないものを選ぶ。' },
  { topic: 'バナー制作', text: '訴求は1つに絞る。伝えたいことが2つあるなら、それは2枚のバナーにするべきという合図。' },
  { topic: 'LP構成', text: 'ファーストビューで「誰の」「どの悩みを」「どう解決するか」。ここが決まらないと以降が全部ぶれる。' },
  { topic: '視線誘導', text: 'Zの法則を基準に、一番伝えたいものを起点か終点に置く。装飾より配置で誘導する。' },
  { topic: 'コントラスト', text: '文字と背景の明度差を先に確認する。色の綺麗さは、読めることを満たしてから。' },
  { topic: 'あしらいの引き算', text: '影・枠・グラデを1つずつ外して、崩れないか見る。外して問題ないものは元々要らなかった。' },
  { topic: 'ワイヤーフレーム', text: '色を付けずに情報の順番だけ決める。ここで迷うなら、デザインではなく中身が決まっていない。' },
  { topic: 'Figmaの使い方', text: 'オートレイアウトを先に組むと、後の修正が段違いに早い。コンポーネント化は使い回す直前で十分。' },
  { topic: '素材の管理', text: 'ファイル名に日付と用途を入れる。「最新_v2_final」を作らないためのルールを最初に決める。' },
  { topic: '制作の段取り', text: 'ラフに時間をかけすぎない。30分で当たりを付けて、残りを詰める作業に回す。' },
  { topic: 'フィードバックの受け方', text: '指摘をそのまま直す前に、何が引っかかったのかを言葉にしてもらう。直し方は自分で決める。' },
  { topic: '模写のやり方', text: '見た目を似せるだけで終わらせない。なぜこの配置なのかを1要素ずつ言葉にしながら進める。' },
  { topic: 'ポートフォリオ', text: '作品ごとに自分の役割と意図を2行で添える。並び順は「見せたい順」にする。' },
  { topic: '案件の相談', text: '相手の目的と期限を先に聞く。デザインの話はその後。ここを飛ばすと後で必ず戻る。' },
  { topic: '見積もりの考え方', text: '作業時間だけでなく、修正の回数を前提に置く。含む範囲を先に文章にしておく。' },
  { topic: '学習ペース', text: '週の合計より、触らない日を作らないほうが効く。15分でも開くと翌日の入りが軽い。' },
  { topic: 'コーディング基礎', text: 'まずHTMLの構造だけで意味が通るか。見た目はCSSで後から乗せる。' },
  { topic: 'レスポンシブ', text: '狭い幅から作ると、詰め込みすぎに気付ける。広い幅は余白を足すだけで済むことが多い。' },
  { topic: 'アクセシビリティ', text: '色だけで情報を伝えない。形・位置・文言のどれかを必ず添える。' },
  { topic: 'AIの使いどころ', text: 'たたき台を出させて、選ぶのは自分。判断まで任せると、自分の引き出しが増えない。' },
];

const DUMMY_LENSES = ['のまとめ', 'の要点メモ', 'でつまずいた点', 'の振り返り', 'の練習ログ', 'をやってみた'];

/** 切り口ごとの締めの1行。書き出しが全部同じ調子になるのを避ける */
const DUMMY_TAILS = [
  '次に同じ場面が来たら、ここから読み直す。',
  '迷ったときの判断基準としてメモしておく。',
  '同じつまずき方を2回した。次は手順を変えて試す。',
  '今週やったことの中で、これが一番効いた。',
  '手を動かして分かったことなので、忘れないうちに残す。',
  'まず1回やってみた記録。次はここを変える。',
];

/** 出どころの出方。実際の使われ方に近づけて、教材とAIを厚めにする */
const DUMMY_ORIGINS: NoteOrigin[] = [
  'material', 'ai', 'self', 'material', 'coaching', 'ai', 'material', 'self', 'ai', 'material',
];

/**
 * ページ送りの確認用に、ダミーノートを指定件数だけ作る。
 *
 * @param count    作る件数
 * @param now      基準時刻
 * @param startDay 何日前から並べ始めるか（既存のデモノートより古い側に置く）
 */
export function buildDummyNotes(count: number, now: Date, startDay = 0): Note[] {
  const notes: Note[] = [];
  for (let i = 0; i < count; i += 1) {
    const { topic, text } = DUMMY_TOPICS[i % DUMMY_TOPICS.length];
    const lensIndex = Math.floor(i / DUMMY_TOPICS.length) % DUMMY_LENSES.length;
    // 0.7日刻み。全部が同じ時刻だと更新日順の並びが確認できない
    const minutesAgo = Math.round((startDay + i * 0.7) * 24 * 60);
    const stamp = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
    notes.push({
      id: nextId('note'),
      title: `${topic}${DUMMY_LENSES[lensIndex]}`,
      favorite: i % 7 === 3,
      origin: DUMMY_ORIGINS[i % DUMMY_ORIGINS.length],
      source: null,
      createdAt: stamp,
      updatedAt: stamp,
      blocks: [
        {
          id: nextId('text'),
          kind: 'text',
          createdAt: stamp,
          updatedAt: stamp,
          text: `${text}\n${DUMMY_TAILS[lensIndex]}`,
        },
      ],
    });
  }
  return notes;
}

/**
 * 初回に置くノートの件数。1ページ24件（MyNotesPage の PAGE_SIZE）なので
 * 100件 = 5ページ。ページ送りと、チップで絞ったときのページ数の変化を
 * そのまま確認できる件数にしてある。
 */
export const DEFAULT_SEED_COUNT = 100;

/**
 * ストアが空のときに置くデモノート（既定100件）。
 * 🔴 これが無いと新規ブラウザでノート画面が真っ白になり、
 *    カードグリッドも絞り込みチップもページ送りもレビューできない。
 *    studyActivitySeed.ts と同じ「確認できる状態から始める」方針。
 *
 * 先頭28件は手書きのデモ。うち3件はブロックを持つ厚いノートで、
 * クリップ・AI回答・==ハイライト== を含む唯一のデモ（ノート面の確認に要る）。
 * 29件目以降は buildDummyNotes の水増しで、ページ送りの確認用。
 * 日付を固定日にせず現在からの相対で置くのは、いつ開いても一覧が
 * 「最近の学び」に見えるようにするため。
 */
export function buildSeedNotes(now: Date, count: number = DEFAULT_SEED_COUNT): Note[] {
  const curated = buildCuratedNotes(now);
  if (count <= curated.length) return curated.slice(0, count);
  // 手書き分の一番古いカード（35日前）より後ろに続ける
  return [...curated, ...buildDummyNotes(count - curated.length, now, 36)];
}

function buildCuratedNotes(now: Date): Note[] {
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

/**
 * localStorage が使えない・容量超過のときの退避先。
 * 🔴 保存できなかったときに黙って諦めると、書いたノートが次のリクエストで
 *    消えて「読み込めない」ように見える。保存だけ諦めて、その場では動かす。
 */
let fallbackStore: NoteStoreV3 | null = null;

/** localStorage から読む。v1・v2 なら移行し、空ならシードを置く */
export function readNoteStore(): NoteStoreV3 {
  if (fallbackStore) return fallbackStore;

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
    // 🔴 「置かれないままの0件」はここで直す。デモを一度も置いていないのに
    //    0件で保存されているブラウザは、以後いくら開き直しても真っ白のまま
    //    （＝ノートが全然読み込めない）になる。seeded が立っていれば、
    //    自分で全部消した結果なので触らない。
    if (parsed.notes.length > 0 || parsed.seeded === true) {
      // 1枚でもあるストアは「出来上がっている」ので印を立てておく。
      // こうしておくと、このあと全部消しても勝手にデモが戻ってこない。
      return { schemaVersion: 3, notes: parsed.notes, memos, seeded: true };
    }
    const reseeded: NoteStoreV3 = {
      schemaVersion: 3,
      notes: buildSeedNotes(new Date()),
      memos,
      seeded: true,
    };
    writeNoteStore(reseeded);
    // eslint-disable-next-line no-console
    console.info(`[MSW] ノートが0件だったのでデモを置き直しました: ${reseeded.notes.length}件`);
    return reseeded;
  }

  // v2 → v3。器はそのまま、出どころだけを中身から推定して足す
  if (parsed?.schemaVersion === 2 && Array.isArray(parsed.notes)) {
    const notes = (parsed.notes as Note[]).map((note) => withOrigin(note));
    const upgraded: NoteStoreV3 = { schemaVersion: 3, notes, memos, seeded: true };
    writeNoteStore(upgraded);
    // eslint-disable-next-line no-console
    console.info(`[MSW] ノートに出どころを付けました（v2 → v3）: ${notes.length}ノート`);
    return upgraded;
  }

  // v1（schemaVersion 無し）か、まったくの空
  const legacy: LegacyNoteItem[] = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const notes = legacy.length > 0 ? migrateLegacyNotes(legacy) : buildSeedNotes(new Date());
  const migrated: NoteStoreV3 = { schemaVersion: 3, notes, memos, seeded: true };
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
    fallbackStore = null; // 保存できたので退避先は要らない
  } catch (e) {
    // 容量超過（AI回答の画像を貼ったノートで起きやすい）。保存は諦めるが、
    // このタブが開いている間はメモリ上のストアで動かし続ける。
    fallbackStore = store;
    // eslint-disable-next-line no-console
    console.warn('[MSW] ノートを保存できませんでした。このタブの間だけメモリ上で保持します', e);
  }
}
