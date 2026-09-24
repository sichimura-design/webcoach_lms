import { forwardRef, Fragment, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { toggleTaskLine } from './noteText';

/**
 * ノート本文の入力欄。見た目は「書いたとおりに整う」、中身は素のテキスト。
 *
 * 🔴 なぜ重ねているか
 *    v6 で本文を1枚の textarea にしたとき、記法（`- [ ] ` / `- ` / `==…==` / `## `）を
 *    描く部品（noteText.tsx の renderNoteText）をどこにも繋いでいなかった。
 *    ツールバーの「チェックリスト」を押しても `- [ ]` という文字が出るだけで、
 *    □ にもマーカーにもならなかった（ユーザー指摘）。
 *    リッチテキストエディタは入れない方針（noteText.tsx 冒頭）なので、
 *    **文字を透明にした textarea の真下に、同じ文字を同じ位置で描いた層（ミラー）を敷く**。
 *    打つのも選ぶのも IME も textarea のまま、目に見えるのはミラーの方。
 *
 * 🔴 ミラーは textarea と「1文字も違わない」こと。
 *    記法の文字は消さずに透明で残し、□ や ・ はその上に絶対配置で重ねる。
 *    文字を1つでも抜いたり太字（幅が変わる）にしたりすると、折り返し位置がずれて
 *    キャレットと見えている文字が食い違う。見出しの太さは -webkit-text-stroke で出す。
 *    フォント関係のスタイルは BODY_TEXT を両方に当てて揃える。
 *
 * 🔴 textarea は中スクロールさせない（overflow: hidden ＋ 高さを中身に合わせて伸ばす）。
 *    中でスクロールするとスクロールバーの分だけ幅が変わり、ミラーと折り返しがずれる。
 *
 * 🔴 □ だけはミラー側で押せる（pointer-events: auto）。それ以外のミラーは
 *    pointer-events: none で、クリックは下の textarea に届く。
 */

const TASK_RE = /^(- \[( |x|X)\] )(.*)$/;
const BULLET_RE = /^(- )(.*)$/;
const HEADING_RE = /^(## )(.*)$/;

type ParsedLine =
  | { kind: 'task'; prefix: string; rest: string; done: boolean }
  | { kind: 'bullet' | 'heading'; prefix: string; rest: string }
  | { kind: 'plain'; prefix: ''; rest: string };

/** 行頭の記法を読む。チェックリストは `- ` より先に見る（`- [ ] ` も `- ` で始まるため） */
export function parseNoteLine(line: string): ParsedLine {
  const task = TASK_RE.exec(line);
  if (task) return { kind: 'task', prefix: task[1], rest: task[3], done: task[2] !== ' ' };
  const bullet = BULLET_RE.exec(line);
  if (bullet) return { kind: 'bullet', prefix: bullet[1], rest: bullet[2] };
  const heading = HEADING_RE.exec(line);
  if (heading) return { kind: 'heading', prefix: heading[1], rest: heading[2] };
  return { kind: 'plain', prefix: '', rest: line };
}

/** textarea とミラーで共有する文字組み。どちらか片方だけ変えないこと */
const BODY_TEXT: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  lineHeight: 1.9,
  letterSpacing: 'inherit',
  wordSpacing: 'inherit',
  fontFeatureSettings: 'inherit',
  fontKerning: 'inherit',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'normal',
  tabSize: 4,
  padding: 0,
  margin: 0,
  border: 0,
  boxSizing: 'border-box',
  width: '100%',
};

const INK = '#4A4245';
/** 記法の文字。幅を取るためだけに残すので見せない */
const hidden: React.CSSProperties = { color: 'transparent' };

/** `==…==` にマーカーを引く。`==` 自体は透明にして幅だけ残す */
function renderInline(text: string, key: string): React.ReactNode[] {
  // 🔴 中身が空（ツールバーで何も選ばずに押した直後の `====`）も拾う。
  //    拾わないと `====` がそのまま見え、押した結果が記号にしか見えない。
  const parts = text.split(/==(.*?)==/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // 透明な `==` ごとマーカーで包む。外に出すと前後に空白のような隙間が見える
      <span key={`${key}-m${i}`} className="wc-note-mark">
        <span style={hidden}>==</span>
        {part}
        <span style={hidden}>==</span>
      </span>
    ) : (
      <Fragment key={`${key}-t${i}`}>{part}</Fragment>
    )
  );
}

function MirrorLine({
  line,
  index,
  onToggleTask,
}: {
  line: string;
  index: number;
  onToggleTask: (lineIndex: number, checked: boolean) => void;
}) {
  // 空行にも高さを持たせる（textarea は空行も1行ぶん取る）
  if (line === '') return <div>{'​'}</div>;

  const p = parseNoteLine(line);
  const key = `l${index}`;

  if (p.kind === 'task') {
    return (
      <div>
        <span style={{ ...hidden, position: 'relative' }}>
          {p.prefix}
          <input
            type="checkbox"
            className="notes-body-check"
            checked={p.done}
            aria-label={p.rest || 'チェック項目'}
            // textarea のキャレットを奪わない（押しても書いている位置はそのまま）
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => onToggleTask(index, e.target.checked)}
          />
        </span>
        <span className={p.done ? 'notes-body-done' : undefined}>{renderInline(p.rest, key)}</span>
      </div>
    );
  }

  if (p.kind === 'bullet') {
    return (
      <div>
        <span style={{ ...hidden, position: 'relative' }}>
          {p.prefix}
          <span aria-hidden="true" className="notes-body-bullet" />
        </span>
        {renderInline(p.rest, key)}
      </div>
    );
  }

  if (p.kind === 'heading') {
    return (
      <div style={{ color: '#1F1D1E', WebkitTextStroke: '0.45px currentColor' }}>
        <span style={{ ...hidden, position: 'relative', WebkitTextStroke: 0 }}>
          {p.prefix}
          <span aria-hidden="true" className="notes-body-heading-bar" />
        </span>
        <span className="wc-note-mark">{renderInline(p.rest, key)}</span>
      </div>
    );
  }

  return <div>{renderInline(line, key)}</div>;
}

interface NoteBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
}

/**
 * textarea の中身を範囲で置き換える。
 * execCommand('insertText') を使うのは、Ctrl+Z の履歴を残すため
 * （value を直接書き換えるとブラウザの取り消し履歴が切れる）。使えなければ直接書く。
 * execCommand が通ったら true（textarea はその場で書き換わり、onChange も同期で飛ぶ）。
 */
export function replaceRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  fallback: (next: string, caret: number) => void
): boolean {
  el.focus();
  el.setSelectionRange(start, end);
  const ok = text
    ? document.execCommand('insertText', false, text)
    : start === end || document.execCommand('delete');
  if (!ok) {
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    fallback(next, start + text.length);
  }
  return ok;
}

export const NoteBodyEditor = forwardRef<HTMLTextAreaElement, NoteBodyEditorProps>(function NoteBodyEditor(
  { value, onChange, onBlur, placeholder },
  forwardedRef
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement);

  // 中身に合わせて伸ばす（中スクロールさせない。理由は冒頭）
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(fit, [value, fit]);
  useLayoutEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  const setDirect = (next: string, caret: number) => {
    onChange(next);
    requestAnimationFrame(() => ref.current?.setSelectionRange(caret, caret));
  };

  const handleToggleTask = (lineIndex: number, checked: boolean) => {
    onChange(toggleTaskLine(value, lineIndex, checked));
  };

  /**
   * 箇条書き・チェックリストの続きを打ちやすくする。
   *   Enter      … 次の行にも同じ記法を付ける。中身の無い行で押したら記法を外す（リストを抜ける）
   *   Backspace  … 記法の直後で押したら記法ごと外す（透明な記号を1文字ずつ消させない）
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // 変換中の Enter は確定。触らない
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (el.selectionStart !== el.selectionEnd) return;
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

    // 🔴 props の value ではなく el.value を読む。速く打つと再描画が追いつかず、
    //    直前の Enter で足した行がまだ value に入っていない（古い行を見て誤判定する）
    const text = el.value;
    const caret = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
    const lineEndRaw = text.indexOf('\n', caret);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    const p = parseNoteLine(text.slice(lineStart, lineEnd));
    if (p.kind === 'plain') return;

    if (e.key === 'Backspace' && caret === lineStart + p.prefix.length) {
      e.preventDefault();
      replaceRange(el, lineStart, lineStart + p.prefix.length, '', setDirect);
      return;
    }

    if (e.key === 'Enter' && (p.kind === 'task' || p.kind === 'bullet') && caret >= lineStart + p.prefix.length) {
      e.preventDefault();
      if (p.rest.trim() === '') {
        replaceRange(el, lineStart, lineEnd, '', setDirect);
        return;
      }
      // 済みの行から続けても、新しい行は未チェックで始める
      const nextPrefix = p.kind === 'task' ? '- [ ] ' : '- ';
      replaceRange(el, caret, caret, `\n${nextPrefix}`, setDirect);
    }
  };

  const lines = value.split('\n');

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <textarea
        ref={ref}
        aria-label="本文"
        className="notes-body-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          ...BODY_TEXT,
          flex: '1 0 auto',
          minHeight: 220,
          overflow: 'hidden',
          background: 'transparent',
          color: 'transparent',
          caretColor: INK,
          resize: 'none',
          outline: 'none',
        }}
      />
      {/* 見えている本文。読み上げは textarea 側が担うので隠す（□ だけは操作できる） */}
      <div
        aria-hidden={value === ''}
        className="notes-body-mirror"
        style={{
          ...BODY_TEXT,
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          color: INK,
          pointerEvents: 'none',
        }}
      >
        {value !== '' && lines.map((line, i) => (
          <MirrorLine key={i} line={line} index={i} onToggleTask={handleToggleTask} />
        ))}
      </div>
    </div>
  );
});

export default NoteBodyEditor;
