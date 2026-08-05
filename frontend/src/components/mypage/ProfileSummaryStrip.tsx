import { useAuth } from '../../contexts/AuthContext';
import { useProgression } from '../../hooks/useProgression';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { withCfToken } from '../profile/AvatarPicker';

/**
 * マイページ最上部の薄い帯。誰が・どれだけ積み上げたかを1行で示す。
 *
 * 数字の置き場をここ1箇所に決めているのが要点。
 * 以前は「今週の学習時間カード」と「学習サマリー帯」に同じ数字が二重に出ていて、
 * 画面がごちゃついていた。詳しい内訳は /study-log に任せる。
 */
interface ProfileSummaryStripProps {
  /** 表示名（プロフィールのニックネーム） */
  name: string;
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 完了レッスン数（コースの進捗率からの推定値） */
  completedLessons: number;
  totalLessons: number;
}

function Cell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div style={{ flex: '0 0 auto', minWidth: 0, paddingLeft: 26 }}>
      <div style={{ ...font.label, color: color.textSubtle }}>{label}</div>
      <div
        style={{
          ...font.statValue,
          color: color.text,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ ...font.caption, color: color.textFaint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 56,
        background: color.divider,
        marginLeft: 26,
        flexShrink: 0,
      }}
    />
  );
}

export function ProfileSummaryStrip({
  name,
  stats,
  loading,
  completedLessons,
  totalLessons,
}: ProfileSummaryStripProps) {
  const { avatarUrl, contentToken } = useAuth();
  const { level } = useProgression();

  // AppHeader と同じ解決順。contextの生URLにはここで cf_token を付ける
  const resolvedAvatar = avatarUrl ? withCfToken(avatarUrl, contentToken) : undefined;
  const avatarSrc =
    resolvedAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=FFECEE&color=E0213A&size=128`;

  const dash = loading ? '…' : '—';

  return (
    <section
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '18px 26px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
      }}
    >
      {/* 誰か */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <img
          src={avatarSrc}
          alt=""
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            flexShrink: 0,
            background: color.primarySoft,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...font.bodyLarge,
              color: color.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name || 'ゲスト'}
          </div>
          <span
            style={{
              display: 'inline-block',
              marginTop: 5,
              ...font.chip,
              color: color.primary,
              background: color.primarySoft,
              borderRadius: radius.pill,
              padding: '4px 12px',
            }}
          >
            Lv.{level}
          </span>
        </div>
      </div>

      {/* どれだけ積み上げたか。3つに絞る */}
      <Divider />
      <Cell
        label="今週の学習時間"
        value={loading ? dash : formatMinutesHM(stats?.week.minutes ?? 0)}
      />
      <Divider />
      <Cell
        label="累計学習時間"
        value={loading ? dash : formatMinutesHM(stats?.allTime.minutes ?? 0)}
      />
      <Divider />
      <Cell
        label="修了レッスン数"
        value={`${completedLessons}`}
        sub={totalLessons > 0 ? `全${totalLessons}レッスン中` : undefined}
      />
    </section>
  );
}

export default ProfileSummaryStrip;
