import { useCallback, useRef } from 'react';
import { ChevronRight, Maximize2, NotebookPen, Sparkles } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';

/**
 * AI／メモのサイドパネル（デザイン案 2a）。
 *
 * 以前はレイアウトの「列」で、目次・本文・サポートの3ペインが常に幅を取り合っていた。
 * 上下分割（split）モードまであり、本文が最も狭くなる状態が既定になり得た。
 * その反動で一度「本文の上に重なるオーバーレイ」だけにしたが、
 * 2a は「本文を押しのけて並ぶが、開くのは必要なときだけ」という中間を採る。
 *
 * 🔴 ドッキングとオーバーレイの切替は JS の幅判定ではなく CSS のメディアクエリで行う
 *    （index.css の `.wc-lesson-support`）。JSで測ると境界の1pxで跳ねる問題が出る。
 *    position:fixed はフロー外なので、オーバーレイ時は親フレックスが幅を確保せず
 *    本文が自動的に全幅に戻る。同じマークアップで両方成立する。
 *
 * 🔴 AiCoachPane / MemoPane の中身は一切変更していない。
 *    ここは器だけの改修で、AI・メモの機能自体は元のまま動く。
 */
export type SupportTab = 'ai' | 'notes';

/** ドラッグでの幅の下限・上限。デザイン 2a と同値 */
const MIN_WIDTH = 320;
const MAX_WIDTH = 560;
/** キーボードで幅を変えるときの1回ぶん */
const KEY_STEP = 16;

interface SupportPanelProps {
  tab: SupportTab;
  onTabChange: (tab: SupportTab) => void;
  onClose: () => void;
  /** ドッキング時の幅。オーバーレイ時はCSS側の固定幅が勝つので効かない */
  width: number;
  onWidthChange: (width: number) => void;
  aiPane: React.ReactNode;
  memoPane: React.ReactNode;
  /**
   * 「広い画面で続ける」。AIタブでだけ出す（メモには拡大先が無い）。
   *
   * 🔴 以前は AiCoachPane が自前のヘッダーに文字ボタンとして持っていたが、
   *    この器にもタブ行があるためバーが2段になっていた。器が1本持つ形に寄せ、
   *    「アイコンだけで分かる」というレビュー指摘に合わせてラベルは落とした。
   */
  onExpand?: () => void;
}

const TABS: { key: SupportTab; label: string; Icon: typeof Sparkles }[] = [
  { key: 'ai', label: 'AIコーチ', Icon: Sparkles },
  { key: 'notes', label: 'メモ', Icon: NotebookPen },
];

const clampWidth = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

export function SupportPanel({
  tab,
  onTabChange,
  onClose,
  width,
  onWidthChange,
  aiPane,
  memoPane,
  onExpand,
}: SupportPanelProps) {
  // ドラッグ中の値は ref で持つ。state 更新の反映待ちで基準がずれるのを避ける
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        // 右端に固定されたパネルなので、左へ動かすと広がる
        onWidthChange(clampWidth(drag.startWidth + (drag.startX - ev.clientX)));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [width, onWidthChange]
  );

  // マウスを持たない人にも幅を変えさせる。separator の作法どおり ←/→ で動かす
  const onResizerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onWidthChange(clampWidth(width + KEY_STEP));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onWidthChange(clampWidth(width - KEY_STEP));
      }
    },
    [width, onWidthChange]
  );

  return (
    <>
      {/* 背景クリックで閉じる。本文を見たいだけのときに閉じ方を探させない。
          ドッキング時（1280px以上）は本文と並ぶので CSS 側で display:none にする */}
      <div
        role="presentation"
        className="wc-lesson-support-backdrop wc-drawer-scrim"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(28,34,44,.22)' }}
      />

      <aside
        // wc-drawer-right … オーバーレイのときに右から滑り込む。
        // ドッキング（1280px以上）ではレイアウトが押し広がる動きになるので、
        // index.css 側でこのアニメーションを打ち消している。
        className="wc-lesson-support wc-drawer-right"
        role="dialog"
        aria-label="AIコーチとメモ"
        style={{
          // ドッキング時の幅。CSS変数にしておくと、オーバーレイ時は
          // CSS の固定幅がそのまま効く（!important が要らない）
          ['--wc-support-w' as string]: `${width}px`,
          zIndex: 71,
          background: color.surface,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* 左端のリサイズハンドル。ドッキング時だけ CSS で表示する */}
        <div
          className="wc-lesson-support-resizer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          role="separator"
          aria-orientation="vertical"
          aria-label="パネルの幅を変更"
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          tabIndex={0}
          title="ドラッグで幅を変更"
          onMouseDown={startResize}
          onKeyDown={onResizerKeyDown}
        >
          <span aria-hidden style={{ width: 3, height: 40, borderRadius: 999, background: color.borderNeutral }} />
        </div>

        <div
          className="flex items-center"
          style={{
            gap: 6,
            minHeight: 52,
            padding: '0 16px',
            borderBottom: `1px solid ${color.border}`,
            flexShrink: 0,
          }}
        >
          {/* 下線型タブ（デザイン §5-1 のタブ）。アイコンは右下のピルと同じものを使い、
              「どのピルから開いたか」と「いまどのタブか」が同じ絵で結び付くようにする */}
          <div role="tablist" aria-label="サポートの種類" style={{ display: 'flex' }}>
            {TABS.map(({ key, label, Icon }) => {
              const active = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(key)}
                  className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    gap: 8,
                    padding: '14px 14px 12px',
                    border: 0,
                    borderBottom: `2px solid ${active ? color.primary : 'transparent'}`,
                    background: 'transparent',
                    color: active ? color.text : color.textMuted,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={15} style={{ color: active ? color.primary : color.iconMuted }} />
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {tab === 'ai' && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label="広い画面で続ける"
              title="いまの会話・レッスン・画像・モードを引き継いで広い画面で続けます"
              className="wc-ai-icon-btn grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 30,
                height: 30,
                border: `1px solid ${color.borderSoft}`,
                borderRadius: 8,
                background: color.surface,
                color: color.textMuted,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Maximize2 size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 4,
              height: 30,
              padding: '0 6px 0 12px',
              border: `1px solid ${color.borderSoft}`,
              borderRadius: 999,
              background: color.surface,
              color: color.textMuted,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            閉じる
            <ChevronRight size={13} />
          </button>
        </div>

        {/* 両方マウントしたままにすると AiCoachPane の会話状態が保たれる。
            タブを行き来しただけで入力中の内容が消えるのを避ける。 */}
        <div style={{ flex: 1, minHeight: 0, display: tab === 'ai' ? 'flex' : 'none', flexDirection: 'column' }}>
          {aiPane}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'notes' ? 'flex' : 'none', flexDirection: 'column' }}>
          {memoPane}
        </div>
      </aside>
    </>
  );
}

export default SupportPanel;
