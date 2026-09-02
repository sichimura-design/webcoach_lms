import { Fragment } from 'react';
import { color } from '../../theme/webcoachTheme';

/**
 * ノート本文のミニ記法。
 *
 * 要件で「複雑なタグ / 高度なブロック編集は初期リリース不要」と切ってあるので、
 * リッチテキストエディタは入れない（フォルダは改善案で入ったが、1段だけで階層は無い）。
 * かわりに4つだけルールを決めて、素の <textarea> と描画ビューの往復で成立させる。
 *
 *   行頭 `## `    → 見出し（下にピンクのマーカー引き）
 *   行頭 `- `     → 箇条書き
 *   行頭 `- [ ] ` → チェックリスト（`- [x] ` で済み）。ツールバーの「チェックリスト」が入れる
 *   `==文字==`    → ピンクの下線ハイライト
 *
 * これで参照デザインの見た目（番号付き見出し・箇条書き・手書き風の下線）が
 * そのまま出せる。編集はテキストのままなので、書き手は記法を覚えなくても
 * 普通の文章として書ける。
 */

const TASK_LINE = /^- \[( |x|X)\] (.*)$/;

export interface RenderNoteTextOptions {
  /**
   * チェックリストの □ を押したとき。行番号（0 始まり、text.split('\n') の添字）と
   * 新しい状態を返す。渡さなければ □ は表示だけになる。
   */
  onToggleTask?: (lineIndex: number, checked: boolean) => void;
}

/** その行のチェック状態を書き換えた本文を返す（NoteBlockView が onPatch に渡す） */
export function toggleTaskLine(text: string, lineIndex: number, checked: boolean): string {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return text;
  const m = TASK_LINE.exec(line);
  if (!m) return text;
  lines[lineIndex] = `- [${checked ? 'x' : ' '}] ${m[2]}`;
  return lines.join('\n');
}

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

export function renderNoteText(text: string, options: RenderNoteTextOptions = {}): React.ReactNode {
  const { onToggleTask } = options;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  let tasks: { lineIndex: number; done: boolean; body: string }[] = [];

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

  const flushTasks = (key: string) => {
    if (tasks.length === 0) return;
    out.push(
      <ul key={`tasks-${key}`} className="notes-checklist" style={{ margin: '6px 0 12px', padding: 0 }}>
        {tasks.map((t) => (
          <li
            key={t.lineIndex}
            className={t.done ? 'is-done' : undefined}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, lineHeight: 2, color: color.textBody }}
          >
            <input
              type="checkbox"
              checked={t.done}
              disabled={!onToggleTask}
              aria-label={t.body || 'チェック項目'}
              // 読み取り表示の外側は「クリックで編集」なので、□ の操作を編集開始にしない
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggleTask?.(t.lineIndex, e.target.checked)}
              style={{ marginTop: 7, flexShrink: 0, cursor: onToggleTask ? 'pointer' : 'default' }}
            />
            <span style={{ minWidth: 0 }}>{renderInline(t.body, `task-${t.lineIndex}`)}</span>
          </li>
        ))}
      </ul>
    );
    tasks = [];
  };

  lines.forEach((line, i) => {
    const key = String(i);

    // チェックリストは `- ` より先に判定する（`- [ ] ` も `- ` で始まるため）
    const task = TASK_LINE.exec(line);
    if (task) {
      flushBullets(key);
      tasks.push({ lineIndex: i, done: task[1] !== ' ', body: task[2] });
      return;
    }
    flushTasks(key);

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
  flushTasks('last');
  return out;
}

/** 記法の説明。編集中だけ小さく添える */
export const NOTE_SYNTAX_HINT = '## 見出し ／ - 箇条書き ／ - [ ] チェック ／ ==マーカー==';

export default renderNoteText;
