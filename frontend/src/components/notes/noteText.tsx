import { Fragment } from 'react';
import { color } from '../../theme/webcoachTheme';

/**
 * ノート本文のミニ記法。
 *
 * 要件で「複雑なタグ / フォルダ階層 / 高度なブロック編集は初期リリース不要」と
 * 切ってあるので、リッチテキストエディタは入れない。
 * かわりに3つだけルールを決めて、素の <textarea> と描画ビューの往復で成立させる。
 *
 *   行頭 `## ` → 見出し（下にピンクのマーカー引き）
 *   行頭 `- `  → 箇条書き
 *   `==文字==` → ピンクの下線ハイライト
 *
 * これで参照デザインの見た目（番号付き見出し・箇条書き・手書き風の下線）が
 * そのまま出せる。編集はテキストのままなので、書き手は記法を覚えなくても
 * 普通の文章として書ける。
 */

/** `==...==` を <mark> に変える。行内の他の記法とは独立して効く */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/==(.+?)==/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={`${keyPrefix}-m${i}`} className="wc-note-mark" style={{ background: 'none', color: 'inherit' }}>
        {part}
      </mark>
    ) : (
      <Fragment key={`${keyPrefix}-t${i}`}>{part}</Fragment>
    )
  );
}

export function renderNoteText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} style={{ margin: '6px 0 12px', paddingLeft: 20 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 13.5, lineHeight: 2, color: color.textBody }}>
            {renderInline(b, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((line, i) => {
    const key = String(i);
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
      return;
    }
    flushBullets(key);

    if (line.startsWith('## ')) {
      out.push(
        <h3
          key={`h-${key}`}
          style={{ margin: '18px 0 10px', fontSize: 15.5, fontWeight: 900, color: color.text, lineHeight: 1.6 }}
        >
          <span className="wc-note-mark">{renderInline(line.slice(3), `h-${key}`)}</span>
        </h3>
      );
      return;
    }

    if (line.trim() === '') {
      out.push(<div key={`sp-${key}`} style={{ height: 8 }} />);
      return;
    }

    out.push(
      <p key={`p-${key}`} style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 2, color: color.textBody }}>
        {renderInline(line, `p-${key}`)}
      </p>
    );
  });

  flushBullets('last');
  return out;
}

/** 記法の説明。編集中だけ小さく添える */
export const NOTE_SYNTAX_HINT = '## 見出し ／ - 箇条書き ／ ==マーカー==';

export default renderNoteText;
