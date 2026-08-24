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
 *   - ここに無い /api/* は、末尾のキャッチオール ハンドラが 501 を返して止める。
 *     実BFFへ抜けて 401 → ログイン画面へ強制遷移、という事故を防ぐため。
 *     コンソールに「未実装のモックAPIです」と出たらここにハンドラを足すこと。
 * ============================================================
 */
import { http, HttpResponse, passthrough } from 'msw';
import type {
  UserInfo,
  Profile,
  Category,
  ResumeCourse,
} from '../types/api';
import type { FocusBoothMember } from '../types/focusBooth';
import { coachingHandlers } from './coachingHandlers';
import { buildCourseStructure, courseLessonCount, isLessonDone, lessonHandlers, setLessonDone } from './lessonHandlers';
import { noteHandlers } from './noteHandlers';
import { learningPlanHandlers } from './learningPlanHandlers';
import { aiSkillHandlers } from './aiSkillHandlers';
import { currentStreakInfo, studyActivityHandlers } from './studyActivityHandlers';
import { STUDY_PEERS } from './studyPeers';
import { listGoals, replaceGoals } from './coachingGoalsStore';
import { buildNextCourses } from '../utils/nextCourseRecommend';
import { searchMaterials } from './materialSearch';

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
  weekly_target_minutes: 600,
};

const categories: Category[] = [
  { id: 1, name: 'Webデザイン', description: 'デザインの基礎から実践まで', coursecount: 9 },
  { id: 2, name: 'コーディング', description: 'HTML/CSS/JavaScript', coursecount: 8 },
  { id: 3, name: 'マーケティング', description: 'Web集客の基礎', coursecount: 5 },
  { id: 4, name: 'キャリア', description: '副業・案件獲得の進め方', coursecount: 5 },
];

/**
 * 「続きから学ぶ」コースの現在位置。
 *
 * レッスンの完了状態の既定は「偶数IDは完了」（lessonHandlers.isLessonDone）で、
 * これだと1レッスン目が未完了になり「45%進んでチャプター2にいる」と噛み合わない。
 * 学習コンテンツトップは進捗と「次に学ぶレッスン」を並べて出すので、
 * 食い違うとそのまま画面上の矛盾になる。そこでこのコースだけ完了状態を明示し、
 * 進捗率・次のレッスン名・単元名・残り時間はすべてそこから導出する
 * （手書きの数字を置くと、構成を変えたときに必ずズレる）。
 */
const RESUME_COURSE_ID = 101;

const resumeLessons = buildCourseStructure(RESUME_COURSE_ID).flatMap((s) =>
  s.lessons.map((l) => ({ ...l, sectionName: s.name }))
);

/** 単元2「手を動かす」の1レッスン目まで終えた状態＝次は4レッスン目 */
const RESUME_DONE_COUNT = 3;
resumeLessons.forEach((l, i) => setLessonDone(l.lessonId, i < RESUME_DONE_COUNT));

const resumeNextLesson = resumeLessons[RESUME_DONE_COUNT];
const resumeProgress = Math.round((RESUME_DONE_COUNT / resumeLessons.length) * 100);
const resumeTotalMinutes = resumeLessons.reduce((n, l) => n + l.minutes, 0);
const resumeRemainingMinutes = resumeLessons.slice(RESUME_DONE_COUNT).reduce((n, l) => n + l.minutes, 0);

const resumeCourses: ResumeCourse[] = [
  {
    courseid: RESUME_COURSE_ID,
    fullname: 'はじめてのWebデザイン',
    shortname: 'design-101',
    summary: 'デザインの基本原則を学ぶ入門コース',
    progress: resumeProgress,
    lastaccess: Math.floor(Date.now() / 1000) - 3600,
    accesscount: 12,
    // 学習サマリー（総学習時間・完了レッスン数）の簡易推定に使う目安値
    durationminutes: resumeTotalMinutes,
    totallessons: resumeLessons.length,
    // マイページ・学習コンテンツトップの「続きから学習」ヒーロー表示用
    currentlesson: `Lesson ${RESUME_DONE_COUNT + 1} ${resumeNextLesson.title}`,
    currentchapter: resumeNextLesson.sectionName,
    remainingminutes: resumeRemainingMinutes,
  },
];

// 受講中のコース。コース名とレッスン数はカタログ（buildCourseStructure）と必ず揃える。
// 別の名前・別のレッスン数を書くと、同じ画面に同じコースが2つの姿で出る。
const userCourses = [
  {
    id: RESUME_COURSE_ID,
    fullname: 'はじめてのWebデザイン',
    displayname: 'はじめてのWebデザイン',
    summary: 'デザインの基本原則をやさしく学ぶ入門コース',
    progress: resumeProgress,
    categoryname: 'Webデザイン',
    durationminutes: resumeTotalMinutes,
    totallessons: resumeLessons.length,
  },
  {
    id: 102,
    fullname: 'HTML & CSSのきほん',
    displayname: 'HTML & CSSのきほん',
    summary: 'Web制作に必要なHTMLとCSSをやさしく学びます',
    progress: 10,
    categoryname: 'コーディング',
    durationminutes: 40,
    totallessons: courseLessonCount(102),
  },
  {
    id: 201,
    fullname: 'デザインの4大原則',
    displayname: 'デザインの4大原則',
    summary: '近接・整列・反復・コントラストを事例で理解する',
    progress: 100,
    categoryname: 'Webデザイン',
    durationminutes: 20,
    totallessons: courseLessonCount(201),
  },
];

// ---- 学習コンテンツ（学習領域→コース→単元→レッスン）ダミー --------------------
type MockCourse = {
  id: number; fullname: string; shortname: string;
  categoryid: number; categoryname: string; summary: string;
  courseimage?: string; tags: { rawname: string }[];
  difficulty: string; duration: string;
  /** 総レッスン数。buildCourseStructure から導出するので、コーストップの単元表示と必ず一致する */
  lessoncount: number;
  /** カード表示用の「どんな人向けか」タグ。tags（学習タイプ）とは別で、絞り込みには使わない */
  purposes: string[];
};

// コースカタログ（/moodle/courses と /moodle/getcoursebyfield の元データ）。
// 学習コンテンツ一覧をギャラリーとして見せるため、各学習領域に一定数のコースを置く。
const rawCatalog: Omit<MockCourse, 'lessoncount'>[] = [
  // カテゴリ1: Webデザイン
  { id: 101, fullname: 'はじめてのWebデザイン', shortname: 'design-101', categoryid: 1, categoryname: 'Webデザイン', summary: 'デザインの基本原則をやさしく学ぶ入門コース', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分', purposes: ['未経験向け', '最初におすすめ'] },
  { id: 201, fullname: 'デザインの4大原則', shortname: 'design-201', categoryid: 1, categoryname: 'Webデザイン', summary: '近接・整列・反復・コントラストを事例で理解する', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '20分', purposes: ['基礎から', 'デザイン力UP'] },
  { id: 202, fullname: '配色の基本とツール', shortname: 'design-202', categoryid: 1, categoryname: 'Webデザイン', summary: '色の役割と配色ツールの使い方をわかりやすく解説', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '25分', purposes: ['基礎から', 'デザイン力UP'] },
  { id: 206, fullname: 'Figmaの基本操作', shortname: 'design-206', categoryid: 1, categoryname: 'Webデザイン', summary: '制作の現場で使うFigmaを、触りながら覚える', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '35分', purposes: ['未経験向け', '基礎から'] },
  { id: 203, fullname: 'バナーを作ってみよう', shortname: 'design-203', categoryid: 1, categoryname: 'Webデザイン', summary: 'バナー制作の基本を実践で学び、作品を1つ完成させる', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '45分', purposes: ['実践で学ぶ', '作品を作る'] },
  { id: 207, fullname: 'デザイン模写のすすめ', shortname: 'design-207', categoryid: 1, categoryname: 'Webデザイン', summary: 'うまい人の意図を読み解きながら手を動かして盗む', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '40分', purposes: ['実践で学ぶ', 'デザイン力UP'] },
  { id: 204, fullname: 'LPのワイヤーフレーム制作', shortname: 'design-204', categoryid: 1, categoryname: 'Webデザイン', summary: '伝わるレイアウトの設計方法を学びます', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '60分', purposes: ['基礎から', '実践で学ぶ'] },
  { id: 208, fullname: 'ポートフォリオサイトを作る', shortname: 'design-208', categoryid: 1, categoryname: 'Webデザイン', summary: '案件応募で見せられる自分の作品集を仕上げる', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '90分', purposes: ['作品を作る', '副業準備'] },
  { id: 205, fullname: '余白の使い方Tips', shortname: 'design-205', categoryid: 1, categoryname: 'Webデザイン', summary: '見やすさが変わる余白の小ワザ', tags: [{ rawname: 'Tips・小ネタ' }], difficulty: '基礎', duration: '10分', purposes: ['デザイン力UP'] },
  // カテゴリ2: コーディング
  { id: 102, fullname: 'HTML & CSSのきほん', shortname: 'coding-102', categoryid: 2, categoryname: 'コーディング', summary: 'Web制作に必要なHTMLとCSSをやさしく学びます', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '40分', purposes: ['未経験向け', '基礎から'] },
  { id: 211, fullname: 'よく使うHTMLタグ辞典', shortname: 'coding-211', categoryid: 2, categoryname: 'コーディング', summary: '実務で頻出のタグをまとめて習得', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分', purposes: ['基礎から'] },
  { id: 212, fullname: 'Flexboxでレイアウト', shortname: 'coding-212', categoryid: 2, categoryname: 'コーディング', summary: '横並び・中央寄せを自在に組めるようになる', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '50分', purposes: ['実践で学ぶ'] },
  { id: 213, fullname: 'レスポンシブ対応の基本', shortname: 'coding-213', categoryid: 2, categoryname: 'コーディング', summary: 'スマホでも崩れないページの作り方', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '45分', purposes: ['実践で学ぶ'] },
  { id: 214, fullname: 'JavaScript入門', shortname: 'coding-214', categoryid: 2, categoryname: 'コーディング', summary: 'ページに動きをつけるための第一歩', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '55分', purposes: ['基礎から'] },
  { id: 215, fullname: 'フォームと入力チェック', shortname: 'coding-215', categoryid: 2, categoryname: 'コーディング', summary: 'お問い合わせフォームを実装できるようになる', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '40分', purposes: ['実践で学ぶ', '作品を作る'] },
  { id: 216, fullname: 'WordPressでサイトを作る', shortname: 'coding-216', categoryid: 2, categoryname: 'コーディング', summary: '案件で一番よく使うCMSを一通り触る', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '80分', purposes: ['作品を作る', '副業準備'] },
  { id: 217, fullname: 'Git / GitHubのきほん', shortname: 'coding-217', categoryid: 2, categoryname: 'コーディング', summary: '変更履歴の残し方と、共同作業の進め方', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '35分', purposes: ['基礎から', '副業準備'] },
  // カテゴリ3: マーケティング
  { id: 221, fullname: 'Webマーケティング入門', shortname: 'mkt-221', categoryid: 3, categoryname: 'マーケティング', summary: '集客の基本と施策の考え方をやさしく解説', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '25分', purposes: ['基礎から', '副業準備'] },
  { id: 223, fullname: 'SNS集客の基本', shortname: 'mkt-223', categoryid: 3, categoryname: 'マーケティング', summary: '各SNSの特性と使い分けを知る', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '25分', purposes: ['基礎から'] },
  { id: 222, fullname: '刺さる広告文の書き方', shortname: 'mkt-222', categoryid: 3, categoryname: 'マーケティング', summary: 'クリックされるコピーの型を身につける', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '35分', purposes: ['実践で学ぶ'] },
  { id: 224, fullname: 'SEOライティング入門', shortname: 'mkt-224', categoryid: 3, categoryname: 'マーケティング', summary: '検索から人が来る記事の組み立て方', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '40分', purposes: ['基礎から', '副業準備'] },
  { id: 225, fullname: 'アクセス解析でふりかえる', shortname: 'mkt-225', categoryid: 3, categoryname: 'マーケティング', summary: '数字を見て次の一手を決められるようになる', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '45分', purposes: ['実践で学ぶ'] },
  // カテゴリ4: キャリア・案件獲得
  { id: 231, fullname: '案件獲得の基礎', shortname: 'career-231', categoryid: 4, categoryname: 'キャリア', summary: '営業の考え方や提案のコツを基礎から学びます', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分', purposes: ['副業準備', '案件獲得'] },
  { id: 232, fullname: '提案文・見積もりの作り方', shortname: 'career-232', categoryid: 4, categoryname: 'キャリア', summary: '選ばれる提案と、適正な値付けの考え方', tags: [{ rawname: '実践課題' }], difficulty: '応用', duration: '40分', purposes: ['案件獲得'] },
  { id: 233, fullname: 'クラウドソーシングの歩き方', shortname: 'career-233', categoryid: 4, categoryname: 'キャリア', summary: '最初の1件を取るための現実的な進め方', tags: [{ rawname: '基礎知識' }], difficulty: '基礎', duration: '30分', purposes: ['未経験向け', '案件獲得'] },
  { id: 234, fullname: 'クライアントワークの進め方', shortname: 'career-234', categoryid: 4, categoryname: 'キャリア', summary: 'ヒアリングから納品までのやりとりを一通り', tags: [{ rawname: '実践課題' }], difficulty: '発展', duration: '50分', purposes: ['実践で学ぶ', '案件獲得'] },
  { id: 235, fullname: '副業のはじめ方と続け方', shortname: 'career-235', categoryid: 4, categoryname: 'キャリア', summary: '時間の作り方、お金まわり、無理のない続け方', tags: [{ rawname: 'Tips・小ネタ' }], difficulty: '基礎', duration: '20分', purposes: ['副業準備'] },
];

const catalog: MockCourse[] = rawCatalog.map((c) => ({ ...c, lessoncount: courseLessonCount(c.id) }));

// コースの構成（/moodle/courses/:id/contents）。
// 単元とレッスンは lessonHandlers.ts の buildCourseStructure を
// 単一の情報源にする。レッスンページの目次とコーストップの表示がズレないようにするため。
const MODULE_DESCRIPTIONS: Record<string, string> = {
  'イントロダクション': '<h2>このコースで学ぶこと</h2><p>この単元では全体像をつかみます。手を動かす前に、まず「なぜそれが必要なのか」を理解しましょう。</p><ul><li>学ぶゴールの確認</li><li>用語の整理</li><li>進め方のコツ</li></ul>',
  '基本の考え方': '<h2>基本の考え方</h2><p>ここが土台になります。焦らず、一つずつ確認していきましょう。</p><p>ポイントは<strong>「まず真似る」</strong>こと。型を覚えてから応用に進みます。</p>',
  'ハンズオン①': '<h2>やってみよう</h2><p>実際に手を動かすパートです。完成イメージを見ながら進めてください。</p><ol><li>お手本をなぞる</li><li>自分でアレンジ</li><li>見比べて改善</li></ol>',
  'ハンズオン②': '<h2>もう一歩踏み込む</h2><p>応用に挑戦します。詰まったら前のレッスンに戻ってOKです。</p>',
  'ケーススタディ': '<h2>実例で考える</h2><p>実際の案件に近い題材で、判断の分かれ目を見ていきます。</p>',
  '応用ワーク': '<h2>応用ワーク</h2><p>条件を変えた課題に取り組み、応用が利く状態を目指します。</p>',
  '確認テスト': '<h2>確認テスト</h2><p>ここまでの理解を確認します。間違えた箇所は該当レッスンに戻りましょう。</p>',
  '制作課題': '<h2>制作課題</h2><p>提出できる形の制作物を仕上げます。コーチのフィードバックを受けられます。</p>',
  'まとめと次にやること': '<h2>まとめ</h2><p>お疲れさまでした。学んだことを振り返り、次のコースへ進みましょう。</p>',
};

function buildSections(courseId: number) {
  return buildCourseStructure(courseId).map((section) => ({
    id: section.id,
    name: section.name,
    visible: true,
    summary: section.summary,
    modules: section.lessons.map((lesson) => ({
      id: lesson.lessonId,
      name: lesson.title,
      modname: 'page',
      // 学習タイプ（階層ではなく分類）。コーストップの単元カードでチップとして出す
      learningtype: lesson.learningType,
      // 所要時間の目安。コーストップの「目安 40分」「15分」はこれを積み上げて出す。
      // シード（CourseLessonSeed.minutes）と同じ値なので、教材ページの表示ともズレない。
      durationminutes: lesson.minutes,
      description: MODULE_DESCRIPTIONS[lesson.title] ?? `<h2>${lesson.title}</h2><p>このレッスンの本文です。</p>`,
      completion: 1,
      completiondata: { state: 0 },
    })),
  }));
}

// AIアプリ（/webcoach/ai-applications）
const aiApps = [
  { id: 1, name: '教材Q&Aチャット', category: '学習中に', hook: '教材を読んでいて「？」となったら', description: '本文を引用して質問すると、どこでつまずいているかを一緒に整理して、あなたに合わせた説明をしてくれる。', example: '「"余白を活かす"ってどういうこと？具体例がほしい」', icon: '💬', iconBg: '#FDF0F2', accent: '#C24358', url: 'https://example.com/qa-chat' },
  { id: 2, name: '学習プランナーAI', category: '学習中に', hook: '今週なにをやるか迷ったら', description: 'ロードマップと使える時間を伝えると、1週間分の学習計画を提案。忙しい週のリスケも相談できる。', example: '「今週は3時間しか取れない。何を優先すべき？」', icon: '🗓', iconBg: '#FDF0F2', accent: '#C24358', url: 'https://example.com/planner' },
  { id: 3, name: 'デザイン添削AI', category: '制作・課題に', hook: '作ったものに自信がないとき', description: 'バナーやLPの画像をアップすると、レイアウト・配色・文字組の観点で講評。提出前のセルフチェックに。', example: '「課題のバナーです。視線誘導の観点でアドバイスして」', icon: '🖼', iconBg: '#FBEACD', accent: '#B98A16', url: 'https://example.com/design-review' },
  { id: 4, name: '文章ブラッシュアップAI', category: '制作・課題に', hook: '言葉づかいに迷ったら', description: 'ポートフォリオの自己紹介文やバナーコピーを、目的と読み手に合わせて磨いてくれる。', example: '「ポートフォリオの自己PRを300字で自然にして」', icon: '✎', iconBg: '#FBEACD', accent: '#B98A16', url: 'https://example.com/writing' },
  { id: 5, name: 'キャリア相談AI', category: 'キャリア・コーチングに', hook: '将来がモヤモヤしてきたら', description: '働き方や案件の獲り方の悩みを整理。コーチングの前に考えをまとめておくのにも使える。', example: '「副業から始めたい。最初の一歩は何がいい？」', icon: '🧭', iconBg: '#EAF6ED', accent: '#2FA35C', url: 'https://example.com/career' },
  { id: 6, name: 'コーチング準備・ふりかえりAI', category: 'キャリア・コーチングに', hook: 'コーチングの前後に', description: '話したいことの整理と、ミーティングノートの要約・ネクストアクション抽出。ロードマップ更新の下書きにも。', example: '「今日のノートを要約して、来週やることを3つに絞って」', icon: '📋', iconBg: '#EAF6ED', accent: '#2FA35C', url: 'https://example.com/coaching-prep' },
];

// コーチ/運営向けの受講生一覧（GET /api/admin/students。実BFFには未実装のため全項目モック）
function formatLastAccess(unixSec: number): string {
  if (!unixSec) return '未ログイン';
  const d = new Date(unixSec * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const now = Math.floor(Date.now() / 1000);
const studentsStore = [
  { id: 501, username: 'sato_hanako', email: 'sato@example.com', firstname: '花子', lastname: '佐藤', fullname: '佐藤 花子', lastaccess: now - 3600, firstaccess: now - 60 * 86400, suspended: false, auth: 'manual', inactive_over_month: false, new_user: false },
  { id: 502, username: 'tanaka_ichiro', email: 'tanaka@example.com', firstname: '一郎', lastname: '田中', fullname: '田中 一郎', lastaccess: now - 40 * 86400, firstaccess: now - 90 * 86400, suspended: false, auth: 'manual', inactive_over_month: true, new_user: false },
  { id: 503, username: 'suzuki_misaki', email: 'suzuki@example.com', firstname: '美咲', lastname: '鈴木', fullname: '鈴木 美咲', lastaccess: now - 2 * 86400, firstaccess: now - 12 * 86400, suspended: false, auth: 'manual', inactive_over_month: false, new_user: true },
  { id: 504, username: 'yamamoto_kenta', email: 'yamamoto@example.com', firstname: '健太', lastname: '山本', fullname: '山本 健太', lastaccess: 0, firstaccess: now - 5 * 86400, suspended: false, auth: 'manual', inactive_over_month: false, new_user: true },
  { id: 505, username: 'ito_ayumi', email: 'ito@example.com', firstname: '歩美', lastname: '伊藤', fullname: '伊藤 歩美', lastaccess: now - 5 * 3600, firstaccess: now - 130 * 86400, suspended: false, auth: 'manual', inactive_over_month: false, new_user: false },
].map((s) => ({ ...s, lastaccess_formatted: formatLastAccess(s.lastaccess) }));

// 次回コーチングまでの目標（セッション内で保持：AI細分化やコーチングページからの生成を
// マイページに反映させるため、GET/PUT で同じストアを読み書きする）
// マイページ側は読み取り専用表示のため、コーチが前回のコーチングで設定した内容として初期値を持たせる
// （journeyの現在地=「バナーを作ってみよう」と揃えてある）
// ストアの実体は mocks/coachingGoalsStore.ts（coachingHandlers.ts の confirm-goals からも
// 追記するため独立モジュールにしてある。詳細はそちらのヘッダコメント）。

// 今日のTODO（セッション内で保持）
let dailyTodosStore: { id: number; text: string; done: boolean }[] = [
  { id: 1, text: 'バナーを1つ作る', done: false },
  { id: 2, text: '配色の基本を復習する', done: false },
  { id: 3, text: '前回の課題を提出する', done: true },
];

// 学習ストリークは studyActivityHandlers.ts が学習アクティビティから算出する。
// ここに固定値を置くと「マイページは12日・集中ブースは5日」のような乖離が生まれるため、
// GET /webcoach/streak/:userid のハンドラも journey の streak も currentStreakInfo() を通す。

// コミュニティの盛り上がり（取り組んでいる活動別の直近人数。固定モック・1〜2時間おきにフロントで取得する想定）
const communityPulseMock = {
  totalToday: 91,
  updatedAt: new Date().toISOString(),
  rooms: [
    { id: 'lecture', activityLabel: '座学勉強中', count: 34, recentInitials: ['さ', 'ゆ', 'こ'] },
    { id: 'practice', activityLabel: '実践課題に取り組み中', count: 22, recentInitials: ['た', 'み'] },
    { id: 'projects', activityLabel: '案件に挑戦中', count: 8, recentInitials: ['あ'] },
    { id: 'focus-booth', activityLabel: '集中ブースで黙々作業', count: 27, recentInitials: ['り', 'は'] },
  ],
  // 「他の人の様子」用の匿名活動フィード（仮名＋匿名アイコン。実名・実写真は使わない）
  activityFeed: [
    { id: 'a1', nickname: 'うさぎ58', avatarEmoji: '🐰', activityLabel: 'バナー制作を学習中', tag: 'バナー制作' },
    { id: 'a2', nickname: 'こあら12', avatarEmoji: '🐨', activityLabel: 'HTML/CSSを復習中', tag: '復習中' },
    { id: 'a3', nickname: 'ぱんだ7', avatarEmoji: '🐼', activityLabel: '休憩から再開', tag: 'Lesson4' },
    { id: 'a4', nickname: 'ひつじ33', avatarEmoji: '🐑', activityLabel: '課題に取り組み中', tag: '課題提出' },
  ],
};

// ==================== 集中ブース ====================
// 在室メンバー（仮名＋匿名アイコン。応援するとheartsが増える・セッション内で保持）。
// 🔴 人物の定義は studyPeers.ts が単一の正。ここで別名簿を持つと、
//    学習時間ランキング（studyActivityHandlers.ts）と顔ぶれが食い違う。
let focusBoothMembersStore: FocusBoothMember[] = STUDY_PEERS.slice(0, 6).map((p, i) => ({
  id: p.id,
  nickname: p.nickname,
  avatarEmoji: p.avatarEmoji,
  activityLabel: p.activityLabel,
  // 在室時間は週の学習時間そのものではないので、名簿の値から今日ぶんの目安に落とす
  elapsedMinutes: Math.round(p.weeklyMinutes / 3),
  hearts: 23 - i * 3,
  cheeredByMe: false,
}));

let myCheerCountToday = 3;

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
  http.post('*/api/webcoach/profile/:userid', async ({ request }) => {
    try {
      const body = (await request.json()) as Partial<Profile>;
      Object.assign(profile, body);
    } catch {
      /* ignore */
    }
    return HttpResponse.json(profile);
  }),
  /**
   * 選べるアイコン。
   * 🔴 以前は空配列を返していて、AvatarPicker を開いても何も並ばなかった。
   *    「アイコンを変えられるようになりたい」というレビュー指摘の実体はこれ。
   *    実運用では管理画面（/admin/avatars）が登録した画像が返る。モックでは
   *    外部画像に依存しない DiceBear の動物アイコンを並べる。
   */
  http.get('*/api/webcoach/avatars', () =>
    HttpResponse.json(
      ['cat', 'dog', 'rabbit', 'bear', 'panda', 'fox', 'penguin', 'koala', 'sheep', 'lion', 'frog', 'owl'].map(
        (seed, i) => ({
          avatar_id: i + 1,
          url: `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=FFECEE`,
        })
      )
    )
  ),

  // ==================== MyPage / ダッシュボード ====================
  http.get('*/api/webcoach/resumecourse/:userid', () => HttpResponse.json(resumeCourses)),

  // 「次におすすめ」3枠（実践／関連／1歩先）。
  // 続きから学ぶコースのカテゴリと難易度だけを根拠にする。判定は buildNextCourses に置いてあり、
  // 実BFFが同じ形を返すようになったらこのハンドラだけ落とせばよい。
  http.get('*/api/webcoach/recommend-courses', () => {
    const resumeId = resumeCourses[0]?.courseid;
    const base = catalog.find((c) => c.id === resumeId);
    const enrolledIds = userCourses.map((c) => c.id);
    return HttpResponse.json(buildNextCourses(base, catalog, enrolledIds));
  }),

  // AI教材検索。「配色が苦手」のような自由文から教材を選ぶ。
  // 判定は materialSearch.ts に置いてある（実BFFが同じ形を返すようになったらこのハンドラだけ落とせばよい）。
  http.post('*/api/webcoach/material-search', async ({ request }) => {
    let query = '';
    try {
      const body = (await request.json()) as { query?: string };
      query = typeof body?.query === 'string' ? body.query : '';
    } catch {
      /* 本文が壊れていても空クエリとして扱う */
    }
    return HttpResponse.json(
      searchMaterials(query, catalog, userCourses.map((c) => c.id), resumeCourses[0]?.courseid)
    );
  }),

  http.get('*/api/webcoach/community-pulse', () => HttpResponse.json(communityPulseMock)),

  // 学習セッションの記録は /webcoach/study-activities/:userid（studyActivityHandlers.ts）に移した。
  // 旧 /study-sessions はメモリ保持でリロードすると消え、統計・履歴・ストリークを検証できなかった。

  // 集中ブース: 雰囲気（集中中の人数・応援フィード件数・自分の本日の応援回数）
  http.get('*/api/webcoach/focus-booth/pulse', () =>
    HttpResponse.json({
      concentratingCount: 128,
      cheerFeedCount: 24,
      myCheerCountToday,
    })
  ),
  // 集中ブース: 在室メンバー
  http.get('*/api/webcoach/focus-booth/members', () => HttpResponse.json(focusBoothMembersStore)),
  // 集中ブース: 応援する
  http.post('*/api/webcoach/focus-booth/members/:id/cheer', ({ params }) => {
    const member = focusBoothMembersStore.find((m) => m.id === params.id);
    if (!member) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    if (!member.cheeredByMe) {
      member.hearts += 1;
      member.cheeredByMe = true;
      myCheerCountToday += 1;
    }
    return HttpResponse.json(member);
  }),
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

  // ==================== 学習コンテンツ（学習領域→コース→単元→レッスン） ====================
  // コース詳細（カリキュラム/教材ページが章立てを取得）
  http.get('*/api/moodle/courses/:courseid/contents', ({ params }) =>
    HttpResponse.json(buildSections(Number(params.courseid)))
  ),
  // アクティビティ完了状態（既定は cmid が偶数なら完了済み。トグル結果はそれを上書きする）
  http.get('*/api/moodle/activities/:cmid/completion', ({ params }) =>
    HttpResponse.json({ state: isLessonDone(Number(params.cmid)) ? 1 : 0 })
  ),
  // 完了トグル。これが無いと実BFFへ抜けて401→ログイン画面へ飛ばされる
  http.post('*/api/moodle/activities/:cmid/completion', async ({ params, request }) => {
    let completed = true;
    try {
      const body = (await request.json()) as { completed?: boolean };
      if (typeof body?.completed === 'boolean') completed = body.completed;
    } catch {
      /* ボディ無しは完了扱い（bffClient の既定値と揃える） */
    }
    setLessonDone(Number(params.cmid), completed);
    return HttpResponse.json({ status: true, state: completed ? 1 : 0 });
  }),
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
  // 次回コーチングまでの目標。コーチングノートで確定した目標もここに載る
  // （反映は coachingHandlers.ts の confirm-goals → coachingGoalsStore.reflectCandidates）。
  http.get('*/api/webcoach/next-coaching-goals/:userid', () => HttpResponse.json(listGoals())),
  http.put('*/api/webcoach/next-coaching-goals/:userid', async ({ request }) => {
    try {
      const body = (await request.json()) as { goals?: Parameters<typeof replaceGoals>[0] };
      if (Array.isArray(body?.goals)) return HttpResponse.json(replaceGoals(body.goals));
    } catch {
      /* ignore */
    }
    return HttpResponse.json(listGoals());
  }),
  http.get('*/api/webcoach/daily-todos/:userid', () => HttpResponse.json(dailyTodosStore)),
  http.put('*/api/webcoach/daily-todos/:userid', async ({ request }) => {
    try {
      const body = (await request.json()) as { todos?: typeof dailyTodosStore };
      dailyTodosStore = Array.isArray(body?.todos) ? body.todos : dailyTodosStore;
    } catch {
      /* ignore */
    }
    return HttpResponse.json(dailyTodosStore);
  }),
  // GET /webcoach/streak/:userid は studyActivityHandlers.ts が持つ（学習日ベース）
  http.get('*/api/webcoach/roadmaps', () => HttpResponse.json([])),
  http.get('*/api/moodle/badges', () =>
    HttpResponse.json([
      { id: 1, name: '学習スタートダッシュ', description: '初めてレッスンを完了した' },
      { id: 2, name: '3日連続ログイン', description: '3日連続で学習した' },
      { id: 3, name: '初回コーチング完了', description: '初回のコーチングセッションを完了した' },
      { id: 4, name: 'バナー制作マスター', description: 'バナー制作の教材を完了した' },
      { id: 5, name: '配色レア発見', description: '配色の基礎教材を完了した' },
      { id: 6, name: '週間チャレンジャー', description: '週の目標学習時間を達成した' },
      { id: 7, name: '案件挑戦者', description: '案件に応募した' },
      { id: 8, name: 'エピック学習者', description: '100時間学習した' },
    ])
  ),
  http.get('*/api/moodle/user-badges/:userid', () =>
    HttpResponse.json([
      { id: 1, badgeid: 1, userid: MOCK_USER_ID, dateissued: Math.floor(Date.now() / 1000) - 28 * 86400, uniquehash: 'mockhash1' },
      { id: 2, badgeid: 2, userid: MOCK_USER_ID, dateissued: Math.floor(Date.now() / 1000) - 14 * 86400, uniquehash: 'mockhash2' },
      { id: 3, badgeid: 3, userid: MOCK_USER_ID, dateissued: Math.floor(Date.now() / 1000) - 3 * 86400, uniquehash: 'mockhash3' },
    ])
  ),
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
    let hasImage = false;
    try {
      const body = (await request.json()) as { message?: string; image?: string };
      message = body?.message || '';
      hasImage = !!body?.image;
    } catch {
      /* ignore */
    }

    // 画像が添付されている場合は、画像を読み取った体で回答する（モック）
    if (hasImage) {
      return HttpResponse.json({
        success: true,
        message:
          '画像を拝見しました。バナーのようですね。よく作り込まれています！さらに良くするなら、\n\n① **主役を1つに絞る**：いちばん伝えたい要素（キャッチ or 写真）を大きく、他は控えめに。\n② **余白を足す**：文字と端の間に少し余白を取ると一気に洗練されます。\n③ **色数を3色まで**：ベース・メイン・アクセントで統一感が出ます。\n\nどの点から直したいか教えてください。一緒に直していきましょう！',
        sources: [
          { chunk_index: 0, module_name: 'デザインの4大原則', filename: 'principles.md', section_name: '基礎知識', similarity: 0.79 },
        ],
        suggestions: ['余白の取り方を詳しく', '配色の直し方は？', 'この構成でOK？'],
        timestamp: '2026-07-09T00:00:00Z',
      });
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
  http.get('*/api/webcoach/journey/:userid', () => {
    // 学習アクティビティを単一の正とし、ここでは導出のみ行う（別々に持って乖離させない）
    const streak = currentStreakInfo(MOCK_USER_ID);
    return HttpResponse.json({
      goal: 'Webデザイナーとして初案件を獲得する',
      streak: {
        current: streak.days,
        best: streak.best ?? streak.days,
        last7days: streak.week.map((d) => d.studied),
      },
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
    });
  }),

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

  // ==================== コーチ/運営: 受講生一覧 ====================
  // 実BFFには /api/admin/students が存在しないため、コーチ側の受講生一覧・詳細ページ用にモックする
  http.get('*/api/admin/students', () => HttpResponse.json({ students: studentsStore })),

  // ==================== AIコーチングノート ====================
  // 取り込み・非同期処理・要約・目標確定。量が多いので coachingHandlers.ts に分離している。
  ...coachingHandlers,

  // ==================== 教材学習ワークスペース ====================
  // 教材目次・構造化教材・教材準拠のAI回答・メモ/クリップ/保存回答。
  // 量が多いので lessonHandlers.ts に分離している。
  ...lessonHandlers,
  ...noteHandlers,

  // ==================== AIコーチの専門モード ====================
  // 従来「AIアプリ」として別タブで開いていたものを、AIコーチの専門モードとして内包する。
  // 本番ではこのエンドポイントがDify呼び出しの境界になる。aiSkillHandlers.ts に分離している。
  ...aiSkillHandlers,

  // ==================== 学習ロードマップ（LearningPlan） ====================
  // 初回質問→自動生成→受講生による調整→月次更新案。
  // 量が多いので learningPlanHandlers.ts に分離している。
  ...learningPlanHandlers,

  // ==================== 集中ブース: 学習アクティビティ ====================
  // タイマー記録・統計・ストリーク。localStorage永続化のため studyActivityHandlers.ts に分離している。
  // 🔴 GET /webcoach/streak/:userid もこちらが持つ（上の固定モックは削除済み）。
  ...studyActivityHandlers,

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

  // ==================== 🔴 最後に置くこと: BFF宛の取りこぼしを止めるフタ ====================
  // dev プレビューの CloudFront は /api/* を実BFFに転送している。モックが無いAPIを
  // 素通しすると、擬似トークンが弾かれて 401 → ログイン画面へ強制遷移 → プレビューの
  // サブパス外に出て AccessDenied、という事故になる。ここで止めて 501 を返し、
  // 「モックが足りない」ことがコンソールで分かるようにする。
  http.all('*/api/*', ({ request }) => {
    const url = new URL(request.url);
    // BFF以外（例: ui-avatars.com/api/...）は素通し
    const bffOrigin = process.env.REACT_APP_BFF_URL;
    const isBff = bffOrigin ? url.href.startsWith(bffOrigin) : url.origin === window.location.origin;
    if (!isBff) return passthrough();

    console.error(
      `[mock] 未実装のモックAPIです: ${request.method} ${url.pathname}\n` +
        '  → frontend/src/mocks/handlers.ts にハンドラを追加してください。'
    );
    return HttpResponse.json(
      { error: 'Not mocked', method: request.method, path: url.pathname },
      { status: 501 }
    );
  }),
];
