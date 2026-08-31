import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AI_SKILL_META, FEATURED_AI_SKILLS } from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * AIコーチの使い方（ホーム右上「ヘルプ・使い方」から開く）。
 *
 * 全体のヘルプページ（/help）へ飛ばさずここで閉じるのは、
 * 相談を書きに来た人を別画面へ連れ出さないため。読み終わったら閉じて、
 * そのまま入力欄に戻れる。
 *
 * 「こんなときに使う」は AI_SKILL_META の useCase をそのまま出す。
 * 使い方の説明のために別の文言を書くと、ホームのカード（AiCoachHome）と
 * 説明が2系統に分かれて必ずズレるため、原本を1つに保つ。
 * ここに並べるのは代表6件だけ。全件はホームのグリッドが出しており、
 * このパネルは「入り方」を読ませる場所なので同じ長さの一覧を二重に置かない。
 *
 * 器は Radix の Sheet ではなく手書きのオーバーレイ。
 * ui/sheet.tsx は animate-in 系（tailwindcss-animate）前提で、
 * このプロジェクトの tailwind.config.js は plugins: [] なので効かない。
 * 会話履歴（モバイル）のオーバーレイと同じ作りに合わせている。
 */
interface AiCoachHowToProps {
  onClose: () => void;
}

/** 入り方の3通り。画面上の要素と1対1で対応させる（読んで迷わせない） */
const STEPS = [
  {
    n: '1',
    title: 'そのまま書いて送る',
    body: 'やりたいことを入力欄に書いて送ると、相談内容に応じて適したAIが自動で選ばれます。どれを使うか決めていなくても始められます。',
  },
  {
    n: '2',
    title: '機能を選んで始める',
    body: '下の「AIアプリでできること」に全てのAIアプリが学習・制作・キャリア・そのほかに分けて並んでいます。押すと、その機能のモードでそのまま始まります。',
  },
  {
    n: '3',
    title: '画像を添付して見てもらう',
    body: '入力欄の ＋ から、または画像をそのまま貼り付けて添付できます。制作物を添付すると、教材と課題の基準に沿った添削を提案します。',
  },
];

export function AiCoachHowTo({ onClose }: AiCoachHowToProps) {
  // Esc で閉じる。閉じ方が「×」1つだけだと、何かに隠れた瞬間に出られなくなる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AIコーチの使い方"
      className="wc-warm wc-drawer-scrim fixed inset-0 flex justify-end"
      // 🔴 z は 70（モーダルの層。FinishSessionModal と同値）。
      //    50 だと学習セッションの常設ピル（同じ 50 で、App.tsx で AppRoutes より
      //    後に描かれる）が手前に来て、右上の「×」がピルに隠れて押せなくなる。
      style={{ zIndex: 70, background: 'rgba(60,48,32,.32)' }}
      onClick={onClose}
    >
      <div
        className="wc-drawer-right flex flex-col"
        style={{
          width: 'min(420px, 92vw)',
          background: 'var(--dc-surface)',
          boxShadow: 'var(--dc-shadow-float)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center flex-shrink-0"
          style={{
            gap: 10,
            minHeight: 56,
            padding: '0 20px',
            borderBottom: '1px solid var(--dc-border)',
          }}
        >
          <strong style={{ fontSize: 15, fontWeight: 700, color: 'var(--dc-text)' }}>
            AIコーチの使い方
          </strong>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 30,
              height: 30,
              border: 0,
              borderRadius: 9,
              background: 'transparent',
              color: 'var(--dc-text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 32px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.9,
              color: 'var(--dc-text-body)',
            }}
          >
            AIコーチは、学習・制作・キャリアの相談にのる窓口です。入り方は3通りあります。
          </p>

          <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none' }}>
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex"
                style={{
                  gap: 12,
                  padding: '14px 0',
                  borderTop: '1px solid var(--dc-rule)',
                }}
              >
                <span
                  aria-hidden
                  className="grid place-items-center flex-shrink-0"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--dc-soft-100)',
                    color: 'var(--dc-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {step.n}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--dc-text)',
                    }}
                  >
                    {step.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 5,
                      fontSize: 12.5,
                      lineHeight: 1.9,
                      color: 'var(--dc-text-muted)',
                    }}
                  >
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <h3
            style={{
              margin: '26px 0 0',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            こんなときに使う
          </h3>
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
            {FEATURED_AI_SKILLS.map((id) => {
              const meta = AI_SKILL_META[id];
              const Icon = AI_SKILL_ICON[meta.icon];
              return (
                <li
                  key={id}
                  className="flex items-start"
                  style={{ gap: 10, padding: '9px 0' }}
                >
                  <span
                    aria-hidden
                    className="grid place-items-center flex-shrink-0"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: 'var(--dc-soft-100)',
                      color: 'var(--dc-primary)',
                    }}
                  >
                    <Icon size={13} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.85 }}>
                    <span style={{ fontWeight: 700, color: 'var(--dc-text)' }}>
                      {meta.shortLabel}
                    </span>
                    <span style={{ color: 'var(--dc-text-muted)' }}>　{meta.useCase}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p
            style={{
              margin: '20px 0 0',
              paddingTop: 16,
              borderTop: '1px solid var(--dc-rule)',
              fontSize: 11.5,
              lineHeight: 1.9,
              color: 'var(--dc-text-subtle)',
            }}
          >
            相談は「履歴」からいつでも読み返せます。教材ページから始めた相談も、同じ履歴に並びます。
          </p>
        </div>
      </div>
    </div>
  );
}

export default AiCoachHowTo;
