import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
}

/**
 * 数値セル。
 * 🔴 flex:1 で等分する。以前は `flex: 0 0 auto` で右端に寄っていて、
 *    3つの数字が右に固まって見えるとレビューで指摘された。
 * 🔴 補足行（「全Nレッスン中」）は持たせない。セルごとに高さが変わって
 *    数字のベースラインが揃わなくなるため。
 */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, paddingLeft: 26 }}>
      <div style={{ ...font.label, color: color.textSubtle }}>{label}</div>
      <div
        style={{
          ...font.statValue,
          color: color.text,
          marginTop: 6,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 52,
        background: color.divider,
        marginLeft: 26,
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  );
}

export function ProfileSummaryStrip({
  name,
  stats,
  loading,
  completedLessons,
}: ProfileSummaryStripProps) {
  const navigate = useNavigate();
  const { avatarUrl, contentToken } = useAuth();

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 1 auto', minWidth: 0, paddingRight: 8 }}>
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
          {/*
            🔴 ここは以前 Lv.N のバッジだった。
               レベルの算出ロジックが決まっていない（何をすると上がるのか説明できない）ため
               レビューで廃止された。代わりに、この帯の数字の内訳が読める学習記録への導線を置く。
          */}
          <button
            type="button"
            onClick={() => navigate('/study-log')}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              marginTop: 6,
              ...font.chip,
              color: color.primary,
              background: color.primarySoft,
              border: 'none',
              borderRadius: radius.pill,
              padding: '5px 13px',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            学習記録を見る
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* どれだけ積み上げたか。3つに絞り、等幅で並べる */}
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
      <Cell label="修了レッスン数" value={`${completedLessons}`} />
    </section>
  );
}

export default ProfileSummaryStrip;
