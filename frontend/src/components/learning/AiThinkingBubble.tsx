import { useEffect, useState } from 'react';
import { color } from '../../theme/webcoachTheme';
import { AiSkillId, AI_SKILL_META, isSpecialistSkill } from '../../types/aiSkill';

/**
 * AIが考えているあいだの表示。
 *
 * 🔴 以前は「教材の該当箇所と照合しています…」という文字が1行あるだけで、
 *    待っている実感も進んでいる実感も無く「チープ」というレビュー指摘を受けた。
 *
 * ここでやることは2つ。
 *   1. **これから来る回答の形**をスケルトンで先に置く（見出し／本文／根拠のブロック）。
 *      回答が入ったときに高さが飛ばず、ページがガタッと動かない。
 *   2. 何をしているかを段階的に言う。1.2秒ごとに1つ進み、**最後で止まる**。
 *      ぐるぐる回し続けると「終わらない処理」に見えるので、ループはさせない。
 *
 * スケルトンの光の流れ（.wc-skel）と点の明滅（.wc-think-dot）は index.css。
 * prefers-reduced-motion のときは止まるが、灰色の面としては残す
 * （消してしまうと「待っている」ことまで伝わらなくなる）。
 */
interface AiThinkingBubbleProps {
  /** 実行中のモード。専門モードなら機能名を文言に混ぜる */
  skillId: AiSkillId;
}

/** 文言が進む間隔。速いと読めず、遅いと止まって見える */
const STEP_MS = 1200;

const GENERAL_STEPS = [
  '質問を読んでいます',
  '教材の該当箇所を探しています',
  '回答をまとめています',
];

const specialistSteps = (shortLabel: string) => [
  `${shortLabel}の観点を確認しています`,
  '教材の基準と照らしています',
  '講評をまとめています',
];

export function AiThinkingBubble({ skillId }: AiThinkingBubbleProps) {
  const specialist = isSpecialistSkill(skillId) ? AI_SKILL_META[skillId] : null;
  const steps = specialist ? specialistSteps(specialist.shortLabel) : GENERAL_STEPS;

  const [step, setStep] = useState(0);
  useEffect(() => {
    // 最後まで来たら進めない。タイマーも張り直さない。
    if (step >= steps.length - 1) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step, steps.length]);

  return (
    <div className="flex" style={{ gap: 8 }}>
      <div
        aria-hidden
        style={{
          width: 27,
          height: 27,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 8,
          background: color.primary,
          color: '#fff',
          fontSize: 9,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        AI
      </div>

      <div
        style={{
          flex: 1,
          maxWidth: '90%',
          padding: '11px 12px',
          border: `1px solid ${color.border}`,
          borderRadius: 12,
          background: color.surface,
        }}
      >
        <div className="flex items-center" style={{ gap: 7 }}>
          <span aria-hidden className="wc-think-dots inline-flex" style={{ gap: 3 }}>
            <span className="wc-think-dot" />
            <span className="wc-think-dot" />
            <span className="wc-think-dot" />
          </span>
          <span role="status" aria-live="polite" style={{ fontSize: 11, color: color.textMuted }}>
            {steps[step]}
          </span>
        </div>

        {/* 回答の形（結論の見出し＋本文2行＋根拠のブロック）をなぞる */}
        <div aria-hidden style={{ marginTop: 9 }}>
          <div className="wc-skel" style={{ width: 52, height: 9 }} />
          <div className="wc-skel" style={{ width: '100%', height: 8, marginTop: 8 }} />
          <div className="wc-skel" style={{ width: '78%', height: 8, marginTop: 6 }} />

          {(specialist ? [0, 1] : [0]).map((i) => (
            <div
              key={i}
              style={{
                marginTop: 9,
                padding: '9px 10px',
                borderRadius: 9,
                background: color.pageBg,
              }}
            >
              <div className="wc-skel" style={{ width: 64, height: 8 }} />
              <div className="wc-skel" style={{ width: '90%', height: 8, marginTop: 7 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AiThinkingBubble;
