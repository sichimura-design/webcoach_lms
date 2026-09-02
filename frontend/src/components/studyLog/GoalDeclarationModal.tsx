import { useState } from 'react';
import { X } from 'lucide-react';
import { ACHIEVEMENT_LABEL, Achievement } from '../../types/studyActivity';
import {
  DECLARATION_REFLECTION_MAX,
  DECLARATION_TEXT_MAX,
  GOAL_DECLARATION_STATUS_LABEL,
  GoalDeclaration,
  GoalDeclarationInput,
  GoalDeclarationPatch,
  GoalDeclarationStatus,
} from '../../types/goalDeclaration';
import { toLocalDateKey } from '../../utils/studyStats';

/**
 * 目標宣言の作成・編集・振り返り。
 * ============================================================
 * 入力は「宣言文 / 対象期間 / 振り返り」の3ブロックだけなので、
 * SessionReview のようにページ全面を差し替えず、モーダルで開く
 * （全面にするとカレンダーごと消えて、何のための宣言だったかの文脈が飛ぶ）。
 *
 * 🔴 達成率・進捗%の入力を置かない。達成したかどうかは status の語彙、
 *    手応えは既存の Achievement（もう少し／できた／バッチリ）の3語で表す。
 *    学習効果を数値化した指標は出さない規約があるため、新しい尺度を作らない。
 * ============================================================
 */
type Mode = 'create' | 'edit' | 'review' | 'view';

interface GoalDeclarationModalProps {
  mode: Mode;
  declaration?: GoalDeclaration;
  saving: boolean;
  error: string | null;
  onSave: (value: Omit<GoalDeclarationInput, 'id'> | GoalDeclarationPatch) => Promise<void>;
  onDelete?: (declaration: GoalDeclaration) => void;
  onClose: () => void;
}

const STATUSES: GoalDeclarationStatus[] = ['active', 'achieved', 'missed', 'abandoned'];
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

/** 今日から n 日後のローカル日キー */
function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalDateKey(d);
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
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
      {label}
    </button>
  );
}

export function GoalDeclarationModal({
  mode,
  declaration,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: GoalDeclarationModalProps) {
  const [text, setText] = useState(declaration?.text ?? '');
  // 既定は「今日から2週間」。空欄から始めるより、直して使うほうが早い
  const [periodFrom, setPeriodFrom] = useState(declaration?.periodFrom ?? dayKey(0));
  const [periodTo, setPeriodTo] = useState(declaration?.periodTo ?? dayKey(13));
  const [status, setStatus] = useState<GoalDeclarationStatus>(declaration?.status ?? 'active');
  const [reflection, setReflection] = useState(declaration?.reflection ?? '');
  const [reflectionAchievement, setReflectionAchievement] = useState<Achievement | null>(
    declaration?.reflectionAchievement ?? null
  );

  const readOnly = mode === 'view';
  const title =
    mode === 'create' ? '目標を宣言する' : mode === 'review' ? '振り返りを書く' : mode === 'view' ? '目標宣言' : '目標宣言を編集する';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || readOnly) return;

    if (mode === 'create') {
      await onSave({ text, periodFrom, periodTo });
      return;
    }
    await onSave({
      text,
      periodFrom,
      periodTo,
      status,
      reflection: reflection.trim() || null,
      reflectionAchievement,
    });
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
        /* 🔴 noValidate。検証は utils/goalDeclaration.ts の validate* に一本化する
           （StudyRecordEditModal と同じ理由。ブラウザ標準の文言を混ぜない）。 */
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-decl-title"
        style={{
          width: '100%',
          maxWidth: 480,
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
            id="goal-decl-title"
            style={{ margin: 0, flex: 1, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            disabled={saving}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 26, height: 26, flex: 'none', borderRadius: 9999,
              border: '1px solid var(--dc-border)', background: 'var(--dc-surface)',
              color: 'var(--dc-text-muted)', display: 'grid', placeItems: 'center',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {mode === 'create' && (
          <p style={{ margin: '0 0 16px', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
            この期間に何をやり切るかを、自分の言葉で1文にしてください。期間が終わったら振り返りを書けます。
          </p>
        )}

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>目標</span>
          <textarea
            required
            readOnly={readOnly}
            value={text}
            maxLength={DECLARATION_TEXT_MAX}
            rows={2}
            placeholder="例）今月中にLPを1本、自分の手で完成させる"
            onChange={(e) => setText(e.target.value)}
            style={{ ...inputStyle, lineHeight: 'var(--dc-lh-prose)', resize: 'vertical' }}
          />
          <span className="dc-num" style={{ display: 'block', textAlign: 'right', marginTop: 4, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
            {text.length} / {DECLARATION_TEXT_MAX}
          </span>
        </label>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 140 }}>
            <span style={labelStyle}>いつから</span>
            <input
              type="date"
              required
              readOnly={readOnly}
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <span style={labelStyle}>いつまで</span>
            <input
              type="date"
              required
              readOnly={readOnly}
              value={periodTo}
              min={periodFrom}
              onChange={(e) => setPeriodTo(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        {/* 作成時は状態も振り返りも出さない。書く前から「達成した／やめた」を
            選ばせても意味がないので、編集・振り返りのときだけ出す */}
        {mode !== 'create' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>いまの状態</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUSES.map((s) => (
                  <Pill
                    key={s}
                    active={status === s}
                    label={GOAL_DECLARATION_STATUS_LABEL[s]}
                    onClick={() => !readOnly && setStatus(s)}
                  />
                ))}
              </div>
            </div>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={labelStyle}>振り返り（任意）</span>
              <textarea
                readOnly={readOnly}
                value={reflection}
                maxLength={DECLARATION_REFLECTION_MAX}
                rows={4}
                placeholder="やってみてどうだったか、次にどうするか"
                onChange={(e) => setReflection(e.target.value)}
                style={{ ...inputStyle, lineHeight: 'var(--dc-lh-prose)', resize: 'vertical' }}
              />
            </label>

            <div style={{ marginBottom: 18 }}>
              <span style={labelStyle}>手応え（任意）</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ACHIEVEMENTS.map((a) => (
                  <Pill
                    key={a}
                    active={reflectionAchievement === a}
                    label={ACHIEVEMENT_LABEL[a]}
                    // もう一度押すと解除
                    onClick={() => !readOnly && setReflectionAchievement(reflectionAchievement === a ? null : a)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <p
            role="alert"
            style={{
              margin: '0 0 14px', padding: '9px 12px',
              borderRadius: 'var(--dc-radius-md)',
              background: 'var(--dc-soft-100)', border: '1px solid var(--dc-soft-200)',
              fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-body)', lineHeight: 'var(--dc-lh-ui)',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', alignItems: 'center' }}>
          {mode !== 'create' && declaration && onDelete && !readOnly && (
            <button
              type="button"
              onClick={() => onDelete(declaration)}
              disabled={saving}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                marginRight: 'auto',
                background: 'none', border: 'none', padding: 0,
                fontFamily: 'inherit', fontSize: 'var(--dc-fs-caption)', fontWeight: 700,
                color: 'var(--dc-text-muted)', cursor: saving ? 'default' : 'pointer',
              }}
            >
              この宣言を削除
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              background: 'var(--dc-surface)', border: '1px solid var(--dc-border-strong)',
              borderRadius: 9, padding: '9px 16px',
              fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: 700,
              color: 'var(--dc-text-body)', cursor: saving ? 'default' : 'pointer',
            }}
          >
            {readOnly ? '閉じる' : 'やめる'}
          </button>

          {!readOnly && (
            <button
              type="submit"
              disabled={saving}
              className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                background: 'var(--dc-primary)', border: '1px solid var(--dc-primary)',
                borderRadius: 9, padding: '9px 18px',
                fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: 700,
                color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '保存中…' : mode === 'create' ? '宣言する' : '保存する'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default GoalDeclarationModal;
