import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppHeader } from '../shared';
import { CourseTile } from './CourseTile';
import { CourseThumb, categoryColor, categoryTint } from './courseVisuals';
import { buildCatalog, type CatalogCourse } from './catalogCourse';
import { useAuth } from '../../contexts/AuthContext';
import { useMypageData } from '../../hooks/useMypageData';
import { bffClient } from '../../services/bffClient';
import { t } from '../../theme/tokens';
import { LEARNING_HIERARCHY } from '../../constants/learningTaxonomy';
import {
  COURSE_KIND,
  CourseKind,
  areaByCode,
  courseKindOf,
} from '../../constants/courseTaxonomy';

/**
 * 学習領域のコース一覧（/courses/category/:categoryId）。
 *
 * 学習トップは「領域が並ぶ構造の地図」に寄せたので、絞り込み・並び替えのある
 * 一覧はこちらが受け持つ。＝「まず領域を選んで、その中から選ぶ」の2段。
 *
 * 🔴 旧 CategoryDetailPage の作り直し。あちらは 7色のハードコードを
 *    categoryId % 7 で回し、廃止済みの難易度（基礎/応用/発展）に依存していた。
 *    色は family（t.color.category）、種類は courseKindOf に揃えている。
 *
 * URLパラメータは領域code（11/21/…）。実BFFが独自のカテゴリ名を返す場合に
 * 備えて、codeで引けなければ領域名そのものとしても解釈する。
 */

const ALL = 'すべて';

const KINDS: readonly CourseKind[] = [COURSE_KIND.basic, COURSE_KIND.practice];

const SORTS = [
  { key: 'recommended', label: 'おすすめ順' },
  { key: 'inProgress', label: '受講中を先に' },
  { key: 'short', label: 'レッスン数が少ない順' },
] as const;
type SortKey = typeof SORTS[number]['key'];

/** 学習トップと同じ素の select。角丸は control(9px) で「その場で絞る」側の形 */
const selectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: `${t.color.bg.card} no-repeat right 12px center`,
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8082\' stroke-width=\'2.2\' stroke-linecap=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  border: `1px solid ${t.color.border.card}`,
  borderRadius: t.radius.control,
  padding: '7px 30px 7px 14px',
  fontSize: 12.5,
  fontFamily: 'inherit',
  color: t.color.text.primary,
  cursor: 'pointer',
  outline: 'none',
};

function AreaCoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { resumableCourse, activeCourses } = useMypageData(user?.userid);

  const [catalog, setCatalog] = useState<CatalogCourse[] | null>(null);

  const [kind, setKind] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>('recommended');

  /** 領域。codeで引けなければ、パラメータを領域名として扱う */
  const area = useMemo(() => {
    const code = Number(categoryId);
    const byCode = Number.isFinite(code) ? areaByCode(code) : undefined;
    if (byCode) return { name: byCode.name, description: byCode.description };
    const name = decodeURIComponent(categoryId ?? '');
    return name ? { name, description: '' } : null;
  }, [categoryId]);

  useEffect(() => {
    let alive = true;
    bffClient
      .getCourses()
      .then((raw: any[]) => {
        if (alive) setCatalog(buildCatalog(raw, activeCourses, resumableCourse));
      })
      .catch(() => {
        if (alive) setCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, [activeCourses, resumableCourse]);

  /** この領域のコース。領域名で引く（カタログが持つのは categoryname） */
  const areaCourses = useMemo(
    () => (catalog ?? []).filter((c) => c.categoryName === area?.name),
    [catalog, area?.name]
  );

  /** 実践課題が1件も無いなら種類プルダウンを出さない（空振りする選択肢を並べない） */
  const hasPractice = useMemo(
    () => areaCourses.some((c) => courseKindOf(c) === COURSE_KIND.practice),
    [areaCourses]
  );

  const filtered = useMemo(() => {
    const list = areaCourses.filter((c) => kind === ALL || courseKindOf(c) === kind);
    if (sort === 'inProgress') {
      return [...list].sort(
        (a, b) =>
          Number(b.progress > 0 && b.progress < 100) - Number(a.progress > 0 && a.progress < 100)
      );
    }
    if (sort === 'short') {
      return [...list].sort((a, b) => (a.totalLessons ?? 99) - (b.totalLessons ?? 99));
    }
    return list; // おすすめ順＝カタログの並び（カリキュラム順）
  }, [areaCourses, kind, sort]);

  const loading = catalog === null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.color.bg.page }}>
      <AppHeader userName={user?.username} />

      <main
        className="wc-page flex flex-col"
        style={
          {
            '--wc-page-max': '1140px',
            flex: 1,
            gap: 20,
            fontFamily: t.font.family,
            color: t.color.text.primary,
          } as React.CSSProperties
        }
      >
        {/* パンくず。学習トップへ戻る導線をここに置く（サイドバーの「学習する」も同じ場所へ） */}
        <nav aria-label="現在の位置" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="appearance-none border-0 outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              background: 'transparent',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: t.font.weight.black,
              color: t.color.primary,
            }}
          >
            学習する
          </button>
          <ChevronRight size={13} aria-hidden style={{ color: t.color.text.subtle }} />
          <span style={{ color: t.color.text.muted }}>{area?.name ?? '学習領域'}</span>
        </nav>

        {!area ? (
          <p style={{ fontSize: 13, color: t.color.text.muted }}>
            この{LEARNING_HIERARCHY.area}は見つかりませんでした。
          </p>
        ) : (
          <>
            {/* ── 領域のヘッダー ── */}
            <section
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 20px',
                background: t.color.bg.card,
                border: `1px solid ${t.color.border.card}`,
                borderRadius: t.radius.card,
              }}
            >
              <CourseThumb categoryName={area.name} size={52} radius={14} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ margin: 0, fontSize: 20, fontWeight: t.font.weight.black }}>{area.name}</h1>
                  <span style={{ fontSize: 12, color: t.color.text.subtle }}>
                    {areaCourses.length} {LEARNING_HIERARCHY.course}
                  </span>
                </div>
                {area.description && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: t.color.text.muted, lineHeight: 1.7 }}>
                    {area.description}
                  </p>
                )}
              </div>
            </section>

            {/* ── 絞り込みと並び替え。領域はURLで決まっているので領域プルダウンは無い ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>
                コースを選ぶ
                {kind !== ALL && (
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: t.color.text.subtle }}>
                    絞り込み中 {filtered.length} {LEARNING_HIERARCHY.course}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {hasPractice && (
                  <select aria-label="種類" value={kind} onChange={(e) => setKind(e.target.value)} style={selectStyle}>
                    <option value={ALL}>種類：すべて</option>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        種類：{k}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label="並び替え"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  style={selectStyle}
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      並び替え：{s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <p style={{ fontSize: 13, color: t.color.text.muted }}>読み込んでいます…</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center" style={{ padding: '48px 0', gap: 12 }}>
                <p style={{ fontSize: 13, color: t.color.text.muted, margin: 0 }}>
                  条件に合うコースが見つかりませんでした。
                </p>
                {kind !== ALL && (
                  <button
                    onClick={() => setKind(ALL)}
                    className="appearance-none outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      background: t.color.bg.card,
                      color: t.color.primary,
                      border: `1px solid ${t.color.primaryBorder}`,
                      borderRadius: t.radius.button,
                      padding: '9px 20px',
                      fontSize: 12.5,
                      fontWeight: t.font.weight.black,
                      fontFamily: 'inherit',
                    }}
                  >
                    絞り込みをリセット
                  </button>
                )}
              </div>
            ) : (
              <div className="wc-area-grid grid" style={{ gap: 14 }}>
                {filtered.map((c) => (
                  <CourseTile key={c.id} course={c} onClick={() => navigate(`/course/${c.id}/curriculum`)} />
                ))}
              </div>
            )}

            {/* 領域色の細い線で、この一覧がどの領域のものかを下端でも示す */}
            <div
              aria-hidden
              style={{
                height: 3,
                borderRadius: 2,
                background: categoryTint(area.name),
                borderTop: `1px solid ${categoryColor(area.name)}22`,
                marginTop: 4,
              }}
            />
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: t.color.text.subtle, marginTop: 4 }}>
          © 2026 WEBCOACH
        </p>
      </main>
    </div>
  );
}

export default AreaCoursesPage;
