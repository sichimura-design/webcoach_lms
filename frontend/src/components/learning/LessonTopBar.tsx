import { Menu, PanelRight, Check } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { LEARNING_HIERARCHY } from '../../constants/learningTaxonomy';
import { LearningBreadcrumb } from '../shared';
import LessonMiniTimer from './LessonMiniTimer';

/**
 * レッスンページ専用のトップバー。
 * AppHeader（左レール）とは別に、この画面だけの操作を1行にまとめる。
 *   ≡ コースの目次 ／ パンくず ／ ミニタイマー ／ 進捗 ／ AI・メモ ／ 完了して次へ
 *
 * パンくずは「コース ＞ 単元 ＞ レッスン」の3階層だけ出す。学習領域は一覧側でしか
 * 使わず、本文内の見出しは階層ではないのでここには含めない（要件の階層定義に合わせる）。
 */
interface LessonTopBarProps {
  courseName: string;
  unitName: string;
  lessonTitle: string;
  progressPercent: number;
  doneCount: number;
  totalCount: number;
  navOpen: boolean;
  supportOpen: boolean;
  isCompleted: boolean;
  completing: boolean;
  /** ミニタイマーが「この教材で開始する」ために必要な識別子 */
  courseId?: number;
  lessonId?: number | null;
  onToggleNav: () => void;
  onToggleSupport: () => void;
  onComplete: () => void;
  onBackToCourse: () => void;
}

const iconButton: React.CSSProperties = {
  flex: '0 0 auto',
  width: 38,
  height: 38,
  display: 'grid',
  placeItems: 'center',
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.nav,
  background: color.surface,
  color: color.iconMuted,
  cursor: 'pointer',
};

export function LessonTopBar({
  courseName,
  unitName,
  lessonTitle,
  progressPercent,
  doneCount,
  totalCount,
  navOpen,
  supportOpen,
  isCompleted,
  completing,
  courseId,
  lessonId,
  onToggleNav,
  onToggleSupport,
  onComplete,
  onBackToCourse,
}: LessonTopBarProps) {
  return (
    <header
      className="flex items-center"
      style={{
        gap: 14,
        padding: '0 16px',
        background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <button
        type="button"
        onClick={onToggleNav}
        aria-label={navOpen ? 'コースの目次を閉じる' : 'コースの目次を開く'}
        aria-expanded={navOpen}
        title="コースの目次（単元・レッスン）"
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ ...iconButton, ...(navOpen ? { background: color.primaryTint, color: color.primary } : null) }}
      >
        <Menu size={18} />
      </button>

      {/* パンくずは長いレッスン名で伸びるので、必ず省略記号で切る
          （切らないとトップバーが横に押し広がり、右のボタンがはみ出す） */}
      <div className="min-w-0 hidden md:block">
        <LearningBreadcrumb
          items={[
            { label: courseName || LEARNING_HIERARCHY.course, onClick: onBackToCourse },
            { label: unitName },
            { label: lessonTitle },
          ]}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* ミニタイマー。SPは下部ナビ64px＋トップバー56pxで余白が無いので sm 以上で出す。
          このページでは FloatingStudyTimer を隠しているので、ここが唯一のタイマー表示になる。 */}
      <div className="hidden sm:flex items-center">
        <LessonMiniTimer
          courseId={courseId}
          courseName={courseName}
          lessonId={lessonId}
          lessonTitle={lessonTitle}
          progressPercent={progressPercent}
        />
      </div>

      <div className="hidden lg:flex items-center" style={{ gap: 10 }}>
        <span style={{ ...font.caption, color: color.textSubtle }}>
          {doneCount} / {totalCount} レッスン
        </span>
        <div style={{ width: 108, height: 7, borderRadius: 999, background: color.trackBg, overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: 999, background: color.primary }} />
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleSupport}
        aria-expanded={supportOpen}
        title="学習サポート（AI・メモ）の表示切替"
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 38,
          padding: '0 13px',
          border: `1px solid ${supportOpen ? color.primaryBorder : color.borderStrong}`,
          borderRadius: radius.nav,
          background: supportOpen ? color.primaryTint : color.surface,
          color: supportOpen ? color.primary : color.textStrong,
          ...font.buttonSm,
          cursor: 'pointer',
        }}
      >
        <PanelRight size={15} />
        <span className="hidden sm:inline">AI・メモ</span>
      </button>

      <button
        type="button"
        onClick={onComplete}
        disabled={completing}
        className="disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 38,
          padding: '0 15px',
          border: 'none',
          borderRadius: radius.nav,
          background: isCompleted ? color.hoverBg : color.primary,
          color: isCompleted ? color.textMuted : color.textOnPrimary,
          ...font.buttonSm,
          cursor: completing ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {isCompleted ? <Check size={15} /> : null}
        <span className="hidden sm:inline">
          {completing ? '送信中…' : isCompleted ? '完了済み・次へ' : '完了して次へ'}
        </span>
        <span className="sm:hidden">{isCompleted ? '次へ' : '完了'}</span>
      </button>
    </header>
  );
}

export default LessonTopBar;
