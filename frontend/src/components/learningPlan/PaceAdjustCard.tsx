/**
 * frontend/src/components/learningPlan/PaceAdjustCard.tsx
 * 「学ぶ内容は変えずに、ペースだけ変える」ための操作。
 *
 * 【設計方針】
 * 受講生が本当に調整したいのは中身ではなく「間に合うかどうか」なので、
 * 触れるつまみを **目標期限ひとつ** に絞る。押すと残りの全フェーズが比例で伸縮し、
 * 週あたりの目安時間がどう変わるかまで同じ画面で見える。
 * フェーズを1つずつ動かす細かい調整は、これまでどおり PlanEditor（詳しく調整する）に置く。
 *
 * 見直し日の予約も同じカードに置いている。ペースの相談はコーチとの見直しとセットで
 * 行われるため、「自分で動かす」と「コーチと決める」を並べておくのが自然と判断した。
 */
import { useMemo, useState } from 'react';
import { LearningPlan } from '../../types/learningPlan';
import {
  addMonths,
  diffDays,
  estimateWeeklyHours,
  formatJpDateFull,
  minGoalDeadline,
  setGoalDeadline,
  toIso,
} from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';

const TODAY = new Date();

/** 見直し日のクイック選択。日付ピッカーを開かずに決められるようにする。 */
const REVIEW_PRESETS: { label: string; days: number }[] = [
  { label: '2週間後', days: 14 },
  { label: '1ヶ月後', days: 30 },
  { label: '6週間後', days: 42 },
];

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 13, color: color.textStrong,
  border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: '9px 11px', background: color.surface,
};

function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 78, padding: '10px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        borderRadius: radius.pill, cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${color.primaryBorder}`, background: color.surface,
        color: disabled ? color.textFaint : color.primary, opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

/** before → after を1行で並べる。 */
function DeltaRow({ label, before, after, changed }: { label: string; before: string; after: string; changed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ ...font.caption, color: color.textSubtle, flex: '0 0 84px' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: changed ? color.textSubtle : color.textStrong, textDecoration: changed ? 'line-through' : 'none' }}>
        {before}
      </span>
      {changed && (
        <>
          <ArrowIcon />
          <span style={{ fontSize: 13, fontWeight: 900, color: color.primary }}>{after}</span>
        </>
      )}
    </div>
  );
}

interface PaceAdjustCardProps {
  plan: LearningPlan;
  busy: boolean;
  /** 目標期限を変えた結果のプランを保存する */
  onSaveDeadline: (draft: LearningPlan) => void;
  /** 次回見直し日を保存する */
  onSaveReviewDate: (nextReviewDate: string) => void;
  /** フェーズ単位の細かい調整へ */
  onOpenEditor: () => void;
}

function PaceAdjustCard({ plan, busy, onSaveDeadline, onSaveReviewDate, onOpenEditor }: PaceAdjustCardProps) {
  const [deadline, setDeadline] = useState(plan.goalDeadline);
  const [reviewDate, setReviewDate] = useState(plan.nextReviewDate);

  const floor = useMemo(() => minGoalDeadline(plan, TODAY), [plan]);

  // 日付入力の min はブラウザ任せなので、下限は状態側でも押さえておく
  // （入力欄の表示とプレビューがずれないようにする）。
  const applyDeadline = (iso: string) => setDeadline(diffDays(iso, floor) > 0 ? floor : iso);

  // 下書きは純関数で作る。保存するまでサーバーには送らない（押した瞬間に結果が見える）。
  const draft = useMemo(
    () => (deadline === plan.goalDeadline ? plan : setGoalDeadline(plan, deadline, TODAY)),
    [plan, deadline],
  );

  const deadlineChanged = draft.goalDeadline !== plan.goalDeadline;
  const reviewChanged = reviewDate !== plan.nextReviewDate;

  const currentHours = useMemo(() => estimateWeeklyHours(plan, TODAY), [plan]);
  const draftHours = useMemo(() => estimateWeeklyHours(draft, TODAY), [draft]);

  const deltaWeeks = Math.round(diffDays(plan.goalDeadline, draft.goalDeadline) / 7);
  const canShorten = diffDays(floor, addMonths(deadline, -1)) >= 0;

  return (
    <section style={{ ...t.card, padding: '22px 26px 20px' }}>
      <div style={{ ...font.cardTitle, color: color.text }}>ペースはいつでも調整できます</div>
      <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
        学ぶ内容は変わりません。目標期限を動かすと、残りのフェーズの長さだけがまとめて伸び縮みします。
      </p>

      {/* ---- 目標期限 ---- */}
      <div style={{ marginTop: 20, padding: '16px 18px', border: `1px solid ${color.border}`, borderRadius: radius.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...font.rowTitle, color: color.textStrong, flex: '0 0 auto' }}>目標期限</span>
          <input
            type="date"
            value={deadline}
            min={floor}
            onChange={(e) => e.target.value && applyDeadline(e.target.value)}
            style={inputStyle}
          />
          <StepButton label="−1ヶ月" onClick={() => applyDeadline(addMonths(deadline, -1))} disabled={!canShorten} />
          <StepButton label="+1ヶ月" onClick={() => applyDeadline(addMonths(deadline, 1))} />
          {deadlineChanged && (
            <span style={{ ...font.chip, color: color.primary, background: color.primarySoft, borderRadius: radius.pill, padding: '5px 12px' }}>
              {deltaWeeks > 0 ? `+${deltaWeeks}週間` : `${deltaWeeks}週間`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          <DeltaRow
            label="目標期限"
            before={formatJpDateFull(plan.goalDeadline)}
            after={formatJpDateFull(draft.goalDeadline)}
            changed={deadlineChanged}
          />
          <DeltaRow
            label="必要な週時間"
            before={`約${currentHours}時間`}
            after={`約${draftHours}時間`}
            changed={deadlineChanged && draftHours !== currentHours}
          />
          <DeltaRow label="学ぶ内容" before="変わりません" after="" changed={false} />
        </div>

        {deadline === floor && (
          <p style={{ ...font.caption, color: color.textFaint, margin: '12px 0 0', lineHeight: 1.7 }}>
            これ以上は短くできません。さらに早めたい場合は、コーチと相談してフェーズそのものを減らす必要があります。
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy || !deadlineChanged}
            onClick={() => onSaveDeadline(draft)}
            style={{ ...t.primaryButton, padding: '13px 24px', fontSize: 13.5, opacity: busy || !deadlineChanged ? 0.45 : 1 }}
          >
            このペースにする
          </button>
          {deadlineChanged && (
            <button type="button" disabled={busy} onClick={() => setDeadline(plan.goalDeadline)} style={{ ...t.outlineButton }}>
              元に戻す
            </button>
          )}
          <button type="button" disabled={busy} onClick={onOpenEditor} style={{ ...t.outlineButton }}>
            フェーズごとに詳しく調整する
          </button>
        </div>
      </div>

      {/* ---- 見直し日の予約 ---- */}
      <div style={{ marginTop: 12, padding: '16px 18px', border: `1px solid ${color.border}`, borderRadius: radius.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...font.rowTitle, color: color.textStrong, flex: '0 0 auto' }}>コーチとの見直し日</span>
          <input
            type="date"
            value={reviewDate}
            min={toIso(TODAY)}
            onChange={(e) => e.target.value && setReviewDate(e.target.value)}
            style={inputStyle}
          />
          {REVIEW_PRESETS.map((p) => (
            <StepButton
              key={p.label}
              label={p.label}
              onClick={() => {
                const d = new Date(TODAY);
                d.setDate(d.getDate() + p.days);
                setReviewDate(toIso(d));
              }}
            />
          ))}
        </div>

        <p style={{ ...font.caption, color: color.textMuted, margin: '12px 0 0', lineHeight: 1.7 }}>
          この日の3日前から「今月のふりかえり」が表示され、回答をもとにLMSが更新案を作ります。
        </p>

        {reviewChanged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSaveReviewDate(reviewDate)}
              style={{ ...t.primaryButton, padding: '12px 22px', fontSize: 13.5, opacity: busy ? 0.6 : 1 }}
            >
              {formatJpDateFull(reviewDate)}に予約する
            </button>
            <button type="button" disabled={busy} onClick={() => setReviewDate(plan.nextReviewDate)} style={{ ...t.outlineButton }}>
              元に戻す
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default PaceAdjustCard;
