import { BookOpen, Heading, Image as ImageIcon, List, ListChecks } from 'lucide-react';

/** ツールバーとブロックの ＋ が足せるもの。本文系は記法（noteText.tsx）の接頭辞で始める */
export type InsertKind = 'heading' | 'list' | 'task' | 'image' | 'text';

export const TEXT_PREFIX: Record<Exclude<InsertKind, 'image'>, string> = {
  heading: '## ',
  list: '- ',
  task: '- [ ] ',
  text: '',
};

export const INSERT_LABEL: Record<InsertKind, string> = {
  heading: '見出し',
  list: '箇条書き',
  task: 'チェックリスト',
  image: '画像',
  text: '文章',
};

/**
 * ノート面の常設ツールバー（デザイン『マイノート 改善案』⑥）。
 * 何を足せるのかが最初から見えている。現行は本文の下端に「＋ 画像・見出し・箇条書きを追加」
 * が1つあるだけで、開くまで何ができるか分からなかった。
 *
 * 🔴「教材から引用」は押しても画面を移動しない。この判断は変えていない。
 *    最初は「教材へ飛ばすだけ」で、案内を読む前に画面が変わった。次に「やり方の説明＋
 *    レッスンへのリンク」にしたが、リンクを踏めば結局は遷移で、飛んだ先から
 *    書きかけのノートへどう戻るのかが分からなかった（レビュー指摘）。
 *    いまは **教材をモーダルで開く**。画面は /notes のまま、選んだ文章はこのノートに入る。
 */
interface NoteEditorToolbarProps {
  onInsert: (kind: Exclude<InsertKind, 'text'>) => void;
  /** 「教材から引用」。引用モーダルを開く（NoteEditor が持っている） */
  onQuote: () => void;
}

export function NoteEditorToolbar({ onInsert, onQuote }: NoteEditorToolbarProps) {
  const tool = (kind: Exclude<InsertKind, 'text'>, icon: React.ReactNode) => (
    <button
      key={kind}
      type="button"
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
      aria-label="ノートに追加"
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
      {tool('image', <ImageIcon size={14} />)}

      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onQuote}
        className="notes-tool notes-tool--light focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      >
        <BookOpen size={14} />
        教材から引用
      </button>

      {tool('task', <ListChecks size={14} />)}

      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dc-text-subtle)', whiteSpace: 'nowrap' }}>
        行にカーソルを置くと、左に ⠿ と ＋ が出ます
      </span>
    </div>
  );
}

export default NoteEditorToolbar;
