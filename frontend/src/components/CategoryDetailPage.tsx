import React from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Sparkles,
  BookOpen,
  Clock,
  Loader2,
  Pencil,
  BookText,
  PlusCircle,
} from 'lucide-react';
import { AppFooter, AppHeader, CourseImage, LearningBreadcrumb } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { bffClient } from '../services/bffClient';
import { useAiCoachStore } from '../store/aiCoachStore';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';

// 学習領域のテーマカラーパレット
const categoryColorPalette = [
  { color: '#FF5A7A', iconLightColor: '#FFEDEE' },
  { color: '#F0AF23', iconLightColor: '#FFFAEA' },
  { color: '#FFC24B', iconLightColor: '#FFF4EF' },
  { color: '#A688D4', iconLightColor: '#F7F2FF' },
  { color: '#E6819D', iconLightColor: '#FFF1F5' },
  { color: '#5B9BD5', iconLightColor: '#EBF3FB' },
  { color: '#6BBF8A', iconLightColor: '#EEF8F1' },
];

// --- Types ---

interface MoodleTag {
  id: number;
  name: string;
  rawname: string;
  isstandard?: boolean;
  [key: string]: any;
}

interface MoodleCourse {
  id: number | string;
  fullname?: string;
  shortname?: string;
  summary?: string;
  courseimage?: string;
  tags?: MoodleTag[];
  customfields?: Array<{ shortname: string; value: string; name?: string }>;
  overviewfiles?: Array<{ fileurl?: string; [key: string]: any }>;
  [key: string]: any;
}

interface CourseSection {
  tagName: string;
  isFeatured: boolean;
  courses: MoodleCourse[];
}

// --- Helpers ---

function getCustomField(course: MoodleCourse, shortname: string): string {
  if (!course.customfields) return '';
  const f = course.customfields.find((cf) => cf.shortname === shortname);
  return f?.value || '';
}

/** tagsフィールドからタグ名の配列を返す（文字列配列・オブジェクト配列どちらも対応） */
function extractTagNames(tags: any): string[] {
  if (!tags) return [];
  const items: any[] = Array.isArray(tags)
    ? tags
    : typeof tags === 'object'
    ? Object.values(tags)
    : [];
  return items
    .filter(Boolean)
    .map((t) => (typeof t === 'string' ? t : t.rawname || t.name || ''))
    .filter((name) => name !== '');
}

/** コースをMoodleタグ名でグループ化。タグは階層ではなく学習領域内の切り口。 */
function groupByTag(courses: MoodleCourse[]): CourseSection[] {
  const grouped = new Map<string, MoodleCourse[]>();

  courses.forEach((course) => {
    const tagNames = extractTagNames(course.tags);
    if (tagNames.length > 0) {
      tagNames.forEach((key) => {
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(course);
      });
    } else {
      const key = 'その他';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(course);
    }
  });

  return Array.from(grouped.entries()).map(([tagName, sectionCourses]) => ({
    tagName,
    isFeatured: false,
    courses: sectionCourses,
  }));
}

/** 難易度バッジのスタイル (Figma実測値) */
function getDifficultyStyle(difficulty: string): { bg: string; text: string } {
  switch (difficulty) {
    case '応用': return { bg: '#FFC24B', text: '#ffffff' };
    case '発展': return { bg: '#FF5A7A', text: '#ffffff' };
    case '基礎':
    default:
      return { bg: '#ffd454', text: '#7A7392' };
  }
}

/** コースまとまり（Moodleタグ）のアイコン（タグ名から推定） */
function getSectionIcon(tagName: string): React.ReactNode {
  const s = tagName.toLowerCase();
  if (s.includes('ai') || s.includes('生成')) {
    return <Sparkles className="w-5 h-5" style={{ color: '#A688D4' }} />;
  }
  if (s.includes('基本') || s.includes('知識') || s.includes('ツール')) {
    return <BookOpen className="w-5 h-5" style={{ color: '#5B9BD5' }} />;
  }
  if (s.includes('実践') || s.includes('課題') || s.includes('テスト') || s.includes('quest')) {
    return <Pencil className="w-5 h-5 text-brand" />;
  }
  if (s.includes('tips') || s.includes('短編') || s.includes('コラム')) {
    return <BookText className="w-5 h-5" style={{ color: '#6BBF8A' }} />;
  }
  return <BookOpen className="w-5 h-5 text-brand-muted" />;
}

// --- Main Component ---

function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  // 右サイドバーからAIコーチのドロワーを開く（本体は AppHeader 配下の GlobalAiCoachDrawer）
  const openDrawer = useAiCoachStore((s) => s.openDrawer);

  const catIdNum = Number(categoryId);
  const paletteIndex = (catIdNum - 1) % categoryColorPalette.length;
  const palette = categoryColorPalette[Math.abs(paletteIndex)] || categoryColorPalette[0];

  const { data, loading, error } = useAsyncData(
    () => Promise.all([
      bffClient.getCourseByField('category', String(catIdNum)),
      bffClient.getCategories().catch(() => []),
    ]).then(([courseData, allCategories]) => {
      const moodleCat = Array.isArray(allCategories)
        ? allCategories.find((c: any) => Number(c.id) === catIdNum)
        : null;
      const flat: MoodleCourse[] = courseData?.courses
        ? courseData.courses
        : Array.isArray(courseData)
        ? courseData
        : [];
      return {
        sections: groupByTag(flat),
        categoryName: moodleCat?.name || '',
        categoryDescription: moodleCat?.description || '',
        categoryImage: moodleCat?.categoryimage || '',
      };
    }),
    [catIdNum],
  );
  const sections: CourseSection[] = data?.sections ?? [];
  const categoryName: string = data?.categoryName ?? '';
  const categoryDescription: string = data?.categoryDescription ?? '';
  const categoryImage: string = data?.categoryImage ?? '';

  const handleCourseClick = (course: MoodleCourse) => {
    const courseId = Number(course.id);

    // Optimistic UI: 即座に遷移し、バックグラウンドで受講登録を処理
    navigate(`/course/${courseId}/curriculum`);

    bffClient.enrollCourse(courseId)
      .then(() => {
        showToast('受講登録しました！', 'success');
      })
      .catch((err: any) => {
        // 409 = すでに受講登録済み（正常ケース）は無視
        if (err.response?.status !== 409) {
          showToast('受講登録に失敗しました。再度お試しください。', 'error');
        }
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <AppHeader userName={user?.username || 'User'} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <AppHeader userName={user?.username || 'User'} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <BookOpen className="w-12 h-12 text-brand-subtle" />
          <p className="text-sm text-brand-muted">
            {error}
          </p>
        </div>
      </div>
    );
  }

  const totalCourses = sections.reduce((n, s) => n + s.courses.length, 0);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        {/* 背景装飾 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
          <div className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
          <div className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '30%', filter: 'blur(40px)' }} />
        </div>

        {/* 学習領域ヘッダーバー */}
        <div
          className="relative border-b py-6 sm:py-8 lg:py-[40px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderColor: '#FEFAF8' }}
        >
          <div className="wc-page flex flex-col" style={{ '--wc-page-max': '1100px', '--wc-page-top': '0px', '--wc-page-bottom': '0px', gap: '24px' } as React.CSSProperties}>
            {/* パンくず（常に表示）。学習領域はコース一覧の大分類にあたる階層。 */}
            <LearningBreadcrumb
              items={[
                { label: '学習する', to: '/courses' },
                { label: categoryName || LEARNING_HIERARCHY.area },
              ]}
            />

            {/* 学習領域情報 */}
            <div className="flex items-center" style={{ gap: '24px' }}>
              <div className="flex-shrink-0">
                <div
                  className="w-14 h-14 sm:w-[79px] sm:h-[79px] flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: palette.color, borderRadius: '24px' }}
                >
                  {categoryImage ? (
                    <img
                      src={categoryImage}
                      alt={categoryName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="w-8 h-8" style={{ color: palette.iconLightColor }} />
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center" style={{ gap: '16px' }}>
                <div className="flex flex-col" style={{ gap: '4px' }}>
                  <span
                    className="inline-block self-start px-2.5 py-0.5 text-xs font-bold"
                    style={{ fontSize: '12px', color: palette.color, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}
                  >
                    {LEARNING_HIERARCHY.area}
                  </span>
                  <h1
                    className="font-bold text-brand-text text-2xl sm:text-3xl lg:text-[32px]"
                    style={{ lineHeight: '1.2' }}
                  >
                    {categoryName || LEARNING_HIERARCHY.area}
                  </h1>
                </div>
                {categoryDescription && (
                  <p
                    className="text-brand-muted"
                    style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 400 }}
                  >
                    {categoryDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div
          className="wc-page relative"
          style={{ '--wc-page-max': '1100px', '--wc-page-top': '40px', '--wc-page-bottom': '40px' } as React.CSSProperties}
        >
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-10">

            {/* 左カラム: タグ別のコース一覧 */}
            <div className="flex-1 min-w-0 flex flex-col gap-6 sm:gap-8 lg:gap-10">
              {totalCourses === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <BookOpen className="w-12 h-12 text-brand-subtle" />
                  <p className="text-sm text-brand-muted">
                    この学習領域にはまだコースがありません
                  </p>
                </div>
              ) : (
                <>
                  {/* タグフィルタータブ (複数タグがある場合のみ表示) */}
                  {sections.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTag(null)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                        style={
                          selectedTag === null
                            ? { backgroundColor: palette.color, color: '#fff' }
                            : { backgroundColor: '#fff', color: '#7A7392', border: '1px solid #C2B9B3' }
                        }
                      >
                        すべて
                      </button>
                      {sections.map((section) => (
                        <button
                          key={section.tagName}
                          onClick={() => setSelectedTag(section.tagName)}
                          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                          style={
                            selectedTag === section.tagName
                              ? { backgroundColor: palette.color, color: '#fff' }
                              : { backgroundColor: '#fff', color: '#7A7392', border: '1px solid #C2B9B3' }
                          }
                        >
                          {section.tagName}
                        </button>
                      ))}
                    </div>
                  )}

                  {sections
                    .filter((s) => selectedTag === null || s.tagName === selectedTag)
                    .map((section, idx) => (
                      <CourseSectionBlock
                        key={section.tagName + idx}
                        section={section}
                        onCourseClick={handleCourseClick}
                      />
                    ))}
                </>
              )}
            </div>

            {/* 右サイドバー */}
            <div className="w-full lg:w-[340px] flex-shrink-0">
              <AiCoachSidebar categoryName={categoryName} onOpen={openDrawer} />
            </div>
          </div>
        </div>
      </div>

      <AppFooter style={{ padding: '32px 0 24px' }} />

    </div>
  );
}

// --- Course Section Block ---

function CourseSectionBlock({
  section,
  onCourseClick,
}: {
  section: CourseSection;
  onCourseClick: (course: MoodleCourse) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: '24px' }}>
      <div
        className="flex items-center justify-between"
        style={{ borderBottom: '1px solid #c2b9b3', paddingBottom: '12px' }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          {getSectionIcon(section.tagName)}
          <h2
            className="font-bold text-brand-muted"
            style={{ fontSize: '18px', lineHeight: '28px' }}
          >
            {section.tagName}
          </h2>
        </div>
        <button
          className="flex items-center gap-1 bg-white border border-brand-border rounded-full text-brand-muted hover:bg-gray-50 transition-colors"
          style={{ fontSize: '12px', fontWeight: 500, padding: '4px 12px' }}
        >
          <span>すべて見る</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '20px' }}>
        {section.courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onClick={() => onCourseClick(course)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Course Card (縦型) ---

function CourseCard({
  course,
  onClick,
}: {
  course: MoodleCourse;
  onClick: () => void;
}) {
  const courseName = course.fullname || course.name || '';
  const difficulty = course.difficulty || getCustomField(course, 'difficulty') || '';
  const duration = course.duration || getCustomField(course, 'duration') || '';
  const diffStyle = getDifficultyStyle(difficulty);

  return (
    <div
      className="bg-white cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex flex-col"
      style={{ borderRadius: '16px', border: '1px solid #F0EAE6' }}
      onClick={onClick}
    >
      {/* 上部: 画像エリア */}
      <div
        className="relative flex-shrink-0 w-full"
        style={{ height: '126px' }}
      >
        <CourseImage
          imageUrl={course.courseimage}
          alt={courseName}
          fallbackText={courseName}
          className="w-full h-full"
          style={{ height: '126px' }}
        />

        {/* 難易度バッジ（右上） */}
        {difficulty && (
          <span
            className="absolute top-2 right-2 text-[11px] font-bold px-2.5 py-1"
            style={{
              backgroundColor: diffStyle.bg,
              color: diffStyle.text,
              borderRadius: '9999px',
              lineHeight: 1,
            }}
          >
            {difficulty}
          </span>
        )}

      </div>

      {/* 下部: テキストエリア */}
      <div className="flex flex-col flex-1" style={{ padding: '19px 16px 16px', gap: '8px' }}>
        {/* コースタイトル */}
        <h3
          className="font-bold text-brand-text line-clamp-2 flex-1"
          style={{ fontSize: '14px', lineHeight: '20px' }}
        >
          {courseName}
        </h3>

        {/* 所要時間 + アクションアイコン */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '4px' }}>
            <Clock className="w-3.5 h-3.5 text-brand-muted" />
            <span
              className="text-brand-muted"
              style={{ fontSize: '12px', fontWeight: 400 }}
            >
              {duration || '--'}
            </span>
          </div>
          <PlusCircle className="w-4 h-4 text-brand" />
        </div>
      </div>
    </div>
  );
}

// --- AIコーチへの導線 ---
// 以前は「おすすめのAIアプリ」を並べて別タブで開いていた。
// AIアプリはAIコーチが必要に応じて使う専門スキルとして裏に隠したので、
// ここに出す入口はAIコーチ1つだけにする（何を選ぶかを最初に考えさせない）。

function AiCoachSidebar({ categoryName, onOpen }: { categoryName: string; onOpen: (seed?: string) => void }) {
  const prompts = [
    `${categoryName || 'この分野'}は何から始めるのがいい？`,
    '作ったものを見てもらいたい',
    '学ぶ順番を整理したい',
  ];

  return (
    <div
      className="bg-white border border-brand-border shadow-sm"
      style={{ borderRadius: '24px', padding: '24px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-[#D60934]" />
        <h3 className="font-bold text-brand-muted" style={{ fontSize: '16px' }}>
          AIコーチに相談
        </h3>
      </div>

      <p className="text-brand-muted" style={{ fontSize: '12px', lineHeight: 1.8, marginBottom: '14px' }}>
        迷っていることをそのまま書けば大丈夫です。制作物の添削や文章の改善が必要なときは、AIコーチが提案します。
      </p>

      <div className="flex flex-col" style={{ gap: '8px' }}>
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onOpen(prompt)}
            className="flex items-center border border-brand-border hover:bg-gray-50 transition-colors text-left"
            style={{ borderRadius: '12px', padding: '11px 13px', gap: '8px' }}
          >
            <span className="text-brand-text" style={{ fontSize: '12.5px', fontWeight: 500 }}>
              {prompt}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-brand-muted flex-shrink-0 ml-auto" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOpen()}
        className="w-full flex items-center justify-center gap-1 mt-4 text-white transition-opacity hover:opacity-90"
        style={{
          borderRadius: '999px',
          padding: '11px 18px',
          border: 'none',
          background: 'linear-gradient(120deg,#E5103C,#D60934)',
          fontSize: '12.5px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ✦ AIコーチを開く
      </button>
    </div>
  );
}

export default CategoryDetailPage;
