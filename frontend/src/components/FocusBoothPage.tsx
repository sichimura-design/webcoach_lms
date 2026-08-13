import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useStudySession } from '../hooks/useStudySession';
import { useCourseChoices } from '../hooks/useCourseChoices';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { StudySessionMode } from '../types/studyRoom';
import { CourseChoice, defaultCourseChoice } from '../utils/courseSelection';
import { color, font, space, t } from '../theme/webcoachTheme';
import FocusTimerCard from './focus/FocusTimerCard';
import CurrentMaterialCard, { FocusMaterialView } from './focus/CurrentMaterialCard';
import StudyRankingCard from './focus/StudyRankingCard';
import MaterialPickerModal from './focus/MaterialPickerModal';
import EnvironmentSettingsPanel from './focus/EnvironmentSettingsPanel';
import { formatTodayLabel } from './focus/focusFormat';
import StudyRoomHeader from './studyRoom/StudyRoomHeader';

const DESIGN_WIDTH = 1440;

/**
 * 集中ブース（自習室タブの1つ目。学習記録 /study-log・ノート /notes と上部タブで並ぶ）。
 *   左  : タイマー（通常／ポモドーロ）＋今回の学習目標＋開始・一時停止・終了
 *   右上: 現在の学習教材
 *   右下: 学習時間ランキング（今週／今月）
 *
 * 以前は右カラムに統計カード・継続カレンダー・最近の学習記録も並べていたが、
 * 「いろいろ表示されすぎている ⇒ タイマーとランキングでいい」という指摘を受けて外した。
 * 数字の振り返りは自習室タブの「学習記録」に集約してある。
 *
 * レイアウトは MyPage.tsx と同じ「固定1440pxで組んで transform:scale で縮小する」方式
 * （index.css の .home-* 節のコメントに書かれている全画面共通の方針）。
 *
 * 🔴 モーダル・ドロワーは <main ref={innerRef}> の外に置くこと。
 *    transform:scale された要素は containing block を作るため、その内側の position:fixed は
 *    ビューポート基準にならず、縮小＋左上寄りにずれて表示される。
 *
 * 学習終了カードは App 直下の StudySessionFinishHost が描く（教材ページからも同じカードを
 * 出すため）。ここは prepareFinish() を呼ぶだけ。
 */
function FocusBoothPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const {
    session,
    elapsedSeconds,
    running,
    reachedTarget,
    stale,
    start,
    pause,
    resume,
    discard,
    updateGoal,
    prepareFinish,
  } = useStudySession(user?.userid);
  const { groups: courseGroups, loading: coursesLoading } = useCourseChoices(user?.userid);

  // 開始前の設定。開始したら session 側が正になる
  const [mode, setMode] = useState<StudySessionMode>('freeform');
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [goalText, setGoalText] = useState('');
  const [choice, setChoice] = useState<CourseChoice | null>(null);
  const [choiceTouched, setChoiceTouched] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);

  // 「前回の続き」を既定選択にしておく。未選択でも開始できるので入力は増やさない
  useEffect(() => {
    if (choiceTouched || choice || courseGroups.length === 0) return;
    setChoice(defaultCourseChoice(courseGroups));
  }, [courseGroups, choice, choiceTouched]);

  // 稼働中は session が唯一の真実。開始前は選択中の教材を見せる（二重管理しない）
  const material: FocusMaterialView | null = session
    ? session.courseId
      ? {
          courseId: session.courseId,
          courseTitle: session.courseTitle ?? '',
          lessonId: session.lessonId,
          lessonTitle: session.lessonTitle,
          progressPercent: session.progressPercentAtStart,
        }
      : null
    : choice
      ? {
          courseId: choice.courseId,
          courseTitle: choice.courseTitle,
          lessonId: choice.lessonId,
          lessonTitle: choice.lessonTitle ?? choice.subtitle,
          progressPercent: choice.progressPercent,
        }
      : null;

  const handleStart = () => {
    start({
      mode,
      // 🔴 通常タイマーでも targetMinutes を捨てない（「目安」として記録に残す）
      targetMinutes,
      courseId: choice?.courseId,
      courseTitle: choice?.courseTitle,
      lessonId: choice?.lessonId,
      lessonTitle: choice?.lessonTitle,
      progressPercentAtStart: choice?.progressPercent,
      goalText: goalText.trim() || undefined,
    });
  };

  const handleGoalChange = (v: string) => {
    setGoalText(v);
    if (session) updateGoal(v);
  };

  const handleSelectMaterial = (next: CourseChoice | null) => {
    setChoice(next);
    setChoiceTouched(true);
  };

  const openMaterial = () => {
    if (!material) return;
    const lesson = material.lessonId ? `?module=${material.lessonId}` : '';
    navigate(`/course/${material.courseId}${lesson}`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        <div
          ref={outerRef}
          style={{
            width: '100%',
            maxWidth: DESIGN_WIDTH,
            margin: '0 auto',
            position: 'relative',
            height: innerHeight ? innerHeight * scale : undefined,
          }}
        >
          <main
            ref={innerRef}
            className="focus-main flex flex-col"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_WIDTH,
              boxSizing: 'border-box',
              gap: space.sectionGap,
              fontFamily: font.family,
              color: color.text,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {/* ヘッダ: 自習室の共通タイトル＋タブ。日付と環境設定はこのページ固有 */}
            <StudyRoomHeader
              active="booth"
              eyebrow={formatTodayLabel(new Date())}
              right={
                <button
                  type="button"
                  onClick={() => setEnvOpen(true)}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ ...t.outlineButton, cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = color.hoverBgTint;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = color.surface;
                  }}
                >
                  <SlidersHorizontal size={15} />
                  環境設定
                </button>
              }
            />

            <div className="focus-2col">
              <FocusTimerCard
                session={session}
                elapsedSeconds={elapsedSeconds}
                running={running}
                reachedTarget={reachedTarget}
                stale={stale}
                onDiscard={discard}
                mode={mode}
                targetMinutes={targetMinutes}
                goalText={goalText}
                materialLabel={
                  material
                    ? material.lessonTitle
                      ? `${material.courseTitle} ・ ${material.lessonTitle}`
                      : material.courseTitle
                    : null
                }
                onModeChange={setMode}
                onTargetChange={setTargetMinutes}
                onGoalChange={handleGoalChange}
                onPickMaterial={() => setPickerOpen(true)}
                onStart={handleStart}
                onPause={pause}
                onResume={resume}
                onFinish={prepareFinish}
              />

              <div className="flex flex-col" style={{ gap: space.columnGap }}>
                <CurrentMaterialCard
                  material={material}
                  canChange={!session}
                  onOpen={openMaterial}
                  onChange={() => setPickerOpen(true)}
                />
                <StudyRankingCard userId={user?.userid} />
              </div>
            </div>
          </main>
        </div>
      </div>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>

      {/* 🔴 scale コンテナの外。ここに置かないと fixed が縮小されて位置がずれる */}
      {pickerOpen && (
        <MaterialPickerModal
          groups={courseGroups}
          loading={coursesLoading}
          selectedCourseId={material?.courseId ?? null}
          onSelect={handleSelectMaterial}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {envOpen && <EnvironmentSettingsPanel onClose={() => setEnvOpen(false)} />}
    </div>
  );
}

export default FocusBoothPage;
