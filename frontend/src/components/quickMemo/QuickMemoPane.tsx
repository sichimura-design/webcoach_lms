import React, { useEffect, useRef } from 'react';
import { AlertCircle, Check, Loader2, Plus, RotateCcw } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';

/**
 * PiP小窓の中身。速記のテキストエリア1枚。
 * ============================================================
 * 🔴 このファイルは自己完結していること。
 *    描画先は親と別のドキュメントなので、以下は一切効かない。
 *      - Tailwind のクラス（w-4 h-4 / focus-visible:ring-* など）
 *      - --dc-* の CSS変数（index.css の .wc-warm スコープ）
 *      - index.css のクラス（.notes-tool など）
 *      - useDismissable / useMediaQuery（グローバルの document/window を直に見る）
 *    使ってよいのは インラインstyle と、下の SELF_CONTAINED_CSS だけ。
 *    theme/webcoachTheme.ts は ただのJSオブジェクトなので、そのまま使える。
 *
 * 🔴 ブロックの粒度は「1コミット＝1ブロック」。
 *    打つたびに追記するとノートにブロックが数十個できる。書き切ってから
 *    「ノートに追加」を押した分だけが text ブロックになる。
 * ============================================================
 */

const SELF_CONTAINED_CSS = [
  '@keyframes qm-spin{to{transform:rotate(360deg)}}',
  '.qm-spin{animation:qm-spin 1s linear infinite}',
  `.qm-input::placeholder{color:${color.textFaint}}`,
  `.qm-input:focus{outline:none;border-color:${color.primaryBorder};`,
  `box-shadow:0 0 0 3px ${color.primarySoft}}`,
  '.qm-input::-webkit-scrollbar{width:10px}',
  `.qm-input::-webkit-scrollbar-thumb{background:${color.borderNeutral};border-radius:999px;`,
  'border:3px solid transparent;background-clip:content-box}',
  `.qm-commit:hover:not(:disabled){background:${color.primaryHover}}`,
  '.qm-commit:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}',
].join('');

/** ⌘ か Ctrl か。小窓のヒント1行のためだけの判定なので UA で十分 */
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.userAgent);
const COMMIT_HINT = `${isMac ? '⌘' : 'Ctrl'} + Enter`;

export interface QuickMemoPaneProps {
  /** 「→ 9/4 コーチング記録」の右側。開いた時点の転記先を固定して見せる */
  targetLabel: string;
  text: string;
  onChangeText: (text: string) => void;
  status: 'idle' | 'saving' | 'saved';
  restored: boolean;
  committing: boolean;
  /** 追加に失敗したときの文言。出ている間も下書きは消さない */
  error: string | null;
  onCommit: () => void;
}

function StatusLine({ status }: { status: QuickMemoPaneProps['status'] }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    color: color.textSubtle,
    whiteSpace: 'nowrap',
  };
  if (status === 'saving') {
    return (
      <span style={base}>
        <Loader2 size={12} className="qm-spin" />
        保存中
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span style={base}>
        <Check size={12} strokeWidth={2.5} style={{ color: color.success }} />
        保存しました
      </span>
    );
  }
  return <span style={base} />;
}

export function QuickMemoPane({
  targetLabel,
  text,
  onChangeText,
  status,
  restored,
  committing,
  error,
  onCommit,
}: QuickMemoPaneProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // requestWindow() は窓にフォーカスを当てるが、中の textarea には当てない。
  // ポータルが commit された次のフレームで自分から取りに行く
  // （autoFocus 属性は別ドキュメントだと順序が不安定なので使わない）。
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const canCommit = text.trim() !== '' && !committing;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 🔴 変換確定の Enter を送信に取られないようにする。
    //    前例: learning/CourseSearchPanel.tsx:155, LearningWorkspacePage.tsx:266
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canCommit) onCommit();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 12,
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            ...font.caption,
            fontWeight: 700,
            color: color.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
          title={targetLabel}
        >
          → {targetLabel}
        </span>
        <StatusLine status={status} />
      </div>

      {restored && (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            margin: 0,
            fontSize: 11,
            fontWeight: 500,
            color: color.textSubtle,
          }}
        >
          <RotateCcw size={12} />
          前回の書きかけを復元しました
        </p>
      )}

      <textarea
        ref={inputRef}
        className="qm-input"
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="話しながら思ったことを、そのまま。"
        spellCheck={false}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          resize: 'none',
          padding: '10px 12px',
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          background: color.surface,
          color: color.text,
          fontFamily: 'inherit',
          fontSize: 13.5,
          lineHeight: 1.85,
          transition: 'border-color .15s, box-shadow .15s',
        }}
      />

      {error && (
        <p
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 5,
            margin: 0,
            fontSize: 11.5,
            fontWeight: 700,
            lineHeight: 1.6,
            color: color.primary,
          }}
          role="alert"
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: color.textFaint, flex: 1 }}>
          {COMMIT_HINT} でも追加
        </span>
        <button
          type="button"
          className="qm-commit"
          onClick={onCommit}
          disabled={!canCommit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: color.primary,
            color: color.textOnPrimary,
            border: 'none',
            borderRadius: radius.pill,
            padding: '8px 16px',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {committing ? <Loader2 size={13} className="qm-spin" /> : <Plus size={13} />}
          ノートに追加
        </button>
      </div>

      <style>{SELF_CONTAINED_CSS}</style>
    </div>
  );
}

export default QuickMemoPane;
