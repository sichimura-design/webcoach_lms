/**
 * frontend/src/components/learningPlan/LearningPlanSetupPage.tsx
 * 初回設定ウィザード。ルートは /learning-plan/setup。
 *
 * ロードマップ作成をコーチの作業にしないため、受講生がここで8問に答えるだけで
 * LMSが計画を組み立てる。コーチングは「ゼロから考える」ではなく
 * 「この内容で進めますか？」の確認から始められる状態にするのが目的。
 *
 * 質問文と選択肢はAPIから取得する（画面にベタ書きしない）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import bffClient from '../../services/bffClient';
import { ChoiceQuestion, IntakeAnswers, LearningPlan, SKILL_LABEL } from '../../types/learningPlan';
import { derivePhaseStatus, formatJpDateFull } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import ChoiceQuestionField from './ChoiceQuestionField';
import PhaseTimeline, { PhaseRangeChip } from './PhaseTimeline';
import MilestoneRow from './MilestoneRow';

type Value = string | number | boolean;

/** 選択肢が多い設問はグリッドで並べる（1問1画面でも縦に伸びすぎないように） */
const GRID_COLUMNS: Record<string, number> = { skills: 2, busyMonths: 4, focus: 2 };

const DEFAULT_ANSWERS: Record<string, Value | Value[]> = {
  skills: [],
  busyMonths: [],
};

export default function LearningPlanSetupPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const userId = user?.userid;

  const [questions, setQuestions] = useState<ChoiceQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Value | Value[]>>(DEFAULT_ANSWERS);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<LearningPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    bffClient
      .getIntakeQuestions()
      .then((qs) => {
        if (cancelled) return;
        setQuestions(qs);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        showToast('質問の取得に失敗しました', 'error');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const current = questions[step];
  const isLast = step === questions.length - 1;

  // multi は未選択でも先に進める（「特にない」を選ばせるより早い）
  const canAdvance = useMemo(() => {
    if (!current) return false;
    if (current.kind === 'multi') return true;
    return answers[current.id] !== undefined;
  }, [answers, current]);

  const buildAnswers = (): IntakeAnswers => ({
    workStyle: answers.workStyle as IntakeAnswers['workStyle'],
    skills: (answers.skills as IntakeAnswers['skills']) ?? [],
    deadlineMonths: answers.deadlineMonths as IntakeAnswers['deadlineMonths'],
    weeklyHours: answers.weeklyHours as IntakeAnswers['weeklyHours'],
    experience: answers.experience as IntakeAnswers['experience'],
    wantsClientWork: answers.wantsClientWork as boolean,
    focus: answers.focus as IntakeAnswers['focus'],
    busyMonths: (answers.busyMonths as number[]) ?? [],
  });

  const submit = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const plan = await bffClient.submitIntake(userId, buildAnswers());
      setPreview(plan);
    } catch {
      showToast('ロードマップの作成に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />
      <main
        className="wc-page"
        style={{
          '--wc-page-max': '720px',
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

  // ============================================================
  // 生成結果のプレビュー
  // ============================================================
  if (preview) {
    const statuses = derivePhaseStatus(preview, new Date());
    return shell(
      <>
        <div>
          <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>ロードマップができました</h1>
          <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
            回答をもとにLMSが作成した案です。次回のコーチングでこの画面を一緒に見ながら、期間やマイルストーンを調整できます。
          </p>
        </div>

        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, padding: '22px 24px 26px' }}>
          <div style={{ ...font.cardTitle, color: color.text }}>{preview.goal}</div>
          <div style={{ ...font.caption, color: color.textSubtle, marginTop: 8 }}>
            目標期限 {formatJpDateFull(preview.goalDeadline)}
            {preview.prioritySkills.length > 0 && `・優先スキル ${preview.prioritySkills.map((s) => SKILL_LABEL[s]).join('・')}`}
          </div>
          <PhaseTimeline phases={preview.phases} statuses={statuses} mode="rail" />
        </div>

        {preview.feasibilityNote && (
          <p
            style={{
              ...font.meta, color: color.textBody, lineHeight: 1.8, margin: 0,
              background: color.hoverBgTint, border: `1px solid ${color.borderSoft}`,
              borderRadius: radius.md, padding: '14px 16px',
            }}
          >
            {preview.feasibilityNote}
          </p>
        )}

        {preview.phases.map((phase, i) => (
          <section key={phase.key + phase.startDate} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, padding: '18px 22px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ ...font.rowTitle, color: color.text }}>{i + 1}. {phase.title}</span>
              <span style={{ marginLeft: 'auto' }}>
                <PhaseRangeChip phase={phase} />
              </span>
            </div>
            {phase.milestones.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                {phase.milestones.map((m) => (
                  <MilestoneRow key={m.id} milestone={m} showMetric={false} />
                ))}
              </div>
            )}
          </section>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/learning-plan')} style={{ ...t.primaryButton, padding: '15px 28px' }}>
            このロードマップで進める
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setStep(0);
            }}
            style={{ ...t.outlineButton }}
          >
            回答をやり直す
          </button>
        </div>
      </>,
    );
  }

  // ============================================================
  // 1問1画面のウィザード
  // ============================================================
  if (!current) {
    return shell(<p style={{ ...font.meta, color: color.textMuted }}>質問を読み込めませんでした。</p>);
  }

  return shell(
    <>
      <div>
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>学習ロードマップをつくる</h1>
        <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
          {questions.length}つの質問に答えると、目標から逆算した学習計画をLMSが作成します。あとから何度でも変更できます。
        </p>
      </div>

      {/* 進捗ドット */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {questions.map((q, i) => (
          <span
            key={q.id}
            style={{
              height: 5, flex: 1, borderRadius: radius.pill,
              background: i <= step ? color.primary : color.trackBg,
              transition: 'background 200ms ease',
            }}
          />
        ))}
        <span style={{ ...font.caption, color: color.textSubtle, marginLeft: 8, whiteSpace: 'nowrap' }}>
          {step + 1} / {questions.length}
        </span>
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, padding: '26px 28px 28px' }}>
        <ChoiceQuestionField
          question={current}
          value={answers[current.id]}
          columns={GRID_COLUMNS[current.id]}
          onChange={(next) => {
            setAnswers((prev) => ({ ...prev, [current.id]: next }));
            // 単一選択は選んだ時点で次へ進む（コーチングの前に3分で終わらせたいので待たせない）
            if (current.kind === 'single' && !isLast) {
              window.setTimeout(() => setStep((s) => Math.min(s + 1, questions.length - 1)), 160);
            }
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{ ...t.outlineButton, opacity: step === 0 || submitting ? 0.4 : 1 }}
        >
          戻る
        </button>

        {isLast ? (
          <button
            type="button"
            disabled={!canAdvance || submitting}
            onClick={submit}
            style={{ ...t.primaryButton, marginLeft: 'auto', padding: '15px 28px', opacity: !canAdvance || submitting ? 0.6 : 1 }}
          >
            {submitting ? '作成中…' : 'ロードマップをつくる'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => Math.min(s + 1, questions.length - 1))}
            style={{ ...t.primaryButton, marginLeft: 'auto', padding: '14px 26px', opacity: !canAdvance ? 0.6 : 1 }}
          >
            次へ
          </button>
        )}
      </div>
    </>,
  );
}
