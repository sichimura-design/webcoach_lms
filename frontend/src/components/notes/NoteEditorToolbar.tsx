import { useRef, useState } from 'react';
import { BookOpen, ExternalLink, Heading, Image as ImageIcon, List, ListChecks } from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';

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
 * 🔴「教材から引用」は押しても画面を移動しない。この画面には素材が無いので、
 *    押させると「教材へ飛ばすだけ」になる（以前それをやって、案内を読む前に画面が変わった）。
 *    やり方の説明を出し、元のレッスンがあるときだけリンクを添える。
 */
interface NoteEditorToolbarProps {
  onInsert: (kind: Exclude<InsertKind, 'text'>) => void;
  /** このノートの元レッスン。あれば「〜を開く」を出す */
  sourceLesson: { label: string; onOpen: () => void } | null;
}

export function NoteEditorToolbar({ onInsert, sourceLesson }: NoteEditorToolbarProps) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  useDismissable(quoteRef, quoteOpen, () => setQuoteOpen(false));

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

      <div ref={quoteRef} style={{ position: 'relative' }}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={quoteOpen}
          onClick={() => setQuoteOpen((v) => !v)}
          className="notes-tool notes-tool--light focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        >
          <BookOpen size={14} />
          教材から引用
        </button>
        {quoteOpen && (
          <div role="dialog" aria-label="教材から引用する方法" className="notes-menu" style={{ top: 38, left: 0, width: 300, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: 'var(--dc-text-body)' }}>
              教材の文章を選んで<b>「クリップ」</b>を押すと、選んだノートに入ります。
              AIの回答は AIコーチの<b>「保存」</b>から入ります。
            </p>
            {sourceLesson ? (
              <button
                type="button"
                onClick={() => {
                  setQuoteOpen(false);
                  sourceLesson.onOpen();
                }}
                className="notes-menu-item"
                style={{ marginTop: 8, color: 'var(--dc-primary)' }}
              >
                <ExternalLink size={14} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>「{sourceLesson.label}」を開く</span>
              </button>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: 11.5, lineHeight: 1.7, color: 'var(--dc-text-subtle)' }}>
                このノートは教材から作られていないので、開くレッスンはありません。
              </p>
            )}
          </div>
        )}
      </div>

      {tool('task', <ListChecks size={14} />)}

      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dc-text-subtle)', whiteSpace: 'nowrap' }}>
        行にカーソルを置くと、左に ⠿ と ＋ が出ます
      </span>
    </div>
  );
}

export default NoteEditorToolbar;
