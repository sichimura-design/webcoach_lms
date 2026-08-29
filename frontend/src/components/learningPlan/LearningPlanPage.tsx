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
} from '../../types/learningPlan';
import { derivePhaseStatus } from '../../utils/learningPlanTemplate';
import { MOCKS_ENABLED } from '../../mocks/config';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import RevisionCard from './RevisionCard';
import MonthlyCheckin from './MonthlyCheckin';
import PhaseFocusCards from './PhaseFocusCards';
import PhaseJourney from './PhaseJourney';
import PlanEditor from './PlanEditor';
import PlanSummaryStrip from './PlanSummaryStrip';
import ReviewDuePrompt from './ReviewDuePrompt';

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

// 「このロードマップの前提」（優先スキル・週の想定学習時間・実現可能性の注記）の帯は外した。
// この画面は「最終ゴール → 道筋 → 今ここ → 今の目的 → 次のステップ」に絞る方針で、
// 前提の確認は初回設定と編集モードで足りる。データ（prioritySkills / feasibilityNote）は
// LearningPlan にそのまま残っていて、PlanEditor では今も編集できる。

export default function LearningPlanPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const userId = user?.userid;

  const {
    plan, loading, error, reload, setPlan,
    stages, currentStage,
    pendingRevision, pendingRevisionCount, checkin, checkinDue,
  } = useLearningPlan(userId);

  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [draft, setDraft] = useState<LearningPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [coachName, setCoachName] = useState<string | null>(null);

  /**
   * 見直し案内のモーダル。見直し時期になったら1度だけ出す。
   * 「あとで」で閉じたあとも告知バンドは残るので、導線は失われない。
   * 毎回モーダルが出ると「見直しを促されて煩わしい」に戻るため、
   * 閉じたら同じセッション中は二度と出さない。
   */
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalShown, setReviewModalShown] = useState(false);

  useEffect(() => {
    if (checkinDue && checkin && !reviewModalShown) {
      setReviewModalOpen(true);
      setReviewModalShown(true);
    }
  }, [checkinDue, checkin, reviewModalShown]);

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

  // マイルストーンの取り回し（今月やること／残りのマイルストーン）はこの画面から外した。
  // ロードマップは中長期の地図に特化し、細かな行動は /coaching の
  // 「次回までのアクション」が持つ、という役割分担にしたため。
  // plan.phases[].milestones はデータとしては残っていて、編集モードでは今も使う。

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

  // ペース調整カード（目標期限・見直し日を日付ピッカーで直接動かすUI）はこの画面から外した。
  // 「日単位・週単位で期限を設定すると、実際のコーチングによって進め方が変わるため、
  // 予定から少しズレただけで遅れている感が出やすい」というレビュー指摘への対応。
  // 期間の調整は「質問に答えて見直す」→ 更新案の採否、という流れに一本化してある。

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
        className="wc-page"
        style={{
          '--wc-page-max': '1080px',
          flex: 1, display: 'flex', flexDirection: 'column', gap: 18,
          fontFamily: font.family,
        } as React.CSSProperties}
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
  //
  // この画面が答えるのは次の5つだけに絞ってある:
  //   最終ゴール → 全体の道筋 → 今ここ → 今のフェーズの目的 → 次のステップ
  // 具体的な行動・短期目標は /coaching の「次回までのアクション」が持つ。
  // 役割を混ぜると運用が複雑になる、というレビュー指摘に沿った分担。
  return shell(
    <>
      <div>
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>学習ロードマップ</h1>
        <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 0', lineHeight: 1.8 }}>
          長期的な学習の道筋です。具体的な短期目標は
          <button
            type="button"
            onClick={() => navigate('/coaching')}
            style={{
              background: 'none', border: 'none', padding: 0, margin: '0 2px',
              fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700,
              color: color.primary, cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            「次回コーチングまでの目標」
          </button>
          で管理します。
        </p>
      </div>

      <PlanSummaryStrip plan={plan} stages={stages} currentStage={currentStage} />

      {/* 見直し時期のときだけ出す。常設すると煩わしい、という指摘への対応。
          モーダルは初回表示の1回だけで、閉じたあとはバンドだけが残る。 */}
      <ReviewDuePrompt
        due={checkinDue}
        ready={!!checkin}
        modalOpen={reviewModalOpen}
        onStart={() => {
          setReviewModalOpen(false);
          setMode({ kind: 'checkin' });
        }}
        onDismissModal={() => setReviewModalOpen(false)}
      />

      {/* 未操作でも溜まっていく更新候補。見直しに答えた結果はここに出る。 */}
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

      <PhaseJourney stages={stages} />

      <PhaseFocusCards stages={stages} />

      {/* モック確認用の導線。本番では出さない（開発者向け文言を本番文言に混ぜない）。 */}
      {MOCKS_ENABLED && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
          <span style={{ ...font.caption, color: color.textFaint }}>
            バージョン {plan.version}・{PLAN_STATUS_LABEL[plan.status]}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={resetPlan}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', ...font.caption, color: color.textFaint, cursor: 'pointer', textDecoration: 'underline' }}
          >
            初回設定をやり直す（モック確認用）
          </button>
        </div>
      )}
    </>,
  );
}
