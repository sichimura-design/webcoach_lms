import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppHeader } from './shared';
import { CourseTile } from './materials/CourseTile';
import { CourseThumb, categoryColor } from './materials/courseVisuals';
import { buildCatalog, type CatalogCourse } from './materials/catalogCourse';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { bffClient } from '../services/bffClient';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { t } from '../theme/tokens';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';
import {
  AREAS,
  AREA_FAMILY_LABEL,
  AREA_FAMILY_ORDER,
  AREA_NAMES,
  type AreaFamily,
} from '../constants/courseTaxonomy';
import { lessonProgressFromPercent } from '../utils/lessonProgress';
import type { MaterialSearchResult } from '../types/courses';

const DESIGN_WIDTH = 1440;

/**
 * この画面だけ上端の余白を共通トークンより広く取る。
 * ヘッダーのすぐ下に見出しと「続きから学ぶ」のヒーローカードが来るため、
 * pageTop(34) のままだとページが上に詰まって見えた（レビュー指摘）。
 */
const PAGE_TOP = t.space.pageTop + 20;

/** ヒーロー右の「次に学ぶ」。コース構成から取れた最初の未完了レッスン */
interface NextLesson {
  id: number;
  name: string;
  sectionName: string;
  /** コース通しの何レッスン目か（1始まり） */
  index: number;
  minutes?: number;
}

/** AI検索バーの例。押すと入力欄に入る */
const SEARCH_EXAMPLES = ['配色が苦手', 'バナーを作りたい', '次に学ぶべき教材は？'];

/*
 * 🔴 「学習領域」「種類」「並び替え」のプルダウンはこの画面から領域ページへ移した
 *    （materials/AreaCoursesPage.tsx）。この画面は領域の地図で、絞り込みは
 *    領域を選んだ先が受け持つ。select のスタイルもあちらに置いてある。
 */

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


  // コースカタログ（全コース）を取得し、自分の受講進捗をマージする
  useEffect(() => {
    let alive = true;
    bffClient.getCourses().then((raw: any[]) => {
      if (!alive) return;
      // 変換は materials/catalogCourse.ts に置いてある（領域ページと共用）
      setCatalog(buildCatalog(raw, activeCourses, resumableCourse));
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
      const at = flat.findIndex(({ module }: any) => !doneMap.get(module.id));
      const hitIndex = at < 0 ? 0 : at;
      const hit = flat[hitIndex];
      setNextLesson(hit && {
        id: hit.module.id,
        name: hit.module.name,
        sectionName: hit.sectionName,
        index: hitIndex + 1,
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
   * 領域カードの中身。件数と「学習中」は実データ（カタログ）から数え、
   * 表示順・説明文・family は constants/courseTaxonomy.ts が正典。
   * 実BFFが独自のカテゴリ名を返した場合（正典に無い領域）は family unknown で後ろに足す。
   */
  const areaCards = useMemo(() => {
    const byName = new Map<string, CatalogCourse[]>();
    catalog.forEach((c) => {
      if (!c.categoryName) return;
      const list = byName.get(c.categoryName);
      if (list) list.push(c);
      else byName.set(c.categoryName, [c]);
    });

    const known = AREAS.filter((a) => byName.has(a.name)).map((a) => ({
      name: a.name,
      description: a.description,
      family: a.family as AreaFamily | 'unknown',
      code: a.code as number | null,
      courses: byName.get(a.name) ?? [],
    }));
    const unknown = Array.from(byName.keys())
      .filter((name) => !AREA_NAMES.includes(name))
      .map((name) => ({
        name,
        description: '',
        family: 'unknown' as const,
        code: null,
        courses: byName.get(name) ?? [],
      }));

    return [...known, ...unknown].map((a) => ({
      ...a,
      count: a.courses.length,
      inProgress: a.courses.filter((c) => c.progress > 0 && c.progress < 100).length,
    }));
  }, [catalog]);

  /** family ごとのまとまり。見出しは5つまでで、色は下のカードの図形サムネと同じ */
  const areaGroups = useMemo(() => {
    const families: Array<AreaFamily | 'unknown'> = [...AREA_FAMILY_ORDER, 'unknown'];
    return families
      .map((family) => {
        const areas = areaCards.filter((a) => a.family === family);
        return {
          family,
          label: family === 'unknown' ? 'そのほか' : AREA_FAMILY_LABEL[family],
          color: areas[0] ? categoryColor(areas[0].name) : t.color.text.subtle,
          areas,
        };
      })
      .filter((g) => g.areas.length > 0);
  }, [areaCards]);

  /**
   * 領域カードの飛び先。コースが1本だけの領域は、1枚しか並ばない一覧を挟まず
   * そのコースのトップへ直接送る（ソフトスキル・キャリア・案件獲得の3つが該当）。
   */
  const openArea = (a: { name: string; code: number | null; courses: CatalogCourse[] }) => {
    if (a.courses.length === 1) {
      navigate(`/course/${a.courses[0].id}/curriculum`);
      return;
    }
    navigate(`/courses/category/${a.code ?? encodeURIComponent(a.name)}`);
  };

  const completedLessons = learningSummary.completedLessons.total;
  const enrolledLessons = activeCourses.reduce((sum, c) => sum + (c.totalLessons ?? 0), 0);

  /** ヒーローの進み具合。％ではなく「4 / 9」で出す（残り本数が引き算1回で分かる） */
  const resumeLessons = lessonProgressFromPercent(resumableCourse?.progress, resumableCourse?.totalLessons);

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
          categoryName: course.categoryname || '',
          totalLessons: course.lessoncount,
          duration: course.duration,
          tags: Array.isArray(course.tags) ? course.tags : undefined,
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
            数えているのはコースではなくレッスンなので、分母も「受講中コースの総レッスン数」に揃える。
            ここはクリックできない数字なので、カード枠（pill・枠線・影）を持たせず地の上に直接組む。
            枠を付けるとページ内で唯一「押せない pill」になり、押せる要素の見分けを鈍らせる。

            スコープを必ず書く: すぐ下のヒーローにも「このコース 3 / 9」が出るので、
            スコープ無しの分数が2つ並ぶと、分母が違う理由が読めない（レビュー指摘）。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--dc-fs-display)', fontWeight: t.font.weight.bold, letterSpacing: '-.01em', lineHeight: 'var(--dc-lh-heading)', flex: 1 }}>学習する</h1>

          {/* 🔴 かつてラベルの左に赤い丸チェックのバッジを置いていたが撤去した。意味を持たない
                 装飾で、押せない丸がこの行の主役になってしまっていた。
                 主役はラベルと数字なので、ラベルは muted ではなく本文色で組む。 */}
          {enrolledLessons > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.medium, color: t.color.text.primary }}>
                受講中コース全体の修了レッスン
              </span>
              <span
                style={{ fontSize: 'var(--dc-fs-display)', fontWeight: t.font.weight.bold, color: t.color.primary, lineHeight: 1 }}
                aria-label={`受講中コース全体で ${enrolledLessons}${LEARNING_HIERARCHY.lesson}中 ${completedLessons}${LEARNING_HIERARCHY.lesson}修了`}
              >
                {completedLessons}
                <span style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.semibold, color: t.color.text.subtle, marginLeft: 3 }}>/ {enrolledLessons}</span>
              </span>
            </div>
          )}
        </div>

        {/* ②③ 続きから学ぶ（左） ＋ ほかに学習中（右）。
            ============================================================
            🔴 この2つは1つの2カラムに組む。以前はどちらも全幅で、
               ・ヒーローは アート／情報／次に学ぶ／CTA を1行に並べていたので
                 1440px では横に伸びきって間延びしていた
               ・「ほかに学習中」は3列グリッドで、1〜2件だと列が空いて
                 スカスカに見えていた（レビュー指摘）
               左はサムネイル＋情報を横に組んだ低いヒーロー、右は縦積みの一覧にすることで、
               どちらも件数に関係なく密度が保てる。
            🔴 左のヒーローは高さを伸ばさない。ここが高いとカタログがファーストビューから
               落ちる。アートを全幅バナーにしたり、行を増やしたりしないこと。
            🔴 片方が無いときは残った方を全幅にする（空の列を残さない）。
            ============================================================ */}
        {(resumableCourse || otherActive.length > 0) && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {resumableCourse && (
              <div
                style={{
                  flex: 1, minWidth: 0,
                  background: t.color.bg.card, border: `1px solid ${t.color.border.card}`,
                  borderRadius: t.radius.card, boxShadow: t.shadow.card,
                  padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
                }}
              >
                {/* 🔴 アートは全幅200pxのバナーではなく、左に置く小さめのサムネイルにする。
                       全幅バナー＋縦積み（情報／次に学ぶ／CTA）だと、1コース分の再開動線だけで
                       ファーストビューをほぼ使い切ってしまい、下のカタログが見えなかった。
                       アートに情報は無いので、縮めても失うものはない。 */}
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                  <img
                    src={`${process.env.PUBLIC_URL}/images/materials/hero-art.png`}
                    alt=""
                    style={{ width: 184, height: 112, flexShrink: 0, objectFit: 'cover', borderRadius: t.radius.inner, display: 'block' }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.bold, color: t.color.primary, marginBottom: 4, letterSpacing: t.font.letterSpacingWide }}>
                      続きから学ぶ
                    </div>
                    {/* 主役はコース。レッスン名は下の「次に学ぶ」が持つので、ここでは繰り返さない。
                        次のレッスンが取れなかったときだけ、続きの位置をここに出してから畳む。 */}
                    <div style={{ fontSize: 'var(--dc-fs-title)', fontWeight: t.font.weight.bold, letterSpacing: '-.01em', lineHeight: 'var(--dc-lh-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {resumableCourse.title}
                    </div>
                    <div style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* 全レッスン数は右の「4 / 9 レッスン」が持つので、ここでは繰り返さない */}
                      {nextLesson
                        ? nextLesson.sectionName
                        : [resumableCourse.currentLesson, resumableCourse.currentChapter].filter(Boolean).join('・')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                      <div
                        role="progressbar"
                        aria-valuenow={resumableCourse.progress ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={resumeLessons?.full}
                        style={{ flex: 1, height: 7, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}
                      >
                        <div style={{ width: `${resumableCourse.progress ?? 0}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
                      </div>
                      {/* 「このコース」を必ず付ける。見出し右の「受講中コース全体」の分数と
                          分母が違うので、どちらを数えた分数なのかを数字の隣で言い切る。
                          レッスン総数が取れないコースだけ、従来どおり％に落とす。 */}
                      <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.muted, flexShrink: 0 }}>
                        このコース{' '}
                        {resumeLessons ? (
                          <>
                            <span style={{ fontWeight: t.font.weight.bold, color: t.color.text.primary }}>{resumeLessons.short}</span>
                            {' '}{LEARNING_HIERARCHY.lesson}
                          </>
                        ) : (
                          <span style={{ fontWeight: t.font.weight.bold, color: t.color.text.primary }}>{resumableCourse.progress ?? 0}%</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 「次に学ぶ」と CTA は同じ行に置く。何を開くのかとその開くボタンは隣同士が読みやすく、
                    行を分けていた頃より2段ぶん低くなる。狭いときは flexWrap で素直に折り返す。 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {nextLesson && (
                    <div
                      style={{
                        flex: 1, minWidth: 240,
                        background: t.color.primarySoft, borderRadius: t.radius.inner, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 30, height: 30, borderRadius: '50%', background: t.color.bg.card }}
                        aria-hidden
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={t.color.primary}><path d="M9 6.5v11l9-5.5z" /></svg>
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.muted }}>次に学ぶ</div>
                        <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.semibold, lineHeight: 'var(--dc-lh-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nextLesson.name}
                          <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.muted, marginLeft: 8 }}>
                            {[`Lesson ${nextLesson.index}`, nextLesson.minutes && `${nextLesson.minutes}分`].filter(Boolean).join('・')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={goToContinue}
                    className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ background: t.color.primary, color: '#fff', borderRadius: t.radius.button, padding: '11px 24px', fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    続きから学ぶ
                  </button>
                  <button
                    onClick={() => navigate(`/course/${resumableCourse.id}/curriculum`)}
                    className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ background: t.color.bg.card, color: t.color.primary, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.button, padding: '10px 20px', fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    コース目次を見る
                  </button>
                </div>
              </div>
            )}

            {/* ほかに学習中。ヒーローに出せるのは1コースだけなので、
                並行して進めているコースだけをここで拾う（修了済みは出さない）。 */}
            {otherActive.length > 0 && (
              <section
                style={{
                  ...(resumableCourse ? { width: 340, flexShrink: 0 } : { flex: 1, minWidth: 0 }),
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>ほかに学習中</div>
                {otherActive.map((c) => {
                  const lessons = lessonProgressFromPercent(c.progress, c.totalLessons);
                  return (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/course/${c.id}/curriculum`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/course/${c.id}/curriculum`); } }}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.tile, boxShadow: t.shadow.card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CourseThumb categoryName={c.categoryName ?? ''} size={56} radius={14} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {c.categoryName && (
                            <div style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.subtle, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.categoryName}
                            </div>
                          )}
                          <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.semibold, lineHeight: 'var(--dc-lh-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.title}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
                          <div style={{ width: `${c.progress ?? 0}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
                        </div>
                        <span
                          title={lessons?.full}
                          style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.muted, flexShrink: 0 }}
                        >
                          {lessons ? lessons.short : `${c.progress ?? 0}%`}
                        </span>
                        <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, color: t.color.primary, flexShrink: 0 }}>続きから →</span>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        )}

        {/* ④ ぴったりの教材をさがす。
            コース名のキーワード検索だと「配色が苦手」のような相談は空振りするので、
            学びたいこと・つまずきをそのまま入れられる1本の入力にまとめた。 */}
        <section style={{ background: t.color.primarySoft, borderRadius: t.radius.tile, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ flexShrink: 0, width: 200 }}>
            <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>ぴったりの教材をさがす</div>
            <div style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, marginTop: 2, lineHeight: 'var(--dc-lh-prose)' }}>
              学びたいこと・つまずいていることから、AIが教材をおすすめ
            </div>
          </div>

          {/* 🔴 入力欄を伸ばしきらない。flex:1 のまま width:100% にすると 1440px 幅で
                 入力が約1180pxになり、1行の質問に対して間延びした帯になる（レビュー指摘）。 */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <form
              onSubmit={(e) => { e.preventDefault(); runAiSearch(aiQuery); }}
              style={{ position: 'relative', width: '100%', maxWidth: 620 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.color.text.muted} strokeWidth="1.75" strokeLinecap="round" style={{ position: 'absolute', left: 16, top: 14 }} aria-hidden>
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5-5" />
              </svg>
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="学びたいこと・つまずいていることを入力（例：配色が苦手）"
                aria-label="学びたいこと・つまずいていること"
                style={{ width: '100%', boxSizing: 'border-box', height: 44, borderRadius: t.radius.pill, border: `1px solid ${t.color.primaryBorder}`, background: t.color.bg.card, padding: '0 118px 0 42px', fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.primary, outline: 'none' }}
              />
              <button
                type="submit"
                disabled={aiState === 'loading' || !aiQuery.trim()}
                className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ position: 'absolute', right: 5, top: 5, height: 34, borderRadius: t.radius.pill, background: aiQuery.trim() ? t.color.primary : t.color.text.subtle, padding: '0 16px', color: '#fff', fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, fontFamily: 'inherit', cursor: aiQuery.trim() ? 'pointer' : 'default' }}
              >
                {aiState === 'loading' ? 'さがし中…' : '教材をさがす'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 620 }}>
              <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle, flexShrink: 0 }}>例：</span>
              {SEARCH_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setAiQuery(ex); runAiSearch(ex); }}
                  className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: t.color.bg.card, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.pill, padding: '5px 13px', fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.body }}
                >
                  {ex}
                </button>
              ))}
              {(aiResult || aiState === 'error') && (
                <button
                  onClick={clearAiSearch}
                  className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'transparent', padding: '5px 4px', fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.muted, textDecoration: 'underline' }}
                >
                  結果を閉じる
                </button>
              )}
            </div>
          </div>
        </section>

        {/* AI検索の結果。実BFF（モックOFF）ではこのAPIが無いので、1行のことわりだけ出して一覧に戻す */}
        {aiState === 'error' && (
          <div style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted }}>
            いまは教材のおすすめを取得できませんでした。下のコース一覧から探してください。
          </div>
        )}

        {aiResult && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>AIが選んだ教材</div>
              <div style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted }}>{aiResult.summary}</div>
            </div>
            {aiCourses.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {aiCourses.map(({ course, reason }) => (
                  <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CourseTile course={course} onClick={() => navigate(`/course/${course.id}/curriculum`)} />
                    <div style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, lineHeight: 'var(--dc-lh-prose)' }}>{reason}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ⑤ 領域から探す。
            ============================================================
            🔴 ここは「コースの一覧」ではなく「領域の地図」。
               55コースを1画面に並べると、初めて見た人に構造が伝わらない
               （商談・初回セッションで見せたときに何がどこにあるか読めない）。
               まず領域が family ごとに並び、選んだ先（/courses/category/:code）で
               絞り込み・並び替えのある一覧に入る、の2段にしている。
            🔴 グループ見出しは family（5つ）。10領域に10個の見出しを立てると
               見出しだけで画面が埋まる。色・図形サムネも family 単位なので、
               見出しの色と下のカードの帯が一致する。
            🔴 コースが1本しかない領域は、領域ページを飛ばして直接コーストップへ。
               カード1枚だけの一覧を作らない（10領域のうち3つが該当）。
            ============================================================ */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>
              {LEARNING_HIERARCHY.area}から探す
            </div>
            <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle }}>
              全 {catalog.length} {LEARNING_HIERARCHY.course} ・ 目標以外のコースも自由に受講できます
            </span>
          </div>

          {areaGroups.length === 0 ? (
            <p style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, margin: 0 }}>
              コースを読み込んでいます…
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {areaGroups.map((group) => (
                <section key={group.family} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 3,
                        height: 15,
                        borderRadius: 2,
                        background: group.color,
                        flexShrink: 0,
                      }}
                    />
                    <h3 style={{ margin: 0, fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.bold }}>
                      {group.label}
                    </h3>
                    <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle }}>
                      {group.areas.length} {LEARNING_HIERARCHY.area}
                    </span>
                  </div>

                  <div className="wc-area-cards">
                    {group.areas.map((a) => (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() => openArea(a)}
                        className="wc-area-card appearance-none outline-none cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 16px',
                          background: t.color.bg.card,
                          border: `1px solid ${t.color.border.card}`,
                          borderRadius: t.radius.card,
                          fontFamily: 'inherit',
                          color: t.color.text.primary,
                        }}
                      >
                        <CourseThumb categoryName={a.name} size={44} radius={12} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              fontSize: 'var(--dc-fs-lead)',
                              fontWeight: t.font.weight.semibold,
                            }}
                          >
                            {a.name}
                            <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 400, color: t.color.text.subtle }}>
                              {a.count} {LEARNING_HIERARCHY.course}
                            </span>
                          </span>
                          {a.description && (
                            <span
                              style={{
                                display: 'block',
                                marginTop: 3,
                                fontSize: 'var(--dc-fs-caption)',
                                color: t.color.text.muted,
                                lineHeight: 'var(--dc-lh-ui)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {a.description}
                            </span>
                          )}
                          {/* 受講中があれば出す。「どこまで手を付けたか」が地図の上で分かる */}
                          {a.inProgress > 0 && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 5,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: t.color.primarySoft,
                                color: t.color.primary,
                                fontSize: 'var(--dc-fs-caption)',
                                fontWeight: t.font.weight.bold,
                              }}
                            >
                              学習中 {a.inProgress}
                            </span>
                          )}
                        </span>
                        <ChevronRight size={16} aria-hidden style={{ color: t.color.text.subtle, flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </section>
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
