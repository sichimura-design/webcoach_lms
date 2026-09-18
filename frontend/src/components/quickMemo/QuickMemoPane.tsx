import React, { useEffect, useRef } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';

/**
 * PiP小窓の中身。ノートの本文そのものを編集する textarea 1枚。
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
 * 🔴 ここは「ノートを小窓で開いたもの」であって、別のメモ帳ではない。
 *    かつては専用の localStorage（webcoach-quick-memo）に下書きを溜めて、
 *    「ノートに追加」を押した分だけが text ブロックとして転記される
 *    片道の投入口だった。小窓にノートの中身が出ないので「速記メモ」という
 *    名前が何を指すのか分からない、という指摘で作りごと変えている。
 *    いまは本文（Note.body）を親と同じ state で編集していて、
 *    打った文字はそのまま親の紙にも出る。「追加」ボタンは無い（自動保存）。
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
].join('');

export interface QuickMemoPaneProps {
  /** 「→ 9/4 コーチング記録」の右側。いま開いているノートの名前 */
  targetLabel: string;
  text: string;
  onChangeText: (text: string) => void;
  /** 小窓から手が離れたら待たずに保存する */
  onFlush: () => void;
  status: 'idle' | 'saving' | 'saved';
  /** 保存に失敗したときの文言。出ている間も打った文字は消さない */
  error: string | null;
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
  onFlush,
  status,
  error,
}: QuickMemoPaneProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // requestWindow() は窓にフォーカスを当てるが、中の textarea には当てない。
  // ポータルが commit された次のフレームで自分から取りに行く
  // （autoFocus 属性は別ドキュメントだと順序が不安定なので使わない）。
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // 続きから書けるよう末尾へ。先頭に飛ぶと長いノートで書き出しが見えない
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(id);
  }, []);

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
          {targetLabel}
        </span>
        <StatusLine status={status} />
      </div>

      <textarea
        ref={inputRef}
        className="qm-input"
        aria-label="本文"
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        onBlur={onFlush}
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

      <style>{SELF_CONTAINED_CSS}</style>
    </div>
  );
}

export default QuickMemoPane;
