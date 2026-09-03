import { CSSProperties } from 'react';
import { AlertCircle, Check, Circle, Loader2, Maximize2, StickyNote } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { MAX_CONTENT_BYTES, UseStudyNote } from '../../hooks/useStudyNote';
import { formatNoteStamp, formatNoteTime } from '../../utils/noteDate';
import { CHAT_FOCUS_RING, iconButtonStyle } from '../chat';

/**
 * 教材ごとのメモ。教材ページ右サイドバーの「メモ」タブ。
 *
 * 入力は自動保存で、状態は必ず「アイコン＋言葉」で出す（色だけに頼らない）。
 * 「保存しました」には時刻を添える。時刻に結び付けておけば表示が古びても
 * 嘘にならない。以前は「自動保存済み」と出したまま、そのあと打っても
 * 文言が変わらず、いつ保存されたのかも分からなかった。
 */
interface MemoPanelProps {
  note: UseStudyNote;
  lessonTitle?: string;
  /** 全画面で書く */
  onExpand?: () => void;
  /** 親が高さを決めているか */
  fill?: boolean;
}

export function MemoPanel({ note, lessonTitle, onExpand, fill = false }: MemoPanelProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        minHeight: 0,
        height: fill ? '100%' : undefined,
        fontFamily: font.family,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 8,
          minHeight: 46,
          padding: '0 10px 0 14px',
          borderBottom: `1px solid ${color.border}`,
          flexShrink: 0,
        }}
      >
        <StickyNote size={15} style={{ color: color.primary }} />
        <strong style={{ ...font.label, fontWeight: 800, color: color.text }}>メモ</strong>
        <div style={{ flex: 1 }} />
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label="メモを全画面で書く"
            title="全画面で書く"
            className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
            style={iconButtonStyle(28)}
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* 🔴 320px幅では「保存しました 23:11」と「再試行」が見出し行に収まらない。
           状態は必ず独立した行に置く。 */}
      <div
        style={{
          padding: '7px 14px',
          borderBottom: `1px solid ${color.border}`,
          background: color.pageBg,
          flexShrink: 0,
        }}
      >
        <SaveStatusRow note={note} />
      </div>

      <MemoEditor
        note={note}
        lessonTitle={lessonTitle}
        style={fill ? { flex: 1, minHeight: 0 } : undefined}
      />
    </div>
  );
}

export default MemoPanel;

// ─────────────────────────────────────────
// 保存状態
// ─────────────────────────────────────────

const statusTextStyle: CSSProperties = {
  fontSize: 11,
  color: color.textMuted,
  fontFamily: font.family,
};

const clockStyle: CSSProperties = {
  fontSize: 11,
  color: color.textFaint,
  fontVariantNumeric: 'tabular-nums',
};

const inlineActionStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '0 2px',
  fontSize: 11,
  fontWeight: 700,
  color: color.primary,
  textDecoration: 'underline',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export function SaveStatusRow({ note }: { note: UseStudyNote }) {
  const { status } = note;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center"
      style={{ gap: 6, flexWrap: 'wrap', minHeight: 18 }}
    >
      {status.kind === 'loading' && (
        <>
          <Loader2 size={12} className="animate-spin" style={{ color: color.textSubtle }} />
          <span style={statusTextStyle}>読み込み中…</span>
        </>
      )}

      {status.kind === 'loadError' && (
        <>
          <AlertCircle size={12} style={{ color: color.primary }} />
          <span style={statusTextStyle}>メモを読み込めませんでした</span>
          <button
            type="button"
            onClick={note.reload}
            // 入力欄から離れるときの保存とクリックが競合しないよう、blur させない
            onMouseDown={e => e.preventDefault()}
            className={CHAT_FOCUS_RING}
            style={inlineActionStyle}
          >
            再読み込み
          </button>
        </>
      )}

      {status.kind === 'error' && (
        <>
          <AlertCircle size={12} style={{ color: color.primary }} />
          <span style={{ ...statusTextStyle, color: color.primary }}>{status.message}</span>
          {!note.overLimit && (
            <button
              type="button"
              onClick={() => void note.retry()}
              onMouseDown={e => e.preventDefault()}
              className={CHAT_FOCUS_RING}
              style={inlineActionStyle}
            >
              再試行
            </button>
          )}
        </>
      )}

      {status.kind === 'saving' && (
        <>
          <Loader2 size={12} className="animate-spin" style={{ color: color.textSubtle }} />
          <span style={statusTextStyle}>保存中…</span>
        </>
      )}

      {status.kind === 'dirty' && (
        <>
          <Circle size={7} style={{ color: color.primary, fill: color.primary }} />
          <span style={statusTextStyle}>未保存</span>
        </>
      )}

      {status.kind === 'savedClient' && (
        <>
          <Check size={12} strokeWidth={2.25} style={{ color: color.success }} />
          <span style={statusTextStyle}>保存しました</span>
          <span style={clockStyle}>{formatNoteTime(status.at)}</span>
        </>
      )}

      {status.kind === 'savedServer' && (
        <>
          <span style={statusTextStyle}>最終更新</span>
          <span style={clockStyle}>{formatNoteStamp(status.at)}</span>
        </>
      )}

      {status.kind === 'idle' && <span style={statusTextStyle}>自動保存されます</span>}
    </div>
  );
}

// ─────────────────────────────────────────
// 入力欄
// ─────────────────────────────────────────

interface MemoEditorProps {
  note: UseStudyNote;
  lessonTitle?: string;
  /** 全画面のときは高さを親に合わせる */
  style?: CSSProperties;
  autoFocus?: boolean;
}

export function MemoEditor({ note, lessonTitle, style, autoFocus }: MemoEditorProps) {
  const { content, phase } = note;
  const editable = phase === 'ready';
  const fill = !!style;

  // 🔴 scrollHeight で測る自動リサイズは display:none のあいだ 0 を返す。
  //    タブは display で出し入れするので、行数から高さを決める。
  const rows = Math.min(20, Math.max(9, content.split('\n').length + 1));

  const remaining = Math.max(0, MAX_CONTENT_BYTES - note.byteCount);
  const approxRemainingChars = Math.floor(remaining / 3);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
      // Ctrl+S は preventDefault しないとブラウザの「名前を付けて保存」が出る
      e.preventDefault();
      void note.flush();
      return;
    }
    if (e.key === 'Escape') e.currentTarget.blur(); // blur で保存が走る
  };

  return (
    <div
      className="flex flex-col"
      style={{ padding: 12, background: color.pageBg, minHeight: 0, ...style }}
    >
      <div
        className="flex flex-col"
        style={{
          flex: fill ? 1 : undefined,
          minHeight: 0,
          border: `1px solid ${color.border}`,
          borderRadius: 11,
          background: color.surface,
          overflow: 'hidden',
        }}
      >
        <textarea
          value={content}
          onChange={e => note.onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void note.flush()}
          readOnly={!editable}
          aria-busy={phase === 'loading'}
          aria-label="この教材のメモ"
          autoFocus={autoFocus}
          rows={fill ? undefined : rows}
          placeholder={
            phase === 'loading'
              ? '読み込み中…'
              : phase === 'loadError'
                ? 'メモを読み込めなかったため、いまは編集できません'
                : '気づいたこと、つまずいたこと、あとで試したいことをメモ…'
          }
          style={{
            flex: fill ? 1 : undefined,
            minHeight: fill ? 0 : 200,
            maxHeight: fill ? undefined : '46vh',
            resize: 'none',
            border: 0,
            outline: 'none',
            background: 'transparent',
            padding: '11px 12px 5px',
            color: editable ? color.text : color.textSubtle,
            fontSize: 12.5,
            lineHeight: 1.9,
            // 🔴 これが無いと等幅になる。@tailwind base を切っていて
            //    CSS リセットが無いので、フォーム部品は継承しない
            fontFamily: 'inherit',
            whiteSpace: 'pre-wrap',
          }}
        />

        <div
          className="flex items-center"
          style={{ gap: 8, padding: '4px 11px 8px', flexShrink: 0 }}
        >
          {lessonTitle && (
            <span
              style={{
                minWidth: 0,
                fontSize: 10,
                color: color.textFaint,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              「{lessonTitle}」のメモ
            </span>
          )}
          <div style={{ flex: 1 }} />
          {content.length > 0 && (
            <span
              style={{
                fontSize: 10,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                color: note.nearLimit ? color.primary : color.textFaint,
              }}
            >
              {note.nearLimit
                ? `残り約 ${approxRemainingChars.toLocaleString()} 字`
                : `${content.length.toLocaleString()} 字`}
            </span>
          )}
        </div>
      </div>

      {/* 打ち始める前だけ操作を教える。文字が入ったら邪魔なので消える */}
      {editable && content.length === 0 && (
        <p style={{ margin: '8px 2px 0', fontSize: 10, color: color.textFaint, lineHeight: 1.8 }}>
          入力すると自動で保存されます（Ctrl+S でもすぐ保存）
        </p>
      )}
    </div>
  );
}
