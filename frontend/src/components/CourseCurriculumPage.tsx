import { useState, useEffect } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, BookOpen, ChevronRight, Check } from 'lucide-react';
import { bffClient } from '../services/bffClient';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';

// ─── 型定義 ──────────────────────────────────

interface Module {
  id: number;
  name: string;
  modname: string;
  description?: string;
  completion?: number;
  completiondata?: { state: number };
}

interface Section {
  id: number;
  name: string;
  visible?: boolean;
  summary: string;
  modules: Module[];
}

interface Course {
  id: number;
  fullname: string;
  shortname: string;
  categoryid: number;
  categoryname?: string;
  summary?: string;
}

// ─── コンポーネント ───────────────────────────

export default function CourseCurriculumPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const courseIdNum = parseInt(courseId || '0', 10);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const { data, loading, error } = useAsyncData(
    () => Promise.all([
      bffClient.getCourseContent(courseIdNum),
      bffClient.getCourses(),
    ]).then(([content, courses]) => ({
      sections: (Array.isArray(content) ? content : []).filter(
        (s: Section) => s.modules?.length > 0,
      ),
      course: (courses as Course[]).find(c => c.id === courseIdNum) ?? null,
    })),
    [courseIdNum],
  );
  const sections: Section[] = data?.sections ?? [];
  const course: Course | null = data?.course ?? null;

  useEffect(() => {
    if (sections.length === 0) return;
    const trackableModules = sections.flatMap(s => s.modules).filter(m => (m.completion ?? 0) >= 1);
    Promise.all(
      trackableModules.map(m =>
        bffClient.getActivityCompletion(m.id, courseIdNum)
          .then((d: { state: number }) => ({ id: m.id, state: d.state }))
          .catch(() => ({ id: m.id, state: 0 }))
      )
    ).then(results => {
      setCompletedIds(new Set(results.filter(r => r.state >= 1).map(r => r.id)));
    });
  }, [sections]);

  // ─── ローディング / エラー ────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto" />
          <p className="mt-4 text-sm text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <p className="text-brand">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 rounded-full text-white font-medium text-sm bg-brand"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">

      {/* ─── 共通ヘッダー ─────────────────────── */}
      <AppHeader userName={user?.username || 'User'} />

      {/* ─── コースヘッダーエリア ──────────────── */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #f0ebe8' }}>
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6">
          {/* 戻るボタン */}
          <button
            onClick={() => course ? navigate(`/courses/category/${course.categoryid}`) : navigate(-1)}
            className="flex items-center gap-1 bg-white border border-brand-border rounded-[30px] text-brand-muted hover:bg-gray-50 transition-colors self-start mb-5"
            style={{ fontSize: '12px', fontWeight: 500, padding: '6px 22px 6px 16px' }}
          >
            <ChevronLeft className="w-3 h-3" />
            <span>学習コンテンツに戻る</span>
          </button>

          {/* コース情報 */}
          <div className="flex items-center gap-5">
            {/* アイコン */}
            <div
              className="w-[78px] h-[78px] rounded-2xl flex items-center justify-center flex-shrink-0 bg-brand-gradient"
            >
              <BookOpen className="w-9 h-9 text-white" />
            </div>

            {/* テキスト */}
            <div className="min-w-0">
              {/* カテゴリバッジ */}
              <div
                className="inline-flex items-center px-3 py-1 rounded-full mb-2 text-xs font-bold text-brand"
                style={{ background: '#ffffff', border: '1px solid #f0d0d3' }}
              >
                {course?.categoryname || 'Category'}
              </div>
              {/* コース名 */}
              <h1
                className="font-bold leading-tight truncate text-brand-text"
                style={{ fontSize: '32px' }}
              >
                {course?.fullname ?? 'コース'}
              </h1>
              {/* 説明 */}
              {course?.summary && (
                <p
                  className="mt-1 line-clamp-1 text-brand-muted"
                  style={{ fontSize: '14px' }}
                >
                  {course.summary.replace(/<[^>]*>/g, '')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── メインコンテンツ ──────────────────── */}
      <div className="flex-1 max-w-[854px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* ─── カリキュラム ─────────────────────── */}
        <div>
          {/* セクションタイトル */}
          <div className="flex items-center gap-3 mb-5">
            <BookOpen className="w-5 h-5 text-brand-text" />
            <h2
              className="font-bold text-brand-text"
              style={{ fontSize: '18px' }}
            >
              カリキュラム
            </h2>
          </div>

          {/* セクションカード一覧 */}
          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <div
                key={section.id}
                className="rounded-3xl overflow-hidden shadow-sm bg-brand-bg"
                style={{ border: '1px solid #f0ebe8' }}
              >
                {/* セクションヘッダー */}
                <div className="flex items-center gap-3 px-6 py-4">
                  <div
                    className="flex-shrink-0 rounded-full bg-brand"
                    style={{ width: '3px', height: '24px' }}
                  />
                  <span
                    className="font-bold text-brand-muted"
                    style={{ fontSize: '18px' }}
                  >
                    {section.name}
                  </span>
                </div>

                {/* レッスン行一覧 */}
                <div className="flex flex-col divide-y" style={{ borderColor: '#f0ebe8' }}>
                  {section.modules.map((module) => (
                    <LessonRow
                      key={module.id}
                      module={module}
                      isCompleted={completedIds.has(module.id)}
                      onStart={() => navigate(`/course/${courseIdNum}?module=${module.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── フッター ─────────────────────────── */}
      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span
          className="font-bold text-white"
          style={{ fontSize: '11.4px', letterSpacing: '0.6px' }}
        >
          2024 © WEBCOACH
        </span>
      </footer>
    </div>
  );
}

// ─── レッスン行 ───────────────────────────────

interface LessonRowProps {
  module: Module;
  isCompleted: boolean;
  onStart: () => void;
}

function LessonRow({ module, isCompleted, onStart }: LessonRowProps) {

  return (
    <div className="flex items-center gap-4 px-6 py-4" style={{ background: '#ffffff' }}>
      {/* 完了アイコン */}
      {isCompleted ? (
        <div
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 bg-brand-gradient"
        >
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      ) : (
        <div
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 border-2"
          style={{ borderColor: '#e0d8d4' }}
        />
      )}

      {/* テキスト */}
      <div className="flex-1 min-w-0">
        <p
          className="font-bold truncate text-brand-muted"
          style={{ fontSize: '14px' }}
        >
          {module.name}
        </p>
        {module.description && (
          <p
            className="mt-0.5 line-clamp-1 text-brand-muted"
            style={{ fontSize: '10px', fontWeight: 300 }}
          >
            {module.description.replace(/<[^>]*>/g, '').slice(0, 60)}
          </p>
        )}
      </div>

      {/* 受講するボタン */}
      <button
        onClick={onStart}
        className="flex items-center gap-1.5 flex-shrink-0 hover:opacity-80 transition-opacity text-brand-muted"
        style={{
          background: '#faf8f4',
          border: '1px solid #e0d8d4',
          borderRadius: '9999px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        受講する
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
