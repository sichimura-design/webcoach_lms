import { useMemo, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import {
  ACHIEVEMENT_LABEL,
  Achievement,
  ManualStudyEntryInput,
  StudyActivity,
  StudyActivityCourseRef,
  StudyActivityPatch,
} from '../../types/studyActivity';
import {
  MAX_MANUAL_MINUTES,
  MIN_ACTIVITY_MINUTES,
  TEXT_MAX_LENGTH,
  formatMinutesHM,
  isManualEntry,
  toLocalDateKey,
} from '../../utils/studyStats';

/**
 * 学習記録の編集／手動追加。
 * ============================================================
 * タイマーの止め忘れ（長すぎる記録）と付け忘れ（記録が無い日）の両方をここで直す。
 *
 * 🔴 起動点は4つある（履歴の行・日別詳細の行・履歴カードの「＋手動で記録を追加」・
 *    日別パネルの「＋この日の記録を追加」）が、入力面はこのモーダル1つだけ。
 *    「同じデータの編集入口を2箇所に置かない」規約に対して、4つはすべて
 *    同じモーダルを開くショートカットという位置づけ。
 *
 * 🔴 focus/FinishSessionModal を再利用しない。あちらは StudyFinishDraft.snapshot
 *    （measuredSeconds / pausedCount / completedTarget）前提の3ステップで、
 *    最後に navigate('/study-log') する。偽の draft を組んでステップを潰す改造は、
 *    タイマー終了時の保存という中核の経路にリスクを持ち込む。
 *    分ステッパーと達成度3ピルの「操作の作法」だけ写して、色は --dc-* に置いた。
 *
 * 🔴 検証は utils/studyStats.ts の validate* に委ねる（呼び出し側のフックが呼ぶ）。
 *    ここでは入力できる範囲を UI で狭めるだけ。
 * ============================================================
 */
interface StudyRecordEditModalProps {
  mode: 'edit' | 'create';
  /** mode='edit' のときの対象 */
  activity?: StudyActivity;
  /** mode='create' のときの初期日付（日別パネルからは選択日） */
  defaultDate?: string;
  /** 教材の選択肢。stats.byCourse から作る（追加フェッチをしない） */
  courses: { id: number; title: string }[];
  saving: boolean;
  /** 送信に失敗した理由。フックが持っている文言をそのまま出す */
  error: string | null;
  onSave: (value: StudyActivityPatch | Omit<ManualStudyEntryInput, 'id'>) => Promise<void>;
  onClose: () => void;
}

const ACHIEVEMENTS: Achievement[] = ['low', 'mid', 'high'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--dc-border-strong)',
  borderRadius: 'var(--dc-radius-md)',
  padding: '9px 12px',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  color: 'var(--dc-text)',
  background: 'var(--dc-surface)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--dc-fs-caption)',
  fontWeight: 700,
  color: 'var(--dc-text-body)',
  marginBottom: 6,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function StudyRecordEditModal({
  mode,
  activity,
  defaultDate,
  courses,
  saving,
  error,
  onSave,
  onClose,
}: StudyRecordEditModalProps) {
  const todayKey = toLocalDateKey(new Date());

  const [date, setDate] = useState(activity?.localDate ?? defaultDate ?? todayKey);
  const [minutes, setMinutes] = useState(activity?.session.durationMinutes ?? 30);
  const [courseId, setCourseId] = useState<number | null>(activity?.course?.courseId ?? null);
  const [contentNote, setContentNote] = useState(activity?.session.contentNote ?? '');
  const [memo, setMemo] = useState(activity?.session.memo ?? '');
  const [achievement, setAchievement] = useState<Achievement | null>(activity?.session.achievement ?? null);

  const measuredMinutes = activity ? Math.round(activity.session.measuredSeconds / 60) : 0;
  const manual = activity ? isManualEntry(activity) : true;

  const stepMinutes = (delta: number) =>
    setMinutes((v) => Math.min(MAX_MANUAL_MINUTES, Math.max(MIN_ACTIVITY_MINUTES, v + delta)));

  const courseRef = useMemo((): StudyActivityCourseRef | null => {
    if (courseId === null) return null;
    // 教材を変えていないなら、レッスン名や進捗などの既存の情報を落とさない
    if (activity?.course && activity.course.courseId === courseId) return activity.course;
    const found = courses.find((c) => c.id === courseId);
    return { courseId, courseTitle: found?.title ?? '' };
  }, [courseId, courses, activity]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (mode === 'edit') {
      const patch: StudyActivityPatch = {
        durationMinutes: minutes,
        course: courseRef,
        contentNote: contentNote.trim() || null,
        memo: memo.trim() || null,
        achievement,
        localDate: date,
      };
      await onSave(patch);
    } else {
      const input: Omit<ManualStudyEntryInput, 'id'> = {
        localDate: date,
        durationMinutes: minutes,
        course: courseRef,
        contentNote: contentNote.trim() || null,
        memo: memo.trim() || null,
        achievement,
      };
      await onSave(input);
    }
  };

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(20,14,8,.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        /*
         * 🔴 noValidate。ブラウザ標準の検証を先に働かせない。
         *    max/required で止めると、出る文言がブラウザ任せ（環境で変わる）になり、
         *    サーバ役（MSW）が返す文言と食い違う。検証は utils/studyStats.ts の
         *    validateManualEntry / validateActivityPatch に一本化して、
         *    同じ日本語をこのカードの中に出す。
         *    min/max/required は入力補助（ステッパーの上限・日付ピッカーの上限）として残す。
         */
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="studylog-edit-title"
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--dc-surface)',
          border: '1px solid var(--dc-border)',
          borderRadius: 'var(--dc-radius-lg)',
          boxShadow: 'var(--dc-shadow-float)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
          <h2
            id="studylog-edit-title"
            style={{
              margin: 0,
              flex: 1,
              fontSize: 'var(--dc-fs-lead)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            {mode === 'edit' ? '学習記録を編集する' : '学習記録を追加する'}
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            disabled={saving}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 26,
              height: 26,
              flex: 'none',
              borderRadius: 9999,
              border: '1px solid var(--dc-border)',
              background: 'var(--dc-surface)',
              color: 'var(--dc-text-muted)',
              display: 'grid',
              placeItems: 'center',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {mode === 'create' && (
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 'var(--dc-fs-caption)',
              color: 'var(--dc-text-muted)',
              lineHeight: 'var(--dc-lh-prose)',
            }}
          >
            タイマーを付け忘れた分をあとから足せます。追加した記録には「手動」の印が付きます。
          </p>
        )}

        <Field label="日付">
          <input
            type="date"
            required
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>学習時間</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              aria-label="5分減らす"
              onClick={() => stepMinutes(-5)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                border: '1px solid var(--dc-border-strong)', background: 'var(--dc-surface)',
                color: 'var(--dc-text)', display: 'grid', placeItems: 'center', cursor: 'pointer',
              }}
            >
              <Minus size={15} strokeWidth={2} />
            </button>

            <input
              type="number"
              inputMode="numeric"
              required
              min={MIN_ACTIVITY_MINUTES}
              max={MAX_MANUAL_MINUTES}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="学習時間（分）"
              className="dc-num"
              style={{ ...inputStyle, textAlign: 'center', maxWidth: 110 }}
            />
            <span style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)', flexShrink: 0 }}>分</span>

            <button
              type="button"
              aria-label="5分増やす"
              onClick={() => stepMinutes(5)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                border: '1px solid var(--dc-border-strong)', background: 'var(--dc-surface)',
                color: 'var(--dc-text)', display: 'grid', placeItems: 'center', cursor: 'pointer',
              }}
            >
              <Plus size={15} strokeWidth={2} />
            </button>

            <span className="dc-num" style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginLeft: 'auto' }}>
              {formatMinutesHM(minutes)}
            </span>
          </div>

          {/* 実測が残っている記録では、元の計測値を添える。
              止め忘れを直すときに「本当は何分だったか」の手がかりになる */}
          {mode === 'edit' && !manual && (
            <p className="dc-num" style={{ margin: '6px 0 0', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
              計測値は {formatMinutesHM(measuredMinutes)} でした
            </p>
          )}
        </div>

        <Field label="教材">
          <select
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value === '' ? null : Number(e.target.value))}
            style={inputStyle}
          >
            <option value="">教材を指定しない</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="学習した内容（任意）">
          <textarea
            value={contentNote}
            maxLength={TEXT_MAX_LENGTH}
            rows={2}
            onChange={(e) => setContentNote(e.target.value)}
            style={{ ...inputStyle, lineHeight: 'var(--dc-lh-prose)', resize: 'vertical' }}
          />
        </Field>

        <Field label="メモ（任意）">
          <textarea
            value={memo}
            maxLength={TEXT_MAX_LENGTH}
            rows={2}
            onChange={(e) => setMemo(e.target.value)}
            style={{ ...inputStyle, lineHeight: 'var(--dc-lh-prose)', resize: 'vertical' }}
          />
        </Field>

        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>手応え（任意）</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACHIEVEMENTS.map((a) => {
              const active = achievement === a;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={active}
                  // もう一度押すと解除。付けたあとに「やっぱり付けない」ができないと詰む
                  onClick={() => setAchievement(active ? null : a)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    fontFamily: 'inherit',
                    fontSize: 'var(--dc-fs-body)',
                    fontWeight: active ? 700 : 500,
                    border: `1px solid ${active ? 'var(--dc-primary)' : 'var(--dc-border-strong)'}`,
                    background: active ? 'var(--dc-primary)' : 'var(--dc-surface)',
                    color: active ? '#fff' : 'var(--dc-text-body)',
                    cursor: 'pointer',
                  }}
                >
                  {ACHIEVEMENT_LABEL[a]}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              margin: '0 0 14px',
              padding: '9px 12px',
              borderRadius: 'var(--dc-radius-md)',
              background: 'var(--dc-soft-100)',
              border: '1px solid var(--dc-soft-200)',
              fontSize: 'var(--dc-fs-caption)',
              color: 'var(--dc-text-body)',
              lineHeight: 'var(--dc-lh-ui)',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              background: 'var(--dc-surface)',
              border: '1px solid var(--dc-border-strong)',
              borderRadius: 9,
              padding: '9px 16px',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text-body)',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            やめる
          </button>
          <button
            type="submit"
            disabled={saving}
            className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              background: 'var(--dc-primary)',
              border: '1px solid var(--dc-primary)',
              borderRadius: 9,
              padding: '9px 18px',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: '#fff',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StudyRecordEditModal;
