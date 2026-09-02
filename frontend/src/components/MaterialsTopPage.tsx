import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppHeader } from './shared';
import { CourseTile } from './materials/CourseTile';
import { CourseArt, CourseThumb, categoryColor } from './materials/courseVisuals';
import { buildCatalog, type CatalogCourse } from './materials/catalogCourse';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { bffClient } from '../services/bffClient';
import { t } from '../theme/tokens';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';
import {
  AREAS,
  AREA_NAMES,
  type AreaFamily,
} from '../constants/courseTaxonomy';
import { lessonProgressFromPercent } from '../utils/lessonProgress';
import type { MaterialSearchResult } from '../types/courses';
import {
  ALL,
  COURSE_STATUSES,
  COURSE_STATUS,
  courseStatusOf,
  isCompleted,
  selectStyle,
} from './materials/courseFilters';

/**
 * ページの最大幅。デザインは 1440px キャンバスで描かれている。
 *
 * 🔴 かつてここを「固定キャンバスの幅」として使い、useScaleToFit(1440) で
 *    transform:scale してビューポートに収めていた。やめた理由:
 *    ブラウザのズームはCSSビューポート幅を減らすことで文字を大きくするのに対し、
 *    useScaleToFit は減った幅に合わせて全体を縮める。つまり両者が打ち消し合い、
 *    「拡大してもサイドバー（72px固定）だけが大きくなり、本文は大きくならない」
 *    状態になっていた。実測でも幅1280pxで scale 0.839 がかかり、
 *    14px が 11.7px、12px が 10.1px まで落ちて 12px 下限を51箇所で割っていた。
 *    いまは max-width として使い、狭いときは他ページと同じように折り返す。
 */
const MAX_WIDTH = 1440;

/**
 * この画面だけ上端の余白を共通トークンより広く取る。
 * ヘッダーのすぐ下に見出しと「続きから学ぶ」のヒーローカードが来るため、
 * pageTop(34) のままだとページが上に詰まって見えた（レビュー指摘）。
 */
const PAGE_TOP = t.space.pageTop + 20;

/**
 * ページ左右のガター。
 * 🔴 t.space.pageX(42) の固定値だと、375px 幅で左右 84px が抜けて中身が入らない
 *    （固定キャンバス時代は transform:scale が全部まとめて縮めていたので露見しなかった）。
 *    他ページの --dc-sp-page-x と同じ「幅に連動して縮む」形にする。
 *    上限は従来と同じ 42px なので、PC の見た目は変わらない。
 */
const PAGE_X = `clamp(20px, 2.53vw, ${t.space.pageX}px)`;

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

/**
 * 「ほかに学習中」を畳まずに出す件数。
 *
 * 🔴 増やさない。ここは「並行して何を進めているか」の早見で、全コースの一覧は
 *    下の「学習領域から探す」が受け持つ。3件ならヒーローより低いままで、
 *    ファーストビューをカタログに残せる。超えたぶんは畳んで、開きたい人だけ開く。
 */
const OTHER_ACTIVE_VISIBLE = 3;

/**
 * 領域ブロックに畳まずに出すコース数。4列グリッドなので2行ぶん。
 * 10領域のうち畳まれるのは Webデザイン(13)・Webマーケティング(11) の2つだけで、
 * 残り8領域（Web制作8・動画編集7・SNS運用6・Web×AI5 …）はそのまま全部出る。
 * ここを下げると畳まれる領域が増えて、開く操作ばかりの画面になる。
 */
const AREA_PREVIEW_LIMIT = 8;

/*
 * 絞り込みの分担。
 * ============================================================
 * 🔴 この画面は「領域」と「受講状況」の2軸だけを持つ。かつては絞り込みを
 *    全部領域ページへ移していたが、10領域55コースを上から眺めるとき
 *   「学習中だけ見たい」「もう終わったものは畳みたい」に応える手段が
 *    無かったので、この2軸だけ戻した。
 * 🔴 「種類（基礎/実践課題）」と「並び替え」は領域ページのまま
 *    （materials/AreaCoursesPage.tsx）。領域を選んだあとにしか意味を
 *    持たない軸を、領域が並ぶこの画面に出さない。
 * 🔴 絞り込みの状態は URL に持たせない。この画面はブックマークして戻る
 *    対象ではなく、領域の開閉（openAreas）も state で持っている。
 * ============================================================
 */

function MaterialsTopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resumableCourse, activeCourses } = useMypageData(user?.userid);
  const learningSummary = useLearningSummary(activeCourses);

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [nextLesson, setNextLesson] = useState<NextLesson | undefined>();
  /** 「ほかに学習中」を全件出すか（既定は OTHER_ACTIVE_VISIBLE 件で畳む） */
  const [showAllActive, setShowAllActive] = useState(false);

  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState<MaterialSearchResult | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  /** 例チップを出すかどうか。入力に用がある間だけ見せて、常設の飾りにしない */
  const [searchFocused, setSearchFocused] = useState(false);

  // --- 絞り込み（⑤「領域から探す」に効く） ---
  const [areaFilter, setAreaFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [hideCompleted, setHideCompleted] = useState(false);

  /**
   * 全件を開いている領域（領域名で持つ）。既定はすべて畳んだ状態。
   * 複数同時に開けてよい（領域を見比べる操作を邪魔しない）。
   */
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());

  const toggleArea = (name: string) =>
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });


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

  /**
   * 表示順＝コース数の降順。
   * 🔴 「学べることが多い領域から見せる」がこの画面の並びの根拠。
   *    family（キャリア/制作/…）のグループ見出しは廃止した。
   * Array.prototype.sort は安定なので、同数の領域は courseTaxonomy の宣言順のまま残る。
   */
  const sortedAreas = useMemo(
    () => [...areaCards].sort((a, b) => b.count - a.count),
    [areaCards],
  );

  /** 絞り込みが1つでも効いているか。畳みの解除と「リセット」の出し分けに使う */
  const filtering = areaFilter !== ALL || statusFilter !== ALL || hideCompleted;

  /**
   * 絞り込み後の領域ブロック。
   * 🔴 コースが0件になった領域はブロックごと落とす。見出しだけが残ると
   *    「この領域には何も無い」ではなく「読み込みに失敗した」に見える。
   * count / inProgress は絞り込み前の実数のまま（見出しは領域の全体像を示す）。
   */
  const visibleAreas = useMemo(() => {
    if (!filtering) return sortedAreas;
    return sortedAreas
      .filter((a) => areaFilter === ALL || a.name === areaFilter)
      .map((a) => ({
        ...a,
        courses: a.courses.filter((c) => {
          if (hideCompleted && isCompleted(c)) return false;
          return statusFilter === ALL || courseStatusOf(c) === statusFilter;
        }),
      }))
      .filter((a) => a.courses.length > 0);
  }, [sortedAreas, filtering, areaFilter, statusFilter, hideCompleted]);

  /** 絞り込み中に見出し横へ出す件数 */
  const filteredCount = useMemo(
    () => visibleAreas.reduce((sum, a) => sum + a.courses.length, 0),
    [visibleAreas],
  );

  const resetFilters = () => {
    setAreaFilter(ALL);
    setStatusFilter(ALL);
    setHideCompleted(false);
  };

  const completedLessons = learningSummary.completedLessons.total;
  const enrolledLessons = activeCourses.reduce((sum, c) => sum + (c.totalLessons ?? 0), 0);

  /** ヒーローの進み具合。％ではなく「4 / 9」で出す（残り本数が引き算1回で分かる） */
  const resumeLessons = lessonProgressFromPercent(resumableCourse?.progress, resumableCourse?.totalLessons);

  /**
   * ヒーローのサムネに使うコースの姿。
   * 🔴 resumecourse は領域名もコース画像も返さないので、カタログ側を正典にする
   *    （mypageApi が入れている categoryName:'カテゴリ' はプレースホルダで、
   *      そのまま渡すと文字組みサムネに「カテゴリ」と印字されてしまう）。
   */
  const resumeArt = useMemo(() => {
    if (!resumableCourse) return undefined;
    const known = catalog.find((c) => c.id === resumableCourse.id);
    // カタログの到着前でも絵柄を出す。領域名は分からないので空に倒す
    return known ?? { id: resumableCourse.id, title: resumableCourse.title, categoryName: '', thumbnailUrl: resumableCourse.thumbnailUrl };
  }, [catalog, resumableCourse]);

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

      <main
        className="flex flex-col"
        style={{ width: '100%', maxWidth: MAX_WIDTH, margin: '0 auto', paddingTop: PAGE_TOP, paddingLeft: PAGE_X, paddingRight: PAGE_X, paddingBottom: t.space.pageBottom, gap: t.space.stack, fontFamily: t.font.family, color: t.color.text.primary, boxSizing: 'border-box' }}
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
            🔴 幅は「左を固定・右を可変」にする。再開できるコースは常に1本なので
               左に必要な幅は決まっているが、右は並行受講の本数で必要な幅が変わる。
               逆にすると（左 flex:1・右 340px 固定）右が1列しか組めず、
               受講本数が増えたぶんだけ右だけが下に伸びて、左と釣り合わなくなる。
            🔴 左のヒーローは高さを伸ばさない。ここが高いとカタログがファーストビューから
               落ちる。アートを全幅バナーにしたり、行を増やしたりしないこと。
            🔴 片方が無いときは残った方を全幅にする（空の列を残さない）。
            ============================================================ */}
        {(resumableCourse || otherActive.length > 0) && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {resumableCourse && resumeArt && (
              <section
                style={{
                  // 460px は「サムネ152＋余白＋単元名が2行に折れない」最小幅。SP では
                  // maxWidth が勝って全幅に戻る（width だけだと 375px 幅で溢れる）。
                  ...(otherActive.length > 0 ? { width: 460, maxWidth: '100%', flexShrink: 0 } : { flex: 1, minWidth: 0 }),
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                {/* 見出しは右の「ほかに学習中」と同じ組み。2つのカードが同じ高さから始まる。
                    かつてカード内に赤い「続きから学ぶ」ラベルを置いていたが、下の CTA と
                    同じ言葉が2回出るので、見出しに「前回学習したもの」として1回だけ出す。 */}
                <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>前回学習したもの</div>

                <div
                  style={{
                    background: t.color.bg.card, border: `1px solid ${t.color.border.card}`,
                    borderRadius: t.radius.card, boxShadow: t.shadow.card,
                    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
                  }}
                >
                  {/* 🔴 アートは全幅200pxのバナーではなく、左に置く小さめのサムネイルにする。
                         全幅バナー＋縦積み（情報／次に学ぶ／CTA）だと、1コース分の再開動線だけで
                         ファーストビューをほぼ使い切ってしまい、下のカタログが見えなかった。
                      🔴 中身は共通の飾り絵（hero-art.png）ではなくコース自身の絵柄にした。
                         文字組みサムネがコース名を持つので、本文側からコース名の行を落とせる。 */}
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* 152px は文字組みサムネ（画像を持たないコース）でコース名が
                        2行に収まる下限。これ以上縮めるなら titleSize も下げること。 */}
                    <CourseArt
                      course={resumeArt}
                      titleSize="var(--dc-fs-body)"
                      style={{ width: 152, height: 92, flexShrink: 0, borderRadius: t.radius.inner }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 画像サムネのコースだけ、絵柄がコース名を持たない。そのときだけ補う
                          （CourseTile がサムネ下でコース名を出し分けているのと同じ判断）。 */}
                      {resumeArt.thumbnailUrl && (
                        <div style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.subtle, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {resumeArt.title}
                        </div>
                      )}
                      {/* 主役は「どこまで進んだか」＝単元名。コース名はサムネが持つので繰り返さない。
                          右に「Lesson 2・12分」を添える。かつては下にピンクの「次に学ぶ」ブロックを
                          置いていたが、単元名のすぐ横で足りる情報のためにカード1段を使っていた。
                          🔴 単元名は1行 ellipsis にしない。サムネが 184px を占める SP 幅では
                             「基礎を…」で切れて読めなくなる（実測）。2行まで許す。 */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div
                          style={{
                            fontSize: 'var(--dc-fs-title)', fontWeight: t.font.weight.bold, letterSpacing: '-.01em', lineHeight: 'var(--dc-lh-heading)',
                            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
                          }}
                        >
                          {nextLesson?.sectionName || resumableCourse.currentChapter || resumableCourse.title}
                        </div>
                        {nextLesson && (
                          <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.muted, flexShrink: 0 }}>
                            {[`Lesson ${nextLesson.index}`, nextLesson.minutes && `${nextLesson.minutes}分`].filter(Boolean).join('・')}
                          </span>
                        )}
                      </div>
                      {/* 左カラムが 460px 固定になったので、バーは幅なりで伸びきらない
                          （全幅だった頃は塗りと右端の分数が離れすぎて読み合わせられなかった）。 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
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

                  {/* CTA 行。狭いときは flexWrap で素直に折り返す。 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
              </section>
            )}

            {/* ほかに学習中。ヒーローに出せるのは1コースだけなので、
                並行して進めているコースだけをここで拾う（修了済みは出さない）。 */}
            {otherActive.length > 0 && (
              <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 見出しに件数を出す。畳んでいるときに「これで全部」と読み違えないため */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>ほかに学習中</div>
                  {otherActive.length > OTHER_ACTIVE_VISIBLE && (
                    <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.muted }}>{otherActive.length} コース</span>
                  )}
                </div>
                {/* 🔴 1コース＝1行の一覧にする。カード＋サムネで組むと1件あたり
                       約110px を使い、並行受講が増えるほどここだけが下に伸びて
                       左のヒーロー（約210px）と釣り合わなくなる。行なら1件44px で、
                       3件でもヒーローより低い。ここは「並行して何を進めているか」の
                       早見なので、絵は要らず、名前と残りが分かれば足りる。 */}
                <div style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.tile, boxShadow: t.shadow.card, overflow: 'hidden' }}>
                  {(showAllActive ? otherActive : otherActive.slice(0, OTHER_ACTIVE_VISIBLE)).map((c, i) => {
                    const lessons = lessonProgressFromPercent(c.progress, c.totalLessons);
                    return (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/course/${c.id}/curriculum`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/course/${c.id}/curriculum`); } }}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                          // 行の区切りは枠線1本。カードを並べるより境目が静かで、高さも食わない
                          borderTop: i === 0 ? undefined : `1px solid ${t.color.border.card}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, lineHeight: 'var(--dc-lh-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.title}
                          </span>
                          {/* サムネを外したので、領域はここで文字として持つ */}
                          {c.categoryName && (
                            <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle, flexShrink: 0 }}>{c.categoryName}</span>
                          )}
                        </div>

                        <div style={{ width: 96, height: 6, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ width: `${c.progress ?? 0}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
                        </div>
                        <span
                          title={lessons?.full}
                          style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: t.color.text.muted, flexShrink: 0, minWidth: 34, textAlign: 'right' }}
                        >
                          {lessons ? lessons.short : `${c.progress ?? 0}%`}
                        </span>
                        <ChevronRight size={15} style={{ color: t.color.primary, flexShrink: 0 }} aria-hidden />
                      </div>
                    );
                  })}
                </div>

                {/* 畳んだぶんの開閉。飛び先を持たない「もっと見る」にはしない
                    （この画面がコース一覧そのものなので、送る先が無い）。 */}
                {otherActive.length > OTHER_ACTIVE_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => setShowAllActive((v) => !v)}
                    aria-expanded={showAllActive}
                    className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      background: 'transparent', border: 0, padding: '2px 4px', alignSelf: 'flex-start',
                      color: t.color.primary, fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, cursor: 'pointer',
                    }}
                  >
                    {showAllActive ? '畳む' : `ほか ${otherActive.length - OTHER_ACTIVE_VISIBLE} コースを表示`}
                  </button>
                )}
              </section>
            )}
          </div>
        )}

        {/* ④ 教材をさがすツールバー（AI検索 ＋ 絞り込み）。
            ============================================================
            🔴 かつてはピンクの帯に見出し「ぴったりの教材をさがす」と説明文を並べた
               約140pxのブロックだった。1行の入力に対して場所を取りすぎるという
               レビューで、地色も見出しもやめて1本のツールバーに統合した
               （見出しの役目は placeholder と aria-label が引き受ける）。
            🔴 コース名のキーワード検索にはしない。「配色が苦手」のような相談は
               名前一致では空振りするので、入力はAIに投げる1本のままにする。
            ============================================================ */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <form
              onSubmit={(e) => { e.preventDefault(); runAiSearch(aiQuery); }}
              style={{ position: 'relative', flex: '1 1 320px', minWidth: 0, maxWidth: 460 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.color.text.muted} strokeWidth="1.75" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: 12 }} aria-hidden>
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5-5" />
              </svg>
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="学びたいこと・つまずいていることでさがす"
                aria-label="学びたいこと・つまずいていることから教材をさがす"
                style={{ width: '100%', boxSizing: 'border-box', height: 40, borderRadius: t.radius.pill, border: `1px solid ${t.color.primaryBorder}`, background: t.color.bg.card, padding: '0 78px 0 38px', fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.primary, outline: 'none' }}
              />
              <button
                type="submit"
                disabled={aiState === 'loading' || !aiQuery.trim()}
                className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ position: 'absolute', right: 4, top: 4, height: 32, borderRadius: t.radius.pill, background: aiQuery.trim() ? t.color.primary : t.color.text.subtle, padding: '0 14px', color: '#fff', fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, fontFamily: 'inherit', cursor: aiQuery.trim() ? 'pointer' : 'default' }}
              >
                {aiState === 'loading' ? 'さがし中…' : 'さがす'}
              </button>
            </form>

            <select
              aria-label={`${LEARNING_HIERARCHY.area}で絞り込む`}
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              style={selectStyle}
            >
              <option value={ALL}>{LEARNING_HIERARCHY.area}：すべて</option>
              {sortedAreas.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>

            <select
              aria-label="受講状況で絞り込む"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value={ALL}>受講状況：すべて</option>
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* 受講状況で「修了」を選んでいるときは両立しないので押させない */}
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--dc-fs-body)', color: t.color.text.body,
                cursor: statusFilter === COURSE_STATUS.completed ? 'default' : 'pointer',
                opacity: statusFilter === COURSE_STATUS.completed ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={hideCompleted}
                disabled={statusFilter === COURSE_STATUS.completed}
                onChange={(e) => setHideCompleted(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: t.color.primary, cursor: 'inherit' }}
              />
              修了を隠す
            </label>
          </div>

          {/* 例チップ。入力に用がある間だけ出す（常設の飾りにしない）。
              🔴 onMouseDown で既定動作を止める。止めないと blur が click より先に
                 走ってチップが消え、押せないボタンになる。 */}
          {(searchFocused || aiQuery !== '') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle, flexShrink: 0 }}>例：</span>
              {SEARCH_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setAiQuery(ex); runAiSearch(ex); }}
                  className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: t.color.bg.card, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.pill, padding: '4px 12px', fontSize: 'var(--dc-fs-caption)', fontFamily: 'inherit', color: t.color.text.body }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* AI検索の結果。実BFF（モックOFF）ではこのAPIが無いので、1行のことわりだけ出して一覧に戻す */}
        {aiState === 'error' && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 'var(--dc-fs-body)', color: t.color.text.muted }}>
            いまは教材のおすすめを取得できませんでした。下のコース一覧から探してください。
            <button
              onClick={clearAiSearch}
              className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ background: 'transparent', padding: '2px 4px', fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.muted, textDecoration: 'underline' }}
            >
              閉じる
            </button>
          </div>
        )}

        {aiResult && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>AIが選んだ教材</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--dc-fs-body)', color: t.color.text.muted }}>{aiResult.summary}</div>
              {/* 結果を畳む導線は結果側に置く。ツールバーに常設すると、結果が
                  出ていないときも場所を取る */}
              <button
                onClick={clearAiSearch}
                className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: 'transparent', padding: '2px 4px', flexShrink: 0, fontSize: 'var(--dc-fs-body)', fontFamily: 'inherit', color: t.color.text.muted, textDecoration: 'underline' }}
              >
                結果を閉じる
              </button>
            </div>
            {aiCourses.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
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
            🔴 かつてここは「領域の地図」（領域カードだけを並べ、コースは
               /courses/category/:code の先で見せる2段構え）だった。やめた理由:
               コースが1枚も見えないので、何を学べるところなのかが伝わらなかった。
               いまは領域をブロックにして、その場でコースを並べる。
            🔴 グループ見出し（family = キャリア/制作/構築/グロース/AI）は廃止した。
               「コースの多い領域から先に見せる」ためには family の並びが邪魔になる。
               領域の色・図形サムネは今も family 単位なので、色の手がかりは残っている。
            🔴 並びはコース数の降順。同数のときは courseTaxonomy の宣言順を保つ
               （sort は安定なので、areaCards の順序がそのまま効く）。
            🔴 コースが多い領域は AREA_PREVIEW_LIMIT 件で畳む。畳まないと
               Webデザイン（21コース）だけで画面が埋まり、下の領域に到達しない。
            🔴 コースが1本しかない領域は、領域ページを飛ばして直接コーストップへ。
               カード1枚だけの一覧を作らない（10領域のうち3つが該当）。
            ============================================================ */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.bold, lineHeight: 'var(--dc-lh-heading)' }}>
              {LEARNING_HIERARCHY.area}から探す
            </div>
            {filtering && (
              <>
                <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle }}>
                  絞り込み中 {filteredCount} {LEARNING_HIERARCHY.course}
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'transparent', padding: '2px 4px', fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold, color: t.color.primary }}
                >
                  絞り込みをリセット
                </button>
              </>
            )}
          </div>

          {sortedAreas.length === 0 ? (
            <p style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, margin: 0 }}>
              コースを読み込んでいます…
            </p>
          ) : visibleAreas.length === 0 ? (
            <div className="flex flex-col items-center" style={{ padding: '48px 0', gap: 12 }}>
              <p style={{ fontSize: 'var(--dc-fs-body)', color: t.color.text.muted, margin: 0 }}>
                条件に合うコースが見つかりませんでした。
              </p>
              <button
                onClick={resetFilters}
                className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  background: t.color.bg.card,
                  color: t.color.primary,
                  border: `1px solid ${t.color.primaryBorder}`,
                  borderRadius: t.radius.button,
                  padding: '9px 20px',
                  fontSize: 'var(--dc-fs-body)',
                  fontWeight: t.font.weight.semibold,
                  fontFamily: 'inherit',
                }}
              >
                絞り込みをリセット
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {visibleAreas.map((a) => {
                const expanded = openAreas.has(a.name);
                // 🔴 絞り込み中は畳まない。一致したコースが「すべて見る」の裏に
                //    隠れると、絞り込んだのに見つからないという状態になる
                const foldable = !filtering && a.courses.length > AREA_PREVIEW_LIMIT;
                const shown = foldable && !expanded ? a.courses.slice(0, AREA_PREVIEW_LIMIT) : a.courses;
                const accent = categoryColor(a.name);

                return (
                  <section
                    key={a.name}
                    style={{
                      // ブロックの左に領域色の帯を通す。まとまりの境目はここで見せるので、
                      // 中のコースタイルには枠を足さない（枠の入れ子でうるさくなる）
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: t.radius.card,
                      background: t.color.bg.card,
                      border: `1px solid ${t.color.border.card}`,
                      borderLeftWidth: 3,
                      borderLeftColor: accent,
                      boxShadow: t.shadow.card,
                      padding: '18px 20px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <CourseThumb categoryName={a.name} size={44} radius={12} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 領域名は地図時代の --dc-fs-lead から一段上げる。
                            ブロックの中にコースタイルが並ぶので、同じ大きさだと
                            どこからどこまでが1つの領域なのか読めない。 */}
                        <h3
                          style={{
                            margin: 0,
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 10,
                            flexWrap: 'wrap',
                            fontSize: 'var(--dc-fs-title)',
                            fontWeight: t.font.weight.bold,
                            letterSpacing: '-.01em',
                            lineHeight: 'var(--dc-lh-heading)',
                          }}
                        >
                          {a.name}
                          <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 400, color: t.color.text.subtle }}>
                            {a.count} {LEARNING_HIERARCHY.course}
                          </span>
                          {/* 受講中があれば出す。「どこまで手を付けたか」が並びの上で分かる */}
                          {a.inProgress > 0 && (
                            <span
                              style={{
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
                        </h3>
                        {a.description && (
                          <p
                            style={{
                              margin: '3px 0 0',
                              fontSize: 'var(--dc-fs-caption)',
                              color: t.color.text.muted,
                              lineHeight: 'var(--dc-lh-ui)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {a.description}
                          </p>
                        )}
                      </div>

                      {/* 🔴 見出し右の「この学習領域をすべて見る」は置かない。
                             ブロックの中にその領域のコースが全部（8件超は「すべて見る」で）
                             並んでいるので、行き先が同じ一覧の別ページになるだけだった。
                             押す先はコースタイル1種類に絞る。 */}
                    </div>

                    <div className="wc-area-grid grid" style={{ gap: 14 }}>
                      {shown.map((c) => (
                        <CourseTile
                          key={c.id}
                          course={c}
                          onClick={() => navigate(`/course/${c.id}/curriculum`)}
                        />
                      ))}
                    </div>

                    {foldable && (
                      <button
                        type="button"
                        onClick={() => toggleArea(a.name)}
                        aria-expanded={expanded}
                        className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: '100%',
                          minHeight: 40,
                          background: 'transparent',
                          border: `1px solid ${t.color.border.card}`,
                          borderRadius: t.radius.button,
                          fontFamily: 'inherit',
                          fontSize: 'var(--dc-fs-body)',
                          fontWeight: t.font.weight.bold,
                          color: t.color.primary,
                        }}
                      >
                        {expanded
                          ? '閉じる'
                          : `すべて見る（${a.count} ${LEARNING_HIERARCHY.course}）`}
                        <ChevronDown
                          size={14}
                          aria-hidden
                          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                        />
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default MaterialsTopPage;
