import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from './shared';
import { CourseTile } from './materials/CourseTile';
import { GalleryCourse, CourseThumb } from './materials/courseVisuals';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { bffClient } from '../services/bffClient';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { t } from '../theme/tokens';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';
import type { MaterialSearchResult } from '../types/courses';

const DESIGN_WIDTH = 1440;

/**
 * この画面だけ上端の余白を共通トークンより広く取る。
 * ヘッダーのすぐ下に見出しと「続きから学ぶ」のヒーローカードが来るため、
 * pageTop(34) のままだとページが上に詰まって見えた（レビュー指摘）。
 */
const PAGE_TOP = t.space.pageTop + 20;

interface CatalogCourse extends GalleryCourse {
  difficulty?: string;
}

/** ヒーロー右の「次に学ぶ」。コース構成から取れた最初の未完了レッスン */
interface NextLesson {
  id: number;
  name: string;
  sectionName: string;
  minutes?: number;
}

const ALL = 'すべて';

/** 「区分」プルダウン。カタログの difficulty 文字列と1:1で対応する */
const LEVELS = ['基礎', '応用', '発展'];

const SORTS = [
  { key: 'recommended', label: 'おすすめ順' },
  { key: 'inProgress', label: '受講中を先に' },
  { key: 'short', label: 'レッスン数が少ない順' },
] as const;
type SortKey = typeof SORTS[number]['key'];

/** AI検索バーの例。押すと入力欄に入る */
const SEARCH_EXAMPLES = ['配色が苦手', 'バナーを作りたい', '次に学ぶべき教材は？'];

/** プルダウンを pill に見せる。新しいドロップダウンは作らず素の select を使う */
const selectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: `${t.color.bg.card} no-repeat right 12px center`,
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8082\' stroke-width=\'2.2\' stroke-linecap=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  border: `1px solid ${t.color.border.card}`,
  borderRadius: t.radius.pill,
  padding: '7px 30px 7px 14px',
  fontSize: 12.5,
  fontFamily: 'inherit',
  color: t.color.text.primary,
  cursor: 'pointer',
  outline: 'none',
};

function MaterialsTopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resumableCourse, activeCourses } = useMypageData(user?.userid);
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);
  const learningSummary = useLearningSummary(activeCourses);

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [nextLesson, setNextLesson] = useState<NextLesson | undefined>();

  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState<MaterialSearchResult | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');

  const [activeTab, setActiveTab] = useState<string>(ALL);
  const [level, setLevel] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>('recommended');

  // コースカタログ（全コース）を取得し、自分の受講進捗をマージする
  useEffect(() => {
    let alive = true;
    bffClient.getCourses().then((raw: any[]) => {
      if (!alive) return;
      const list = Array.isArray(raw) ? raw : [];
      setCatalog(list.map((c) => {
        const enrolled = activeCourses.find((ac) => ac.id === c.id) || (resumableCourse?.id === c.id ? resumableCourse : undefined);
        return {
          id: c.id,
          title: c.fullname || c.displayname || '',
          description: c.summary || '',
          categoryName: c.categoryname || LEARNING_HIERARCHY.area,
          totalLessons: c.lessoncount ?? enrolled?.totalLessons,
          duration: c.duration,
          purposes: Array.isArray(c.purposes) ? c.purposes : undefined,
          difficulty: c.difficulty,
          thumbnailUrl: c.courseimage,
          progress: enrolled?.progress ?? 0,
          isCurrent: resumableCourse?.id === c.id,
        };
      }));
    }).catch(() => setCatalog([]));
    return () => { alive = false; };
  }, [activeCourses, resumableCourse]);

  /**
   * 続きから学ぶコースの「次に学ぶ1レッスン」を決める。
   * ヒーローの飛び先と、ヒーロー右の「次に学ぶ」ブロックの両方がこれ1つで決まる。
   * 完了状態を見るのは completion >= 1（追跡対象）のレッスンだけにして、
   * コーストップの進捗計算（CourseTopPage）と同じ土俵に乗せる。
   */
  useEffect(() => {
    if (!resumableCourse) {
      setNextLesson(undefined);
      return;
    }
    let alive = true;
    const courseId = resumableCourse.id;
    bffClient.getCourseContent(courseId).then(async (raw: any) => {
      const sections = (Array.isArray(raw) ? raw : []).filter((s: any) => s.modules?.length > 0);
      const flat = sections.flatMap((s: any) => (s.modules ?? []).map((m: any) => ({ module: m, sectionName: s.name as string })));
      const trackable = flat.filter(({ module }: any) => (module.completion ?? 0) >= 1);
      const results = await Promise.all(
        trackable.map(({ module }: any) =>
          bffClient.getActivityCompletion(module.id, courseId)
            .then((d: any) => ({ id: module.id, done: (d?.state ?? 0) >= 1 }))
            .catch(() => ({ id: module.id, done: false }))
        )
      );
      if (!alive) return;
      const doneMap = new Map(results.map((r) => [r.id, r.done]));
      const hit = flat.find(({ module }: any) => !doneMap.get(module.id)) ?? flat[0];
      setNextLesson(hit && {
        id: hit.module.id,
        name: hit.module.name,
        sectionName: hit.sectionName,
        minutes: hit.module.durationminutes,
      });
    }).catch(() => setNextLesson(undefined));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumableCourse?.id]);

  /** ほかに学習中。続きから学ぶコースと修了済みは除く */
  const otherActive = useMemo(
    () => activeCourses.filter((c) => c.id !== resumableCourse?.id && (c.progress ?? 0) > 0 && (c.progress ?? 0) < 100),
    [activeCourses, resumableCourse?.id],
  );

  /**
   * カテゴリタブ。学習領域が1つしか無いとき（＝実BFFで categoryname が来ないとき）は
   * 「すべて」と同じ意味のタブが2つ並ぶだけなので、タブ自体を出さない。
   */
  const tabs = useMemo(() => {
    const names = Array.from(new Set(catalog.map((c) => c.categoryName)));
    return names.length > 1 ? [ALL, ...names] : [];
  }, [catalog]);

  const hasDifficulty = useMemo(() => catalog.some((c) => c.difficulty), [catalog]);

  /** タブ・区分・並び替えを効かせた一覧。全件そのまま並べる（ページネーションはしない） */
  const visibleCourses = useMemo(() => {
    const list = catalog.filter(
      (c) => (activeTab === ALL || c.categoryName === activeTab) && (level === ALL || c.difficulty === level),
    );
    if (sort === 'inProgress') {
      return [...list].sort((a, b) => Number(b.progress > 0 && b.progress < 100) - Number(a.progress > 0 && a.progress < 100));
    }
    if (sort === 'short') {
      return [...list].sort((a, b) => (a.totalLessons ?? 99) - (b.totalLessons ?? 99));
    }
    return list; // おすすめ順＝カタログの並び（カリキュラム順）
  }, [catalog, activeTab, level, sort]);

  const completedLessons = learningSummary.completedLessons.total;
  const enrolledLessons = activeCourses.reduce((sum, c) => sum + (c.totalLessons ?? 0), 0);

  const goToContinue = () => {
    if (!resumableCourse) return;
    navigate(nextLesson ? `/course/${resumableCourse.id}?module=${nextLesson.id}` : `/course/${resumableCourse.id}/curriculum`);
  };

  const runAiSearch = (q: string) => {
    const query = q.trim();
    if (!query) return;
    setAiState('loading');
    bffClient.searchMaterialsByAI(query)
      .then((res) => { setAiResult(res); setAiState('idle'); })
      // 実BFFにこのAPIは無い（モックOFFでは501）。ここで畳んで他の節に波及させない
      .catch(() => { setAiResult(null); setAiState('error'); });
  };

  const clearAiSearch = () => { setAiQuery(''); setAiResult(null); setAiState('idle'); };

  /** AI検索の結果は Moodle の生データで返るので、タイルが読める形に寄せる */
  const aiCourses: Array<{ course: CatalogCourse; reason: string }> = useMemo(
    () => (aiResult?.results ?? []).map(({ course, reason }) => {
      const known = catalog.find((c) => c.id === course.id);
      return {
        reason,
        course: known ?? {
          id: course.id,
          title: course.fullname || '',
          description: course.summary || '',
          categoryName: course.categoryname || LEARNING_HIERARCHY.area,
          totalLessons: course.lessoncount,
          duration: course.duration,
          difficulty: course.difficulty,
          thumbnailUrl: course.courseimage,
          progress: 0,
          isCurrent: false,
        },
      };
    }),
    [aiResult, catalog],
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.color.bg.page }}>
      <AppHeader userName={user?.username || 'User'} />

      <div
        ref={outerRef}
        style={{ width: '100%', maxWidth: DESIGN_WIDTH, margin: '0 auto', position: 'relative', height: innerHeight ? innerHeight * scale : undefined }}
      >
      <main
        ref={innerRef}
        className="flex flex-col"
        style={{ position: 'absolute', top: 0, left: 0, width: DESIGN_WIDTH, paddingTop: PAGE_TOP, paddingLeft: t.space.pageX, paddingRight: t.space.pageX, paddingBottom: t.space.pageBottom, gap: t.space.stack, fontFamily: t.font.family, color: t.color.text.primary, boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {/* ① 見出し行。右端に「修了レッスン」だけを置く。
            数えているのはコースではなくレッスンなので、分母も「受講中コースの総レッスン数」に揃える。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <h1 style={{ margin: 0, fontSize: t.font.size.pageTitle, fontWeight: t.font.weight.black, letterSpacing: '-.01em', flex: 1 }}>学習する</h1>

          {enrolledLessons > 0 && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                background: t.color.bg.card, border: `1px solid ${t.color.border.card}`,
                borderRadius: t.radius.pill, padding: '8px 20px 8px 10px', boxShadow: t.shadow.card,
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${t.color.primary},${t.color.primaryHover})` }}
                aria-hidden
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: t.font.weight.bold, color: t.color.text.muted }}>修了レッスン</span>
              <span style={{ fontSize: 24, fontWeight: t.font.weight.black, color: t.color.primary, lineHeight: 1 }}>
                {completedLessons}
                <span style={{ fontSize: 12, fontWeight: t.font.weight.bold, color: t.color.text.subtle, marginLeft: 3 }}>/ {enrolledLessons}</span>
              </span>
            </div>
          )}
        </div>

        {/* ② 続きから学ぶ。1コースだけを大きく出し、そのすぐ隣に「次に学ぶ1レッスン」を添える。
            「どこまで進んだか」と「次に開くのはどれか」が同じ視線の中で分かるようにするため。 */}
        {resumableCourse && (
          <div
            style={{
              background: t.color.bg.card, border: `1px solid ${t.color.border.card}`,
              borderRadius: t.radius.card, boxShadow: t.shadow.card,
              padding: '22px 24px', display: 'flex', gap: 24, alignItems: 'center',
            }}
          >
            <img
              src={`${process.env.PUBLIC_URL}/images/materials/hero-art.png`}
              alt=""
              style={{ width: 240, height: 140, objectFit: 'cover', borderRadius: t.radius.inner, display: 'block', flexShrink: 0 }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: t.font.weight.black, color: t.color.primary, marginBottom: 6, letterSpacing: t.font.letterSpacingWide }}>
                続きから学ぶ
              </div>
              <div style={{ fontSize: 21, fontWeight: t.font.weight.black, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {resumableCourse.currentLesson || resumableCourse.title}
              </div>
              <div style={{ fontSize: 13, color: t.color.text.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[resumableCourse.title, resumableCourse.currentChapter].filter(Boolean).join('・')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, maxWidth: 360 }}>
                <div
                  role="progressbar"
                  aria-valuenow={resumableCourse.progress ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{ flex: 1, height: 8, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}
                >
                  <div style={{ width: `${resumableCourse.progress ?? 0}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
                </div>
                <span style={{ fontSize: 13, color: t.color.text.muted, flexShrink: 0 }}>
                  進捗 <span style={{ fontWeight: t.font.weight.bold, color: t.color.text.primary }}>{resumableCourse.progress ?? 0}%</span>
                </span>
              </div>
            </div>

            {nextLesson && (
              <div style={{ flexShrink: 0, borderLeft: `1px solid ${t.color.border.card}`, paddingLeft: 24, width: 210 }}>
                <div style={{ fontSize: 12, color: t.color.text.muted, marginBottom: 8 }}>次に学ぶ</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, borderRadius: '50%', background: t.color.primarySoft }}
                    aria-hidden
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={t.color.primary}><path d="M9 6.5v11l9-5.5z" /></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: t.font.weight.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextLesson.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: t.color.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[nextLesson.sectionName, nextLesson.minutes && `${nextLesson.minutes}分`].filter(Boolean).join('・')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
              <button
                onClick={goToContinue}
                className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: t.color.primary, color: '#fff', borderRadius: t.radius.button, padding: '12px 26px', fontSize: 14, fontWeight: t.font.weight.black, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                続きから学ぶ
              </button>
              <button
                onClick={() => navigate(`/course/${resumableCourse.id}/curriculum`)}
                className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: t.color.bg.card, color: t.color.primary, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.button, padding: '11px 26px', fontSize: 13.5, fontWeight: t.font.weight.black, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                コース目次を見る
              </button>
            </div>
          </div>
        )}

        {/* ③ ほかに学習中。ヒーローに出せるのは1コースだけなので、
            並行して進めているコースだけをここで拾う（修了済みは出さない）。 */}
        {otherActive.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>ほかに学習中</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {otherActive.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/course/${c.id}/curriculum`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/course/${c.id}/curriculum`); } }}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.tile, boxShadow: t.shadow.card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box' }}
                >
                  <CourseThumb categoryName={c.categoryName ?? ''} size={40} radius={12} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: t.font.weight.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
                        <div style={{ width: `${c.progress ?? 0}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: t.font.weight.bold, color: t.color.text.muted, flexShrink: 0 }}>{c.progress ?? 0}%</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: t.font.weight.black, color: t.color.primary, flexShrink: 0 }}>続きから →</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ④ ぴったりの教材をさがす。
            コース名のキーワード検索だと「配色が苦手」のような相談は空振りするので、
            学びたいこと・つまずきをそのまま入れられる1本の入力にまとめた。 */}
        <section style={{ background: t.color.primarySoft, borderRadius: t.radius.tile, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ flexShrink: 0, width: 200 }}>
            <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>ぴったりの教材をさがす</div>
            <div style={{ fontSize: 12, color: t.color.text.muted, marginTop: 2, lineHeight: 1.6 }}>
              学びたいこと・つまずいていることから、AIが教材をおすすめ
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <form
              onSubmit={(e) => { e.preventDefault(); runAiSearch(aiQuery); }}
              style={{ position: 'relative' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.color.text.muted} strokeWidth="1.75" strokeLinecap="round" style={{ position: 'absolute', left: 16, top: 14 }} aria-hidden>
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5-5" />
              </svg>
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="学びたいこと・つまずいていることを入力（例：配色が苦手）"
                aria-label="学びたいこと・つまずいていること"
                style={{ width: '100%', boxSizing: 'border-box', height: 44, borderRadius: t.radius.pill, border: `1px solid ${t.color.primaryBorder}`, background: t.color.bg.card, padding: '0 118px 0 42px', fontSize: 13, fontFamily: 'inherit', color: t.color.text.primary, outline: 'none' }}
              />
              <button
                type="submit"
                disabled={aiState === 'loading' || !aiQuery.trim()}
                className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ position: 'absolute', right: 5, top: 5, height: 34, borderRadius: t.radius.pill, background: aiQuery.trim() ? t.color.primary : t.color.text.subtle, padding: '0 16px', color: '#fff', fontSize: 12.5, fontWeight: t.font.weight.black, fontFamily: 'inherit', cursor: aiQuery.trim() ? 'pointer' : 'default' }}
              >
                {aiState === 'loading' ? 'さがし中…' : '教材をさがす'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: t.color.text.subtle, flexShrink: 0 }}>例：</span>
              {SEARCH_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setAiQuery(ex); runAiSearch(ex); }}
                  className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: t.color.bg.card, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.pill, padding: '5px 13px', fontSize: 12, fontFamily: 'inherit', color: t.color.text.body }}
                >
                  {ex}
                </button>
              ))}
              {(aiResult || aiState === 'error') && (
                <button
                  onClick={clearAiSearch}
                  className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'transparent', padding: '5px 4px', fontSize: 12, fontFamily: 'inherit', color: t.color.text.muted, textDecoration: 'underline' }}
                >
                  結果を閉じる
                </button>
              )}
            </div>
          </div>
        </section>

        {/* AI検索の結果。実BFF（モックOFF）ではこのAPIが無いので、1行のことわりだけ出して一覧に戻す */}
        {aiState === 'error' && (
          <div style={{ fontSize: 12.5, color: t.color.text.muted }}>
            いまは教材のおすすめを取得できませんでした。下のコース一覧から探してください。
          </div>
        )}

        {aiResult && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>AIが選んだ教材</div>
              <div style={{ fontSize: 12.5, color: t.color.text.muted }}>{aiResult.summary}</div>
            </div>
            {aiCourses.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {aiCourses.map(({ course, reason }) => (
                  <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CourseTile course={course} onClick={() => navigate(`/course/${course.id}/curriculum`)} />
                    <div style={{ fontSize: 11.5, color: t.color.text.muted, lineHeight: 1.6 }}>{reason}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ⑤ すべてのコースから探す。
            以前は学習領域→段階の見出しで全件を縦に積んでいたが、ページが長くなりすぎたため
            タブ1段＋区分／並び替えの2プルダウンに畳んだ。 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>すべてのコースから探す</div>
              <span style={{ fontSize: 12, color: t.color.text.subtle }}>
                全 {catalog.length} コース ・ 目標以外のコースも自由に受講できます
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {hasDifficulty && (
                <select aria-label="区分" value={level} onChange={(e) => setLevel(e.target.value)} style={selectStyle}>
                  <option value={ALL}>区分：すべて</option>
                  {LEVELS.map((l) => <option key={l} value={l}>区分：{l}</option>)}
                </select>
              )}
              <select aria-label="並び替え" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle}>
                {SORTS.map((s) => <option key={s.key} value={s.key}>並び替え：{s.label}</option>)}
              </select>
            </div>
          </div>

          {tabs.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tabs.map((name) => {
                const on = activeTab === name;
                return (
                  <button
                    key={name}
                    onClick={() => setActiveTab(name)}
                    aria-pressed={on}
                    className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      background: on ? t.color.primary : t.color.bg.card,
                      color: on ? '#fff' : t.color.text.muted,
                      border: `1px solid ${on ? t.color.primary : t.color.border.card}`,
                      borderRadius: t.radius.pill, padding: '7px 18px',
                      fontSize: 12.5, fontWeight: t.font.weight.bold, fontFamily: 'inherit',
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {visibleCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '60px 0', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🔍</span>
              <p style={{ fontSize: 13, color: t.color.text.muted, margin: 0 }}>条件に合うコースが見つかりませんでした。タブや区分を変えてみてください。</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              {visibleCourses.map((c) => (
                <CourseTile key={c.id} course={c} onClick={() => navigate(`/course/${c.id}/curriculum`)} />
              ))}
            </div>
          )}
        </section>
      </main>
      </div>
    </div>
  );
}

export default MaterialsTopPage;
