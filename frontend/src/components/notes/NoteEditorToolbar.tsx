import { BookOpen, Heading, Highlighter, List, ListChecks } from 'lucide-react';

/** ツールバーが本文に差し込める記法（解釈は noteText.tsx） */
export type InsertKind = 'heading' | 'list' | 'task' | 'marker';

/**
 * 行頭に付ける記法。marker だけは行頭ではなく選択範囲を囲むので、ここには入れない。
 * 🔴 'text'（＝何も付けない）は持たない。本文が1本になり「空の文章ブロックを足す」
 *    という操作自体が無くなった。書きたければそのまま打てばいい。
 */
export const TEXT_PREFIX: Record<Exclude<InsertKind, 'marker'>, string> = {
  heading: '## ',
  list: '- ',
  task: '- [ ] ',
};

export const INSERT_LABEL: Record<InsertKind, string> = {
  heading: '見出し',
  list: '箇条書き',
  task: 'チェックリスト',
  marker: 'マーカー',
};

/**
 * ノート面の常設ツールバー。
 *
 * 🔴 押すと「本文のカーソル位置に記法を挿入する」。ブロックを足すのではない。
 *    v5 まではボタン1つで text ブロックが1つ生えていたが、本文が1本になったので
 *    やることは「いま書いている行の頭に ## を付ける」だけになった。
 *
 * 🔴「教材から引用」は押しても画面を移動しない。この判断は変えていない。
 *    最初は「教材へ飛ばすだけ」で、案内を読む前に画面が変わった。次に「やり方の説明＋
 *    レッスンへのリンク」にしたが、リンクを踏めば結局は遷移で、飛んだ先から
 *    書きかけのノートへどう戻るのかが分からなかった（レビュー指摘）。
 *    いまは **教材をモーダルで開く**。画面は /notes のまま、選んだ文章はこのノートに入る。
 *
 * 🔴「画像」ボタンは置かない。ノートに画像を持ち込む機能は撤去した。足し直さないこと。
 */
interface NoteEditorToolbarProps {
  onInsert: (kind: InsertKind) => void;
  /** 「教材から引用」。引用モーダルを開く（NoteEditor が持っている） */
  onQuote: () => void;
}

export function NoteEditorToolbar({ onInsert, onQuote }: NoteEditorToolbarProps) {
  const tool = (kind: InsertKind, icon: React.ReactNode) => (
    <button
      key={kind}
      type="button"
      // 押した瞬間に本文の textarea が blur すると、挿入位置（カーソル）が失われる
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(kind)}
      className="notes-tool notes-tool--light focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
    >
      {icon}
      {INSERT_LABEL[kind]}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="本文の書式"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        padding: '10px 28px',
        borderBottom: '1px solid var(--dc-border)',
        background: '#FFFDFA',
      }}
    >
      {tool('heading', <Heading size={14} />)}
      {tool('list', <List size={14} />)}
      {tool('task', <ListChecks size={14} />)}
      {tool('marker', <Highlighter size={14} />)}

      <button
        type="button"
        aria-haspopup="dialog"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onQuote}
        className="notes-tool notes-tool--light focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      >
        <BookOpen size={14} />
        教材から引用
      </button>

      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dc-text-subtle)', whiteSpace: 'nowrap' }}>
        Ctrl+S で保存
      </span>
    </div>
  );
}

export default NoteEditorToolbar;
