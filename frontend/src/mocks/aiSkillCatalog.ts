/**
 * frontend/src/mocks/aiSkillCatalog.ts
 * 専門モードごとの内部設定。**モック専用**。
 *
 * ここが「AIコーチ → 裏側のDifyアプリ」の対応表にあたる。
 * 本番では BFF が同じ対応をサーバ側で持ち、`internalApp` に対応する
 * Difyアプリの資格情報へ解決して代理呼び出しする。
 *
 * 重要: `internalApp` を UI へ渡してはならない。
 *   ユーザーに見せるのは「制作物添削モード」であって「デザイン添削AIというアプリ」ではない。
 *   ここが漏れると、せっかく1つのAI体験に統一した意味が無くなる。
 *   UI が使ってよいのは types/aiSkill.ts のラベル群だけ。
 *
 * `internalApp` の値は既存テーブル webcoach_ai_application の想定運用に合わせている。
 * tags 列に `skill:design-review` を入れておけば新規カラムを追加せずに対応表を作れる。
 */

import { AiSkillVerdict, ConcreteAiSkillId } from '../types/aiSkill';

/** 添削・改善の観点。教材ブロックの種別に応じて実際に当てるので、飾りではない */
export interface SkillAspect {
  label: string;
  /** この観点にヒットさせたい教材の語。教材側に無ければ basis を付けない */
  terms: string[];
  /** 教材に根拠が見つからなかったときの既定評価 */
  fallbackVerdict: AiSkillVerdict;
  comment: string;
}

export interface AiSkillMockConfig {
  /** 裏で呼ぶDifyアプリの識別子。UIには出さない */
  internalApp: string;
  /** 全体講評の書き出し */
  summaryTemplate: (heading: string) => string;
  aspects: SkillAspect[];
  /** 文章改善のように「修正案」を返すスキルか */
  producesRevision: boolean;
  /**
   * 修正案の書式。producesRevision のスキルで、既定（文章の組み替え）と
   * 出す形が違うものだけ指定する。コピー案なら「案を3本並べる」形になる。
   * @param source ユーザーが渡した文章（引用または質問文）
   */
  revisionTemplate?: (source: string, topHeading: string | null) => string;
  /** LLM呼び出しに近い体感にするための遅延（ms） */
  latencyMs: number;
}

export const AI_SKILL_MOCK: Record<ConcreteAiSkillId, AiSkillMockConfig> = {
  learning: {
    // 'learning' は lesson-ai がそのまま担うので通常この設定は使われない。
    // セレクタで手動指定されたときの保険として置いておく。
    internalApp: 'webcoach-qa-chat',
    summaryTemplate: (heading) => `「${heading}」を軸に、質問の内容を教材へ紐づけて整理しました。`,
    aspects: [
      {
        label: '教材との対応',
        terms: [],
        fallbackVerdict: 'good',
        comment: '質問の内容が教材のどの説明に当たるかを確認しました。',
      },
    ],
    producesRevision: false,
    latencyMs: 700,
  },

  'design-review': {
    internalApp: 'webcoach-design-review',
    summaryTemplate: (heading) =>
      `教材「${heading}」の基準で見ると、伝えたいことは伝わる構成になっています。優先度の付け方に絞って直すと、もう一段良くなります。`,
    // 観点は「一般的なデザインチェックリスト」ではなく、教材が教えている判断基準に寄せる。
    // 教材と無関係な観点を並べると、教材基準で添削していることにならない。
    // 最後の「仕上げ」だけは教材に記述が無い想定で、根拠なしの表示も確認できるようにしてある。
    aspects: [
      {
        label: '目的の絞り込み',
        terms: ['目的', '絞', '伝えたい', '見てほしい'],
        fallbackVerdict: 'improve',
        comment:
          'いちばん伝えたいことが1つに絞れているかを確認してください。同じ強さの要素が並ぶと、何も印象に残らなくなります。',
      },
      {
        label: '優先順位のつけ方',
        terms: ['優先', '支え', '弱め', '強く', '目立'],
        fallbackVerdict: 'improve',
        comment:
          '目的を支えない要素が弱められているかを見てください。消す・小さくする・色を落とすのいずれかで十分です。',
      },
      {
        label: '伝わるかの検証',
        terms: ['検証', '数秒', '最初に目に入る', '見直し', '確認'],
        fallbackVerdict: 'improve',
        comment:
          '時間をおいて見たとき、いちばん見てほしいものが最初に目に入るかを確かめてください。',
      },
      {
        label: '仕上げ（配色・余白・文字組）',
        terms: ['配色', 'アクセント', '余白', '行間', '書体'],
        fallbackVerdict: 'good',
        comment:
          '構成が決まっていれば、細部の詰めは後からで間に合います。色数を絞り、余白を揃えるだけでも整います。',
      },
    ],
    producesRevision: false,
    latencyMs: 950,
  },

  writing: {
    internalApp: 'webcoach-writing',
    summaryTemplate: (heading) =>
      `教材「${heading}」の考え方に沿って、読み手が判断しやすい順序に整えました。`,
    aspects: [
      {
        label: '結論の位置',
        terms: ['結論', '要点', '最初に'],
        fallbackVerdict: 'improve',
        comment: '読み手が最初の1文で全体を把握できるように、結論を先に置きます。',
      },
      {
        label: '一文の長さ',
        terms: ['一文', '短く', '読みやすさ'],
        fallbackVerdict: 'improve',
        comment: '一文に2つ以上の主張が入っている箇所を分けました。',
      },
      {
        label: '具体性',
        terms: ['具体', '例', '数字'],
        fallbackVerdict: 'improve',
        comment: '「頑張りました」のような主観を、何をどれだけやったかに置き換えます。',
      },
    ],
    producesRevision: true,
    latencyMs: 900,
  },

  idea: {
    internalApp: 'webcoach-idea',
    summaryTemplate: (heading) =>
      `「${heading}」を起点に、いま決められることと後回しにできることを分けました。`,
    aspects: [
      {
        label: 'いま決めること',
        terms: ['目的', 'ターゲット', '決める'],
        fallbackVerdict: 'improve',
        comment: '誰に何を伝えたいかを一言で書き出すところから始めます。ここが決まらないと後の判断がすべて揺れます。',
      },
      {
        label: '後回しにできること',
        terms: ['装飾', '仕上げ', '細部'],
        fallbackVerdict: 'good',
        comment: '見た目の作り込みは、構成が決まってからで間に合います。',
      },
      {
        label: '次の一歩',
        terms: ['次', '手順', '進め方'],
        fallbackVerdict: 'improve',
        comment: '今日のうちに終わる大きさまで分解します。15分で終わる作業に切ると着手できます。',
      },
    ],
    producesRevision: false,
    latencyMs: 800,
  },

  // 旧「専門用語AIアシスタント」。UIでは「用語・文章をわかりやすくする」。
  glossary: {
    internalApp: 'webcoach-glossary',
    summaryTemplate: (heading) =>
      `「${heading}」で出てくる言葉を、初めて聞く人にも通じる説明に置き換えました。`,
    aspects: [
      {
        label: '言い換え',
        terms: ['つまり', '意味', 'とは'],
        fallbackVerdict: 'good',
        comment:
          '同じ内容を、日常の言葉だけで言い直します。専門用語を残すのは、他の教材でも同じ語が出てくるときだけにします。',
      },
      {
        label: 'たとえ',
        terms: ['例', 'たとえ'],
        fallbackVerdict: 'good',
        comment: '身近な場面に置き換えて、何のために使う言葉なのかを先に伝えます。',
      },
      {
        label: '混同しやすい語',
        terms: ['違い', '一方', '対して'],
        fallbackVerdict: 'improve',
        comment: '似た言葉と並べて、どちらを指しているのかを確かめてください。ここを曖昧にすると後で読み違えます。',
      },
    ],
    producesRevision: true,
    revisionTemplate: (source) => {
      const head = source.length > 40 ? `${source.slice(0, 40)}…` : source;
      return [
        `【やさしい言い方】${head} は、ひとことで言うと「◯◯するための考え方」です。`,
        '',
        '【たとえると】はじめて訪れた店で、まず看板を探すのと同じ動きです。',
        '',
        '【使う場面】教材の中でこの語が出てきたら、上の言い換えに置き換えて読み進めてください。',
        '',
        '※ ◯◯の部分は、いま読んでいる教材の文脈に合わせて埋めています。',
      ].join('\n');
    },
    latencyMs: 750,
  },

  quiz: {
    internalApp: 'webcoach-quiz',
    summaryTemplate: (heading) =>
      `「${heading}」の範囲から確認します。答えを口に出して説明できれば身についています。`,
    aspects: [
      {
        label: '用語を説明できるか',
        terms: ['とは', '意味', '定義'],
        fallbackVerdict: 'improve',
        comment: '教材の言葉をそのまま覚えるのではなく、自分の言葉で言い直せるかを確かめます。',
      },
      {
        label: '判断の理由を言えるか',
        terms: ['なぜ', '理由', '目的'],
        fallbackVerdict: 'improve',
        comment: '「そうする理由」を1文で言えるかどうかが、次の制作で使えるかの分かれ目になります。',
      },
      {
        label: '自分の制作物に当てられるか',
        terms: ['当てはめ', '実際に', '自分の'],
        fallbackVerdict: 'improve',
        comment: 'いま作っているものの中から、この考え方を使った箇所を1つ挙げてください。',
      },
    ],
    producesRevision: false,
    latencyMs: 800,
  },

  // 旧「キャッチコピーアイデアメーカー」。UIでは「キャッチコピーを考える」。
  copy: {
    internalApp: 'webcoach-copy',
    summaryTemplate: (heading) =>
      `「${heading}」の考え方に沿って、狙いの違う案を並べました。良い案を選ぶより、狙いを選んでください。`,
    aspects: [
      {
        label: '誰に向けるか',
        terms: ['ターゲット', '誰に', '読み手'],
        fallbackVerdict: 'improve',
        comment: '相手が1人に絞れていないと、どの案も同じくらい弱く見えます。まず相手を決めます。',
      },
      {
        label: '約束していること',
        terms: ['ベネフィット', '価値', '伝えたい'],
        fallbackVerdict: 'improve',
        comment: '相手にとって何が良くなるのかを、機能ではなく結果で書きます。',
      },
      {
        label: '言い切りの強さ',
        terms: ['短く', '言い切', '強い'],
        fallbackVerdict: 'good',
        comment: '説明を足すほど弱くなります。削れる語を削ってから比べてください。',
      },
    ],
    producesRevision: true,
    revisionTemplate: (source) => {
      const head = source.length > 30 ? `${source.slice(0, 30)}…` : source || 'この商品';
      return [
        `A案（悩みから入る）　${head}で、もう迷わない。`,
        `B案（結果を約束する）　${head}が、3日で形になる。`,
        `C案（相手を名指しする）　はじめての人のための、${head}。`,
        '',
        '※ A〜Cは狙いが違います。良い案を選ぶのではなく、いま伝えたい狙いを選んでください。',
      ].join('\n');
    },
    latencyMs: 850,
  },

  application: {
    internalApp: 'webcoach-application',
    summaryTemplate: () =>
      '募集内容に対して、相手が採否を判断できる順序に組み替えました。実績は書ける範囲だけで足ります。',
    aspects: [
      {
        label: '募集内容との対応',
        terms: ['要件', '募集', '条件'],
        fallbackVerdict: 'improve',
        comment: '相手が挙げている条件に、1つずつ短く答えます。ここが無い応募文はまず読まれません。',
      },
      {
        label: '出せる実績',
        terms: ['実績', 'ポートフォリオ', '制作物'],
        fallbackVerdict: 'improve',
        comment: '近い制作物を1点だけ選び、何を担当したかを添えます。点数は多くしません。',
      },
      {
        label: '進め方の提示',
        terms: ['納期', '進め方', '連絡'],
        fallbackVerdict: 'improve',
        comment: '着手できる日と連絡が取れる時間を書きます。相手の不安はほぼここです。',
      },
    ],
    producesRevision: true,
    revisionTemplate: (source) => {
      const head = source.length > 40 ? `${source.slice(0, 40)}…` : source;
      return [
        '【はじめに】募集内容を拝見し、◯◯の部分でお力になれると考えご連絡しました。',
        '',
        `【できること】${head || '募集内容にある作業'}を、着手から納品まで担当できます。`,
        '',
        '【近い実績】◯◯を制作しました（担当：構成・デザイン）。URL：◯◯',
        '',
        '【進め方】◯月◯日から着手でき、平日は◯時〜◯時に連絡が取れます。',
        '',
        '※ ◯◯はご自身の内容に置き換えてください。実績は近いもの1点で足ります。',
      ].join('\n');
    },
    latencyMs: 900,
  },

  // 旧「AI面接シミュレーター」。UIでは「AIと面接練習をする」。
  interview: {
    internalApp: 'webcoach-interview',
    summaryTemplate: () =>
      '面接官役として質問します。答えたら、伝わり方の観点で振り返ります。言い直しは何度でもできます。',
    aspects: [
      {
        label: '結論から答えているか',
        terms: ['結論', '最初に'],
        fallbackVerdict: 'improve',
        comment: '最初の1文で答えを言い、そのあとに理由を足します。経緯から話すと要点が埋もれます。',
      },
      {
        label: '具体で裏づけているか',
        terms: ['具体', '数字', '実績'],
        fallbackVerdict: 'improve',
        comment: '「頑張りました」を、何をどれだけやったかに置き換えます。',
      },
      {
        label: '長さ',
        terms: [],
        fallbackVerdict: 'improve',
        comment: '1問あたり30秒〜1分に収めます。長い答えは覚えてもらえません。',
      },
    ],
    producesRevision: false,
    latencyMs: 850,
  },

  // 旧「案件抽出メーカー」。UIでは「自分に合う案件を探す」。
  'job-search': {
    internalApp: 'webcoach-job-search',
    summaryTemplate: () =>
      'いま受けられる条件から整理しました。案件を広く見るより、受けられる形を決める方が先に進みます。',
    aspects: [
      {
        label: 'できること',
        terms: ['得意', 'できる', 'スキル'],
        fallbackVerdict: 'improve',
        comment: '完成まで一人で運べる作業だけを挙げます。学習中のものは分けて考えます。',
      },
      {
        label: '使える時間',
        terms: ['時間', '週', '納期'],
        fallbackVerdict: 'improve',
        comment: '週に確実に取れる時間で考えます。ここを多めに見積もると納期で苦しくなります。',
      },
      {
        label: '単価の目安',
        terms: ['単価', '報酬', '価格'],
        fallbackVerdict: 'good',
        comment: '最初の数件は実績づくりを優先しても構いませんが、下限は決めておきます。',
      },
    ],
    producesRevision: false,
    latencyMs: 800,
  },

  tooling: {
    internalApp: 'webcoach-tooling',
    summaryTemplate: () =>
      '手元の環境で起きている問題なので、教材の内容ではなく切り分けの順序で見ていきます。',
    aspects: [
      {
        label: '再現条件',
        terms: [],
        fallbackVerdict: 'improve',
        comment: 'どの操作をしたときに起きるかを固定します。毎回起きるのか、特定の手順だけかで原因が変わります。',
      },
      {
        label: '直前の変更',
        terms: [],
        fallbackVerdict: 'improve',
        comment: '直前に変えた設定やファイルを1つずつ戻して、どれが引き金かを確かめます。',
      },
      {
        label: 'メッセージの確認',
        terms: [],
        fallbackVerdict: 'improve',
        comment: '画面に出ている文言をそのまま読み取ります。原因の大半はそこに書かれています。',
      },
    ],
    producesRevision: false,
    latencyMs: 750,
  },
};

export default AI_SKILL_MOCK;
