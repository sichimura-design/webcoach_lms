/**
 * frontend/src/components/learningPlan/ReviewDuePrompt.tsx
 * 「ロードマップの見直し時期です」の告知バンドとモーダル。
 *
 * 【なぜ常設しないか】
 * 「毎回ロードマップの見直しを促すと煩わしい」というレビュー指摘への対応。
 * 以前は見直し導線を常にページ内に置き、期日が近いときだけ配色を強めていた。
 * 見直し時期（checkinDue）でないときは何も出さない。
 *
 * 【なぜコーチ相談ボタンを置かないか】
 * 「コーチへの相談導線はロードマップ上では特に設けず、必要以上に相談を促さない」方針。
 * モーダル下部に「コーチと一緒に調整できます」と一文だけ添えて、押させはしない。
 */
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';

interface ReviewDuePromptProps {
  /** 見直し時期かどうか。false なら何も描かない */
  due: boolean;
  /** 見直しの4問が取れているか。取れないときはボタンを無効にする */
  ready: boolean;
  /** モーダルを出すか（初回表示時のみ true にして、閉じたら false に落とす） */
  modalOpen: boolean;
  onStart: () => void;
  onDismissModal: () => void;
}

const QUESTIONS = [
  { icon: '🕐', text: '学習時間に変化はありますか？' },
  { icon: '📈', text: '今のフェーズの進みやすさはどうですか？' },
  { icon: '🎯', text: '次に目指したいことは変わりましたか？' },
];

export function ReviewDuePrompt({ due, ready, modalOpen, onStart, onDismissModal }: ReviewDuePromptProps) {
  if (!due) return null;

  return (
    <>
      {/* サマリー帯の直下に置く告知バンド。モーダルを閉じてもここは残る */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          background: color.hoverBgTint,
          border: `1px solid ${color.primaryBorderSoft}`,
          borderRadius: radius.card,
          padding: '20px 26px',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: color.primarySoft,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          🕐
        </span>
        <div style={{ flex: '1 1 280px', minWidth: 220 }}>
          <div style={{ ...font.rowTitle, fontSize: 15, color: color.text }}>
            ロードマップの見直し時期です
          </div>
          <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 0', lineHeight: 1.8 }}>
            今の進み方に合わせて、数分で見直しできます。
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ ...t.primaryButton, padding: '14px 24px', fontSize: 14, opacity: ready ? 1 : 0.5 }}
        >
          質問に答えて見直す　›
        </button>
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ロードマップの見直し"
          onClick={onDismissModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31,29,30,.38)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            zIndex: 90,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: color.surface,
              borderRadius: radius.hero,
              boxShadow: shadow.hero,
              padding: '34px 32px 28px',
              position: 'relative',
              fontFamily: font.family,
            }}
          >
            <button
              type="button"
              onClick={onDismissModal}
              aria-label="閉じる"
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                background: 'none',
                color: color.textSubtle,
                fontSize: 18,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>

            <div style={{ textAlign: 'center' }}>
              <span
                aria-hidden
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: color.primarySoft,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 34,
                  margin: '0 auto 16px',
                }}
              >
                🗺️
              </span>
              <h2 style={{ ...font.cardTitleLg, color: color.text, margin: 0 }}>
                ロードマップの見直し時期です
              </h2>
              <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
                今の進み方に合わせて、数分で見直しできます。
              </p>
            </div>

            {/* 何を聞かれるかを先に見せる。答える前に負担の見積もりが立つようにする */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '22px 0 14px' }}>
              {QUESTIONS.map((q) => (
                <div
                  key={q.text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: color.hoverBgTint,
                    borderRadius: radius.md,
                    ...font.meta,
                    color: color.textBody,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 15 }}>{q.icon}</span>
                  {q.text}
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', ...font.caption, color: color.textFaint, marginBottom: 16 }}>
              🕐 所要時間 3〜5分
            </div>

            <button
              type="button"
              onClick={onStart}
              disabled={!ready}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                ...t.primaryButton,
                width: '100%',
                justifyContent: 'center',
                padding: '15px 20px',
                opacity: ready ? 1 : 0.5,
              }}
            >
              質問に答えて見直す　›
            </button>

            <button
              type="button"
              onClick={onDismissModal}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ ...t.ghostButton, marginTop: 10 }}
            >
              あとで
            </button>

            {/* 押させる導線にはしない。「相談してもいい」とだけ伝える */}
            <p style={{ ...font.caption, color: color.textFaint, textAlign: 'center', margin: '14px 0 0' }}>
              コーチと一緒に調整することもできます
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default ReviewDuePrompt;
