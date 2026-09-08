/**
 * MSW: コーチ画面（/coach/schedule/:studentId、/coach/settings）が使うAPIのモック。
 * ============================================================
 * 🔴 mocks/coachingHandlers.ts とは別系統。あちらは受講生側の /coaching が使う
 *    招待URL型のモックAPI（/api/webcoach/coaching-sessions/*）で、こちらは
 *    コーチ画面が使う /api/coaching/schedule/* と /api/coaching/notes/*。
 *    実BFF側は dev/kanegae で実装済みだが、このブランチはデザイン統一が目的で
 *    実BFFに繋がないため、フロント側にモックを置いて画面を出せるようにしている。
 *
 * ストアはモジュールスコープの配列。リロードで毎回同じ種に戻るので、
 * デザイン確認では「全パターンが必ず1画面に出る」状態を保てる。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import type {
  CoachingSchedule,
  CoachingNote,
  CreateCoachingScheduleRequest,
  UpdateCoachingScheduleRequest,
  UpdateCoachingNoteRequest,
} from '../types/api';

/** handlers.ts の studentsStore と同じ受講生ID。501=佐藤花子 / 502=田中一郎 */
const STUDENT_HANAKO = 501;
const STUDENT_ICHIRO = 502;
/** 擬似ログインユーザー（mockAuth の userid）をコーチとして扱う */
const MOCK_COACH_USER_ID = 2;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 種データ。ステータス3種（終了／中断／リスケ）・TODOあり/なし・会議URLあり/なしを
 * 佐藤花子の3件で網羅する。田中一郎は1件だけ、鈴木美咲以降は0件にして
 * 「まだコーチング記録がありません」の空状態も確認できるようにしてある。
 */
let schedulesStore: CoachingSchedule[] = [
  {
    id: 9001,
    mdl_user_id: STUDENT_HANAKO,
    coach_user_id: MOCK_COACH_USER_ID,
    coaching_no: 1,
    coaching_date: daysAgo(42),
    status: 'completed',
    meeting_url: 'https://meet.google.com/abc-defg-hij',
    meeting_provider: 'google_meet',
    meet_space_name: 'spaces/mock-abc-defg-hij',
    coaching_summary:
      '初回。Webデザインに興味があるが、何から手を付けるか決めきれていない状態。まずは配色とレイアウトの基礎を1ヶ月で終える計画を一緒に立てた。',
    todo: '配色の基礎レッスンを最後まで見る / バナーを1本作ってみる',
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: 9002,
    mdl_user_id: STUDENT_HANAKO,
    coach_user_id: MOCK_COACH_USER_ID,
    coaching_no: 2,
    coaching_date: daysAgo(14),
    status: 'rescheduled',
    meeting_url: '',
    meeting_provider: null,
    meet_space_name: null,
    coaching_summary: '体調不良の連絡があり開始5分で日程変更。次週に振り替え。',
    todo: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: 9003,
    mdl_user_id: STUDENT_HANAKO,
    coach_user_id: MOCK_COACH_USER_ID,
    coaching_no: 3,
    coaching_date: daysAgo(7),
    status: 'completed',
    meeting_url: 'https://us02web.zoom.us/j/8812345678',
    meeting_provider: null,
    meet_space_name: null,
    coaching_summary:
      'バナー3本を持参。余白の取り方が良くなっている一方、文字の優先順位がまだ弱い。次回までにジャンプ率を意識した作り直しを1本。',
    todo: 'バナーを1本作り直す / レイアウト実践に着手する',
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: 9010,
    mdl_user_id: STUDENT_ICHIRO,
    coach_user_id: MOCK_COACH_USER_ID,
    coaching_no: 1,
    coaching_date: daysAgo(35),
    status: 'interrupted',
    meeting_url: 'https://us02web.zoom.us/j/8899887766',
    meeting_provider: null,
    meet_space_name: null,
    coaching_summary: '接続不良で中断。以降ログインが確認できていないため、運営から状況確認を依頼した。',
    todo: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

/**
 * AIノート。ステータス3種を網羅する。
 * 9002（リスケ）はノート無し = 「まだAIノートが生成されていません」の確認用に意図的に持たない。
 */
let notesStore: CoachingNote[] = [
  {
    id: 7001,
    coaching_schedule_id: 9001,
    status: 'published',
    session_summary: '初回セッション。学習の動機と使える時間を確認し、最初の1ヶ月の計画を決めた。',
    client_status_and_goal: '独学で3ヶ月。半年後に副業で月3万円を目標にしている。平日は夜1時間、休日は3時間確保できる。',
    main_issues: '教材の数が多く、どれを先に見るかの判断で手が止まっている。作ったものを人に見せる機会がない。',
    coach_feedback: '手が止まる原因は迷いではなく順番が決まっていないだけ。まず配色とレイアウトの2つに絞ると良い。',
    decisions: '1ヶ月で配色の基礎とレイアウト実践を終える。毎週バナーを1本作って共有する。',
    client_next_actions: '配色の基礎レッスンを最後まで見る。バナーを1本作ってSlackに投稿する。',
    coach_follow_up: '週次でSlackの投稿にコメントを返す。2週目に進捗が止まっていたら声をかける。',
    next_session_check: 'バナー1本が出せているか。配色の基礎を最後まで見られたか。',
    published_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: 7003,
    coaching_schedule_id: 9003,
    status: 'ai_suggested',
    session_summary: 'バナー3本のレビュー。余白は改善、文字の優先順位に課題が残る。',
    client_status_and_goal: '配色の基礎を修了。バナー制作を継続中。副業開始の目標は変わらず。',
    main_issues: '文字の大小差が小さく、一番言いたいことが最初に目に入らない。',
    coach_feedback: '余白の取り方は前回から明確に良くなっている。次はジャンプ率を意識して主役を1つに絞る。',
    decisions: '次回までにバナー1本をジャンプ率を意識して作り直す。レイアウト実践に着手する。',
    client_next_actions: 'バナーを1本作り直す。レイアウト実践の最初の3レッスンを見る。',
    coach_follow_up: '作り直したバナーにコメントを返す。',
    next_session_check: '作り直したバナーで主役が1つに絞れているか。',
    published_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: 7010,
    coaching_schedule_id: 9010,
    status: 'coach_confirmed',
    session_summary: '接続不良により中断。実質的な対話は行えていない。',
    client_status_and_goal: '受講開始から1ヶ月。学習の進捗は未確認。',
    main_issues: '接続環境。以降のログインが確認できていない。',
    coach_feedback: null,
    decisions: '運営から本人へ状況確認の連絡を入れる。',
    client_next_actions: '接続環境を確認したうえで日程を再調整する。',
    coach_follow_up: '運営に状況確認を依頼。返答があり次第、日程を押さえ直す。',
    next_session_check: '接続環境が解決しているか。',
    published_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

/**
 * Zoom 連携。未連携で始めて、認可URLを開くと連携済みに変わる（連携済みバッジの確認用）。
 * 🔴 localStorage に置く。認可は window.location.href での遷移＝ページリロードなので、
 *    モジュールスコープの変数だと戻ってきた時点で false に戻り、
 *    「連携済み」の見た目に一度も到達できない。
 *    リセットしたいときは DevTools で webcoach-mock-zoom-connected を消す。
 */
const ZOOM_KEY = 'webcoach-mock-zoom-connected';

function isZoomConnected(): boolean {
  try {
    return localStorage.getItem(ZOOM_KEY) === '1';
  } catch {
    return false;
  }
}

function setZoomConnected(): void {
  try {
    localStorage.setItem(ZOOM_KEY, '1');
  } catch {
    /* プライベートモードなどで書けなくても、連携前の見た目は確認できる */
  }
}

let nextScheduleId = 9100;
let nextNoteId = 7100;

export const coachScheduleHandlers = [
  // ---- コーチングスケジュール ------------------------------------------
  http.get('*/api/coaching/schedule/:userId', ({ params }) => {
    const userId = Number(params.userId);
    const list = schedulesStore
      .filter((s) => s.mdl_user_id === userId)
      .sort((a, b) => a.coaching_no - b.coaching_no);
    return HttpResponse.json(list);
  }),

  http.post('*/api/coaching/schedule/:userId', async ({ params, request }) => {
    const userId = Number(params.userId);
    const body = (await request.json()) as CreateCoachingScheduleRequest;
    const maxNo = schedulesStore
      .filter((s) => s.mdl_user_id === userId)
      .reduce((max, s) => Math.max(max, s.coaching_no), 0);

    // meeting_provider が google_meet のときは、実BFFと同じく作成時にURLを発行する
    const isMeet = body.meeting_provider === 'google_meet';
    const meetId = `mock-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;

    const created: CoachingSchedule = {
      id: nextScheduleId++,
      mdl_user_id: userId,
      coach_user_id: body.coach_user_id,
      coaching_no: maxNo + 1,
      coaching_date: body.coaching_date,
      status: null,
      meeting_url: isMeet ? `https://meet.google.com/${meetId}` : body.meeting_url,
      meeting_provider: body.meeting_provider ?? null,
      meet_space_name: isMeet ? `spaces/${meetId}` : null,
      coaching_summary: body.coaching_summary ?? null,
      todo: body.todo ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    schedulesStore.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put('*/api/coaching/schedule/:userId/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as UpdateCoachingScheduleRequest;
    const target = schedulesStore.find((s) => s.id === id);
    if (!target) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.coaching_date !== undefined) target.coaching_date = body.coaching_date;
    if (body.status !== undefined) target.status = body.status;
    if (body.meeting_url !== undefined) target.meeting_url = body.meeting_url;
    if (body.coaching_summary !== undefined) target.coaching_summary = body.coaching_summary;
    if (body.todo !== undefined) target.todo = body.todo;
    target.updated_at = nowIso();

    return HttpResponse.json(target);
  }),

  http.delete('*/api/coaching/schedule/:userId/:id', ({ params }) => {
    const id = Number(params.id);
    schedulesStore = schedulesStore.filter((s) => s.id !== id);
    notesStore = notesStore.filter((n) => n.coaching_schedule_id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- AIコーチングノート ----------------------------------------------
  // 生成されていないセッションは 404。画面側はそれを 'none' として
  // 「まだAIノートが生成されていません」に出す。
  http.get('*/api/coaching/notes/:scheduleId', ({ params }) => {
    const scheduleId = Number(params.scheduleId);
    const note = notesStore.find((n) => n.coaching_schedule_id === scheduleId);
    if (!note) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(note);
  }),

  http.put('*/api/coaching/notes/:scheduleId', async ({ params, request }) => {
    const scheduleId = Number(params.scheduleId);
    const body = (await request.json()) as UpdateCoachingNoteRequest;
    let note = notesStore.find((n) => n.coaching_schedule_id === scheduleId);

    if (!note) {
      note = {
        id: nextNoteId++,
        coaching_schedule_id: scheduleId,
        status: 'ai_suggested',
        session_summary: null,
        client_status_and_goal: null,
        main_issues: null,
        coach_feedback: null,
        decisions: null,
        client_next_actions: null,
        coach_follow_up: null,
        next_session_check: null,
        published_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      notesStore.push(note);
    }

    const { status, ...fields } = body;
    Object.assign(note, fields);
    if (status) {
      note.status = status;
      // 公開したときだけ公開日時が入る（受講生側に出る条件）
      if (status === 'published' && !note.published_at) note.published_at = nowIso();
    }
    note.updated_at = nowIso();

    return HttpResponse.json(note);
  }),

  // ---- ミーティング連携（コーチ個人のZoom） ------------------------------
  http.get('*/api/integrations/status', () => {
    return HttpResponse.json({
      coach_user_id: MOCK_COACH_USER_ID,
      integrations: isZoomConnected()
        ? [
            {
              coach_user_id: MOCK_COACH_USER_ID,
              provider: 'zoom',
              provider_account_email: 'coach@webcoach.dev',
              connected_at: nowIso(),
              updated_at: nowIso(),
            },
          ]
        : [],
    });
  }),

  // 実際のOAuthには飛ばせないので、連携済みにしてから今いる画面へ戻す。
  // 画面側は ?connected=zoom&status=success を見て完了バナーを出す。
  // window.location.pathname をそのまま使うのは、プレビューが
  // /branches/<slug>/ 配下にぶら下がっていて basename が付くため。
  http.get('*/api/integrations/:provider/authorize', ({ params }) => {
    const provider = String(params.provider);
    if (provider === 'zoom') setZoomConnected();
    const back = `${window.location.origin}${window.location.pathname}?connected=${provider}&status=success`;
    return HttpResponse.json({ authorizeUrl: back });
  }),
];
