import { BookOpen } from 'lucide-react';
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';

/**
 * 集中ブース右上「現在の学習教材」。
 * 教材名・レッスン名・進捗と、「教材を開く」「変更する」。
 */
export interface FocusMaterialView {
  courseId: number;
  courseTitle: string;
  lessonId?: number;
  lessonTitle?: string;
  progressPercent?: number;
}

interface CurrentMaterialCardProps {
  material: FocusMaterialView | null;
  /**
   * 教材を変更できるか。タイマー稼働中は false にする。
   * 走っている記録の教材を途中で差し替えられると、記録された学習時間と教材の対応が
   * 実際と合わなくなるため（変えたいときは終了して記録してから開始し直す）。
   */
  canChange: boolean;
  onOpen: () => void;
  onChange: () => void;
}

// t.primaryButton / t.ghostButton は padding が大きいので、2分割で並べる用に上書きする
const smallPrimary: React.CSSProperties = {
  ...t.primaryButton,
  padding: '11px 18px',
  fontSize: 13.5,
  justifyContent: 'center',
  flex: 1,
  cursor: 'pointer',
};

const smallGhost: React.CSSProperties = {
  ...t.ghostButton,
  padding: '11px 18px',
  fontSize: 13.5,
  width: 'auto',
  justifyContent: 'center',
  flex: 1,
  cursor: 'pointer',
};

export function CurrentMaterialCard({
  material,
  canChange,
  onOpen,
  onChange,
}: CurrentMaterialCardProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '20px 22px 18px',
        gap: 14,
      }}
    >
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>現在の学習教材</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            background: material ? color.primarySoft : 'transparent',
            border: material ? 'none' : `1px dashed ${color.primaryDashed}`,
          }}
        >
          <BookOpen size={18} style={{ color: material ? color.primary : color.primaryDashed }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...font.bodyLarge,
              color: material ? color.text : color.textFaint,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {material?.courseTitle ?? '教材を指定していません'}
          </div>
          <div
            style={{
              ...font.caption,
              color: color.textSubtle,
              marginTop: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {material?.lessonTitle ?? '教材を選ぶと、学習記録に紐づけられます'}
          </div>
        </div>
      </div>

      {material?.progressPercent !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: radius.pill,
              background: color.trackBg,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${material.progressPercent}%`,
                height: '100%',
                background: color.primary,
                borderRadius: radius.pill,
                transition: 'width 400ms ease',
              }}
            />
          </div>
          <span style={{ ...font.link, color: color.primary }}>{material.progressPercent}%</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {material ? (
          <>
            <button
              type="button"
              onClick={onOpen}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={smallPrimary}
            >
              教材を開く
            </button>
            {canChange && (
              <button
                type="button"
                onClick={onChange}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={smallGhost}
              >
                変更する
              </button>
            )}
          </>
        ) : canChange ? (
          <button
            type="button"
            onClick={onChange}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={smallPrimary}
          >
            教材を選ぶ
          </button>
        ) : (
          <span style={{ ...font.caption, color: color.textSubtle, lineHeight: 1.9 }}>
            このセッションは教材を指定せずに始めました
          </span>
        )}
      </div>
    </div>
  );
}

export default CurrentMaterialCard;
