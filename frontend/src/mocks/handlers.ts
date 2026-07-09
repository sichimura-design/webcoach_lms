/**
 * MSW モックハンドラ定義
 * ============================================================
 * バックエンド（BFF / FastAPI）は変更できないため、フロントで新機能を作る際に
 * 必要な API はすべてここにモックとして追加する。
 *
 * 【新機能追加の手順】
 *   1. bffClient に新メソッドを足す（例: getAnnouncements → GET /api/webcoach/announcements）
 *   2. このファイルに対応するハンドラを1つ追加する（下の「サンプル機能」を参照）
 *   3. npm start で確認 → dev/XX ブランチへ push → プレビューURLで確認
 *
 * 注意:
 *   - パスは baseURL が /api のため実際のリクエストは `${origin}/api/...`。
 *     どのオリジン/サブパスでも一致するよう `*​/api/...` のワイルドカードで書く。
 *   - ここに無いエンドポイントは onUnhandledRequest: 'bypass' で素通し
 *     （ローカルでは実BFFが無いのでネットワークエラーになるだけ）。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import type {
  UserInfo,
  Profile,
  Category,
  ResumeCourse,
} from '../types/api';

// ---- 固定モックデータ（型に沿った最小限） ----------------------------------
const MOCK_USER_ID = 2;

const userInfo: UserInfo = {
  cognito: {
    sub: 'mock-sub-0001',
    email: 'mock@webcoach.dev',
    username: 'mock@webcoach.dev',
  },
  moodle: {
    id: MOCK_USER_ID,
    username: 'mock_user',
    fullname: 'モック 太郎',
    email: 'mock@webcoach.dev',
    firstname: 'モック',
    lastname: '太郎',
    profileimageurl: '',
  },
};

const profile: Profile = {
  mdl_user_id: MOCK_USER_ID,
  nick_name: 'モックさん',
  self_intro: 'これはモック環境のプロフィールです。',
  target_job: 'Webデザイナー',
  ideal_career: 'フリーランスで自由に働く',
  today_small_step: '今日はバナーを1つ作る',
  badge_count: 3,
  goal: '3ヶ月で案件を1件獲得する',
  avatar_url: '',
  avatar_id: '',
};

const categories: Category[] = [
  { id: 1, name: 'Webデザイン', description: 'デザインの基礎から実践まで', coursecount: 8 },
  { id: 2, name: 'コーディング', description: 'HTML/CSS/JavaScript', coursecount: 12 },
  { id: 3, name: 'マーケティング', description: 'Web集客の基礎', coursecount: 5 },
];

const resumeCourses: ResumeCourse[] = [
  {
    courseid: 101,
    fullname: 'はじめてのWebデザイン',
    shortname: 'design-101',
    summary: 'デザインの基本原則を学ぶ入門コース',
    progress: 45,
    lastaccess: Math.floor(Date.now() / 1000) - 3600,
    accesscount: 12,
  },
];

const userCourses = [
  {
    id: 101,
    fullname: 'はじめてのWebデザイン',
    displayname: 'はじめてのWebデザイン',
    summary: 'デザインの基本原則を学ぶ入門コース',
    progress: 45,
    categoryname: 'Webデザイン',
  },
  {
    id: 102,
    fullname: 'HTML/CSS基礎',
    displayname: 'HTML/CSS基礎',
    summary: 'Webページを作る第一歩',
    progress: 10,
    categoryname: 'コーディング',
  },
  {
    id: 201,
    fullname: 'デザインの4大原則',
    displayname: 'デザインの4大原則',
    summary: '近接・整列・反復・コントラストを理解する',
    progress: 100,
    categoryname: 'Webデザイン',
  },
];

// ---- 学習コンテンツ（カテゴリ→コース→カリキュラム→教材）ダミー ----------------
type MockCourse = {
  id: number; fullname: string; shortname: string;
  categoryid: number; categoryname: string; summary: string;
  courseimage?: string; tags: { rawname: string }[];
  difficulty: string; duration: string;
};

// コースカタログ（/moodle/courses と /moodle/getcoursebyfield の元データ）
const catalog: MockCourse[] = [
  // カテゴリ1: Webデザイン
  { id: 101, fullname: 'はじめてのWebデザイン', shortname: 'design-101', categoryid: 1, categoryname: 'Webデザイン', summary: 'デザインの基本原則をやさしく学ぶ入門コース', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分' },
  { id: 201, fullname: 'デザインの4大原則', shortname: 'design-201', categoryid: 1, categoryname: 'Webデザイン', summary: '近接・整列・反復・コントラストを理解する', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '20分' },
  { id: 202, fullname: '配色の基本とツール', shortname: 'design-202', categoryid: 1, categoryname: 'Webデザイン', summary: '色の役割と配色ツールの使い方', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '25分' },
  { id: 203, fullname: 'バナーを作ってみよう', shortname: 'design-203', categoryid: 1, categoryname: 'Webデザイン', summary: '実際に1枚のバナーを完成させる', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '45分' },
  { id: 204, fullname: 'LPのワイヤーフレーム制作', shortname: 'design-204', categoryid: 1, categoryname: 'Webデザイン', summary: '構成から作るランディングページ設計', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '60分' },
  { id: 205, fullname: '余白の使い方Tips', shortname: 'design-205', categoryid: 1, categoryname: 'Webデザイン', summary: '見やすさが変わる余白の小ワザ', tags: [{ rawname: 'Tips・小ネタ' }], difficulty: '基礎', duration: '10分' },
  // カテゴリ2: コーディング
  { id: 102, fullname: 'HTML/CSS基礎', shortname: 'coding-102', categoryid: 2, categoryname: 'コーディング', summary: 'Webページを作る第一歩', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '40分' },
  { id: 211, fullname: 'よく使うHTMLタグ辞典', shortname: 'coding-211', categoryid: 2, categoryname: 'コーディング', summary: '実務で頻出のタグをまとめて習得', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分' },
  { id: 212, fullname: 'Flexboxでレイアウト', shortname: 'coding-212', categoryid: 2, categoryname: 'コーディング', summary: '横並び・中央寄せを自在に', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '50分' },
  // カテゴリ3: マーケティング
  { id: 221, fullname: 'SNS集客の基本', shortname: 'mkt-221', categoryid: 3, categoryname: 'マーケティング', summary: '各SNSの特性と使い分け', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '25分' },
  { id: 222, fullname: '刺さる広告文の書き方', shortname: 'mkt-222', categoryid: 3, categoryname: 'マーケティング', summary: 'クリックされるコピーの型', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '35分' },
];

// カリキュラム/教材（/moodle/courses/:id/contents）。どのコースでも汎用の章立てを返す。
function buildSections(courseId: number) {
  const page = (id: number, name: string, body: string) => ({
    id, name, modname: 'page',
    description: body,
    completion: 1,
    completiondata: { state: 0 },
  });
  const lead = courseId * 1000;
  return [
    {
      id: lead + 1, name: 'セクション1: 基礎を理解する', visible: true, summary: '',
      modules: [
        page(lead + 11, 'イントロダクション', '<h2>このコースで学ぶこと</h2><p>このセクションでは全体像をつかみます。手を動かす前に、まず「なぜそれが必要なのか」を理解しましょう。</p><ul><li>学ぶゴールの確認</li><li>用語の整理</li><li>進め方のコツ</li></ul>'),
        page(lead + 12, '基本の考え方', '<h2>基本の考え方</h2><p>ここが土台になります。焦らず、一つずつ確認していきましょう。</p><p>ポイントは<strong>「まず真似る」</strong>こと。型を覚えてから応用に進みます。</p>'),
      ],
    },
    {
      id: lead + 2, name: 'セクション2: 手を動かす', visible: true, summary: '',
      modules: [
        page(lead + 21, 'ハンズオン①', '<h2>やってみよう</h2><p>実際に手を動かすパートです。完成イメージを見ながら進めてください。</p><ol><li>お手本をなぞる</li><li>自分でアレンジ</li><li>見比べて改善</li></ol>'),
        page(lead + 22, 'ハンズオン②', '<h2>もう一歩踏み込む</h2><p>応用に挑戦します。詰まったら前のレッスンに戻ってOKです。</p>'),
        page(lead + 23, 'まとめと次のステップ', '<h2>まとめ</h2><p>お疲れさまでした。学んだことを振り返り、次のコースへ進みましょう。</p>'),
      ],
    },
  ];
}

// AIアプリ（/webcoach/ai-applications）
const aiApps = [
  { id: 1, name: 'バナーAIジェネレーター', description: '文字を入れるだけでバナー画像を生成', url: 'https://example.com/banner', icon: '' },
  { id: 2, name: 'キャッチコピー生成', description: '商品情報から刺さるコピーを提案', url: 'https://example.com/copy', icon: '' },
  { id: 3, name: '配色パレット提案', description: 'イメージに合う配色を自動生成', url: 'https://example.com/color', icon: '' },
  { id: 4, name: '文章校正アシスタント', description: '誤字・言い回しをAIがチェック', url: 'https://example.com/proof', icon: '' },
];

// 次回コーチングまでの目標（セッション内で保持：AI細分化やコーチングページからの生成を
// マイページに反映させるため、GET/PUT で同じストアを読み書きする）
let coachingGoalsStore: { no: number; description: string; is_completed: 0 | 1 }[] = [];

// 学習計画（今週の予定・セッション内で保持）
let studyPlanStore: { weekLabel: string; days: any[] } | null = null;

// 月曜始まりの週の7日分（offsetWeeks=0で今週、1で来週）を返す
function weekDays(offsetWeeks: number) {
  const now = new Date();
  const dow = now.getDay(); // 0=日
  const mondayDiff = (dow === 0 ? -6 : 1 - dow) + offsetWeeks * 7;
  const wd = ['月', '火', '水', '木', '金', '土', '日'];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + mondayDiff + i);
    days.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: wd[i],
      md: `${d.getMonth() + 1}/${d.getDate()}`,
      sessions: [] as any[],
    });
  }
  return days;
}
function weekLabelOf(days: any[]) {
  return `${days[0].md}–${days[6].md}`;
}
// サンプルの週間予定（曜日index→セッション）
function buildWeek(offsetWeeks: number) {
  const days = weekDays(offsetWeeks);
  const plan = [
    { i: 0, title: 'バナーを作ってみよう', minutes: 45, courseId: 203 },
    { i: 1, title: '配色の基本とツール', minutes: 30, courseId: 202 },
    { i: 3, title: 'バナー制作のつづき', minutes: 60, courseId: 203 },
    { i: 4, title: '参考サイトを3つ分析する', minutes: 30 },
    { i: 5, title: '作品を仕上げる', minutes: 60, courseId: 204 },
    { i: 6, title: '今週の振り返り', minutes: 15 },
  ];
  plan.forEach(s => days[s.i].sessions.push({ title: s.title, minutes: s.minutes, courseId: s.courseId, done: false }));
  return { weekLabel: weekLabelOf(days), days };
}

// ---- ハンドラ ---------------------------------------------------------------
export const handlers = [
  // ==================== 認証後のブート経路 ====================
  http.get('*/api/user/info', () => HttpResponse.json(userInfo)),

  http.get('*/api/content-token', () =>
    HttpResponse.json({ token: 'mock-content-token', expiresAt: Date.now() + 60 * 60 * 1000 })
  ),

  http.get('*/api/webcoach/profile/:userid', () => HttpResponse.json(profile)),
  http.get('*/api/webcoach/avatars', () => HttpResponse.json([])),

  // ==================== MyPage / ダッシュボード ====================
  http.get('*/api/webcoach/resumecourse/:userid', () => HttpResponse.json(resumeCourses)),

  // おすすめコース（同じフェーズの人が学んでいるコース）
  http.get('*/api/webcoach/recommend-courses', () =>
    HttpResponse.json(catalog.filter(c => [211, 212, 221].includes(c.id)))
  ),

  // 案件獲得ダッシュボード
  http.get('*/api/webcoach/career-dashboard/:userid', () =>
    HttpResponse.json({
      weeklyGoal: 3,
      appliedThisWeek: 2,
      totals: { applied: 12, inProgress: 3, won: 1, rejected: 5 },
      weekly: [
        { label: '3w前', applied: 1 },
        { label: '2w前', applied: 3 },
        { label: '先週', applied: 4 },
        { label: '今週', applied: 2 },
      ],
      review: {
        comment: '先週は4件応募でき、1件が一次面接に進みました。今週はペースが落ち気味なので、木曜までにあと1件出しましょう。',
        improvements: ['応募文のテンプレを使い回して時短する', '実績（バナー3枚）をポートフォリオ冒頭に置く'],
      },
      nextAction: '求人Aの一次面接に向けて自己PRを1本用意する',
    })
  ),

  // ==================== 学習コンテンツ（カテゴリ→コース→カリキュラム→教材） ====================
  // コース詳細（カリキュラム/教材ページが章立てを取得）
  http.get('*/api/moodle/courses/:courseid/contents', ({ params }) =>
    HttpResponse.json(buildSections(Number(params.courseid)))
  ),
  // アクティビティ完了状態（cmid が偶数なら完了済みとして見せる）
  http.get('*/api/moodle/activities/:cmid/completion', ({ params }) =>
    HttpResponse.json({ state: Number(params.cmid) % 2 === 0 ? 1 : 0 })
  ),
  // カテゴリ内のコース一覧（?field=category&value=<id>）
  http.get('*/api/moodle/getcoursebyfield', ({ request }) => {
    const value = new URL(request.url).searchParams.get('value');
    const catId = Number(value);
    const courses = catalog.filter((c) => c.categoryid === catId);
    return HttpResponse.json({ courses: courses.length ? courses : catalog.slice(0, 3) });
  }),
  http.get('*/api/moodle/courses/:userid', () => HttpResponse.json(userCourses)),
  http.get('*/api/moodle/courses', () => HttpResponse.json(catalog)),
  http.get('*/api/moodle/categories', () => HttpResponse.json(categories)),
  http.get('*/api/webcoach/recomendbadge/:userid', () => HttpResponse.json([])),
  http.get('*/api/webcoach/next-coaching-goals/:userid', () => HttpResponse.json(coachingGoalsStore)),
  http.put('*/api/webcoach/next-coaching-goals/:userid', async ({ request }) => {
    try {
      const body = (await request.json()) as { goals?: typeof coachingGoalsStore };
      coachingGoalsStore = Array.isArray(body?.goals) ? body.goals : [];
    } catch {
      /* ignore */
    }
    return HttpResponse.json(coachingGoalsStore);
  }),
  http.get('*/api/webcoach/roadmaps', () => HttpResponse.json([])),
  http.get('*/api/moodle/badges', () => HttpResponse.json([])),
  http.get('*/api/moodle/user-badges/:userid', () => HttpResponse.json([])),
  http.get('*/api/webcoach/ai-applications', () => HttpResponse.json(aiApps)),
  // コース受講登録（クリック時）— 成功を返すだけ
  http.post('*/api/moodle/enroll-course/:courseid', () => HttpResponse.json({ success: true })),
  http.get('*/api/moodle/notifications/new-content', () =>
    HttpResponse.json({ count: 0, items: [] })
  ),
  http.get('*/health', () => HttpResponse.json({ status: 'ok' })),

  // ==================== AIコーチ（チャット） ====================
  // POST /webcoach/ai — 質問内容に応じてダミー応答を返す
  http.post('*/api/webcoach/ai', async ({ request }) => {
    let message = '';
    try {
      const body = (await request.json()) as { message?: string };
      message = body?.message || '';
    } catch {
      /* ignore */
    }

    const kb: { keys: string[]; reply: string }[] = [
      { keys: ['バナー', 'banner'], reply: 'バナー制作は「①目的とターゲットを決める → ②訴求（キャッチコピー）を1つに絞る → ③レイアウトと配色 → ④仕上げ」の順で進めるとブレません。まずは「誰に・何を・どうしてほしいか」を一言で書き出してみましょう。' },
      { keys: ['配色', '色', 'カラー'], reply: '配色は「ベース70% / メイン25% / アクセント5%」の比率を意識すると整います。迷ったら、まずメインカラーを1つ決めて、その類似色でまとめるのが失敗しにくいです。' },
      { keys: ['ポートフォリオ', '案件', '仕事', '就職', '転職'], reply: '未経験からの最初の一歩は、学んだことを「作品」にして見える形に残すことです。小さくても完成品を3つ作ると、案件応募のときに一気に説得力が出ます。今日はどれか1つ、手を動かしてみませんか？' },
      { keys: ['モチベ', '続かない', '不安', 'つらい'], reply: '大丈夫、最初は誰でも手探りです。大きな目標より「今日の小さな一歩」を決めるのがコツ。例えば「15分だけ教材を見る」でも立派な前進です。一緒に続けていきましょう！' },
    ];

    const hit = kb.find((k) => k.keys.some((key) => message.includes(key)));
    const reply = hit
      ? hit.reply
      : `「${message || 'ご質問'}」についてですね。ポイントを整理すると、①まず全体像をつかむ ②お手本を真似る ③小さく作って振り返る、の順で進めると理解が定着しやすいです。具体的に知りたい部分があれば教えてください！`;

    return HttpResponse.json({
      success: true,
      message: reply,
      sources: [
        { chunk_index: 0, module_name: 'はじめてのWebデザイン', filename: 'intro.md', section_name: '基礎知識', similarity: 0.82 },
        { chunk_index: 1, module_name: 'デザインの4大原則', filename: 'principles.md', section_name: '基礎知識', similarity: 0.71 },
      ],
      suggestions: ['具体例を教えて', '次に学ぶべきことは？', 'おすすめのコースは？'],
      timestamp: '2026-07-09T00:00:00Z',
    });
  }),

  // ==================== 学習ジャーニー（ゲーム風ロードマップ＋今日のクエスト＋ストリーク） ====================
  http.get('*/api/webcoach/journey/:userid', () =>
    HttpResponse.json({
      goal: 'Webデザイナーとして初案件を獲得する',
      streak: { current: 5, best: 12, last7days: [true, true, false, true, true, true, true] },
      todayQuest: {
        title: '「バナーを作ってみよう」を進める',
        subtitle: '今日はここから ・ 約45分',
        courseId: 203,
        cta: 'はじめる',
      },
      phases: [
        { id: 1, title: 'フェーズ1: 基礎を固める', outcome: 'デザインの基本原則と配色を説明できる', status: 'done', progress: 100, recommendedCourseIds: [101, 201, 202] },
        { id: 2, title: 'フェーズ2: 手を動かして作る', outcome: 'バナーとLPを自力で1つずつ完成できる', status: 'current', progress: 35, recommendedCourseIds: [203, 204] },
        { id: 3, title: 'フェーズ3: 案件に挑戦する', outcome: 'ポートフォリオを作り、初案件に応募する', status: 'locked', progress: 0, recommendedCourseIds: [] },
      ],
      nodes: [
        { id: 1, title: 'オリエンテーション', type: 'milestone', status: 'done', phaseId: 1 },
        { id: 2, title: 'デザインの4大原則', type: 'lesson', status: 'done', courseId: 201, phaseId: 1 },
        { id: 3, title: '配色の基本とツール', type: 'lesson', status: 'done', courseId: 202, phaseId: 1 },
        { id: 4, title: '基礎チェック', type: 'boss', status: 'done', phaseId: 1 },
        { id: 5, title: 'バナーを作ってみよう', type: 'lesson', status: 'current', courseId: 203, phaseId: 2 },
        { id: 6, title: 'LPのワイヤーフレーム制作', type: 'lesson', status: 'locked', courseId: 204, phaseId: 2 },
        { id: 7, title: '作品を仕上げる', type: 'boss', status: 'locked', phaseId: 2 },
        { id: 8, title: 'ポートフォリオ作成', type: 'milestone', status: 'locked', phaseId: 3 },
        { id: 9, title: '初案件に応募', type: 'boss', status: 'locked', phaseId: 3 },
      ],
    })
  ),

  // 目標のAI細分化（POST /webcoach/goal-breakdown）— ゴール文字列/コーチング記録→サブ目標配列
  http.post('*/api/webcoach/goal-breakdown', async ({ request }) => {
    let goal = '';
    let source = 'goal';
    try {
      const body = (await request.json()) as { goal?: string; source?: string };
      goal = body?.goal || '';
      source = body?.source || 'goal';
    } catch {
      /* ignore */
    }
    let subgoals: string[];
    if (source === 'coaching') {
      // 前回コーチングで話した内容から、コーチと決めたタスクとして分解
      subgoals = [
        'コーチと決めた「バナー3枚」に今週着手する',
        '前回指摘された余白の取り方を意識して1枚作り直す',
        'おすすめされた参考サイトを3つ分析する',
        '配色パターンを2案つくって次回に備える',
        '完成したバナーを次回コーチングに持参する',
      ];
    } else if (/(バナー|デザイン|配色|design)/i.test(goal)) {
      subgoals = [
        '「デザインの4大原則」を復習する',
        '好きなバナーを3つ集めて良い点を言語化する',
        '配色ツールで配色案を2パターン作る',
        'バナーを1枚ラフまで作る',
        'コーチにバナーのフィードバックをもらう',
      ];
    } else if (/(コーディング|html|css|coding)/i.test(goal)) {
      subgoals = [
        '「HTML/CSS基礎」を1コース進める',
        'よく使うタグ・プロパティを5つメモする',
        '簡単なプロフィールページを模写する',
        'Flexboxで横並びレイアウトを作る',
        'つまずいた点をAIコーチに質問する',
      ];
    } else {
      subgoals = [
        '今週の学習リズムを決める（週3回×30分など）',
        '学んだことを1つメモにまとめる',
        '教材を1コース分進める',
        'わからない点をAIコーチに質問する',
        '作ったもの・気づきをコーチに共有する',
      ];
    }
    return HttpResponse.json({ subgoals });
  }),

  // ==================== 学習計画（月間＞週間・カレンダー＋AI生成） ====================
  http.get('*/api/webcoach/study-plan/:userid', () => {
    if (studyPlanStore) {
      return HttpResponse.json({ ...studyPlanStore, hasPlan: true, review: null });
    }
    const empty = weekDays(0);
    return HttpResponse.json({ weekLabel: weekLabelOf(empty), days: empty, hasPlan: false, review: null });
  }),
  http.post('*/api/webcoach/study-plan/generate', async ({ request }) => {
    let mode = 'this';
    try {
      const body = (await request.json()) as { mode?: string };
      mode = body?.mode || 'this';
    } catch {
      /* ignore */
    }
    const next = mode === 'next';
    const week = buildWeek(next ? 1 : 0);
    studyPlanStore = week;
    const review = next
      ? {
          lastWeekLabel: weekLabelOf(weekDays(-1)),
          planned: 6,
          completed: 4,
          streak: 5,
          comment:
            '先週は6件中4件を達成できました。特にバナー制作が前に進んだのが大きいです。水曜が空いて後半に予定が詰まったので、今週は平日の負荷を分散しましょう。',
          improvements: [
            '水曜にも30分の枠を入れて平準化する',
            '集中しやすい午前に作業を寄せる',
            '詰まったら抱え込まず早めにAIコーチへ相談する',
          ],
        }
      : null;
    return HttpResponse.json({ ...week, hasPlan: true, review });
  }),

  // ==================== コーチング（AIミーティングノート） ====================
  http.get('*/api/webcoach/coaching-sessions/:userid', () =>
    HttpResponse.json({
      next: { date: '7月16日(木) 20:00', coach: '田中コーチ' },
      past: [
        { id: 4, date: '2026-07-02', title: '第4回コーチング', summary: 'バナー制作の進め方と「余白の取り方」の課題を確認。次回までに参考分析と配色案。', tasksCreated: true },
        { id: 3, date: '2026-06-25', title: '第3回コーチング', summary: '配色の基礎と参考サイトの見方を整理。デザインの型を増やす方針に。', tasksCreated: true },
        { id: 2, date: '2026-06-18', title: '第2回コーチング', summary: '学習リズムの設計。週3回のペースで基礎コースを進めることで合意。', tasksCreated: true },
      ],
    })
  ),
  // 録音→要約→タスク候補の生成（本番は 録音→文字起こしAPI→要約 に置き換え）
  http.post('*/api/webcoach/coaching-note', () =>
    HttpResponse.json({
      summary:
        '今回はポートフォリオ用のバナー制作を最優先に設定。前回の課題「余白の取り方」を改善するため、参考サイトの分析と配色2案の準備を次回までに行うことで合意しました。',
      transcript:
        '今日のコーチングでは、ポートフォリオ用にバナーを3枚作ることを目標にしました。前回の余白の取り方が課題だったのでそこを意識すること。参考サイトを3つ見て分析するのと、配色は2パターン用意して次回持ってくるよう言われました。',
      keyPoints: [
        'ポートフォリオ用バナーを3枚作る',
        '余白の取り方を改善する',
        '参考サイトを3つ分析する',
        '配色を2パターン用意する',
      ],
      suggestedTasks: [
        'コーチと決めた「バナー3枚」に今週着手する',
        '前回指摘された余白の取り方を意識して1枚作り直す',
        'おすすめされた参考サイトを3つ分析する',
        '配色パターンを2案つくって次回に備える',
        '完成したバナーを次回コーチングに持参する',
      ],
    })
  ),

  // ==================== サンプル機能（新API＝モックの雛形） ====================
  // 実BFFには存在しない新エンドポイント。/announcements ページから利用する。
  // 新機能を足すときは、このブロックをコピーして中身を差し替える。
  http.get('*/api/webcoach/announcements', () =>
    HttpResponse.json([
      {
        id: 1,
        title: 'モック環境へようこそ',
        body: 'この画面は実BFFではなくMSWモックからデータを取得しています。',
        publishedAt: '2026-07-06T00:00:00Z',
      },
      {
        id: 2,
        title: '新機能はモックAPIで作れます',
        body: 'frontend/src/mocks/handlers.ts にハンドラを1つ足すだけ。',
        publishedAt: '2026-07-05T00:00:00Z',
      },
    ])
  ),
];
