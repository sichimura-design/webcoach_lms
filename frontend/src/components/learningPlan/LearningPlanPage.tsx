/**
 * frontend/src/components/learningPlan/LearningPlanPage.tsx
 * 長期学習ロードマップの全体表示と操作。ルートは /learning-plan。
 *
 * コーチはLMSを操作しない運用なので（docs/ai-coaching-notes-design.md）、
 * 閲覧・編集・確定・更新案への回答をすべて受講生側のこの1画面で完結させる。
 * コーチングの場では受講生がこの画面を共有し、2人で見ながら調整する想定。
 *
 * ダイアログ primitive を現行コードで使っていないため、
 * CoachingNotesPage.tsx と同じく Mode 判別ユニオンで1ページ内を切り替える。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLearningPlan } from '../../hooks/useLearningPlan';
import bffClient from '../../services/bffClient';
import {
  CheckinAnswers,
  LearningPlan,
  PLAN_STATUS_LABEL,
  PlanRevision,
  RevisionAction,
  SKILL_LABEL,
} from '../../types/learningPlan';
import {
  derivePhaseStatus,
  diffDays,
  formatJpDate,
  formatJpDateFull,
  toIso,
} from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import PhaseTimeline, { PhaseRangeChip } from './PhaseTimeline';
import MilestoneRow from './MilestoneRow';
import RevisionCard from './RevisionCard';
import MonthlyCheckin from './MonthlyCheckin';
import PlanEditor from './PlanEditor';

type Mode =
  | { kind: 'view' }
  | { kind: 'edit' }
  | { kind: 'checkin' }
  | { kind: 'revision'; revision: PlanRevision };

const TODAY = new Date();

function cardStyle(): React.CSSProperties {
  return {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.card,
    padding: '22px 24px 20px',
  };
}

/** 「全ロードマップで必須の7項目」を一覧で見せるブロック。 */
function RequiredSummary({ plan }: { plan: LearningPlan }) {
  const currentPhase = plan.phases[Math.max(0, plan.phases.findIndex((p) => p.key === plan.currentPhaseKey))];
  const remaining = diffDays(toIso(TODAY), plan.goalDeadline);

  const rows: { label: string; value: string }[] = [
    { label: '最終ゴール', value: plan.goal },
    {
      label: '目標期限',
      value: `${formatJpDateFull(plan.goalDeadline)}（${remaining > 0 ? `残り${remaining}日` : '期限を過ぎています'}）`,
    },
    { label: '現在のフェーズ', value: currentPhase?.title ?? '—' },
    {
      label: '優先スキル',
      value: plan.prioritySkills.length ? plan.prioritySkills.map((s) => SKILL_LABEL[s]).join('・') : '—',
    },
    { label: '次回見直し日', value: formatJpDateFull(plan.nextReviewDate) },
  ];

  return (
    <div style={cardStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...font.cardTitle, color: color.text }}>このロードマップの約束</span>
        <span
          style={{
            ...t.chip,
            background: plan.status === 'confirmed_with_coach' ? color.primarySoft : color.hoverBg,
            color: plan.status === 'confirmed_with_coach' ? color.primary : color.textMuted,
          }}
        >
          {PLAN_STATUS_LABEL[plan.status]}
        </span>
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 20px', margin: '18px 0 0' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <dt style={{ ...font.caption, color: color.textSubtle, whiteSpace: 'nowrap' }}>{r.label}</dt>
            <dd style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: color.textStrong }}>{r.value}</dd>
          </div>
        ))}
      </dl>

      {plan.feasibilityNote && (
        <p
          style={{
            ...font.caption, color: color.textBody, lineHeight: 1.8, margin: '18px 0 0',
            background: color.hoverBgTint, border: `1px solid ${color.borderSoft}`,
            borderRadius: radius.md, padding: '11px 14px',
          }}
        >
          {plan.feasibilityNote}
        </p>
      )}

      {plan.status !== 'confirmed_with_coach' && (
        <p style={{ ...font.caption, color: color.textMuted, lineHeight: 1.8, margin: '14px 0 0' }}>
          これはLMSが自動で作成した案です。次回のコーチングでこの画面を一緒に見ながら確認しましょう。
        </p>
      )}
    </div>
  );
}

export default function LearningPlanPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const userId = user?.userid;

  const { plan, loading, error, reload, setPlan, phaseStatuses, pendingRevision, pendingRevisionCount, checkin, checkinDue } =
    useLearningPlan(userId);

  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [draft, setDraft] = useState<LearningPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [coachName, setCoachName] = useState<string | null>(null);

  // 「コーチと確認しました」に添える既定のコーチ名を次回コーチング予定から取る。
  // 読み取りのみ。コーチング機能側のデータには書き込まない。
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    bffClient
      .getCoachingSessions(userId)
      .then((s) => {
        if (!cancelled) setCoachName(s.next?.coach ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const draftStatuses = useMemo(() => (draft ? derivePhaseStatus(draft, TODAY) : []), [draft]);

  const openEditor = useCallback(() => {
    if (!plan) return;
    setDraft(plan);
    setMode({ kind: 'edit' });
  }, [plan]);

  // ---- 保存・確定 ----

  const saveDraft = async () => {
    if (!userId || !draft) return;
    setBusy(true);
    try {
      const saved = await bffClient.updateLearningPlan(userId, {
        phases: draft.phases,
        goalDeadline: draft.goalDeadline,
      });
      setPlan(saved);
      setDraft(saved);
      showToast('ロードマップを保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmWithCoach = async () => {
    if (!userId || !draft) return;
    setBusy(true);
    try {
      await bffClient.updateLearningPlan(userId, { phases: draft.phases, goalDeadline: draft.goalDeadline });
      const confirmed = await bffClient.confirmLearningPlan(userId, coachName);
      setPlan(confirmed);
      setDraft(null);
      setMode({ kind: 'view' });
      showToast('コーチと確認済みとして記録しました', 'success');
    } catch {
      showToast('確定に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- 月次チェックイン ----

  const submitCheckin = async (answers: CheckinAnswers) => {
    if (!userId) return;
    setBusy(true);
    try {
      const revision = await bffClient.submitPlanCheckin(userId, answers);
      if (revision) {
        setMode({ kind: 'revision', revision });
        showToast('更新案を作成しました', 'success');
      } else {
        setMode({ kind: 'view' });
        showToast('いまのロードマップのままで問題なさそうです', 'success');
      }
      reload();
    } catch {
      showToast('回答の送信に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- 更新案への回答 ----

  const resolveRevision = async (revisionId: string, action: RevisionAction, selectedDiffIds: string[]) => {
    if (!userId) return;
    setBusy(true);
    try {
      const { plan: nextPlan } = await bffClient.resolvePlanRevision(userId, revisionId, action, selectedDiffIds);
      setPlan(nextPlan);
      setMode({ kind: 'view' });
      reload();
      showToast(action === 'keep_current' ? '現状のロードマップを維持します' : 'ロードマップを更新しました', 'success');
    } catch {
      showToast('更新に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- モック確認用のリセット ----

  const resetPlan = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await bffClient.resetLearningPlan(userId);
      navigate('/learning-plan/setup');
    } catch {
      showToast('リセットに失敗しました', 'error');
      setBusy(false);
    }
  };

  // ============================================================
  // 描画
  // ============================================================

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />
      <main
        style={{
          flex: 1, width: '100%', maxWidth: 880, margin: '0 auto',
          padding: '32px 20px 80px', display: 'flex', flexDirection: 'column', gap: 18,
          fontFamily: font.family,
        }}
      >
        {children}
      </main>
    </div>
  );

  if (loading) {
    return shell(
      <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>,
    );
  }

  if (error) {
    return shell(<p style={{ ...font.meta, color: color.primary, textAlign: 'center', padding: '48px 0' }}>{error}</p>);
  }

  if (!plan) {
    return shell(
      <div style={cardStyle()}>
        <div style={{ ...font.cardTitle, color: color.text }}>まだロードマップがありません</div>
        <p style={{ ...font.meta, color: color.textMuted, margin: '10px 0 20px', lineHeight: 1.8 }}>
          8つの質問に答えると、目標から逆算した学習計画をLMSが作成します。作成後、コーチと一緒に調整できます。
        </p>
        <button type="button" onClick={() => navigate('/learning-plan/setup')} style={{ ...t.primaryButton }}>
          ロードマップをつくる（約3分）
        </button>
      </div>,
    );
  }

  // ---- 編集モード ----
  if (mode.kind === 'edit' && draft) {
    return shell(
      <>
        <div>
          <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>ロードマップを調整する</h1>
          <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 0', lineHeight: 1.8 }}>
            コーチングの場でこの画面を共有しながら、期間とマイルストーンを一緒に決めてください。3ステップで終わります。
          </p>
        </div>
        <PlanEditor
          plan={draft}
          statuses={draftStatuses}
          saving={busy}
          defaultCoachName={coachName}
          onChange={setDraft}
          onSave={saveDraft}
          onConfirm={confirmWithCoach}
          onCancel={() => {
            setDraft(null);
            setMode({ kind: 'view' });
          }}
        />
      </>,
    );
  }

  // ---- 月次チェックイン ----
  if (mode.kind === 'checkin' && checkin) {
    return shell(
      <MonthlyCheckin prompt={checkin} busy={busy} onSubmit={submitCheckin} onCancel={() => setMode({ kind: 'view' })} />,
    );
  }

  // ---- 更新案（チェックイン直後） ----
  if (mode.kind === 'revision') {
    return shell(
      <RevisionCard
        key={mode.revision.id}
        revision={mode.revision}
        pendingCount={1}
        busy={busy}
        onResolve={(action, ids) => resolveRevision(mode.revision.id, action, ids)}
        onOpenEditor={openEditor}
      />,
    );
  }

  // ---- 通常表示 ----
  return shell(
    <>
      <div>
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>学習ロードマップ</h1>
        <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 0', lineHeight: 1.8 }}>
          目標から逆算した長期の学習計画です。コーチングのたびに、この画面を一緒に見ながら調整していきます。
        </p>
      </div>

      {/* 未操作でも溜まっていく更新候補。ここで初めてまとめて見えるようにする。 */}
      {pendingRevision && (
        <RevisionCard
          /* 差分の選択状態はマウント時に初期化されるので、別の更新案に変わったら作り直す */
          key={pendingRevision.id}
          revision={pendingRevision}
          pendingCount={pendingRevisionCount}
          busy={busy}
          onResolve={(action, ids) => resolveRevision(pendingRevision.id, action, ids)}
          onOpenEditor={openEditor}
        />
      )}

      {checkinDue && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: color.primarySoft, borderRadius: radius.md, padding: '14px 18px',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: color.primary }}>
            次回コーチングの前に、今月のふりかえりに答えましょう（約1分）
          </span>
          <button
            type="button"
            onClick={() => setMode({ kind: 'checkin' })}
            style={{ ...t.outlineButton, marginLeft: 'auto', padding: '10px 18px' }}
          >
            答える
          </button>
        </div>
      )}

      <RequiredSummary plan={plan} />

      <div style={cardStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ ...font.cardTitle, color: color.text }}>全体の流れ</span>
          <button type="button" onClick={openEditor} style={{ ...t.outlineButton, padding: '10px 18px' }}>
            期間・マイルストーンを調整する
          </button>
        </div>
        <div style={{ marginTop: 22 }}>
          <PhaseTimeline phases={plan.phases} statuses={phaseStatuses} mode="gantt" />
        </div>
      </div>

      {plan.phases.map((phase, i) => {
        const status = phaseStatuses[i] ?? 'todo';
        return (
          <section
            key={phase.key + phase.startDate}
            style={{
              ...cardStyle(),
              borderColor: status === 'current' ? color.primaryBorder : color.border,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ ...font.rowTitle, fontSize: 15, color: status === 'current' ? color.primary : color.text }}>
                {i + 1}. {phase.title}
              </span>
              {status === 'current' && <span style={{ ...t.chip }}>いまここ</span>}
              {status === 'done' && (
                <span style={{ ...font.caption, color: color.textSubtle }}>完了</span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                <PhaseRangeChip phase={phase} />
              </span>
            </div>

            {phase.skills.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {phase.skills.map((s) => (
                  <span
                    key={s}
                    style={{
                      ...font.caption, color: color.textMuted, background: color.hoverBg,
                      borderRadius: radius.pill, padding: '4px 10px',
                    }}
                  >
                    {SKILL_LABEL[s]}
                  </span>
                ))}
              </div>
            )}

            {phase.milestones.length === 0 ? (
              <p style={{ ...font.caption, color: color.textSubtle, margin: '14px 0 0' }}>
                このフェーズのマイルストーンは未設定です。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
                {phase.milestones.map((m) => (
                  <MilestoneRow key={m.id} milestone={m} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        <span style={{ ...font.caption, color: color.textFaint }}>
          次回見直し予定 {formatJpDate(plan.nextReviewDate)}・バージョン {plan.version}
        </span>
        {/* モック確認用。実運用では管理者操作にする想定。 */}
        <button
          type="button"
          disabled={busy}
          onClick={resetPlan}
          style={{ background: 'none', border: 'none', fontFamily: 'inherit', ...font.caption, color: color.textFaint, cursor: 'pointer', textDecoration: 'underline' }}
        >
          初回設定をやり直す
        </button>
      </div>
    </>,
  );
}
