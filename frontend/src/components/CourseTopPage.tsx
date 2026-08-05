import { useState, useEffect } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import { bffClient } from '../services/bffClient';
import { AppHeader, LearningBreadcrumb, MascotSvg } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { LEARNING_HIERARCHY, lessonLabel, unitLabel } from '../constants/learningTaxonomy';

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

type ModuleKind = 'done' | 'active' | 'locked';

// design_handoff_lms_app の冒険マップ内の6ノード配置（%座標）
const MAP_COORDS = [[56, 86], [34, 74], [54, 62], [32, 48], [56, 36], [58, 24]];

export default function CourseTopPage() {
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
      sections: (Array.isArray(content) ? content : []).filter((s: Section) => s.modules?.length > 0),
      course: (courses as Course[]).find(c => c.id === courseIdNum) ?? null,
    })),
    [courseIdNum],
  );
  const sections: Section[] = data?.sections ?? [];
  const course: Course | null = data?.course ?? null;
  const modules: Module[] = sections.flatMap(s => s.modules);

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
  }, [sections, courseIdNum]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dash-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto" />
          <p className="mt-4 text-sm text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dash-bg">
        <div className="text-center">
          <p className="text-brand">{error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 rounded-full text-white font-medium text-sm bg-brand">戻る</button>
        </div>
      </div>
    );
  }

  const kindOf = (moduleId: number, index: number): ModuleKind => {
    if (completedIds.has(moduleId)) return 'done';
    const firstIncompleteIndex = modules.findIndex(m => !completedIds.has(m.id));
    return index === firstIncompleteIndex ? 'active' : 'locked';
  };

  const progressPercent = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;
  const mapModules = modules.slice(0, MAP_COORDS.length);
  const currentModule = modules.find((m, i) => kindOf(m.id, i) === 'active');

  return (
    <div className="min-h-screen flex flex-col bg-dash-bg">
      <AppHeader userName={user?.username || 'User'} />

      <main className="relative mx-auto flex flex-col" style={{ maxWidth: 1440, paddingTop: 32, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, gap: 20 }}>
        {/* パンくずは常に表示。学習領域からコースまでを辿れるようにする
            （以前の「← コース一覧に戻る」は戻り先が1つだけで、いまどこにいるか分からなかった） */}
        <LearningBreadcrumb
          items={[
            { label: '学習コンテンツ', to: '/courses' },
            course?.categoryname
              ? { label: course.categoryname, to: `/courses/category/${course.categoryid}` }
              : { label: '' },
            { label: course?.fullname ?? LEARNING_HIERARCHY.course },
          ]}
        />

        <div className="flex items-center" style={{ gap: 18 }}>
          <div className="flex-shrink-0" style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(120deg,#F6B4BE,#EE8296)' }} />
          <div className="flex-1 min-w-0">
            <span style={{ background: '#E0213A', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 12px' }}>
              {course?.categoryname || LEARNING_HIERARCHY.area}
            </span>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900 }}>{course?.fullname ?? LEARNING_HIERARCHY.course}</h1>
            <div style={{ fontSize: 12, color: '#B78F98', marginTop: 4 }}>
              全{sections.length}単元・{modules.length}レッスン{course?.summary ? ` ・ ${course.summary.replace(/<[^>]*>/g, '')}` : ''}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ fontSize: 11, color: '#8A767D' }}>コース進捗</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#E0213A' }}>{progressPercent}%</div>
          </div>
          <button
            className="appearance-none flex-shrink-0"
            style={{ background: '#fff', color: '#6B575E', border: '1px solid #EDD8DB', borderRadius: 999, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🗎 コース詳細
          </button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'stretch' }}>
          {/* 冒険マップ */}
          <div className="relative overflow-hidden" style={{ borderRadius: 22, background: 'linear-gradient(175deg,#FBF2DE,#F6E7CD 55%,#F2DFC2)', minHeight: 560 }}>
            <div className="absolute" style={{ left: '8%', top: '6%', width: 130, height: 90, borderRadius: '50%', background: 'radial-gradient(closest-side,#CDE3B4,rgba(205,227,180,0))' }} />
            <div className="absolute" style={{ right: '4%', top: '38%', width: 150, height: 100, borderRadius: '50%', background: 'radial-gradient(closest-side,#D8E8C2,rgba(216,232,194,0))' }} />
            <div className="absolute" style={{ left: '2%', bottom: '8%', width: 170, height: 110, borderRadius: '50%', background: 'radial-gradient(closest-side,#D3E5BC,rgba(211,229,188,0))' }} />

            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M 60 97 C 38 93 26 86 34 78 C 40 72 62 68 58 60 C 54 52 28 54 32 46 C 36 38 62 42 60 34 C 58 26 48 26 50 17" fill="none" stroke="#E4D2B2" strokeWidth="8.5" strokeLinecap="round" />
              <path d="M 60 97 C 38 93 26 86 34 78 C 40 72 62 68 58 60 C 54 52 28 54 32 46 C 36 38 62 42 60 34 C 58 26 48 26 50 17" fill="none" stroke="#FBF6EA" strokeWidth="7" strokeLinecap="round" />
              <path d="M 60 97 C 38 93 26 86 34 78 C 40 72 62 68 58 60 C 54 52 28 54 32 46 C 36 38 62 42 60 34 C 58 26 48 26 50 17" fill="none" stroke="#E8D9C2" strokeWidth="0.7" strokeDasharray="2 2.4" />
            </svg>

            <svg className="absolute" style={{ left: '50%', top: '2%', transform: 'translateX(-50%)' }} width="150" height="112" viewBox="0 0 150 112">
              <ellipse cx="75" cy="102" rx="62" ry="12" fill="#BFDCA4" />
              <rect x="30" y="52" width="22" height="48" rx="3" fill="#F3EDF5" stroke="#DCC9E0" />
              <polygon points="27,54 41,30 55,54" fill="#B394CC" />
              <rect x="98" y="52" width="22" height="48" rx="3" fill="#F3EDF5" stroke="#DCC9E0" />
              <polygon points="95,54 109,30 123,54" fill="#B394CC" />
              <rect x="52" y="42" width="46" height="58" rx="4" fill="#F8F3F9" stroke="#DCC9E0" />
              <polygon points="49,44 75,12 101,44" fill="#9F7CC4" />
              <line x1="75" y1="12" x2="75" y2="2" stroke="#8A6A55" strokeWidth="2" />
              <path d="M75 2 l14 4 -14 4 z" fill="#E0213A" />
              <path d="M66 100 v-16 a9 9 0 0 1 18 0 v16 z" fill="#C9A8D8" />
              <rect x="60" y="58" width="7" height="10" rx="3" fill="#C9A8D8" />
              <rect x="83" y="58" width="7" height="10" rx="3" fill="#C9A8D8" />
              <text x="34" y="26" fontSize="11" fill="#E9C46A">✦</text>
              <text x="112" y="20" fontSize="9" fill="#E9C46A">✦</text>
            </svg>

            <svg className="absolute" style={{ left: '7%', top: '56%' }} width="40" height="52" viewBox="0 0 40 52"><rect x="17" y="30" width="6" height="18" rx="2" fill="#A97C55" /><circle cx="20" cy="20" r="14" fill="#8FBF75" /><circle cx="12" cy="27" r="8" fill="#A2CB88" /></svg>
            <svg className="absolute" style={{ right: '8%', top: '64%' }} width="34" height="46" viewBox="0 0 40 52"><rect x="17" y="30" width="6" height="18" rx="2" fill="#A97C55" /><circle cx="20" cy="20" r="14" fill="#9CC782" /></svg>
            <svg className="absolute" style={{ right: '6%', top: '26%' }} width="30" height="40" viewBox="0 0 40 52"><rect x="17" y="30" width="6" height="18" rx="2" fill="#A97C55" /><circle cx="20" cy="20" r="14" fill="#8FBF75" /></svg>
            <svg className="absolute" style={{ left: '14%', top: '28%' }} width="26" height="36" viewBox="0 0 40 52"><rect x="17" y="30" width="6" height="18" rx="2" fill="#A97C55" /><circle cx="20" cy="20" r="14" fill="#A2CB88" /></svg>
            <svg className="absolute" style={{ right: '18%', bottom: '6%' }} width="38" height="50" viewBox="0 0 40 52"><rect x="17" y="30" width="6" height="18" rx="2" fill="#A97C55" /><circle cx="20" cy="20" r="14" fill="#8FBF75" /><circle cx="28" cy="26" r="8" fill="#A2CB88" /></svg>

            <span
              className="absolute"
              style={{ left: '78%', bottom: '2.5%', transform: 'translateX(-50%) rotate(-4deg)', background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', fontSize: 12, fontWeight: 900, letterSpacing: '.14em', borderRadius: 8, padding: '7px 20px', boxShadow: '0 8px 18px rgba(224,33,58,.3)' }}
            >
              START
            </span>

            {mapModules.map((m, i) => {
              const [x, y] = MAP_COORDS[i];
              const kind = kindOf(m.id, i);
              const locked = kind === 'locked';
              return (
                <div
                  key={m.id}
                  onClick={locked ? undefined : () => navigate(`/course/${courseIdNum}?module=${m.id}`)}
                  className="absolute flex items-center"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', gap: 8, zIndex: 2, cursor: locked ? undefined : 'pointer' }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={
                      kind === 'done'
                        ? { width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(140deg,#F0546A,#E0213A)', color: '#fff', fontSize: 13, fontWeight: 900, border: '2.5px solid #fff', boxShadow: '0 5px 12px rgba(224,33,58,.3)' }
                        : kind === 'active'
                          ? { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(140deg,#F0546A,#E0213A)', color: '#fff', fontSize: 17, fontWeight: 900, border: '3px solid #fff', boxShadow: '0 8px 18px rgba(224,33,58,.4)', animation: 'wcPulse 3s ease-in-out infinite' }
                          : { width: 28, height: 28, borderRadius: '50%', background: '#fff', color: '#B7A0A7', fontSize: 12, fontWeight: 900, border: '2px solid #E8DCCB' }
                    }
                  >
                    {kind === 'done' ? '✓' : String(i + 1)}
                  </span>
                  <span
                    className="whitespace-nowrap"
                    style={{
                      background: 'rgba(255,255,255,.95)', borderRadius: 999, padding: '6px 13px', fontSize: 11.5, fontWeight: 900,
                      boxShadow: '0 5px 14px rgba(120,80,40,.12)',
                      color: kind === 'active' ? '#E0213A' : kind === 'locked' ? '#B7A0A7' : '#3A2F35',
                    }}
                  >
                    {m.name}
                    <span style={{ marginLeft: 6 }}>{kind === 'done' ? '✔' : kind === 'locked' ? '🔒' : '▶'}</span>
                  </span>
                </div>
              );
            })}

            <div className="absolute" style={{ top: 16, left: 16, background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '10px 16px', boxShadow: '0 6px 16px rgba(120,60,90,.14)' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#8A767D' }}>GOAL</div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>課題デザインに挑戦！</div>
            </div>
            <div className="absolute" style={{ top: '20%', left: 16, background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '10px 16px', boxShadow: '0 6px 16px rgba(120,60,90,.12)' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#E0213A' }}>クエストクリアで<br />バッジ&EXP獲得！</div>
              <div style={{ fontSize: 15, marginTop: 6 }}>🪙 <span style={{ fontSize: 11, fontWeight: 700, color: '#B98A16' }}>+100</span>　🏅</div>
            </div>
            <div className="absolute flex items-end" style={{ bottom: 18, left: 18, gap: 10 }}>
              <MascotSvg size={62} pulse />
              <div style={{ background: '#fff', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', fontSize: 13, fontWeight: 700, lineHeight: 1.6, boxShadow: '0 8px 20px rgba(120,60,90,.14)' }}>
                {currentModule ? <>あと{Math.max(1, modules.length - completedIds.size)}レッスンで<br />このクエストをクリアできるよ！</> : 'このコースをクリアしたよ！お疲れさま！'}
              </div>
            </div>
          </div>

          {/* 単元ごとのレッスンリスト。
              以前は単元を無視して全レッスンを平らに並べていたため、コースの中の
              テーマの区切り（単元）が受講生に見えていなかった。 */}
          <div className="bg-white flex flex-col" style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 14, gap: 8 }}>
            {sections.map((section, sectionIndex) => (
              <div key={section.id} className="flex flex-col" style={{ gap: 8 }}>
                <div style={{ padding: '8px 18px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#C08A96', letterSpacing: '.08em' }}>
                    {unitLabel(sectionIndex + 1)}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 900, color: '#3A2F35' }}>{section.name}</div>
                </div>
                {section.modules.map((m) => {
              // ロック判定と番号はコース全体の並び（modules）を基準にする。
              // 単元ごとに1から振り直すと、進行順とレッスン番号がずれてしまう。
              const i = modules.findIndex((x) => x.id === m.id);
              const kind = kindOf(m.id, i);
              const locked = kind === 'locked';
              return (
                <div
                  key={m.id}
                  onClick={locked ? undefined : () => navigate(`/course/${courseIdNum}?module=${m.id}`)}
                  className="flex items-center"
                  style={{
                    gap: 14, padding: '16px 18px', borderRadius: 16,
                    border: kind === 'active' ? '1.5px solid #E0213A' : undefined,
                    background: kind === 'active' ? '#FFF7F8' : undefined,
                    opacity: locked ? 0.55 : 1,
                    cursor: locked ? undefined : 'pointer',
                  }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={
                      kind === 'done'
                        ? { width: 34, height: 34, borderRadius: '50%', background: '#2FA35C', color: '#fff', fontSize: 14 }
                        : kind === 'active'
                          ? { width: 34, height: 34, borderRadius: '50%', background: '#E0213A', color: '#fff', fontSize: 12 }
                          : { width: 34, height: 34, borderRadius: '50%', background: '#F3E7EA', color: '#B7A0A7', fontSize: 13 }
                    }
                  >
                    {kind === 'done' ? '✓' : kind === 'active' ? '▶' : '🔒'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#C08A96' }}>{lessonLabel(i + 1)}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: kind === 'locked' ? '#B7A0A7' : '#20141A' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#B7A0A7', marginTop: 2 }}>
                      {kind === 'done' ? '完了' : kind === 'active' ? '学習中' : 'ロック中'}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: kind === 'done' ? '#2FA35C' : kind === 'active' ? '#E0213A' : '#C9B4BB' }}>
                    {kind === 'done' ? '✓' : kind === 'active' ? '▶' : '🔒'}
                  </span>
                </div>
              );
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="font-bold text-white" style={{ fontSize: '11.4px', letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
