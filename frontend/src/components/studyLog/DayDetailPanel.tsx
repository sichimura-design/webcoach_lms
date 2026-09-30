import { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { ACHIEVEMENT_LABEL, Achievement, StudyReflection, StudySession } from '../../types/studyActivity';
import type { CoachingSessionSummary } from '../../types/coaching';
import { STUDY_DAY_MIN_MINUTES, formatMinutesHM } from '../../utils/studyStats';
import { formatDayLabel } from '../focus/focusFormat';
import StudyLogRow, { EmptyStudyLog } from './StudyLogRow';

/**
 * カレンダーで選んだ日の中身。
 * ============================================================
 * 広い画面ではカレンダーの右横、1023px 以下ではカレンダーの真下に回り込む
 * （.studylog-calendar-grid が1カラムに落ちるだけで、DOM は同じ）。
 *
 * 🔴 モーダルにしない。カレンダーが隠れると「隣の日はどうだったか」を
 *    続けて見られなくなる。
 *
 * 🔴 カレンダー直下に展開もしない。日を選ぶたびに下の推移・履歴が大きく動き、
 *    記録の無い日を選ぶと高さが急に縮む。
 *
 * 🔴 セッション一覧は読み取り専用（Moodleログ由来の自動記録なので編集・削除できない）。
 *    ユーザーが書けるのは「この日の振り返り」（達成度・メモ、StudyReflection）だけ。
 * ============================================================
 */
const ACHIEVEMENT_OPTIONS: Achievement[] = ['low', 'mid', 'high'];

interface DayDetailPanelProps {
  /** 選択中の日（YYYY-MM-DD）。null なら「日付を選んでください」 */
  date: string | null;
  /** その日に完了した学習セッション（新しい順、実データ） */
  sessions: StudySession[];
  /** courseid → 教材名。courseOptions から解決できなければ null */
  courseTitleOf: (courseid: number | null) => string | null;
  /** その日の振り返り。未入力なら null */
  reflection: StudyReflection | null;
  /** その日のコーチング */
  coachingSessions: CoachingSessionSummary[];
  loading: boolean;
  saving?: boolean;
  saveError?: string | null;
  onOpenSession: (sessionId: number) => void;
  onSaveReflection: (patch: { achievement: Achievement | null; memo: string | null }) => Promise<void>;
  onClose: () => void;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

function ReflectionEditor({
  reflection,
  saving,
  saveError,
  onSave,
  onCancel,
}: {
  reflection: StudyReflection | null;
  saving: boolean;
  saveError?: string | null;
  onSave: (patch: { achievement: Achievement | null; memo: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [achievement, setAchievement] = useState<Achievement | null>(reflection?.achievement ?? null);
  const [memo, setMemo] = useState(reflection?.memo ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {ACHIEVEMENT_OPTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAchievement(achievement === a ? null : a)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 9999,
              border: `1px solid ${achievement === a ? 'var(--dc-primary)' : 'var(--dc-border)'}`,
              background: achievement === a ? 'var(--dc-soft-100)' : 'var(--dc-surface)',
              color: achievement === a ? 'var(--dc-primary)' : 'var(--dc-text-body)',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-caption)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {ACHIEVEMENT_LABEL[a]}
          </button>
        ))}
      </div>

      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="今日の振り返りメモ（任意）"
        rows={3}
        style={{
          width: '100%',
          resize: 'vertical',
          borderRadius: 'var(--dc-radius-md)',
          border: '1px solid var(--dc-border)',
          background: 'var(--dc-surface)',
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: 'var(--dc-fs-caption)',
          color: 'var(--dc-text-body)',
        }}
      />

      {saveError && (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-primary)' }}>{saveError}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            await onSave({ achievement, memo: memo.trim() ? memo.trim() : null });
          }}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            flex: 1,
            minHeight: 38,
            borderRadius: 9999,
            border: 'none',
            background: 'var(--dc-primary)',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-caption)',
            fontWeight: 700,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '保存中…' : '保存する'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            minHeight: 38,
            padding: '0 16px',
            borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)',
            background: 'var(--dc-surface)',
            color: 'var(--dc-text-body)',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-caption)',
            fontWeight: 700,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

export function DayDetailPanel({
  date,
  sessions,
  courseTitleOf,
  reflection,
  coachingSessions,
  loading,
  saving = false,
  saveError = null,
  onOpenSession,
  onSaveReflection,
  onClose,
}: DayDetailPanelProps) {
  const [editingReflection, setEditingReflection] = useState(false);

  // 日を切り替えたら編集状態はリセットする
  useEffect(() => {
    setEditingReflection(false);
  }, [date]);

  if (!date) {
    return (
      <section style={CARD} aria-label="選んだ日の学習内容">
        <p
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-prose)',
          }}
        >
          カレンダーの日付を選ぶと、その日に学習した教材と時間、受けたコーチングがここに出ます。
        </p>
      </section>
    );
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const isStudyDay = totalMinutes >= STUDY_DAY_MIN_MINUTES;

  return (
    <section style={CARD} aria-label={`${formatDayLabel(`${date}T00:00:00`)}の学習内容`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--dc-fs-lead)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            {formatDayLabel(`${date}T00:00:00`)}
          </h2>
          <p
            className="dc-num"
            style={{ margin: '4px 0 0', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}
          >
            {loading
              ? '読み込み中…'
              : sessions.length === 0
                ? '学習の記録はありません'
                : `合計 ${formatMinutesHM(totalMinutes)} ・ ${sessions.length}件${isStudyDay ? '' : `（${STUDY_DAY_MIN_MINUTES}分未満）`}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="選択を解除する"
          onClick={onClose}
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
            cursor: 'pointer',
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {loading ? (
          <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
            読み込んでいます…
          </p>
        ) : sessions.length === 0 ? (
          <EmptyStudyLog message="この日の学習記録はありません。" />
        ) : (
          sessions.map((s, i) => (
            <StudyLogRow key={`${s.started_at}-${i}`} session={s} courseTitle={courseTitleOf(s.courseid)} />
          ))
        )}
      </div>

      {coachingSessions.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--dc-border)' }}>
          <h3
            style={{
              margin: '0 0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            <MessageSquare size={14} strokeWidth={2} color="var(--dc-gold)" aria-hidden="true" />
            この日のコーチング
          </h3>
          {coachingSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSession(s.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                minHeight: 44,
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: 'var(--dc-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.title}
              </span>
              <span style={{ color: 'var(--dc-primary)', fontWeight: 700, flex: 'none' }}>詳しく見る ›</span>
            </button>
          ))}
        </div>
      )}

      {/* この日の振り返り（達成度・メモ）。学習時間・教材とは別に、本人だけが書ける */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--dc-border)' }}>
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 700,
            color: 'var(--dc-text)',
          }}
        >
          この日の振り返り
        </h3>

        {editingReflection ? (
          <ReflectionEditor
            reflection={reflection}
            saving={saving}
            saveError={saveError}
            onSave={async (patch) => {
              await onSaveReflection(patch);
              setEditingReflection(false);
            }}
            onCancel={() => setEditingReflection(false)}
          />
        ) : reflection?.achievement || reflection?.memo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reflection.achievement && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'var(--dc-soft-100)',
                  color: 'var(--dc-primary)',
                  fontSize: 'var(--dc-fs-caption)',
                  fontWeight: 700,
                }}
              >
                {ACHIEVEMENT_LABEL[reflection.achievement]}
              </span>
            )}
            {reflection.memo && (
              <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-body)', lineHeight: 'var(--dc-lh-ui)' }}>
                {reflection.memo}
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditingReflection(true)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-caption)',
                fontWeight: 700,
                color: 'var(--dc-primary)',
                cursor: 'pointer',
              }}
            >
              編集する
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingReflection(true)}
            className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 40,
              borderRadius: 9999,
              border: '1px solid var(--dc-border-strong)',
              background: 'var(--dc-surface)',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text-body)',
              cursor: 'pointer',
            }}
          >
            振り返りを書く
          </button>
        )}
      </div>
    </section>
  );
}

export default DayDetailPanel;
