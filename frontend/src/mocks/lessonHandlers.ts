/**
 * frontend/src/mocks/lessonHandlers.ts
 * 教材学習ワークスペース（/course/:courseId?module=）のモックAPI。
 *
 * 実BFF（FastAPI）には以下のエンドポイントが存在しない。バックエンドは変更禁止のため、
 * ここで MSW を使って「あるべきAPI」を再現している。実装が固まったら
 * frontend/docs/learning-workspace-design.md の I/F をバックエンドチームへ渡す。
 *
 *   GET    /api/webcoach/courses/:courseId/outline
 *   GET    /api/webcoach/courses/:courseId/lessons/:lessonId
 *   POST   /api/webcoach/lesson-ai
 *   GET    /api/webcoach/lesson-notes/:lessonId
 *   PUT    /api/webcoach/lesson-notes/:lessonId
 *   GET    /api/webcoach/notes
 *   POST   /api/webcoach/notes
 *   DELETE /api/webcoach/notes/:id
 *
 * 設計上の判断:
 *  1. コースの構成（単元・レッスン）は本ファイルを単一の情報源にし、
 *     handlers.ts の buildSections（/moodle/courses/:id/contents）もここから導出する。
 *     レッスンページの目次と、コーストップ／マイページの表示がズレないようにするため。
 *  2. lesson-ai は「それらしい文章を返す」のではなく、要件§8の教材検索優先順位を
 *     実際にスコアリングで実装している。教材にヒットしなければ groundedInMaterial:false を
 *     返し、UI側で「教材だけでは判断できません」と明示的に区別させる。
 *  3. ノート類はハンドラ内で localStorage に永続化する。リロードしても消えないことが
 *     この機能の体験そのものなので、メモリ保持では検証にならない。
 *  4. lesson-ai の回答には専門モードの提案（suggestion）を同梱する。判定そのものは
 *     utils/aiSkillRouting.ts の純粋関数に委譲し、UIと同じ実装を通す。
 *     本番ではこの suggestion をサーバ側の正とする。
 */

import { http, HttpResponse } from 'msw';
import {
  LessonAiRequest,
  LessonAiResponse,
  LessonBlock,
  LessonBlockKind,
  LessonCheerRequest,
  LessonCheerResponse,
  LessonDoc,
  LessonOutline,
  OutlineLesson,
} from '../types/lesson';
import { readNoteStore, writeNoteStore } from './noteMigration';
import { currentStreakInfo } from './studyActivityHandlers';
import {
  findMigratedLesson,
  isMigratedCourse,
  migratedCourseName,
  migratedLessonCount,
  migratedOutline,
} from './migratedMaterials';
import { LearningType } from '../constants/learningTaxonomy';
import { COURSE_ID_BY_SLUG, courseById } from '../constants/courseTaxonomy';
import { SkillSuggestion } from '../types/aiSkill';
import { detectSkill } from '../utils/aiSkillRouting';

// ---- 共通ヘルパ ------------------------------------------------------------

/** 表示用HTMLから検索・AI根拠付け用のプレーンテキストを作る */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h2|h3|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

interface BlockSeed {
  id: string;
  heading: string;
  kind: LessonBlockKind;
  html: string;
  quiz?: LessonBlock['quiz'];
  media?: LessonBlock['media'];
}

function toBlocks(seeds: BlockSeed[]): LessonBlock[] {
  return seeds.map((s) => ({
    id: s.id,
    heading: s.heading,
    kind: s.kind,
    html: s.html,
    plain: stripHtml(s.html) + (s.quiz ? ' ' + s.quiz.question : ''),
    quiz: s.quiz,
    media: s.media,
  }));
}

// ---- コース構造（handlers.ts の buildSections もここから導出する）----------

export interface CourseLessonSeed {
  lessonId: number;
  title: string;
  minutes: number;
  /** レッスンに付ける学習タイプ。階層ではなく分類（constants/learningTaxonomy.ts） */
  learningType: LearningType;
}

/** 単元（コース内のテーマ別まとまり）。name には「単元1」のような序数を含めない。
 *  序数はUI側で unitLabel() を使って付ける。 */
export interface CourseSectionSeed {
  id: number;
  name: string;
  /** 単元の概要。コーストップの単元カードにそのまま出す */
  summary: string;
  lessons: CourseLessonSeed[];
}

/**
 * コースの単元構成を返す。レッスンIDは courseId*1000 + nn で採番し、
 * 既存の `?module=` ディープリンクと互換を保つ。
 *
 * 単元数は courseId から決まる 2〜4（+ふりかえり）で、コースごとに変える。
 * 全コースが同じ構成だと、一覧に出す「全Nレッスン」がどのコースも同じ数になり
 * カタログとして嘘になるため。単元1・単元2のIDとレッスンIDは従来のまま固定。
 */
export function buildCourseStructure(courseId: number): CourseSectionSeed[] {
  const lead = courseId * 1000;
  const depth = courseId % 3; // 0:5レッスン / 1:7レッスン / 2:9レッスン
  const sections: CourseSectionSeed[] = [
    {
      id: lead + 1,
      name: '基礎を理解する',
      summary: 'このコースで扱う考え方の土台をつかみます。手を動かす前に、なぜそれが必要なのかを理解します。',
      lessons: [
        { lessonId: lead + 11, title: 'イントロダクション', minutes: 8, learningType: 'intro' },
        { lessonId: lead + 12, title: '基本の考え方', minutes: 12, learningType: 'knowledge' },
      ],
    },
    {
      id: lead + 2,
      name: '手を動かす',
      summary: 'お手本をなぞりながら、学んだ考え方を実際の作業に落とし込みます。',
      lessons: [
        { lessonId: lead + 21, title: 'ハンズオン①', minutes: 14, learningType: 'drill' },
        { lessonId: lead + 22, title: 'ハンズオン②', minutes: 12, learningType: 'assignment' },
      ],
    },
  ];
  if (depth >= 1) {
    sections.push({
      id: lead + 3,
      name: '実践に近づける',
      summary: '実際の案件に近い題材で、判断に迷う場面の考え方を身につけます。',
      lessons: [
        { lessonId: lead + 31, title: 'ケーススタディ', minutes: 15, learningType: 'knowledge' },
        { lessonId: lead + 32, title: '応用ワーク', minutes: 18, learningType: 'drill' },
      ],
    });
  }
  if (depth >= 2) {
    sections.push({
      id: lead + 4,
      name: '仕上げる',
      summary: '理解の確認と、提出できる形の制作物づくりまで進めます。',
      lessons: [
        { lessonId: lead + 41, title: '確認テスト', minutes: 10, learningType: 'test' },
        { lessonId: lead + 42, title: '制作課題', minutes: 25, learningType: 'assignment' },
      ],
    });
  }
  sections.push({
    id: lead + 9,
    name: 'ふりかえり',
    summary: '学んだことを整理して、次にやることを決めます。',
    lessons: [
      { lessonId: lead + 91, title: 'まとめと次にやること', minutes: 7, learningType: 'review' },
    ],
  });
  return sections;
}

/** コースの総レッスン数。コース一覧の「全Nレッスン」を構造と一致させるために使う。 */
export function courseLessonCount(courseId: number): number {
  if (isMigratedCourse(courseId)) return migratedLessonCount(courseId);
  return buildCourseStructure(courseId).reduce((n, s) => n + s.lessons.length, 0);
}

/**
 * コース名。カタログ（courseCatalog.ts）を import すると循環するので、
 * import を持たない constants/courseTaxonomy.ts から引く。
 * 名前をここに書き写すと必ず片方だけ直してカタログと食い違う（実際に一度そうなっていた）。
 */
function courseName(courseId: number): string {
  // カタログを優先する。移行済み教材の bundle 側の名前（「AI×デザイナー」）と
  // カタログのコース名（「AI×デザイン」）は微妙に違うことがあり、一覧のタイルと
  // 教材ページで別名が出ると同じコースが2つあるように見えるため。
  return courseById(courseId)?.name ?? migratedCourseName(courseId) ?? `コース ${courseId}`;
}

/**
 * そのコースが扱うテーマ。汎用教材の文面を題材に寄せるために使う。
 * 判定は領域の family。IDのレンジで分けると、採番を変えた瞬間に全コースが
 * 同じテーマに倒れて気づけない。
 */
function courseTopic(courseId: number): { subject: string; artifact: string; check: string } {
  switch (courseById(courseId)?.family) {
    case 'build':
      return { subject: 'マークアップ', artifact: 'コード', check: '意図した見た目になっているか' };
    case 'grow':
      return { subject: '情報設計', artifact: '投稿・広告文', check: '読み手に伝わる順番になっているか' };
    case 'career':
      return { subject: '進め方の設計', artifact: '提案・計画', check: '相手が判断できる材料になっているか' };
    case 'ai':
      return { subject: 'AIの使い方', artifact: '指示文と成果物', check: '根拠を自分で確かめられるか' };
    default: // create（Webデザイン・動画編集）と未知のコース
      return { subject: 'デザイン', artifact: '制作物', check: '一番見てほしいものが最初に目に入るか' };
  }
}

// ---- 手書きレッスン：配色の基本（Webデザイン ＞ デザイン基礎 の「基本の考え方」枠）------
//
// 学習ワークスペースのショーケース。選択→解説／質問／クリップ、AIの根拠提示、
// 確認問題まで一通り体験できるだけの密度を持たせてある。
//
// 旧構成の「配色の基本とツール」（コース202）に置いていたが、新しい教材構成に
// 配色単独のコースは無い。リポジトリで一番密度の高いモックレッスンがURL直打ちしか
// 到達できない孤児にならないよう、デザイン基礎の中に置く。
// レッスンIDは buildCourseStructure の単元1「基本の考え方」枠（learningType:'knowledge'）
// に一致させる。ここを動かすときは noteMigration.ts のシードも一緒に直すこと。

const COLOR_LESSON_COURSE_ID = COURSE_ID_BY_SLUG['design-basics'];
export const COLOR_LESSON_ID = COLOR_LESSON_COURSE_ID * 1000 + 12;

const COLOR_BLOCKS: BlockSeed[] = [
  {
    id: 'color-role',
    heading: '配色の役割',
    kind: 'text',
    html: `<h2>1. 色を選ぶ前に、情報の役割を決める</h2>
<p>配色で最初に考えるべきことは「どの色がきれいか」ではありません。まず画面内の情報を、必ず見てほしいもの・次に見てほしいもの・補足情報に分けます。</p>
<p>情報の優先順位が決まっていないまま色を足すと、見出し・ボタン・装飾がすべて同じ強さになり、受講生が次に何を見ればいいか分からなくなります。</p>`,
  },
  {
    id: 'color-criteria',
    heading: '配色の役割',
    kind: 'callout',
    html: `<strong>このレッスンの判断基準</strong>
<p>最初は無彩色だけでレイアウトを組み、重要度が最も高い箇所にだけ色を加えます。色は「飾り」ではなく、視線を誘導するための機能として使います。</p>`,
  },
  {
    id: 'color-three',
    heading: '3つの色の役割',
    kind: 'text',
    html: `<h2>2. 3つの色の役割</h2>
<p><strong>ベースカラー</strong>は背景など広い面積に使い、情報を受け止める土台をつくります。<strong>メインカラー</strong>はサービスらしさやまとまりをつけるために使います。</p>
<p><strong>アクセントカラー</strong>は、CTAや重要な状態表示など、行動してほしい場所に限定して使います。目立つ色を複数箇所へ広げるほど、注目を集める力は弱くなります。</p>
<ul>
<li>ベースカラー：背景・大きな余白・カード面</li>
<li>メインカラー：見出し・区切り・ブランドを示す箇所</li>
<li>アクセントカラー：CTA・選択状態・重要な注意</li>
</ul>`,
  },
  {
    id: 'color-ratio',
    heading: '配色の比率',
    kind: 'text',
    html: `<h2>3. 比率は固定ルールではなく、優先順位を守る目安</h2>
<p>「70：25：5」のような比率は、どの制作物にも厳密に当てはめる規則ではありません。このレッスンでは、ベースが最も広く、アクセントが最も限定的に使えているかの確認目安として扱います。</p>
<p>重要なのは数値を合わせることではなく、CTA以外の赤を減らした結果、CTAが自然に目立っているかを確認することです。</p>`,
  },
  {
    id: 'color-example',
    heading: '配色の比率',
    kind: 'example',
    html: `<strong>改善イメージ</strong>
<p><b>改善前：</b>見出しも罫線もアイコンもCTAもすべて赤で、どこが重要なのか判断しづらい。</p>
<p><b>改善後：</b>見出しは濃いグレー、罫線は薄いグレー、CTAと現在地だけに赤を使用。</p>`,
  },
  {
    id: 'color-process',
    heading: '実践の手順',
    kind: 'text',
    html: `<h2>4. 実践するときの手順</h2>
<ol>
<li>すべてを無彩色にして、文字サイズと余白だけで優先順位をつける</li>
<li>サービスらしさを示したい見出しや区切りにメインカラーを加える</li>
<li>最も行動してほしいCTAへアクセントカラーを加える</li>
<li>他の色を一度隠し、CTAが最初に目に入るか確認する</li>
</ol>`,
  },
  {
    id: 'color-quiz',
    heading: '実践の手順',
    kind: 'quiz',
    html: `<strong>ここまでの確認</strong>`,
    quiz: {
      question: 'アクセントカラーを最初に使う場所として、このレッスンが推奨しているのはどこですか？',
      choices: [
        { text: 'すべての見出し', correct: false, explain: '見出しに広く使うと注目が分散します。このレッスンの「3つの色の役割」をもう一度確認しましょう。' },
        { text: '最も行動してほしいCTA', correct: true, explain: '正解です。アクセントカラーはCTAへ優先して使います。' },
        { text: 'すべてのカードの罫線', correct: false, explain: '罫線は薄いグレーで十分です。色は行動してほしい場所に限定します。' },
      ],
    },
  },
  {
    id: 'color-summary',
    heading: 'まとめ',
    kind: 'summary',
    html: `<h2>このレッスンのまとめ</h2>
<p>配色は色の好みではなく、情報の優先順位を視覚的に補強する手段です。無彩色で優先順位をつくり、メインカラーでまとまりを出し、アクセントカラーは行動してほしい一点に絞ります。</p>`,
  },
  {
    id: 'color-task',
    heading: '次にやること',
    kind: 'task',
    html: `<strong>実践課題</strong>
<p>制作中の画面を一度無彩色に戻し、CTA以外に使っている赤を洗い出してください。その後、最も重要な行動だけに赤を戻し、視線の流れを確認します。</p>
<p>制作物のスクリーンショットをAIコーチへ添付し、「この教材の配色手順に沿って、優先順位が崩れている箇所を指摘してください」と質問してみましょう。</p>`,
  },
];

const COLOR_LESSON: Omit<LessonDoc, 'prev' | 'next'> = {
  courseId: COLOR_LESSON_COURSE_ID,
  courseName: courseName(COLOR_LESSON_COURSE_ID),
  lessonId: COLOR_LESSON_ID,
  title: '配色の基本：色で情報の優先順位をつける',
  lead: '色を増やして見栄えをよくするのではなく、「何を一番見てほしいか」から配色を設計する方法を学びます。',
  goals: [
    'ベース・メイン・アクセントの役割を説明できる',
    'CTAへ視線を集める配色を判断できる',
  ],
  estimatedMinutes: 12,
  learningType: 'knowledge',
  materialFormat: 'text',
  blocks: toBlocks(COLOR_BLOCKS),
  summary: '色は飾りではなく、情報の優先順位を伝える機能として使う。',
  nextAction: '制作中の画面からCTA以外の赤を洗い出し、視線の流れを確認する。',
  source: 'structured',
};

// ---- 汎用レッスンビルダー --------------------------------------------------
//
// ショーケース以外のレッスンも、ブロック構造・確認問題・課題を備えた
// 「ちゃんと読めるレッスン」にする。全機能がどのレッスンでも検証できるようにするため。

function buildGenericBlocks(courseId: number, title: string, index: number): BlockSeed[] {
  const { subject, artifact, check } = courseTopic(courseId);
  const prefix = `g${index}`;

  return [
    {
      id: `${prefix}-overview`,
      heading: 'このパートの位置づけ',
      kind: 'text',
      html: `<h2>1. このパートで押さえること</h2>
<p>「${title}」では、${courseName(courseId)}のなかで${subject}の土台になる考え方を扱います。細かな手順を覚える前に、なぜその手順が必要なのかを理解しておくと、応用が効くようになります。</p>
<p>読み進めながら「自分の${artifact}ならどうなるか」を都度あてはめてみてください。手を動かす前に判断基準を持っておくことが、やり直しを減らす一番の近道です。</p>`,
    },
    {
      id: `${prefix}-criteria`,
      heading: 'このパートの位置づけ',
      kind: 'callout',
      html: `<strong>判断基準</strong>
<p>迷ったときは「${check}」に立ち返ります。この基準に照らして説明できない選択は、いったん保留にして構いません。</p>`,
    },
    {
      id: `${prefix}-concept`,
      heading: '基本の考え方',
      kind: 'text',
      html: `<h2>2. 基本の考え方</h2>
<p>${subject}では、要素を足していくほど良くなるわけではありません。まず目的を1つに絞り、それを支えない要素は削るか弱めます。</p>
<ul>
<li>目的：この${artifact}で相手にしてほしい行動を1つ決める</li>
<li>優先順位：目的を支える要素を強く、それ以外を弱くする</li>
<li>検証：他人が数秒見て、目的が伝わるかを確かめる</li>
</ul>`,
    },
    {
      id: `${prefix}-example`,
      heading: '具体例',
      kind: 'example',
      html: `<strong>よくあるつまずき</strong>
<p><b>改善前：</b>伝えたいことが複数あり、すべてを同じ強さで並べてしまう。結果として何も印象に残らない。</p>
<p><b>改善後：</b>最も伝えたい1つを目立たせ、残りは補足として弱める。情報量は変えずに伝わり方だけが変わる。</p>`,
    },
    {
      id: `${prefix}-process`,
      heading: '実践の手順',
      kind: 'text',
      html: `<h2>3. 実践の手順</h2>
<ol>
<li>目的を1文で書き出す</li>
<li>目的を支える要素と、そうでない要素に仕分ける</li>
<li>支えない要素を弱める（消す・小さくする・色を落とす）</li>
<li>時間をおいて見直し、${check}を確認する</li>
</ol>`,
    },
    {
      id: `${prefix}-quiz`,
      heading: '実践の手順',
      kind: 'quiz',
      html: `<strong>ここまでの確認</strong>`,
      quiz: {
        question: 'このレッスンが、要素を仕分けたあとに最初にやるべきこととして挙げているのはどれですか？',
        choices: [
          { text: '目的を支えない要素を弱める', correct: true, explain: '正解です。足すのではなく、弱めることから始めます。' },
          { text: '新しい要素を追加して情報量を増やす', correct: false, explain: '情報量を増やすと目的が埋もれます。「基本の考え方」を確認しましょう。' },
          { text: 'すべての要素を同じ強さに揃える', correct: false, explain: '同じ強さに揃えると優先順位が失われます。' },
        ],
      },
    },
    {
      id: `${prefix}-summary`,
      heading: 'まとめ',
      kind: 'summary',
      html: `<h2>このレッスンのまとめ</h2>
<p>${subject}は、足し算ではなく優先順位づけの作業です。目的を1つに決め、それを支えない要素を弱めることで、伝わる${artifact}になります。</p>`,
    },
    {
      id: `${prefix}-task`,
      heading: '次にやること',
      kind: 'task',
      html: `<strong>実践課題</strong>
<p>いま作っている${artifact}を開き、目的を1文で書き出してください。そのうえで、目的を支えていない要素を3つ挙げ、弱める方法を考えます。</p>
<p>迷ったら、${artifact}のスクリーンショットをAIコーチへ添付して「この教材の基準で添削してください」と質問してみましょう。</p>`,
    },
  ];
}

// ---- LessonDoc の組み立て --------------------------------------------------

function findLessonPosition(courseId: number, lessonId: number) {
  const sections = buildCourseStructure(courseId);
  const flat = sections.flatMap((s) => s.lessons);
  const index = flat.findIndex((l) => l.lessonId === lessonId);
  return { sections, flat, index };
}

/** aiSkillHandlers.ts からもレッスン本文を引くため export する */
export function buildLessonDoc(courseId: number, lessonId: number): LessonDoc | null {
  // 移行済みコースは Clipkit 由来の実教材をそのまま返す。
  const migrated = findMigratedLesson(courseId, lessonId);
  if (migrated) return migrated;

  const { flat, index } = findLessonPosition(courseId, lessonId);
  if (index < 0) return null;

  const current = flat[index];
  const prev = index > 0 ? { lessonId: flat[index - 1].lessonId, title: flat[index - 1].title } : null;
  const next = index < flat.length - 1 ? { lessonId: flat[index + 1].lessonId, title: flat[index + 1].title } : null;

  if (lessonId === COLOR_LESSON_ID) {
    return { ...COLOR_LESSON, prev, next };
  }

  const { subject, artifact, check } = courseTopic(courseId);
  return {
    courseId,
    courseName: courseName(courseId),
    lessonId,
    title: current.title,
    lead: `${courseName(courseId)}の「${current.title}」です。${subject}の判断基準を身につけ、自分の${artifact}にあてはめられる状態を目指します。`,
    goals: [
      `${subject}で迷ったときの判断基準を説明できる`,
      `${check}を自分で確認できる`,
    ],
    estimatedMinutes: current.minutes,
    learningType: current.learningType,
    materialFormat: 'text',
    blocks: toBlocks(buildGenericBlocks(courseId, current.title, index)),
    summary: `${subject}は足し算ではなく優先順位づけ。目的を1つに決め、支えない要素を弱める。`,
    nextAction: `自分の${artifact}で目的を1文にし、支えていない要素を3つ弱める。`,
    prev,
    next,
    source: 'structured',
  };
}

/**
 * レッスン完了状態のセッション内オーバーライド。
 * POST /moodle/activities/:cmid/completion（handlers.ts）が書き込み、
 * 完了状態API・目次の両方がこれを参照するので、完了トグルの結果が両方に反映される。
 */
const completionOverrides = new Map<number, boolean>();

export function setLessonDone(lessonId: number, done: boolean): void {
  completionOverrides.set(lessonId, done);
}

/** 既定は「偶数IDは完了扱い」。トグル済みのレッスンはその結果を優先する。 */
export function isLessonDone(lessonId: number): boolean {
  const override = completionOverrides.get(lessonId);
  return override !== undefined ? override : lessonId % 2 === 0;
}

function buildOutline(courseId: number): LessonOutline {
  const migrated = migratedOutline(courseId, isLessonDone);
  if (migrated) return migrated;

  const sections = buildCourseStructure(courseId);
  const flat = sections.flatMap((s) => s.lessons);
  const isDone = isLessonDone;
  const doneCount = flat.filter((l) => isDone(l.lessonId)).length;

  return {
    courseId,
    courseName: courseName(courseId),
    progressPercent: flat.length ? Math.round((doneCount / flat.length) * 100) : 0,
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      lessons: s.lessons.map((l) => ({
        lessonId: l.lessonId,
        title: l.title,
        minutes: l.minutes,
        learningType: l.learningType,
        state: isDone(l.lessonId) ? ('done' as const) : ('todo' as const),
      })),
    })),
  };
}

// ---- 教材検索（要件§8の優先順位）------------------------------------------

export interface ScoredBlock {
  block: LessonBlock;
  lessonId: number;
  lessonTitle: string;
  score: number;
  priority: number; // 1..5。小さいほど優先度が高い
}

/**
 * 日本語は分かち書きがないため、カタカナ／漢字／英数字の連続を2文字以上で
 * 切り出したものを検索語として扱う。簡易だが、教材本文への当たりは十分に取れる。
 */
function extractTerms(text: string): string[] {
  const matches = text.match(/[ァ-ヴー]{2,}|[一-龠々]{2,}|[A-Za-z0-9]{2,}/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function termHits(terms: string[], plain: string): number {
  return terms.reduce((n, term) => (plain.includes(term) ? n + 1 : n), 0);
}

/**
 * 教材ブロックを質問との関連でスコアリングする。
 * aiSkillHandlers.ts（専門モード）も同じ検索を使い、
 * 「AIコーチの回答」と「専門モードの添削」が別の教材を根拠にする事故を防ぐ。
 */
export function searchMaterial(req: LessonAiRequest): ScoredBlock[] {
  const doc = buildLessonDoc(req.courseId, req.lessonId);
  if (!doc) return [];

  const terms = extractTerms(`${req.question} ${req.selectedText ?? ''}`);
  const selected = (req.selectedText ?? '').trim();
  const scored: ScoredBlock[] = [];

  const push = (block: LessonBlock, lessonId: number, lessonTitle: string, priority: number, score: number) => {
    scored.push({ block, lessonId, lessonTitle, score, priority });
  };

  for (const block of doc.blocks) {
    // 優先度1: 選択された文章を含むブロック
    if (selected.length >= 2 && block.plain.includes(selected.slice(0, 40))) {
      push(block, doc.lessonId, doc.title, 1, 100 + termHits(terms, block.plain));
      continue;
    }
    // 優先度2: 選択文章を含む教材ブロック（blockId 一致）
    if (req.blockId && block.id === req.blockId) {
      push(block, doc.lessonId, doc.title, 2, 80 + termHits(terms, block.plain));
      continue;
    }
    // 優先度3: 同じ見出し内の前後文章
    if (req.heading && block.heading === req.heading) {
      push(block, doc.lessonId, doc.title, 3, 60 + termHits(terms, block.plain) * 3);
      continue;
    }
    // 優先度4: 同レッスン内の定義・手順・具体例
    const hits = termHits(terms, block.plain);
    if (hits > 0) {
      const kindBonus = block.kind === 'example' || block.kind === 'callout' || block.kind === 'task' ? 6 : 0;
      push(block, doc.lessonId, doc.title, 4, 30 + hits * 6 + kindBonus);
    }
  }

  // 優先度5: 同コース内の関連教材
  if (scored.length === 0 && terms.length > 0) {
    for (const lesson of buildCourseStructure(req.courseId).flatMap((s) => s.lessons)) {
      if (lesson.lessonId === req.lessonId) continue;
      const other = buildLessonDoc(req.courseId, lesson.lessonId);
      if (!other) continue;
      for (const block of other.blocks) {
        const hits = termHits(terms, block.plain);
        if (hits > 0) push(block, other.lessonId, other.title, 5, 10 + hits * 4);
      }
    }
  }

  return scored
    .sort((a, b) => (a.priority - b.priority) || (b.score - a.score))
    .slice(0, 3);
}

/** ブロックのプレーンテキストから、引用に使う一文を切り出す */
export function excerpt(plain: string, max = 90): string {
  const sentence = plain.split(/(?<=。)/).find((s) => s.trim().length > 12) ?? plain;
  const trimmed = sentence.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function buildAiAnswer(req: LessonAiRequest): LessonAiResponse {
  const hits = searchMaterial(req);
  const doc = buildLessonDoc(req.courseId, req.lessonId);

  // 優先度6: 教材にヒットしない → 一般知識であることを明示的に区別する
  if (hits.length === 0 || !doc) {
    return {
      conclusion: 'この教材だけでは判断できません。',
      basis: `「${doc?.title ?? 'このレッスン'}」には、いまの質問に直接答えている記述が見つかりませんでした。`,
      apply: '教材の範囲外の内容のため、以下は一般的な補足として扱ってください。教材に沿って進めたい場合は、関連する見出しを開いてから質問し直すと精度が上がります。',
      next: '同じコース内の別のレッスンを確認するか、コーチングで直接相談することをおすすめします。',
      sources: [],
      groundedInMaterial: false,
      generalNote:
        '一般的には、まず目的を1つに絞り、それを支えない要素を弱めることから始めると判断しやすくなります。ただしこれは教材に書かれている内容ではありません。',
    };
  }

  const top = hits[0];
  const sources = hits.map((h) => ({ blockId: h.block.id, heading: h.block.heading }));
  const taskBlock = doc.blocks.find((b) => b.kind === 'task');
  const hasImage = !!req.image;

  // 画像添付時は「教材の基準で添削する」トーンに寄せる
  if (hasImage) {
    return {
      conclusion: `添付された${doc.courseName}の制作物は、「${top.block.heading}」の基準で見直す余地があります。`,
      basis: `教材の「${top.block.heading}」では、${excerpt(top.block.plain)}と説明されています。`,
      apply: '画像内で、目的を支えていない要素が主役と同じ強さで並んでいないかを確認してください。一般論ではなく、この教材の手順に戻して判断します。',
      next: taskBlock ? excerpt(taskBlock.plain, 120) : doc.nextAction,
      sources,
      groundedInMaterial: true,
      generalNote: null,
    };
  }

  const quoted = (req.selectedText ?? '').trim();
  return {
    conclusion: excerpt(top.block.plain, 110),
    basis: `教材の「${top.block.heading}」では、${excerpt(top.block.plain, 120)}と説明されています。`,
    apply: quoted
      ? `選択した文章「${quoted.slice(0, 50)}${quoted.length > 50 ? '…' : ''}」は、${top.block.heading}の考え方をあなたのケースに当てはめる部分にあたります。`
      : `いま開いている「${doc.title}」の文脈では、${excerpt(hits[1]?.block.plain ?? top.block.plain, 90)}という点が判断の分かれ目になります。`,
    next: taskBlock ? excerpt(taskBlock.plain, 120) : doc.nextAction,
    sources,
    groundedInMaterial: true,
    generalNote: null,
  };
}

/**
 * 通常回答に添える専門モードの提案（仕様§4-2）。
 *
 * 判定は utils/aiSkillRouting.ts の純粋関数に委譲する。ここに判定を書くと、
 * UIが送信前に出す確認カードとサーバが返す提案が食い違い、
 * 「AIが言っていることと画面が違う」状態になる。
 */
function suggestFor(req: LessonAiRequest): SkillSuggestion {
  const doc = buildLessonDoc(req.courseId, req.lessonId);
  const taskBlock = doc?.blocks.find((b) => b.kind === 'task');
  return detectSkill({
    question: req.question,
    hasImage: !!req.image,
    quote: req.selectedText,
    currentSkillId: req.skillId ?? 'auto',
    contextHeading: req.heading ?? doc?.title ?? null,
    taskHeading: taskBlock?.heading ?? null,
  });
}

/** 💡かんたん解説（選択文章に対する短い説明） */
function buildBriefAnswer(req: LessonAiRequest): LessonAiResponse {
  const full = buildAiAnswer(req);
  if (!full.groundedInMaterial) {
    return { ...full, apply: '', next: '' };
  }
  const heading = req.heading ?? full.sources[0]?.heading ?? 'この教材';
  const quoted = (req.selectedText ?? '').trim();
  return {
    ...full,
    conclusion: `「${heading}」の説明に沿うと、${quoted ? `この文章は${full.conclusion}` : full.conclusion}`,
    apply: '',
    next: '',
  };
}

// ---- レッスン完了時のひと言 -------------------------------------------------
//
// 文章ベースの教材はレッスンの区切りが薄く、10本目でも1本目と同じ重さになっていた。
// 完了直後にAIコーチが一言添えて、そこに抑揚を作る。
//
// 🔴 定型文の配列からランダムに1本選ぶ、はやらない。それは変化して見えて実際には
//    毎回同じ重さで、「メリハリがない」という指摘そのものを直さない。
//    ここでは実データ（単元の位置・完了本数・ノート・連続日数）で段を決め、
//    その段の文にだけ実数を差し込む。
// 🔴 乱数を使わず、同じ状況なら必ず同じ文を返す。完了を取り消してもう一度完了した
//    ときに文が変わると、その一言が「その場の飾り」だと分かってしまう。
// 🔴 通常回（plain）ではほめない。毎回ほめると節目の祝いが効かなくなるので、
//    残り本数と次のレッスン名を言うだけに留める。

/** ひと言を組むために集めた実データ */
interface CheerFacts {
  courseName: string;
  sectionName: string;
  /** この単元の完了本数 / 総数（今回の1本を含む） */
  sectionDone: number;
  sectionTotal: number;
  /** コース全体の完了本数 / 総数（今回の1本を含む） */
  courseDone: number;
  courseTotal: number;
  nextTitle: string | null;
  /** このレッスンから取ったクリップ・AI回答の件数 */
  clips: number;
  /** このレッスンのメモ下書きの文字数 */
  memoChars: number;
  streakDays: number;
  askedCount: number;
}

/**
 * このレッスンに紐づくノート活動。
 * ノートストア（localStorage）が正なので、クライアントの申告は使わない。
 */
function lessonNoteActivity(lessonId: number): { clips: number; memoChars: number } {
  const store = readNoteStore();
  let clips = 0;
  for (const note of store.notes) {
    for (const block of note.blocks) {
      if (block.kind === 'clip' && block.source.lessonId === lessonId) clips += 1;
      if (block.kind === 'answer' && block.source?.lessonId === lessonId) clips += 1;
    }
  }
  return { clips, memoChars: (store.memos[String(lessonId)]?.text ?? '').trim().length };
}

function collectCheerFacts(
  courseId: number,
  lessonId: number,
  askedCount: number
): CheerFacts | null {
  const outline = buildOutline(courseId);
  const section = outline.sections.find((s) => s.lessons.some((l) => l.lessonId === lessonId));
  if (!section) return null;

  const flat = outline.sections.flatMap((s) => s.lessons);
  const index = flat.findIndex((l) => l.lessonId === lessonId);
  // 完了直後に呼ばれるが、目次がまだ追いついていない可能性を潰すために
  // 今回のレッスンは必ず完了として数える。
  const isDone = (l: OutlineLesson) => l.state === 'done' || l.lessonId === lessonId;

  const { clips, memoChars } = lessonNoteActivity(lessonId);
  return {
    courseName: outline.courseName,
    sectionName: section.name,
    sectionDone: section.lessons.filter(isDone).length,
    sectionTotal: section.lessons.length,
    courseDone: flat.filter(isDone).length,
    courseTotal: flat.length,
    nextTitle: index >= 0 && index < flat.length - 1 ? flat[index + 1].title : null,
    clips,
    memoChars,
    streakDays: currentStreakInfo().days,
    askedCount: Math.max(0, Math.floor(askedCount)),
  };
}

/**
 * 連続日数に触れる回。
 * 毎回言うと「5日連続」が背景になって効かないので、区切りの日数だけに絞る
 * （3・5・7日、その後は7日ごと）。
 */
function isStreakMilestone(days: number): boolean {
  return days === 3 || days === 5 || days === 7 || (days > 7 && days % 7 === 0);
}

function buildCheer(facts: CheerFacts): LessonCheerResponse {
  const remainInCourse = facts.courseTotal - facts.courseDone;
  const remainInSection = facts.sectionTotal - facts.sectionDone;

  // ── 節目 ──────────────────────────────────────────────
  if (facts.courseDone === facts.courseTotal) {
    return {
      tier: 'milestone',
      headline: 'コース完走',
      message: `「${facts.courseName}」全${facts.courseTotal}レッスンを走り切りました。ここで身につけた判断基準は、次のコースでもそのまま土台になります。`,
    };
  }
  if (remainInSection === 0) {
    return {
      tier: 'milestone',
      headline: '単元クリア',
      message: `単元「${facts.sectionName}」を完走です。${facts.sectionTotal}本かけて扱ってきた内容が、ここでひとまとまりになりました。`,
    };
  }
  // ちょうど半分を越えた1本だけ。以降の回で毎回言わないよう、越えた瞬間で判定する
  const half = facts.courseTotal / 2;
  if (facts.courseDone >= half && facts.courseDone - 1 < half) {
    return {
      tier: 'milestone',
      headline: '折り返し',
      message: `「${facts.courseName}」はこれで折り返しです。残り${remainInCourse}本。ここまで来た人はたいてい最後まで行きます。`,
    };
  }

  // ── 手応え（このレッスンで実際にやったこと）────────────
  const hasRecord = facts.clips > 0 || facts.memoChars >= 20;
  if (facts.askedCount > 0 && hasRecord) {
    return {
      tier: 'effort',
      headline: null,
      message: `${facts.askedCount}回質問して、手元にも記録を残しながら読み切りましたね。この進め方だと次に思い出せます。`,
    };
  }
  if (facts.askedCount > 0) {
    return {
      tier: 'effort',
      headline: null,
      message: `${facts.askedCount}回質問しながら読み切りましたね。分からないところを流さないのが、いちばん効く進め方です。`,
    };
  }
  if (facts.clips > 0) {
    return {
      tier: 'effort',
      headline: null,
      message: `${facts.clips}件クリップしながら読み進めましたね。あとで見返せる形が残っています。`,
    };
  }
  if (facts.memoChars >= 20) {
    return {
      tier: 'effort',
      headline: null,
      message: '自分の言葉でメモを残しながら進めましたね。読んだだけのときより、手を動かすときに出てきます。',
    };
  }

  // ── 積み上げ（連続日数の区切り）─────────────────────────
  if (isStreakMilestone(facts.streakDays)) {
    return {
      tier: 'streak',
      headline: `${facts.streakDays}日連続`,
      message:
        facts.streakDays >= 7
          ? `${facts.streakDays}日続いています。ここまで来ると、やらない日のほうが落ち着かないはずです。`
          : `${facts.streakDays}日続いています。この辺りを越えると、続けるほうが楽になります。`,
    };
  }

  // ── 通常回。ほめずに事実だけ ───────────────────────────
  if (facts.nextTitle) {
    return {
      tier: 'plain',
      headline: null,
      message: `1本読み切りました。単元「${facts.sectionName}」はあと${remainInSection}本、次は「${facts.nextTitle}」です。`,
    };
  }
  return {
    tier: 'plain',
    headline: null,
    message: `最後のレッスンまで来ました。未完了が${remainInCourse}本残っているので、目次から拾っていきましょう。`,
  };
}

// ---- ハンドラ --------------------------------------------------------------
// レッスン単位の下書き（memos）は noteMigration.ts のストアに同居している。
// ノート本体と同じ localStorage キーなので、読み書きの入口も共有する。

export const lessonHandlers = [
  // コースの目次（単元＞レッスン）
  http.get('*/api/webcoach/courses/:courseId/outline', ({ params }) =>
    HttpResponse.json(buildOutline(Number(params.courseId)))
  ),

  // レッスン本文（:courseId/outline より後ろに置くとパスが食い合わないので順序は問わないが、
  // 具体的なパスを先に並べる方針に合わせて outline の直後に置く）
  http.get('*/api/webcoach/courses/:courseId/lessons/:lessonId', ({ params }) => {
    const doc = buildLessonDoc(Number(params.courseId), Number(params.lessonId));
    if (!doc) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(doc);
  }),

  // 教材に根拠を置いたAI回答
  http.post('*/api/webcoach/lesson-ai', async ({ request }) => {
    let req: LessonAiRequest | null = null;
    try {
      req = (await request.json()) as LessonAiRequest;
    } catch {
      /* ignore */
    }
    if (!req || typeof req.question !== 'string') {
      return new HttpResponse(null, { status: 400 });
    }
    // 💡かんたん解説（brief）には提案を載せない。
    // 小さなポップオーバーに「専門モードでどうですか」を出すと騒がしく、
    // 「まず短く知りたい」という選択そのものを邪魔する。
    const answer =
      req.mode === 'brief'
        ? buildBriefAnswer(req)
        : { ...buildAiAnswer(req), suggestion: suggestFor(req) };
    // 実際のLLM呼び出しに近い体感にするため、わずかに遅延させる
    await new Promise((resolve) => setTimeout(resolve, req?.mode === 'brief' ? 260 : 620));
    return HttpResponse.json(answer);
  }),

  // 完了時のAIコーチのひと言
  http.post('*/api/webcoach/lesson-cheer', async ({ request }) => {
    let req: LessonCheerRequest | null = null;
    try {
      req = (await request.json()) as LessonCheerRequest;
    } catch {
      /* ignore */
    }
    if (!req || !Number.isFinite(req.courseId) || !Number.isFinite(req.lessonId)) {
      return new HttpResponse(null, { status: 400 });
    }
    const facts = collectCheerFacts(req.courseId, req.lessonId, req.askedCount ?? 0);
    if (!facts) return new HttpResponse(null, { status: 404 });

    // lesson-ai より短くする。祝う面の手前で待たされると熱が冷める
    await new Promise((resolve) => setTimeout(resolve, 240));
    const cheer: LessonCheerResponse = buildCheer(facts);
    return HttpResponse.json(cheer);
  }),

  // レッスン単位のメモ（自動保存）
  http.get('*/api/webcoach/lesson-notes/:lessonId', ({ params }) => {
    const store = readNoteStore();
    const entry = store.memos[String(params.lessonId)];
    return HttpResponse.json({ text: entry?.text ?? '', updatedAt: entry?.updatedAt ?? null });
  }),

  http.put('*/api/webcoach/lesson-notes/:lessonId', async ({ params, request }) => {
    let text = '';
    try {
      const body = (await request.json()) as { text?: string };
      text = typeof body?.text === 'string' ? body.text : '';
    } catch {
      /* ignore */
    }
    const store = readNoteStore();
    const updatedAt = new Date().toISOString();
    store.memos[String(params.lessonId)] = { text, updatedAt };
    writeNoteStore(store);
    return HttpResponse.json({ text, updatedAt });
  }),

  // マイノート（/webcoach/notes 系）は mocks/noteHandlers.ts に分離した。
  // このファイルは既に36KBあり、ノートは器＋ブロックのCRUDで独立した関心事のため。
  // レッスン単位の下書き（lesson-notes）は教材本文と対なのでここに残す。
];
