/**
 * dev/kanegae から移した画面が呼ぶ「実BFF の形」の API のモック。
 * ============================================================
 * dev/kanegae は実バックエンドにつないで作られているので、学習セッション・マイノート・
 * ロードマップなどを実BFF のパス（/api/study/*・/api/my-note/* など）で呼ぶ。
 * dev/miyabe はモックで全画面が動く前提なので、その口をここで受ける（2026-09-30 同期時に追加）。
 *
 * 🔴 学習時間の数字は studyActivityHandlers.ts の学習アクティビティを唯一の集計元にする。
 *    ここで別の保存場所から数えると、学習記録・集中ブース・マイページで数字が食い違う。
 *    start/end で覚えるのは「いま計測中か」だけ（記録そのものは study-activities 側に入る）。
 * 🔴 保存はすべて localStorage。再読み込みしても残り、「保存できた」を画面で確かめられるようにする。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import type { MyNote, MyNoteFolder, RoadmapPhase, RoadmapSkill, UserRoadmap } from '../types/api';
import type { StudyActivity } from '../types/studyActivity';
import { activitiesOf, currentStreakInfo } from './studyActivityHandlers';
import { STUDY_PEERS } from './studyPeers';

// ---- localStorage の小さな器 ---------------------------------------------

function load<T>(key: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* 壊れていたら作り直す */
  }
  const v = seed();
  save(key, v);
  return v;
}
function save<T>(key: string, v: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 容量超過などは無視（モックなので記録できなくても画面は動く） */
  }
}
const nowIso = () => new Date().toISOString();
const uid = (params: Record<string, unknown>) => Number(params.userid) || 2;
const noContent = () => new HttpResponse(null, { status: 204 });

// ---- 学習セッション（/api/study/*） ---------------------------------------

const ACTIVE_KEY = 'webcoach-mock-study-active';
type ActiveState = { courseid: number | null; started_at: string } | null;

const minutesOf = (a: StudyActivity) => a.session?.durationMinutes ?? 0;
const toSession = (a: StudyActivity) => ({
  courseid: a.course?.courseId ?? null,
  started_at: a.startedAt,
  ended_at: a.endedAt,
  duration_minutes: minutesOf(a),
});
const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  const day = (s.getDay() + 6) % 7; // 月曜始まり
  s.setDate(s.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

const studyHandlers = [
  http.post('*/api/study/sessions/:userid/start', async ({ request }) => {
    let courseid: number | null = null;
    try {
      courseid = ((await request.json()) as { courseid?: number }).courseid ?? null;
    } catch {
      /* 本文なし */
    }
    const cur = load<ActiveState>(ACTIVE_KEY, () => null);
    if (!cur) save<ActiveState>(ACTIVE_KEY, { courseid, started_at: nowIso() });
    return noContent();
  }),
  http.post('*/api/study/sessions/:userid/end', () => {
    save<ActiveState>(ACTIVE_KEY, null);
    return noContent();
  }),
  // 補正は study-activities 側の記録を直すのが本筋。ここでは受け付けるだけ
  http.post('*/api/study/sessions/:userid/correct', () => noContent()),
  http.get('*/api/study/sessions/:userid/active', () => {
    const cur = load<ActiveState>(ACTIVE_KEY, () => null);
    return cur ? HttpResponse.json(cur) : HttpResponse.json({ detail: 'no active session' }, { status: 404 });
  }),
  http.get('*/api/study/sessions/:userid/recent', ({ params, request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 10);
    const list = [...activitiesOf(uid(params))]
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .slice(0, limit)
      .map(toSession);
    return HttpResponse.json(list);
  }),
  http.get('*/api/study/sessions/:userid/by-date', ({ params, request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? '';
    return HttpResponse.json(activitiesOf(uid(params)).filter((a) => a.localDate === date).map(toSession));
  }),
  http.get('*/api/study/stats/:userid', ({ params }) => {
    const acts = activitiesOf(uid(params));
    const now = new Date();
    const today = localDateKey(now);
    const weekStart = localDateKey(startOfWeek(now));
    const sum = (f: (a: StudyActivity) => boolean) => acts.filter(f).reduce((n, a) => n + minutesOf(a), 0);
    return HttpResponse.json({
      userid: uid(params),
      today_minutes: sum((a) => a.localDate === today),
      week_minutes: sum((a) => a.localDate >= weekStart),
      total_minutes: sum(() => true),
    });
  }),
  http.get('*/api/study/streak/:userid', ({ params }) => {
    const acts = activitiesOf(uid(params));
    const last = acts.map((a) => a.localDate).sort().pop() ?? null;
    return HttpResponse.json({ userid: uid(params), current_streak: currentStreakInfo(uid(params)).days, last_active_date: last });
  }),
  http.get('*/api/study/calendar/:userid', ({ params, request }) => {
    const sp = new URL(request.url).searchParams;
    const year = Number(sp.get('year')) || new Date().getFullYear();
    const month = Number(sp.get('month')) || new Date().getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const byDay = new Map<string, { total_minutes: number; session_count: number }>();
    activitiesOf(uid(params))
      .filter((a) => a.localDate.startsWith(prefix))
      .forEach((a) => {
        const d = byDay.get(a.localDate) ?? { total_minutes: 0, session_count: 0 };
        d.total_minutes += minutesOf(a);
        d.session_count += 1;
        byDay.set(a.localDate, d);
      });
    const days = Array.from(byDay.entries()).sort().map(([date, v]) => ({ date, ...v }));
    return HttpResponse.json({ userid: uid(params), year, month, days });
  }),
  // 実BFF形のランキングは userid と分数だけ。自分以外は studyPeers.ts の固定名簿から作る
  http.get('*/api/study/ranking', ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const period = (sp.get('period') as 'week' | 'month' | 'all') || 'week';
    const limit = Number(sp.get('limit') ?? 20);
    const factor = period === 'week' ? 1 : period === 'month' ? 4.3 : 20;
    const me = activitiesOf(2).reduce((n, a) => n + minutesOf(a), 0);
    const rows = [
      { userid: 2, total_minutes: period === 'all' ? me : Math.round(me / (period === 'week' ? 4 : 1)) },
      ...STUDY_PEERS.map((p: any, i: number) => ({
        userid: 100 + i,
        total_minutes: Math.round((p.weeklyMinutes ?? 120 + i * 17) * factor),
      })),
    ]
      .sort((a, b) => b.total_minutes - a.total_minutes)
      .slice(0, limit)
      .map((r, i) => ({ rank: i + 1, ...r }));
    return HttpResponse.json({ period, entries: rows });
  }),
  http.get('*/api/study/course-access/:userid', ({ params }) => {
    const by = new Map<number, { access_count: number; last_accessed: string }>();
    activitiesOf(uid(params)).forEach((a) => {
      if (!a.course) return;
      const c = by.get(a.course.courseId) ?? { access_count: 0, last_accessed: a.endedAt };
      c.access_count += 1;
      if (a.endedAt > c.last_accessed) c.last_accessed = a.endedAt;
      by.set(a.course.courseId, c);
    });
    return HttpResponse.json({ userid: uid(params), courses: Array.from(by.entries()).map(([courseid, v]) => ({ courseid, ...v })) });
  }),
  http.get('*/api/study/course-access/:userid/:courseid/materials', ({ params }) => {
    const courseid = Number(params.courseid);
    const by = new Map<number, { access_count: number; last_accessed: string }>();
    activitiesOf(uid(params)).forEach((a) => {
      if (a.course?.courseId !== courseid || !a.course.lessonId) return;
      const c = by.get(a.course.lessonId) ?? { access_count: 0, last_accessed: a.endedAt };
      c.access_count += 1;
      by.set(a.course.lessonId, c);
    });
    return HttpResponse.json({ userid: uid(params), courseid, materials: Array.from(by.entries()).map(([cmid, v]) => ({ cmid, ...v })) });
  }),
  // 教材の閲覧ログ。記録するだけなので受け付けて終わり
  http.post('*/api/study/modules/:userid/viewed', () => noContent()),
];

// ---- 「前回の続き」の記録 -------------------------------------------------

const resumeHandlers = [
  http.post('*/api/webcoach/resumecourse/:userid', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { courseid?: number; progress_percent?: number };
    return HttpResponse.json({ courseid: body.courseid ?? 0, progress: body.progress_percent ?? 0, lastaccess: Math.floor(Date.now() / 1000) });
  }),
];

// ---- 教材メモ・その日の振り返り -------------------------------------------

const STUDY_NOTE_KEY = 'webcoach-mock-study-note';
const REFLECTION_KEY = 'webcoach-mock-study-reflection';
type NoteMap = Record<string, { content: string; updated_at: string | null }>;
type ReflectionMap = Record<string, { achievement: unknown; memo: string | null; updated_at: string | null }>;

const memoHandlers = [
  http.get('*/api/webcoach/study-note/:userid/:courseid/:cmid', ({ params }) => {
    const all = load<NoteMap>(STUDY_NOTE_KEY, () => ({}));
    return HttpResponse.json(all[`${params.courseid}/${params.cmid}`] ?? { content: '', updated_at: null });
  }),
  http.put('*/api/webcoach/study-note/:userid/:courseid/:cmid', async ({ params, request }) => {
    const body = (await request.json()) as { content: string };
    const all = load<NoteMap>(STUDY_NOTE_KEY, () => ({}));
    const v = { content: body.content ?? '', updated_at: nowIso() };
    all[`${params.courseid}/${params.cmid}`] = v;
    save(STUDY_NOTE_KEY, all);
    return HttpResponse.json(v);
  }),
  http.get('*/api/webcoach/study-reflection/:userid/:date', ({ params }) => {
    const all = load<ReflectionMap>(REFLECTION_KEY, () => ({}));
    const v = all[String(params.date)];
    return HttpResponse.json({
      mdl_user_id: uid(params),
      local_date: String(params.date),
      achievement: v?.achievement ?? null,
      memo: v?.memo ?? null,
      updated_at: v?.updated_at ?? null,
    });
  }),
  http.put('*/api/webcoach/study-reflection/:userid/:date', async ({ params, request }) => {
    const body = (await request.json()) as { achievement: unknown; memo: string | null };
    const all = load<ReflectionMap>(REFLECTION_KEY, () => ({}));
    all[String(params.date)] = { achievement: body.achievement ?? null, memo: body.memo ?? null, updated_at: nowIso() };
    save(REFLECTION_KEY, all);
    return HttpResponse.json({ mdl_user_id: uid(params), local_date: String(params.date), ...all[String(params.date)] });
  }),
  http.delete('*/api/webcoach/study-reflection/:userid/:date', ({ params }) => {
    const all = load<ReflectionMap>(REFLECTION_KEY, () => ({}));
    delete all[String(params.date)];
    save(REFLECTION_KEY, all);
    return noContent();
  }),
];

// ---- マイノート（/api/my-note/*） -----------------------------------------
// 実API と同じく 1ノート＝1行。本文と素材は contents（Markdown 1列）に入る（utils/noteMarkdown.ts）。

const NOTES_KEY = 'webcoach-mock-my-notes';
type NoteStore = { notes: MyNote[]; folders: MyNoteFolder[]; seq: number };

function seedNotes(): NoteStore {
  const t = nowIso();
  const base = { mdl_user_id: 2, courseid: null, cmid: null, favorite: 0, from_ai: 0, from_coaching: 0, created_at: t, updated_at: t };
  return {
    seq: 10,
    folders: [{ folder_id: 1, mdl_user_id: 2, name: '学習メモ', parent_folder_id: null, created_at: t, updated_at: t }],
    notes: [
      { ...base, noteid: 1, folder_id: 1, title: 'Figma の基本操作', contents: '## オートレイアウト\n- Shift + A で追加\n- [ ] 余白を 16px にそろえる\n==よく使う==' },
      { ...base, noteid: 2, folder_id: null, favorite: 1, title: '配色のコツ', contents: '- メインカラーは1色に絞る\n- 文字色はコントラストを確認する' },
      { ...base, noteid: 3, folder_id: null, from_coaching: 1, title: 'コーチングで話したこと', contents: '次回までにポートフォリオを1ページ作る' },
    ],
  };
}
const notesStore = () => load<NoteStore>(NOTES_KEY, seedNotes);

const noteHandlers = [
  http.get('*/api/my-note/folders/:userid', () => HttpResponse.json(notesStore().folders)),
  http.post('*/api/my-note/folders/:userid', async ({ params, request }) => {
    const body = (await request.json()) as { name: string; parent_folder_id?: number | null };
    const s = notesStore();
    s.seq += 1;
    const t = nowIso();
    const f: MyNoteFolder = { folder_id: s.seq, mdl_user_id: uid(params), name: body.name, parent_folder_id: body.parent_folder_id ?? null, created_at: t, updated_at: t };
    s.folders.push(f);
    save(NOTES_KEY, s);
    return HttpResponse.json(f, { status: 201 });
  }),
  http.put('*/api/my-note/folders/:userid/:folderId', async ({ params, request }) => {
    const body = (await request.json()) as Partial<MyNoteFolder>;
    const s = notesStore();
    const f = s.folders.find((x) => x.folder_id === Number(params.folderId));
    if (!f) return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    Object.assign(f, body, { updated_at: nowIso() });
    save(NOTES_KEY, s);
    return HttpResponse.json(f);
  }),
  // 実API と同じく、消したフォルダの中のノートは未整理（folder_id=null）に戻す
  http.delete('*/api/my-note/folders/:userid/:folderId', ({ params }) => {
    const s = notesStore();
    const id = Number(params.folderId);
    s.folders = s.folders.filter((f) => f.folder_id !== id);
    s.notes.forEach((n) => { if (n.folder_id === id) n.folder_id = null; });
    save(NOTES_KEY, s);
    return noContent();
  }),
  http.get('*/api/my-note/notes/:userid', ({ request }) => {
    const sp = new URL(request.url).searchParams;
    let list = notesStore().notes;
    if (sp.has('folder_id')) {
      const f = Number(sp.get('folder_id'));
      list = list.filter((n) => (f === 0 ? n.folder_id == null : n.folder_id === f));
    }
    if (sp.has('cmid')) list = list.filter((n) => n.cmid === Number(sp.get('cmid')));
    return HttpResponse.json(list);
  }),
  http.post('*/api/my-note/notes/:userid', async ({ params, request }) => {
    const body = (await request.json()) as Partial<MyNote>;
    const s = notesStore();
    s.seq += 1;
    const t = nowIso();
    const n: MyNote = {
      noteid: s.seq, mdl_user_id: uid(params), folder_id: body.folder_id ?? null, courseid: body.courseid ?? null,
      cmid: body.cmid ?? null, favorite: body.favorite ?? 0, from_ai: body.from_ai ?? 0, from_coaching: body.from_coaching ?? 0,
      title: body.title ?? '無題のノート', contents: body.contents ?? '', created_at: t, updated_at: t,
    };
    s.notes.unshift(n);
    save(NOTES_KEY, s);
    return HttpResponse.json(n, { status: 201 });
  }),
  http.get('*/api/my-note/notes/:userid/:noteId', ({ params }) => {
    const n = notesStore().notes.find((x) => x.noteid === Number(params.noteId));
    return n ? HttpResponse.json(n) : HttpResponse.json({ detail: 'not found' }, { status: 404 });
  }),
  http.put('*/api/my-note/notes/:userid/:noteId', async ({ params, request }) => {
    const body = (await request.json()) as Partial<MyNote>;
    const s = notesStore();
    const n = s.notes.find((x) => x.noteid === Number(params.noteId));
    if (!n) return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    Object.assign(n, body, { updated_at: nowIso() });
    save(NOTES_KEY, s);
    return HttpResponse.json(n);
  }),
  http.delete('*/api/my-note/notes/:userid/:noteId', ({ params }) => {
    const s = notesStore();
    s.notes = s.notes.filter((x) => x.noteid !== Number(params.noteId));
    save(NOTES_KEY, s);
    return noContent();
  }),
];

// ---- キャリアロードマップ（/api/roadmap/*） -------------------------------

const ROADMAP_KEY = 'webcoach-mock-roadmap';
const SKILLS: RoadmapSkill[] = [
  { id: 1, code: 'web-design', name: 'Webデザイン', goal_label: 'Webデザイナーとして案件を受ける', display_order: 1 },
  { id: 2, code: 'video', name: '動画編集', goal_label: '動画編集の案件を受ける', display_order: 2 },
  { id: 3, code: 'marketing', name: 'Webマーケティング', goal_label: 'SNS運用の案件を受ける', display_order: 3 },
];
const PHASE_NAMES = ['基礎を固める', '作品をつくる', 'ポートフォリオを整える', '案件に応募する'];
const phasesOf = (skillId: number): RoadmapPhase[] =>
  PHASE_NAMES.map((name, i) => ({
    id: skillId * 10 + i + 1,
    skill_id: skillId,
    phase_no: i + 1,
    name,
    goal: `${name}ところまで進める`,
    milestone: i === 3 ? '初案件の獲得' : `${name}の完了`,
    duration_days: 14 + i * 7,
    todos: [1, 2].map((todo_no) => ({ phase_id: skillId * 10 + i + 1, todo_no, description: `${name}のためのやること ${todo_no}` })),
  }));
function buildUserRoadmap(userId: number, skillId: number): UserRoadmap {
  const skill = SKILLS.find((s) => s.id === skillId) ?? SKILLS[0];
  return {
    id: 1, mdl_user_id: userId, skill_id: skill.id, is_completed: false, skill, target_date: null,
    phases: phasesOf(skill.id).map((phase, i) => ({
      id: phase.id, user_roadmap_id: 1, phase_id: phase.id,
      status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'not_started',
      start: null, end: null, updated_by: null, phase,
    })),
  };
}

const roadmapHandlers = [
  http.get('*/api/roadmap/skills', () => HttpResponse.json(SKILLS)),
  http.get('*/api/roadmap/phases', ({ request }) =>
    HttpResponse.json(phasesOf(Number(new URL(request.url).searchParams.get('skill_id')) || 1))
  ),
  http.get('*/api/roadmap/users/:userid', ({ params }) => {
    const r = load<UserRoadmap | null>(ROADMAP_KEY, () => buildUserRoadmap(uid(params), 1));
    return r ? HttpResponse.json(r) : HttpResponse.json({ detail: 'not started' }, { status: 404 });
  }),
  http.post('*/api/roadmap/users/:userid', async ({ params, request }) => {
    const body = (await request.json()) as { skill_id: number };
    const r = buildUserRoadmap(uid(params), body.skill_id);
    save(ROADMAP_KEY, r);
    return HttpResponse.json(r, { status: 201 });
  }),
  http.put('*/api/roadmap/progress/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const r = load<UserRoadmap | null>(ROADMAP_KEY, () => buildUserRoadmap(2, 1));
    const p = r?.phases.find((x) => x.id === Number(params.id));
    if (!r || !p) return HttpResponse.json({ detail: 'not found' }, { status: 404 });
    Object.assign(p, body);
    save(ROADMAP_KEY, r);
    return HttpResponse.json(p);
  }),
  http.get('*/api/roadmap/questions/:reviewNo', ({ params }) =>
    HttpResponse.json(
      ['今のフェーズで一番時間がかかっていることは？', '次のフェーズまでに身につけたいことは？'].map((question, i) => ({
        review_no: Number(params.reviewNo), question_no: i + 1, question,
      }))
    )
  ),
  http.post('*/api/roadmap/users/:userid/answers', async ({ params, request }) => {
    const body = (await request.json()) as { review_no: number; answers: { question_no: number; answer: string }[] };
    return HttpResponse.json(
      body.answers.map((a) => ({ mdl_user_id: uid(params), review_no: body.review_no, ...a, created_at: nowIso() })),
      { status: 201 }
    );
  }),
];

// ---- 連携・AIチャットの補助 -----------------------------------------------

const miscHandlers = [
  http.get('*/api/integrations/organizer/status', () => HttpResponse.json({ provider: 'google', connected: false, providerAccountEmail: null })),
  // モックでは外部の認可画面へは飛ばさない
  http.get('*/api/integrations/organizer/:provider/authorize', () => HttpResponse.json({ authorizeUrl: '#mock-organizer-authorize' })),
  // モックの /webcoach/ai はすぐ答えを返すので、ポーリングと中止は形だけ受ける
  http.get('*/api/webcoach/ai/status/:jobId', () => HttpResponse.json({ status: 'completed', message: '' })),
  http.post('*/api/webcoach/ai/cancel', () => noContent()),
];

export const realApiHandlers = [
  ...studyHandlers,
  ...resumeHandlers,
  ...memoHandlers,
  ...noteHandlers,
  ...roadmapHandlers,
  ...miscHandlers,
];

export default realApiHandlers;
