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
