import React from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Clock,
  Loader2,
  Pencil,
  BookText,
  PlusCircle,
} from 'lucide-react';
import { AppHeader, AppIcon, CourseImage } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { bffClient } from '../services/bffClient';

// カテゴリのテーマカラーパレット
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

interface AIApp {
  id: number | string;
  name: string;
  description: string;
  icon?: string;
  url?: string;
  [key: string]: any;
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

/** コースをMoodleタグ名でグループ化 */
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

/** セクションのアイコン（タグ名から推定） */
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

  const catIdNum = Number(categoryId);
  const paletteIndex = (catIdNum - 1) % categoryColorPalette.length;
  const palette = categoryColorPalette[Math.abs(paletteIndex)] || categoryColorPalette[0];

  const { data, loading, error } = useAsyncData(
    () => Promise.all([
      bffClient.getCourseByField('category', String(catIdNum)),
      bffClient.getCategories().catch(() => []),
      bffClient.getAIApplications().catch(() => []),
    ]).then(([courseData, allCategories, apps]) => {
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
        aiApps: (Array.isArray(apps) ? apps : []).slice(0, 3) as AIApp[],
      };
    }),
    [catIdNum],
  );
  const sections: CourseSection[] = data?.sections ?? [];
  const categoryName: string = data?.categoryName ?? '';
  const categoryDescription: string = data?.categoryDescription ?? '';
  const categoryImage: string = data?.categoryImage ?? '';
  const aiApps: AIApp[] = data?.aiApps ?? [];

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

        {/* カテゴリヘッダーバー */}
        <div
          className="relative border-b py-6 sm:py-8 lg:py-[40px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderColor: '#FEFAF8' }}
        >
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 flex flex-col" style={{ gap: '24px' }}>
            {/* 戻るボタン */}
            <button
              onClick={() => navigate('/courses')}
              className="flex items-center gap-1 bg-white border border-brand-border rounded-[30px] text-brand-muted hover:bg-gray-50 transition-colors self-start"
              style={{ fontSize: '12px', fontWeight: 500, padding: '6px 22px 6px 16px' }}
            >
              <ChevronLeft className="w-3 h-3" />
              <span>カテゴリ一覧に戻る</span>
            </button>

            {/* カテゴリ情報 */}
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
                    style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: palette.color, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}
                  >
                    Category
                  </span>
                  <h1
                    className="font-bold text-brand-text text-2xl sm:text-3xl lg:text-[32px]"
                    style={{ lineHeight: '1.2' }}
                  >
                    {categoryName || 'カテゴリ'}
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
          className="relative max-w-[1100px] mx-auto px-4 sm:px-6"
          style={{ paddingTop: '40px', paddingBottom: '40px' }}
        >
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-10">

            {/* 左カラム: タグ別コースセクション */}
            <div className="flex-1 min-w-0 flex flex-col gap-6 sm:gap-8 lg:gap-10">
              {totalCourses === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <BookOpen className="w-12 h-12 text-brand-subtle" />
                  <p className="text-sm text-brand-muted">
                    このカテゴリにはまだコースがありません
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
              <AIAppsSidebar apps={aiApps} onViewAll={() => navigate('/ai-apps')} />
            </div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="flex items-center justify-center" style={{ height: '48px' }}>
        <span
          className="text-brand-muted"
          style={{ fontSize: '11.4px', fontWeight: 500, letterSpacing: '0.6px' }}
        >
          2026 &copy; WEBCOACH
        </span>
      </footer>

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

// --- AI Apps Sidebar ---

function AIAppsSidebar({ apps, onViewAll }: { apps: AIApp[]; onViewAll: () => void }) {
  return (
    <div
      className="bg-white border border-brand-border shadow-sm"
      style={{ borderRadius: '24px', padding: '24px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#A688D4]" />
          <h3
            className="font-bold text-brand-muted"
            style={{ fontSize: '16px' }}
          >
            おすすめのAIアプリ
          </h3>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-[#A688D4] hover:text-[#8B6FC0] transition-colors"
          style={{ fontSize: '12px', fontWeight: 500 }}
        >
          <span>すべて見る</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Sparkles className="w-8 h-8 text-brand-subtle" />
          <p className="text-xs text-brand-muted">
            AIアプリを読み込み中...
          </p>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: '10px' }}>
          {apps.map((app) => (
            <div
              key={app.id}
              className="flex items-center border border-brand-border cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '12px', padding: '12px', gap: '12px' }}
              onClick={() => {
                if (app.url) window.open(app.url, '_blank', 'noopener,noreferrer');
              }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#F7F2FF', borderRadius: '8px' }}
              >
                <AppIcon iconUrl={app.icon_url} url={app.url} icon={app.icon} alt={app.name} size={32} />
              </div>
              <div className="flex flex-col min-w-0" style={{ gap: '4px' }}>
                <span
                  className="text-brand-text font-medium truncate"
                  style={{ fontSize: '14px' }}
                >
                  {app.name}
                </span>
                <span
                  className="text-brand-muted truncate"
                  style={{ fontSize: '11px', fontWeight: 400 }}
                >
                  {app.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryDetailPage;
