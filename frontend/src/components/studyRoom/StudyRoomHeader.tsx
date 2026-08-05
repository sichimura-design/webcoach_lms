import { useNavigate } from 'react-router-dom';
import { BarChart3, Headphones, NotebookPen } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';

/**
 * 「自習室」の共通ヘッダ（タイトル＋タブ）。
 *
 * 集中ブース（/focus-booth）・学習記録（/study-log）・ノート（/notes）は
 * 「自分の学習をする／振り返る場所」という同じ性格なので、サイドバーでは
 * 自習室という1項目にまとめ、この3面はここのタブで行き来する。
 * ページ自体は分けたまま（URLは従来どおり）で、上部の見た目だけを共通化している。
 *
 * right には各ページ固有の操作（環境設定・期間切替など）を渡す。
 */

export type StudyRoomTab = 'booth' | 'log' | 'notes';

const TABS: { key: StudyRoomTab; label: string; path: string; icon: typeof Headphones }[] = [
  { key: 'booth', label: '集中ブース', path: '/focus-booth', icon: Headphones },
  { key: 'log', label: '学習記録', path: '/study-log', icon: BarChart3 },
  { key: 'notes', label: 'ノート', path: '/notes', icon: NotebookPen },
];

interface StudyRoomHeaderProps {
  active: StudyRoomTab;
  /** タイトルの上に出す小さな行（集中ブースの日付など） */
  eyebrow?: React.ReactNode;
  /** タイトル行の右端に出すページ固有の操作 */
  right?: React.ReactNode;
}

function StudyRoomHeader({ active, eyebrow, right }: StudyRoomHeaderProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          {eyebrow && (
            <div style={{ fontSize: 13, fontWeight: 500, color: color.textSubtle, letterSpacing: '.2px' }}>
              {eyebrow}
            </div>
          )}
          <div style={{ ...font.pageTitle, color: color.text, marginTop: eyebrow ? 10 : 0 }}>自習室</div>
        </div>
        {right && <div style={{ paddingBottom: 4 }}>{right}</div>}
      </div>

      {/* タブ。アクティブの下線が、以前タイトル下にあった赤いラインの役割も兼ねる */}
      <div
        role="tablist"
        aria-label="自習室"
        style={{
          display: 'flex',
          gap: 4,
          marginTop: 12,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => { if (!isActive) navigate(tab.path); }}
              className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 7,
                appearance: 'none',
                background: 'transparent',
                border: 0,
                borderBottom: `3px solid ${isActive ? color.primary : 'transparent'}`,
                marginBottom: -1,
                padding: '0 16px 10px',
                fontFamily: 'inherit',
                ...font.buttonSm,
                fontWeight: isActive ? 900 : 500,
                color: isActive ? color.primary : color.textMuted,
                cursor: isActive ? 'default' : 'pointer',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StudyRoomHeader;
