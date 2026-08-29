import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, X } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import {
  ACHIEVEMENT_LABEL,
  Achievement,
  STUDY_CATEGORY_LABEL,
  StudyFinishDraft,
} from '../../types/studyActivity';
import { MAX_ADJUST_EXTRA_MINUTES, displaySegments, formatMinutesHM } from '../../utils/studyStats';
import { formatSessionRange } from './focusFormat';

/**
 * 学習終了時の記録カード。
 *
 * 1つのモーダルで「確認 → 内容を追加 → 完了」を状態フラグで切り替える
 * （coaching/MeetingLinkModal.tsx と同じ作法）。
 * 操作は要件どおり「そのまま記録」「内容を追加して記録」の2つに絞る。
 * 閉じる（X・背景クリック）は記録せずタイマーへ戻る = onDismiss。
 */
interface FinishSessionModalProps {
  draft: StudyFinishDraft;
  /** 今週の累計（この記録を含む見込み）。記録カードに出す自動記録項目 */
  weekTotalMinutes: number;
  /** 記録後のストリーク日数。分かる場合だけ完了画面に出す */
  streakDays?: number;
  onRecord: (patch: Partial<StudyFinishDraft>) => Promise<void>;
  onDismiss: () => void;
}

type Step = 'confirm' | 'detail' | 'done';

const ACHIEVEMENTS: Achievement[] = ['low', 'mid', 'high'];

const stepperButton: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: `1px solid ${color.borderSoft}`,
  background: color.surface,
  color: color.textStrong,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: 14,
  fontSize: 14,
  lineHeight: 1.8,
  fontFamily: 'inherit',
  color: color.text,
  background: color.surface,
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical',
};

function Row({
  label,
  children,
  first,
}: {
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '10px 0',
        borderTop: first ? undefined : `1px solid ${color.divider}`,
      }}
    >
      <span style={{ ...font.label, color: color.textSubtle, flexShrink: 0 }}>{label}</span>
      <div style={{ minWidth: 0, textAlign: 'right' }}>{children}</div>
    </div>
  );
}

function Value({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{ ...font.rowTitle, color: muted ? color.textFaint : color.text }}>{children}</span>
  );
}

export function FinishSessionModal({
  draft,
  weekTotalMinutes,
  streakDays,
  onRecord,
  onDismiss,
}: FinishSessionModalProps) {
  const navigate = useNavigate();
  const measuredMinutes = Math.max(1, Math.round(draft.measuredSeconds / 60));

  const [step, setStep] = useState<Step>('confirm');
  const [minutes, setMinutes] = useState(draft.actualMinutes);
  const [editingMinutes, setEditingMinutes] = useState(false);
  const [contentNote, setContentNote] = useState(draft.contentNote);
  const [memo, setMemo] = useState(draft.memo);
  const [achievement, setAchievement] = useState<Achievement | null>(draft.achievement);
  const [saving, setSaving] = useState(false);

  const { snapshot } = draft;
  const maxMinutes = measuredMinutes + MAX_ADJUST_EXTRA_MINUTES;

  /*
   * 表示する内訳。minutes（ユーザーが修正できる値）に合わせて配分し直す。
   * 保存されるのも同じ比率（buildActivityInput が rescaleSegments を通す）。
   * displaySegments は分に丸めたうえで、合計が minutes と一致するよう端数を配り、
   * 1行しか残らないときは空を返す（学習時間と同じことを2回言わないため）。
   */
  const breakdown = displaySegments(snapshot.segments ?? [], minutes);

  const stepMinutes = (delta: number) =>
    setMinutes((v) => Math.min(maxMinutes, Math.max(1, v + delta)));

  const record = async (withDetail: boolean) => {
    if (saving) return;
    setSaving(true);
    await onRecord({
      actualMinutes: minutes,
      contentNote: withDetail ? contentNote : '',
      memo: withDetail ? memo : '',
      achievement: withDetail ? achievement : null,
    });
    setSaving(false);
    setStep('done');
  };

  const backdrop = (e: React.MouseEvent) => {
    // 完了画面まで来たら記録済みなので、背景クリックでそのまま閉じる
    if (e.target === e.currentTarget) onDismiss();
  };

  const title =
    step === 'done' ? '記録しました' : step === 'detail' ? '学習した内容を残す' : 'おつかれさまでした';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: font.family,
      }}
      onClick={backdrop}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: color.surface,
          borderRadius: radius.card,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
          }}
        >
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="閉じる"
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: color.pageBg,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" style={{ color: color.textMuted }} />
          </button>
        </div>

        <div style={{ padding: '14px 24px 24px' }}>
          {/* ---- 確認（自動記録された内容を見せる） ---- */}
          {step === 'confirm' && (
            <>
              <div
                style={{
                  background: color.pageBg,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: '6px 16px',
                }}
              >
                <Row label="学習日時" first>
                  <Value>{formatSessionRange(snapshot.startedAt, snapshot.endedAt)}</Value>
                </Row>

                <Row label="学習時間">
                  {editingMinutes ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => stepMinutes(-5)}
                        aria-label="5分減らす"
                        style={stepperButton}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={maxMinutes}
                        inputMode="numeric"
                        value={minutes}
                        onChange={(e) =>
                          setMinutes(
                            Math.min(maxMinutes, Math.max(1, Number(e.target.value) || 1))
                          )
                        }
                        style={{
                          width: 68,
                          textAlign: 'center',
                          border: `1px solid ${color.border}`,
                          borderRadius: radius.md,
                          padding: '8px 6px',
                          fontFamily: 'inherit',
                          fontSize: 15,
                          fontWeight: 700,
                          color: color.text,
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <span style={{ ...font.label, color: color.textSubtle }}>分</span>
                      <button
                        type="button"
                        onClick={() => stepMinutes(5)}
                        aria-label="5分増やす"
                        style={stepperButton}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Value>{formatMinutesHM(minutes)}</Value>
                      <button
                        type="button"
                        onClick={() => setEditingMinutes(true)}
                        style={{ ...t.chip, border: 'none', cursor: 'pointer' }}
                      >
                        修正
                      </button>
                    </div>
                  )}
                </Row>

                {/* カテゴリ別の内訳。合計は必ず上の「学習時間」と一致し、
                    時間を修正すると内訳も比例して動く。1行だけになるときは出さない。 */}
                {breakdown.length > 0 && (
                  <Row label="内訳">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      {breakdown.map((seg) => (
                        <div key={seg.category} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ ...font.caption, color: color.textMuted }}>
                            {STUDY_CATEGORY_LABEL[seg.category]}
                          </span>
                          <Value>{formatMinutesHM(seg.minutes)}</Value>
                        </div>
                      ))}
                    </div>
                  </Row>
                )}

                <Row label="学習した教材">
                  {snapshot.course ? (
                    <Value>
                      {snapshot.course.courseTitle}
                      {snapshot.course.lessonTitle ? ` ・ ${snapshot.course.lessonTitle}` : ''}
                    </Value>
                  ) : (
                    <Value muted>教材を指定しない</Value>
                  )}
                </Row>

                <Row label="今回の学習目標">
                  {draft.goalText ? <Value>{draft.goalText}</Value> : <Value muted>—</Value>}
                </Row>

                {snapshot.course?.progressPercentAtEnd !== undefined && (
                  <Row label="教材の進捗">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          display: 'block',
                          width: 96,
                          height: 6,
                          borderRadius: radius.pill,
                          background: color.trackBg,
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            width: `${snapshot.course.progressPercentAtEnd}%`,
                            height: '100%',
                            background: color.primary,
                            borderRadius: radius.pill,
                          }}
                        />
                      </span>
                      <Value>{snapshot.course.progressPercentAtEnd}%</Value>
                    </div>
                  </Row>
                )}

                <Row label="今週の累計学習時間">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Value>{formatMinutesHM(weekTotalMinutes)}</Value>
                    <span style={t.chip}>+{minutes}分</span>
                  </div>
                </Row>
              </div>

              {editingMinutes && (
                <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 0' }}>
                  自動計測は {measuredMinutes}分 でした。実際の学習時間に合わせて調整できます。
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setStep('detail')}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ ...t.ghostButton, flex: 1, cursor: 'pointer' }}
                >
                  内容を追加して記録
                </button>
                <button
                  type="button"
                  onClick={() => void record(false)}
                  disabled={saving}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    ...t.primaryButton,
                    flex: 1.25,
                    justifyContent: 'center',
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? '記録しています…' : 'そのまま記録'}
                </button>
              </div>
              <p
                style={{
                  ...font.caption,
                  color: color.textMuted,
                  margin: '10px 0 0',
                  textAlign: 'center',
                }}
              >
                閉じるとタイマーに戻ります（記録はされません）
              </p>
            </>
          )}

          {/* ---- 内容を追加 ---- */}
          {step === 'detail' && (
            <>
              <div
                style={{
                  ...t.chip,
                  display: 'inline-flex',
                  marginBottom: 16,
                }}
              >
                {formatMinutesHM(minutes)}
                {snapshot.course ? ` ・ ${snapshot.course.courseTitle}` : ' ・ 教材の指定なし'}
              </div>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ ...font.label, color: color.textSubtle }}>学習した内容（任意）</span>
                <textarea
                  rows={3}
                  value={contentNote}
                  onChange={(e) => setContentNote(e.target.value)}
                  placeholder="例）flexbox の主軸と交差軸を整理した"
                  style={{ ...textareaStyle, marginTop: 8 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ ...font.label, color: color.textSubtle }}>一言メモ（任意）</span>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="例）明日は Grid をやる"
                  style={{ ...textareaStyle, marginTop: 8, resize: 'none' }}
                />
              </label>

              <div style={{ marginBottom: 6 }}>
                <span style={{ ...font.label, color: color.textSubtle }}>達成度（任意）</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {ACHIEVEMENTS.map((v) => {
                    const active = achievement === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAchievement(active ? null : v)}
                        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          flex: 1,
                          borderRadius: radius.pill,
                          padding: '11px 0',
                          cursor: 'pointer',
                          border: `1px solid ${active ? color.primary : color.borderSoft}`,
                          background: active ? color.primary : color.surface,
                          color: active ? color.textOnPrimary : color.textStrong,
                          fontFamily: 'inherit',
                          ...font.buttonSm,
                        }}
                      >
                        {ACHIEVEMENT_LABEL[v]}
                      </button>
                    );
                  })}
                </div>
                <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 0' }}>
                  今日の自分の感じ方を記録するだけの項目です。
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ ...t.ghostButton, flex: 1, cursor: 'pointer' }}
                >
                  戻る
                </button>
                <button
                  type="button"
                  onClick={() => void record(true)}
                  disabled={saving}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    ...t.primaryButton,
                    flex: 1.25,
                    justifyContent: 'center',
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? '記録しています…' : '記録する'}
                </button>
              </div>
            </>
          )}

          {/* ---- 完了 ---- */}
          {step === 'done' && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <Check className="w-5 h-5" style={{ color: '#2F7F5B', flexShrink: 0, marginTop: 2 }} />
                <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.9 }}>
                  おつかれさまでした。学習記録に残しました。
                </p>
              </div>
              <div
                style={{
                  background: color.primaryTint,
                  border: `1px solid ${color.primaryBorder}`,
                  borderRadius: radius.md,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ ...font.bodyLarge, color: color.text }}>
                  今回 {formatMinutesHM(minutes)} ・ 今週の累計{' '}
                  {formatMinutesHM(weekTotalMinutes)}
                </span>
                {streakDays !== undefined && streakDays > 0 && (
                  <span style={{ ...font.meta, color: color.primary }}>
                    🔥 {streakDays}日連続で学習しています
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => {
                    onDismiss();
                    navigate('/study-log');
                  }}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ ...t.ghostButton, flex: 1, cursor: 'pointer' }}
                >
                  学習履歴を見る
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    ...t.primaryButton,
                    flex: 1,
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  閉じる
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FinishSessionModal;
