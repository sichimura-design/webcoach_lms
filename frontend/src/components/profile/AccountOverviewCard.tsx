import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, KeyRound, LogOut, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { resolveAvatarUrl } from './AvatarPicker';

/**
 * アカウント設定の入口。
 *
 * 「アカウント設定を変えるとどうなるのかよくわからない」「設定画面にいくと
 * 今の設定状況が一覧で出ていて、そこから各操作に入れる画面を挟んだほうがいい」
 * というレビュー指摘への対応。
 *
 * いきなり入力フォームを出すのをやめ、まず
 *   ・いまどうなっているか（名前・メール・アイコン）
 *   ・そこから何ができるか（アイコン変更・学習記録・パスワード変更・ログアウト）
 * を見せる。フォーム自体はこのカードの下にそのまま残す。
 *
 * ログアウトはここにしか無い（CONSISTENCY-007: 現行画面にログアウト導線が存在しなかった）。
 */
interface AccountOverviewCardProps {
  /** 「パスワードを変える」を押したときに下のフォームへ送る */
  onFocusPassword: () => void;
}

function Row({
  icon,
  label,
  value,
  action,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  action: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '15px 16px',
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.surface,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        className="grid place-items-center flex-shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: danger ? color.pageBg : color.primarySoft,
          color: danger ? color.textMuted : color.primary,
        }}
      >
        {icon}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...font.rowTitle, color: danger ? color.textBody : color.text }}>
          {label}
        </span>
        {value && (
          <span
            style={{
              display: 'block',
              ...font.caption,
              color: color.textMuted,
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        )}
      </span>

      <span style={{ ...font.link, color: danger ? color.textMuted : color.primary, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {action}
      </span>
      <ChevronRight size={15} style={{ color: color.textFaint, flexShrink: 0 }} />
    </button>
  );
}

export function AccountOverviewCard({ onFocusPassword }: AccountOverviewCardProps) {
  const navigate = useNavigate();
  const { user, nickName, avatarUrl, logout } = useAuth();

  const displayName = nickName || user?.username || 'ユーザー';
  // 未設定でもプレースホルダのURLが返るので、img は常に描ける
  const avatar = resolveAvatarUrl(avatarUrl, displayName);

  return (
    <section style={{ ...t.card, padding: 24, marginBottom: 20 }}>
      {/* いまの状態。何を変えられるかの前に、何がそうなっているかを見せる */}
      <div className="flex items-center" style={{ gap: 16, marginBottom: 20 }}>
        <img
          src={avatar}
          alt=""
          style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...font.userName, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div className="flex items-center" style={{ gap: 6, ...font.caption, color: color.textMuted, marginTop: 5 }}>
            <Mail size={13} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || 'メールアドレス未設定'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        <Row
          icon={<UserRound size={17} />}
          label="プロフィールとアイコン"
          value="ニックネーム・アイコン・これからの目標"
          action="変更する"
          onClick={() => navigate('/profile')}
        />
        <Row
          icon={<BarChart3 size={17} />}
          label="学習記録"
          value="学習時間・連続日数・これまでの履歴"
          action="見る"
          onClick={() => navigate('/study-log')}
        />
        <Row
          icon={<KeyRound size={17} />}
          label="メールアドレスとパスワード"
          value="ログインに使う情報。変更すると次回から新しい情報でログインします"
          action="変更する"
          onClick={onFocusPassword}
        />
        <Row
          icon={<LogOut size={17} />}
          label="ログアウト"
          value="この端末からサインアウトします。学習記録は残ります"
          action="実行"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          danger
        />
      </div>
    </section>
  );
}

export default AccountOverviewCard;
