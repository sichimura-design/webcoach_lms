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
import { derivePhaseStatus, formatJpDate } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import RevisionCard from './RevisionCard';
import MonthlyCheckin from './MonthlyCheckin';
import PlanEditor from './PlanEditor';
import PlanSummaryStrip from './PlanSummaryStrip';
import StageRail from './StageRail';
import ThisMonthCard from './ThisMonthCard';
import PaceAdjustCard from './PaceAdjustCard';

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

/**
 * 「全ロードマップで必須の7項目」のうち、上部のサマリー4タイルに出ないものを補う帯。
 * ゴール・期限・現在フェーズ・見直し日は PlanSummaryStrip 側で見えているので、
 * ここは優先スキル・状態・実現可能性の注記だけに絞る。
 */
function PlanConditions({ plan }: { plan: LearningPlan }) {
  return (
    <div style={cardStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...font.cardTitle, color: color.text }}>このロードマップの前提</span>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <span style={{ ...font.caption, color: color.textSubtle, flex: '0 0 auto' }}>優先スキル</span>
        {plan.prioritySkills.length === 0 ? (
          <span style={{ fontSize: 13, color: color.textSubtle }}>—</span>
        ) : (
          plan.prioritySkills.map((s) => (
            <span
              key={s}
              style={{
                ...font.caption, color: color.textStrong, background: color.hoverBg,
                borderRadius: radius.pill, padding: '5px 12px',
              }}
            >
              {SKILL_LABEL[s]}
            </span>
          ))
        )}
        <span style={{ ...font.caption, color: color.textSubtle, marginLeft: 12 }}>
          週の学習時間の想定 約{plan.intake.weeklyHours}時間
        </span>
      </div>

      {plan.feasibilityNote && (
        <p
          style={{
            ...font.caption, color: color.textBody, lineHeight: 1.8, margin: '16px 0 0',
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

  const {
    plan, loading, error, reload, setPlan,
    stages, currentStage, currentPhase, progress, monthMilestones,
    pendingRevision, pendingRevisionCount, checkin, checkinDue,
  } = useLearningPlan(userId);

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

  // 「今月やること」に出していない、現在フェーズの残りのマイルストーン。
  // 全フェーズぶんを並べると再び「やることが多すぎる」画面に戻るので、現在フェーズ内に留める。
  const restMilestones = useMemo(() => {
    if (!currentPhase) return [];
    const shown = new Set(monthMilestones.map((m) => m.id));
    return currentPhase.milestones.filter((m) => !shown.has(m.id));
  }, [currentPhase, monthMilestones]);

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
      reload();
      showToast('ロードマップを保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  /**
   * ペース調整（目標期限の変更）の保存。
   * 期間の再計算は PaceAdjustCard 内の純関数で済んでいるので、ここは結果を送るだけ。
   */
  const saveDeadline = async (next: LearningPlan) => {
    if (!userId) return;
    setBusy(true);
    try {
      const saved = await bffClient.updateLearningPlan(userId, {
        phases: next.phases,
        goalDeadline: next.goalDeadline,
      });
      setPlan(saved);
      // 期間を動かすと古い更新案は前提が変わるのでサーバー側で superseded になる。
      // 画面から消えるように取り直す。
      reload();
      showToast('ペースを変更しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  };

  /** コーチとの見直し日の予約。日付が動くとふりかえりの表示タイミングも変わるので再取得する。 */
  const saveReviewDate = async (nextReviewDate: string) => {
    if (!userId) return;
    setBusy(true);
    try {
      const saved = await bffClient.updateLearningPlan(userId, { nextReviewDate });
      setPlan(saved);
      reload();
      showToast('見直し日を予約しました', 'success');
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
          flex: 1, width: '100%', maxWidth: 1080, margin: '0 auto',
          padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', gap: 18,
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
          長期の学習計画をもとに、今やることを分かりやすくお届けします。定期的に見直して、目標達成を一緒に目指しましょう。
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

      <PlanSummaryStrip
        plan={plan}
        stages={stages}
        currentStage={currentStage}
        currentPhaseTitle={currentPhase?.title ?? null}
        progress={progress}
      />

      <div style={cardStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ ...font.cardTitle, color: color.text }}>全体のロードマップ</span>
          <span style={{ ...font.caption, color: color.textFaint }}>
            全{plan.phases.length}フェーズを{stages.length}つのステージにまとめて表示しています
          </span>
        </div>
        <div style={{ marginTop: 26 }}>
          <StageRail stages={stages} currentStage={currentStage} />
        </div>
      </div>

      <ThisMonthCard milestones={monthMilestones} phase={currentPhase} restMilestones={restMilestones} />

      {/*
        「質問に答えて見直す」導線。中身は既存の月次ふりかえり4問をそのまま使う。
        見直し日が近いときだけ配色と文言を強めて、それ以外は常設の案内として置いておく。
      */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          background: checkinDue ? color.primarySoft : color.hoverBgTint,
          border: `1px solid ${checkinDue ? color.primaryBorder : color.borderSoft}`,
          borderRadius: radius.card, padding: '20px 24px',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <div style={{ ...font.rowTitle, fontSize: 15, color: checkinDue ? color.primary : color.text }}>
            {checkinDue
              ? `${formatJpDate(plan.nextReviewDate)}の見直しが近づいています`
              : '学習計画は、いつでもあなたに合わせて調整できます'}
          </div>
          <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
            4つの質問（今月の達成度・学習時間の変化・つまずき・目標の変化）に答えると、
            回答をもとにLMSがペースの調整案を作ります。採用するかどうかはあなたが選べます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode({ kind: 'checkin' })}
          disabled={!checkin}
          style={{ ...t.primaryButton, padding: '15px 26px', fontSize: 14, opacity: checkin ? 1 : 0.5 }}
        >
          質問に答えて見直す
        </button>
        <span style={{ ...font.caption, color: color.textFaint, flex: '0 0 auto' }}>所要時間：約1分</span>
      </div>

      <PaceAdjustCard
        plan={plan}
        busy={busy}
        onSaveDeadline={saveDeadline}
        onSaveReviewDate={saveReviewDate}
        onOpenEditor={openEditor}
      />

      <PlanConditions plan={plan} />

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
