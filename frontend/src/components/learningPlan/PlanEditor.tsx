/**
 * frontend/src/components/learningPlan/PlanEditor.tsx
 * コーチングの場で、受講生が画面共有しながらコーチと一緒にいじるための編集モード。
 *
 * 【設計方針】
 * コーチはLMSアカウントを持たず操作もしないため（docs/ai-coaching-notes-design.md）、
 * 「コーチ用管理画面」ではなく「2人で画面を見ながら2〜5分で終わる編集画面」を作る。
 * そのため操作を意図的に3つだけに絞っている:
 *   1. 期間を調整する        … ガント＋[−1週][+1週]＋日付入力（以降のフェーズは自動連動）
 *   2. マイルストーンを選ぶ  … 候補チェックリスト。数値と期限だけ変更でき、文言編集は要明示操作
 *   3. 確定する              … 「コーチと確認しました」を記録する
 *
 * 変更はローカルの下書きに即時反映し（純関数エンジンをそのまま呼ぶ）、
 * 「保存」を押したときだけサーバーへ送る。コーチの前で待たせないため。
 */
import { useMemo, useState } from 'react';
import { LearningPlan, MilestoneTemplate, PhaseKey, PhaseProgressStatus, PlanPhase } from '../../types/learningPlan';
import {
  addMilestoneFromTemplate,
  diffDays,
  formatJpDate,
  removeMilestone,
  setPhaseDates,
  shiftPhase,
  templatesForPhase,
  updateMilestone,
} from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import PhaseTimeline from './PhaseTimeline';
import MilestoneRow from './MilestoneRow';

interface PlanEditorProps {
  plan: LearningPlan;
  statuses: PhaseProgressStatus[];
  saving: boolean;
  onChange: (next: LearningPlan) => void;
  onSave: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** 「コーチと確認しました」に添える既定のコーチ名（次回コーチング予定から取る） */
  defaultCoachName: string | null;
}

const TODAY = new Date();

function StepHeading({ no, title, help }: { no: number; title: string; help: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span
        style={{
          width: 26, height: 26, flex: '0 0 26px', borderRadius: '50%', background: color.primary,
          color: color.textOnPrimary, fontSize: 13, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {no}
      </span>
      <div>
        <div style={{ ...font.cardTitle, color: color.text }}>{title}</div>
        <div style={{ ...font.caption, color: color.textSubtle, marginTop: 5, lineHeight: 1.7 }}>{help}</div>
      </div>
    </div>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.card,
    padding: '22px 24px 20px',
  };
}

/** 大きめの丸ボタン。コーチと画面を見ながら押すので小さくしない。 */
function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 62, padding: '9px 12px', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        borderRadius: radius.pill, cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${color.primaryBorder}`,
        background: color.surface, color: disabled ? color.textFaint : color.primary,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

const dateInputStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 12.5, color: color.textStrong,
  border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: '7px 9px', background: color.surface,
};

// ============================================================
// 1. 期間を調整する
// ============================================================

function PhaseDurationRow({
  phase,
  onShift,
  onSetDates,
}: {
  phase: PlanPhase;
  onShift: (delta: number) => void;
  onSetDates: (start: string, end: string) => void;
}) {
  const weeks = Math.max(1, Math.round(diffDays(phase.startDate, phase.endDate) / 7));
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 14px', border: `1px solid ${color.border}`, borderRadius: radius.md,
      }}
    >
      <span style={{ flex: '1 1 150px', minWidth: 130, fontSize: 13.5, fontWeight: 700, color: color.textStrong }}>
        {phase.title}
        <span style={{ ...font.caption, color: color.textFaint, marginLeft: 8, fontWeight: 500 }}>約{weeks}週間</span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="date"
          value={phase.startDate}
          onChange={(e) => onSetDates(e.target.value, phase.endDate)}
          style={dateInputStyle}
        />
        <span style={{ ...font.caption, color: color.textFaint }}>〜</span>
        <input
          type="date"
          value={phase.endDate}
          onChange={(e) => onSetDates(phase.startDate, e.target.value)}
          style={dateInputStyle}
        />
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StepButton label="−1週" onClick={() => onShift(-7)} disabled={weeks <= 1} />
        <StepButton label="+1週" onClick={() => onShift(7)} />
      </span>
    </div>
  );
}

// ============================================================
// 2. マイルストーンを選ぶ
// ============================================================

function MilestoneEditor({
  phase,
  templates,
  onAdd,
  onRemove,
  onUpdate,
}: {
  phase: PlanPhase;
  templates: MilestoneTemplate[];
  onAdd: (templateId: string) => void;
  onRemove: (milestoneId: string) => void;
  onUpdate: (milestoneId: string, patch: Parameters<typeof updateMilestone>[2]) => void;
}) {
  const [editingText, setEditingText] = useState<string | null>(null);
  const usedTemplateIds = new Set(phase.milestones.map((m) => m.templateId).filter(Boolean) as string[]);
  const unused = templates.filter((tpl) => !usedTemplateIds.has(tpl.id));

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.md, padding: '14px 16px' }}>
      <div style={{ ...font.rowTitle, color: color.textStrong }}>{phase.title}</div>

      {phase.milestones.length === 0 ? (
        <p style={{ ...font.caption, color: color.textSubtle, margin: '10px 0 0' }}>
          まだマイルストーンがありません。下の候補から選んでください。
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          {phase.milestones.map((m) => (
            <div key={m.id}>
              <MilestoneRow
                milestone={m}
                showMetric={false}
                action={
                  <button
                    type="button"
                    onClick={() => onRemove(m.id)}
                    style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: color.textFaint, cursor: 'pointer', padding: 4 }}
                  >
                    外す
                  </button>
                }
              />

              {/* 数値と期限だけを触れるようにする。文言編集は明示操作の後だけ。 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10, paddingLeft: 36 }}>
                {m.metric && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...font.caption, color: color.textSubtle }}>
                    目標
                    <input
                      type="number"
                      min={1}
                      value={m.metric.target}
                      onChange={(e) => onUpdate(m.id, { target: Number(e.target.value) })}
                      style={{ ...dateInputStyle, width: 68 }}
                    />
                    {m.metric.unit}
                  </label>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...font.caption, color: color.textSubtle }}>
                  期限
                  <input
                    type="date"
                    value={m.dueDate}
                    onChange={(e) => onUpdate(m.id, { dueDate: e.target.value })}
                    style={dateInputStyle}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setEditingText(editingText === m.id ? null : m.id)}
                  style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: color.primary, cursor: 'pointer', padding: 0 }}
                >
                  {editingText === m.id ? '文言の編集を閉じる' : '文言を編集'}
                </button>
              </div>

              {editingText === m.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingLeft: 36 }}>
                  <input
                    value={m.action}
                    onChange={(e) => onUpdate(m.id, { action: e.target.value })}
                    placeholder="何をするか"
                    style={{ ...dateInputStyle, fontSize: 13, padding: '9px 11px' }}
                  />
                  <input
                    value={m.criteria}
                    onChange={(e) => onUpdate(m.id, { criteria: e.target.value })}
                    placeholder="どの状態になれば完了か"
                    style={{ ...dateInputStyle, fontSize: 13, padding: '9px 11px' }}
                  />
                  <span style={{ ...font.caption, color: color.textFaint }}>
                    文言を変えると自動整形が外れ、1文ではなく2つに分けて表示されます。
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {unused.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${color.border}` }}>
          <div style={{ ...font.caption, color: color.textSubtle, marginBottom: 9 }}>候補から追加する</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unused.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onAdd(tpl.id)}
                style={{
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  padding: '8px 13px', borderRadius: radius.pill,
                  border: `1px dashed ${color.primaryDashed}`, background: color.surface, color: color.textStrong,
                }}
              >
                ＋ {tpl.action.replace(/\{n\}/g, String(tpl.defaultTarget))}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 本体
// ============================================================

function PlanEditor({ plan, statuses, saving, onChange, onSave, onConfirm, onCancel, defaultCoachName }: PlanEditorProps) {
  const templatesByPhase = useMemo(() => {
    const map = new Map<PhaseKey, MilestoneTemplate[]>();
    plan.phases.forEach((p) => map.set(p.key, templatesForPhase(p.key, plan.intake.skills)));
    return map;
  }, [plan.phases, plan.intake.skills]);

  const handleShift = (phaseKey: PhaseKey, delta: number) => onChange(shiftPhase(plan, phaseKey, delta, TODAY));
  const handleDates = (phaseKey: PhaseKey, start: string, end: string) =>
    onChange(setPhaseDates(plan, phaseKey, start, end, TODAY));
  const handleAdd = (phaseKey: PhaseKey, templateId: string) =>
    onChange(addMilestoneFromTemplate(plan, phaseKey, templateId, TODAY));
  const handleRemove = (milestoneId: string) => onChange(removeMilestone(plan, milestoneId, TODAY));
  const handleUpdate = (milestoneId: string, patch: Parameters<typeof updateMilestone>[2]) =>
    onChange(updateMilestone(plan, milestoneId, patch, TODAY));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={cardStyle()}>
        <StepHeading
          no={1}
          title="期間を調整する"
          help="フェーズを伸ばすと、以降のフェーズは自動で後ろにずれます。目標期限も必要に応じて一緒に動きます。"
        />
        <div style={{ marginTop: 20 }}>
          <PhaseTimeline phases={plan.phases} statuses={statuses} mode="gantt" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {plan.phases.map((phase) => (
            <PhaseDurationRow
              key={phase.key + phase.startDate}
              phase={phase}
              onShift={(delta) => handleShift(phase.key, delta)}
              onSetDates={(s, e) => handleDates(phase.key, s, e)}
            />
          ))}
        </div>
        <div style={{ ...font.caption, color: color.textSubtle, marginTop: 14 }}>
          目標期限: {formatJpDate(plan.goalDeadline)}
        </div>
      </div>

      <div style={cardStyle()}>
        <StepHeading
          no={2}
          title="マイルストーンを選ぶ"
          help="候補から選ぶと「いつまでに・何をして・どうなれば完了か」の1文が自動で組み立てられます。変更するのは数値と期限だけで十分です。"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {plan.phases.map((phase) => (
            <MilestoneEditor
              key={phase.key + phase.startDate}
              phase={phase}
              templates={templatesByPhase.get(phase.key) ?? []}
              onAdd={(templateId) => handleAdd(phase.key, templateId)}
              onRemove={handleRemove}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </div>

      <div style={cardStyle()}>
        <StepHeading
          no={3}
          title="確定する"
          help="コーチと内容を確認できたら記録しておきます。あとから何度でも調整できます。"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            style={{ ...t.primaryButton, padding: '14px 26px', fontSize: 14, opacity: saving ? 0.6 : 1 }}
          >
            {defaultCoachName ? `${defaultCoachName}と確認しました` : 'コーチと確認しました'}
          </button>
          <button type="button" disabled={saving} onClick={onSave} style={{ ...t.outlineButton, opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中…' : '調整だけ保存する'}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} style={{ ...t.outlineButton, opacity: saving ? 0.6 : 1 }}>
            編集をやめる
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanEditor;
