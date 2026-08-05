import { useState } from 'react';
import { X } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { CourseChoice, CourseChoiceGroupView } from '../../utils/courseSelection';

/**
 * 今回学習する教材を選ぶ。
 * coaching/MeetingLinkModal.tsx の overlay とラジオカードの作法を踏襲する。
 *
 * 「教材を指定しない」は常に最後に置く（要件の4分類の1つ）。
 */
interface MaterialPickerModalProps {
  groups: CourseChoiceGroupView[];
  loading: boolean;
  /** いま選ばれている教材のコースID。指定なしは null */
  selectedCourseId: number | null;
  onSelect: (choice: CourseChoice | null) => void;
  onClose: () => void;
}

const NONE_KEY = 'none';

export function MaterialPickerModal({
  groups,
  loading,
  selectedCourseId,
  onSelect,
  onClose,
}: MaterialPickerModalProps) {
  const [picked, setPicked] = useState<string>(
    selectedCourseId === null ? NONE_KEY : String(selectedCourseId)
  );

  const flat = groups.flatMap((g) => g.items);
  const pickedChoice = picked === NONE_KEY ? null : flat.find((c) => String(c.courseId) === picked);
  // 「指定しない」は常に選べる。教材が1件も無いときもここから開始できる
  const canConfirm = picked === NONE_KEY || !!pickedChoice;

  const backdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: `1px solid ${active ? color.primaryBorder : color.border}`,
    background: active ? color.primaryTint : color.surface,
    borderRadius: radius.md,
    cursor: 'pointer',
    marginBottom: 8,
  });

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
          maxHeight: '86vh',
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
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>
            今回学習する教材
          </h2>
          <button
            type="button"
            onClick={onClose}
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
          {loading && (
            <p style={{ ...font.meta, color: color.textSubtle, margin: '0 0 12px' }}>
              教材を読み込んでいます…
            </p>
          )}

          {groups.map((group) => (
            <div key={group.group}>
              <div style={{ ...font.caption, color: color.textSubtle, margin: '16px 0 8px' }}>
                {group.label}
              </div>
              {group.items.map((c) => {
                const key = String(c.courseId);
                const active = picked === key;
                return (
                  <label key={key} style={rowStyle(active)}>
                    <input
                      type="radio"
                      name="focus-material"
                      value={key}
                      checked={active}
                      onChange={() => setPicked(key)}
                      style={{ accentColor: color.primary, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          ...font.rowTitle,
                          color: color.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.courseTitle}
                      </span>
                      {c.subtitle && (
                        <span
                          style={{
                            display: 'block',
                            ...font.caption,
                            color: color.textSubtle,
                            marginTop: 3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.subtitle}
                        </span>
                      )}
                    </span>
                    {c.progressPercent !== undefined && (
                      <>
                        <span
                          style={{
                            display: 'block',
                            width: 72,
                            height: 6,
                            borderRadius: radius.pill,
                            background: color.trackBg,
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: `${c.progressPercent}%`,
                              height: '100%',
                              background: color.primary,
                              borderRadius: radius.pill,
                            }}
                          />
                        </span>
                        <span style={{ ...font.link, color: color.primary, flexShrink: 0 }}>
                          {c.progressPercent}%
                        </span>
                      </>
                    )}
                  </label>
                );
              })}
            </div>
          ))}

          {/* 4分類の最後。進捗バーは無い */}
          <div style={{ ...font.caption, color: color.textSubtle, margin: '16px 0 8px' }}>
            教材を使わずに集中する
          </div>
          <label style={rowStyle(picked === NONE_KEY)}>
            <input
              type="radio"
              name="focus-material"
              value={NONE_KEY}
              checked={picked === NONE_KEY}
              onChange={() => setPicked(NONE_KEY)}
              style={{ accentColor: color.primary, flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', ...font.rowTitle, color: color.text }}>
                教材を指定しない
              </span>
              <span
                style={{
                  display: 'block',
                  ...font.caption,
                  color: color.textSubtle,
                  marginTop: 3,
                }}
              >
                記録に教材は紐づきません
              </span>
            </span>
          </label>

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                onSelect(pickedChoice ?? null);
                onClose();
              }}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                ...t.primaryButton,
                width: '100%',
                justifyContent: 'center',
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                opacity: canConfirm ? 1 : 0.5,
              }}
            >
              この教材で学習する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaterialPickerModal;
