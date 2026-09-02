/**
 * frontend/src/mocks/courseCatalog.ts
 * コースカタログのモック（/moodle/courses・/moodle/categories・/moodle/getcoursebyfield の元データ）。
 *
 * 領域とコースの構成そのものは constants/courseTaxonomy.ts が持つ。
 * ここが足すのはモック固有の肉付け（説明文・目安時間・向いている人）だけで、
 * コース名・領域・IDを二重に書かない。書くと必ず片方だけ直して食い違う。
 *
 * import の向き（循環を避けるため崩さないこと）:
 *   constants/courseTaxonomy.ts ← lessonHandlers.ts ← courseCatalog.ts ← handlers.ts
 * courseTaxonomy は import を持たない葉。画面（MaterialsTopPage など）は
 * courseTaxonomy だけを見て、このモジュールには触らない。
 */
import type { Category } from '../types/api';
import { AREA_COURSES, COURSES, COURSE_ID_BY_SLUG, COURSE_KIND, courseKindOf } from '../constants/courseTaxonomy';
import { courseLessonCount } from './lessonHandlers';

export type MockCourse = {
  id: number; fullname: string; shortname: string;
  categoryid: number; categoryname: string; summary: string;
  courseimage?: string; tags: { rawname: string }[];
  duration: string;
  /** 総レッスン数。buildCourseStructure から導出するので、コーストップの単元表示と必ず一致する */
  lessoncount: number;
  /** カード表示用の「どんな人向けか」タグ。tags（種類）とは別で、絞り込みには使わない */
  purposes: string[];
};

/** slug → コースIDの別名。フィクスチャからIDを参照するときはこれを使う（リテラル禁止） */
export const COURSE_ID = COURSE_ID_BY_SLUG;

/** モック固有の肉付け。キーは courseTaxonomy の slug */
const DETAILS: Record<string, { summary: string; duration: string; purposes: string[] }> = {
  // ソフトスキル
  mindset: { summary: '何をどの順で学ぶか、続けるために何を決めておくかを整理します', duration: '40分', purposes: ['未経験向け', '最初におすすめ'] },
  // キャリア
  'job-change': { summary: '求人リサーチ・自己分析から書類・面接対策までのテキスト教材', duration: '90分', purposes: ['キャリアを変える', '副業準備'] },

  // Webデザイン
  'design-basics': { summary: '近接・整列・反復・コントラストなど、デザインの土台になる考え方', duration: '60分', purposes: ['未経験向け', '最初におすすめ'] },
  figma: { summary: '制作の現場で使うFigmaを、触りながら覚える', duration: '70分', purposes: ['ツールを覚える', '基礎から'] },
  canva: { summary: 'テンプレートから素早く形にするための操作と考え方', duration: '45分', purposes: ['未経験向け', 'ツールを覚える'] },
  writing: { summary: 'SEOライティングとコピーライティング。読まれる文章の型', duration: '80分', purposes: ['基礎から', '副業準備'] },
  illustrator: { summary: 'ロゴや図形を扱うためのIllustratorの基本操作', duration: '75分', purposes: ['ツールを覚える'] },
  photoshop: { summary: '写真の補正・合成・書き出しまでのPhotoshopの基本操作', duration: '75分', purposes: ['ツールを覚える'] },
  'banner-dojo': { summary: '数をこなして手を速くする。お題つきのバナー特訓', duration: '180分', purposes: ['デザイン力UP', '実践で学ぶ'] },
  'practice-logo': { summary: 'ヒアリングから展開まで、ロゴを1件仕上げる', duration: '120分', purposes: ['実践で学ぶ', '作品を作る'] },
  'practice-business-card': { summary: '限られた面積で情報を整える、名刺のデザイン課題', duration: '90分', purposes: ['実践で学ぶ', '作品を作る'] },
  'practice-sns-design': { summary: '投稿・ストーリーズ・バナーをセットで組む課題', duration: '100分', purposes: ['実践で学ぶ', '発信を伸ばす'] },
  'practice-ec-banner': { summary: '売り場で戦うバナーとパッケージを作る課題', duration: '120分', purposes: ['実践で学ぶ', '案件獲得'] },
  'practice-lp': { summary: '伝わる順番を設計し、LPを1枚仕上げる', duration: '150分', purposes: ['実践で学ぶ', '作品を作る'] },
  'practice-portfolio-site': { summary: '案件応募で見せられる自分の作品集を仕上げる', duration: '180分', purposes: ['作品を作る', '案件獲得'] },

  // Web制作
  wix: { summary: 'コードを書かずにサイトを公開するところまで', duration: '60分', purposes: ['未経験向け', '最初におすすめ'] },
  wordpress: { summary: '案件で一番よく使うCMSを一通り触る', duration: '120分', purposes: ['副業準備', '案件獲得'] },
  'vscode-setup': { summary: 'エディタと拡張機能をそろえて、書き始められる状態にする', duration: '30分', purposes: ['未経験向け', '基礎から'] },
  'html-css': { summary: 'Web制作に必要なHTMLとCSSをやさしく学びます', duration: '110分', purposes: ['未経験向け', '基礎から'] },
  javascript: { summary: 'ページに動きをつけるための第一歩', duration: '120分', purposes: ['基礎から'] },
  jquery: { summary: '現場に残っているjQueryの読み方と書き方', duration: '70分', purposes: ['案件獲得'] },
  shopify: { summary: 'ネットショップの構築とテーマのカスタマイズ', duration: '110分', purposes: ['案件獲得'] },
  devtools: { summary: 'ブラウザの開発者ツールで、崩れの原因を自分で見つける', duration: '45分', purposes: ['基礎から', '実践で学ぶ'] },

  // 動画編集
  capcut: { summary: 'スマホでもできるカット・テロップ・BGMの基本', duration: '60分', purposes: ['未経験向け', '最初におすすめ'] },
  'premiere-pro': { summary: '納品を前提にした編集ワークフローと書き出し設定', duration: '140分', purposes: ['ツールを覚える', '副業準備'] },
  'practice-thumbnail': { summary: 'クリックされるサムネイルの作り方を課題で身につける', duration: '60分', purposes: ['実践で学ぶ', '作品を作る'] },
  'practice-short-video': { summary: '冒頭3秒で離脱させないショート動画を1本仕上げる', duration: '120分', purposes: ['実践で学ぶ', '発信を伸ばす'] },
  'practice-ad-video': { summary: '目的と訴求を決めてから作る、Web広告動画の課題', duration: '130分', purposes: ['実践で学ぶ', '案件獲得'] },
  'practice-service-video': { summary: 'サービスの魅力を順序立てて伝える紹介動画の課題', duration: '140分', purposes: ['実践で学ぶ', '案件獲得'] },
  'practice-portfolio-movie': { summary: '実績としてまとめるポートフォリオムービーを作る', duration: '150分', purposes: ['作品を作る', '案件獲得'] },

  // Webマーケティング
  'marketing-overview': { summary: '集客の全体像と施策の考え方をやさしく解説', duration: '60分', purposes: ['未経験向け', '最初におすすめ'] },
  'google-analytics': { summary: '見るべき指標を絞って、次の一手を決められるようになる', duration: '80分', purposes: ['数字を読む', '基礎から'] },
  'search-console': { summary: '検索の流入をどう読み、どこを直すかを判断する', duration: '60分', purposes: ['数字を読む'] },
  heatmap: { summary: 'どこまで読まれてどこで離れたかを可視化して改善する', duration: '45分', purposes: ['数字を読む', '実践で学ぶ'] },
  seo: { summary: '検索から人が来るサイトと記事の組み立て方', duration: '100分', purposes: ['基礎から', '副業準備'] },
  'meta-ads': { summary: 'Instagram・Facebook広告の設計と運用の型', duration: '110分', purposes: ['案件獲得'] },
  'google-ads': { summary: '検索意図に合わせたキーワードと入札の考え方', duration: '110分', purposes: ['案件獲得'] },
  'tiktok-ads': { summary: '短尺クリエイティブを前提にした広告運用', duration: '90分', purposes: ['案件獲得'] },
  'line-ads': { summary: '友だち追加を軸にしたLINE広告の設計', duration: '80分', purposes: ['案件獲得'] },
  meo: { summary: '店舗の地図検索で見つけてもらうための運用', duration: '70分', purposes: ['案件獲得'] },
  'hpb-review': { summary: 'ホットペッパービューティーの掲載を、集客の観点で添削する', duration: '60分', purposes: ['案件獲得', '実践で学ぶ'] },

  // SNS運用
  instagram: { summary: 'アカウント設計から投稿運用、数字の見方まで', duration: '120分', purposes: ['最初におすすめ', '発信を伸ばす'] },
  x: { summary: 'テキスト中心のSNSで、届く投稿を積み上げる', duration: '90分', purposes: ['発信を伸ばす'] },
  'short-video-creator': { summary: '企画・撮影・編集・投稿までを一貫してこなせる状態を目指す', duration: '240分', purposes: ['実践で学ぶ', '副業準備'] },
  'maria-short-video': { summary: 'インフルエンサーMariaさんと作った、人を惹きつける企画術', duration: '120分', purposes: ['発信を伸ばす', 'デザイン力UP'] },
  'sns-buzz': { summary: 'ターゲット設定と試行錯誤の回し方。バズの前提を整える', duration: '180分', purposes: ['発信を伸ばす', '基礎から'] },
  camera: { summary: 'スマホを超える画作りのための、実機カメラの基本', duration: '90分', purposes: ['ツールを覚える'] },

  // 案件獲得攻略プログラム
  'client-work-program': { summary: '営業・提案・見積もり・納品までを通しで攻略する', duration: '240分', purposes: ['副業準備', '案件獲得'] },

  // 生成AI基礎
  'genai-basics': { summary: 'AIの著作権や市場感など、使う前に押さえたい前提', duration: '70分', purposes: ['未経験向け', '最初におすすめ'] },
  'genai-passport': { summary: '生成AIパスポートの試験範囲に沿った対策講座', duration: '180分', purposes: ['基礎から', 'キャリアを変える'] },

  // Web×AI
  'ai-design': { summary: '案の広げ方から仕上げまで、デザインの工程にAIを組み込む', duration: '100分', purposes: ['AIを使う', 'デザイン力UP'] },
  'ai-coding': { summary: '実装・レビュー・詰まったときの調べ方をAIと進める', duration: '100分', purposes: ['AIを使う', '実践で学ぶ'] },
  'ai-writing': { summary: '構成案からリライトまで、書く工程をAIで速くする', duration: '80分', purposes: ['AIを使う'] },
  'ai-movie': { summary: '素材づくり・字幕・要約など編集の周辺をAIに任せる', duration: '90分', purposes: ['AIを使う'] },
  'ai-sns': { summary: '企画の量産と反応の分析をAIで回す', duration: '80分', purposes: ['AIを使う', '発信を伸ばす'] },
};

/**
 * コースのサムネイル画像。キーは courseTaxonomy の slug、値は
 * frontend/public/images/courses/ 配下のファイル名。
 *
 * 実BFF（Moodle）は courseimage に保護URLを返すが、モックには画像が無いので
 * ここで public の静的ファイルに差し替える。**未登録のコースは文字組みサムネ**
 * （CourseTile / CourseArt のフォールバック）になるので、1枚ずつ足していける。
 *
 * 🔴 リテラルのコースIDをキーにしないこと。ID は領域code*100+連番で採番されるので、
 *    領域内の並びを1つ変えると全部ずれる。slug は動かない。
 */
const COURSE_THUMBNAILS: Record<string, string> = {
  // 画像が届いたらここに追記する（例: 'design-basics': 'design-basics.png'）
};

/**
 * カタログ本体。tags（＝種類）は courseKindOf から機械的に決める。
 * 手で「基礎知識」「実践課題」を振らないので、コースを足しても未分類が出ない。
 */
export const catalog: MockCourse[] = COURSES.map((course) => {
  const detail = DETAILS[course.slug];
  const kind = courseKindOf({ fullname: course.name });
  const thumbnail = COURSE_THUMBNAILS[course.slug];
  return {
    id: course.id,
    fullname: course.name,
    shortname: course.slug,
    categoryid: Math.floor(course.id / 100),
    categoryname: course.areaName,
    summary: detail?.summary ?? '',
    // サブパス配信（dev プレビューの /branches/<slug>/）でも壊れないよう PUBLIC_URL 起点にする
    ...(thumbnail ? { courseimage: `${process.env.PUBLIC_URL}/images/courses/${thumbnail}` } : {}),
    tags: [{ rawname: kind === COURSE_KIND.practice ? COURSE_KIND.practice : '基礎知識' }],
    duration: detail?.duration ?? '60分',
    lessoncount: courseLessonCount(course.id),
    purposes: detail?.purposes ?? [],
  };
});

/** 学習領域（/moodle/categories）。coursecount は数えて出す。手書きにすると必ずドリフトする */
export const categories: Category[] = AREA_COURSES.map((area) => ({
  id: area.code,
  name: area.name,
  description: area.description,
  coursecount: area.courses.length,
}));

export const courseInCatalog = (id: number): MockCourse | undefined => catalog.find((c) => c.id === id);
