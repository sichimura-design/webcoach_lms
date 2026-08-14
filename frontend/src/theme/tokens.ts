/**
 * WEBCOACH LMS — Design Tokens (マイページ / ホーム 2026-07 デザイン)
 *
 * 使い方:
 *   import { t } from '../theme/tokens';
 *   <div style={{ background: t.color.bg.card, borderRadius: t.radius.card, boxShadow: t.shadow.card }} />
 *
 * ルール:
 *   1. 新しい色・角丸・影・サイズをコンポーネント内に直書きしない。必ずここに追加してから参照する。
 *   2. 既存の frontend/src/theme/colors.ts (#D60934 系) は旧デザイン。新規画面ではこのファイルを使う。
 *   3. 値はデザインモック WebcoachHomeLayered.dc.html のインライン style から 1:1 で写経したもの。推測値なし。
 */

export const t = {
  color: {
    /** ブランド赤。CTA・アクティブ状態・アクセントすべてこの1色 */
    primary: '#D60934',
    primaryHover: '#B50829',
    /** 赤の淡い背景（アクティブなナビ、バッジ地） */
    primarySoft: '#FDEEEF',
    /** 赤の枠線（セカンダリボタン） */
    primaryBorder: '#F3C7CB',
    /** 未着手チェックの破線 */
    primaryDashed: '#F0A9AF',

    text: {
      /** 見出し・本文の既定色 */
      primary: '#1F1A1B',
      /** 濃いめの本文（チェックボックス枠など） */
      strong: '#2B2426',
      /** ナビ項目・ステップラベル */
      body: '#4A4244',
      /** 補助テキスト（日付・キャプション） */
      muted: '#8A8082',
      /** さらに薄い補助（目標値・未着手ステップ） */
      subtle: '#A29A9C',
      /** 完了済み（取り消し扱い） */
      done: '#9E9698',
      /** 小見出しの副次テキスト */
      secondary: '#6B6365',
    },

    bg: {
      page: '#FDFBFB',
      card: '#FFFFFF',
      sidebar: '#FFFFFF',
      /** ナビ・行の hover */
      hover: '#FAF7F7',
      /** イラストのレターボックス地（ロビー画のクリーム色） */
      illustration: '#F7F2EC',
    },

    border: {
      /** カード外周 */
      card: '#F2EDED',
      /** サイドバー・区切り線 */
      line: '#F0EBEB',
      /** 未着手ステップの円 */
      muted: '#EFE4E5',
      /** 未着手ステップの破線コネクタ */
      stepDashed: '#F0DDDF',
    },

    /** オンライン表示のドット */
    success: '#2FA35C',
    /** 「修了」タグの淡い背景 */
    successSoft: '#EAF6ED',

    streak: {
      on: '#D60934',
      off: '#F7DADC',
    },

    /** 進捗バーの未達成部分（学習コンテンツページで追加。ハンドオフのdc.html実測値） */
    progressTrack: '#F5E9EA',
    /** セクション間・チップ間の区切り線（border.lineとは別の実測値。学習コンテンツページで追加） */
    divider: '#EDE6E6',

    /** コースのカテゴリ色（design_handoff_materialsのREADME「カテゴリ色」表に準拠。design/careerは既存トークンを再利用） */
    category: {
      design: '#D60934',
      coding: '#D9930D',
      marketing: '#8B5CD6',
      career: '#2FA35C',
    },

    /**
     * 「次におすすめ」3枠のバッジ色。枠の意味を色でも区別する。
     * カテゴリ色と同じ色相を使うが、意味は別（枠の種類 ≠ 学習領域）なので独立したトークンにする。
     */
    recommendSlot: {
      practice: { fg: '#2FA35C', bg: '#EAF6ED' },
      related: { fg: '#D9930D', bg: '#FBF1DC' },
      ahead: { fg: '#8B5CD6', bg: '#F2ECFC' },
    },
  },

  radius: {
    /** 大カード */
    card: 20,
    /** カード内のカード（メンバー行）・イラスト枠 */
    inner: 14,
    /** ナビ項目 */
    nav: 12,
    /** 主要ボタン */
    button: 12,
    /** イラスト上のボタン */
    buttonOnImage: 10,
    pill: 999,
  },

  shadow: {
    /** 全カード共通。非常に浅い */
    card: '0 2px 10px rgba(120,90,95,.04)',
    /** イラストに重ねる赤ボタン */
    buttonPrimary: '0 8px 20px rgba(214,9,52,.28)',
  },

  space: {
    /** メイン領域の padding: 上 右/左 下 */
    pageTop: 34,
    pageX: 42,
    pageBottom: 56,
    /** メイン領域のセクション間 */
    stack: 22,
    /** 3カラムグリッドの gap */
    grid: 20,
    /** カード内 padding（縦・横） */
    cardY: 22,
    cardX: 24,
    /** 横並び要素の既定 gap */
    row: 14,
  },

  font: {
    family: "'Noto Sans JP', sans-serif",
    /** 見出しは 900、本文 400、ラベル 700 */
    weight: { regular: 400, medium: 500, bold: 700, black: 900 },
    size: {
      pageTitle: 30,      // おかえりなさい、モックさん！
      heroTitle: 26,      // Lesson 4 バナー制作の基礎
      statValue: 23,      // 4 時間 35 分 / 128 時間
      cardTitle: 15.5,    // 次回コーチングまでの目標 / ギルドロビー
      roadmapTitle: 16,
      body: 14,           // チェックリスト項目
      memberName: 13.5,
      label: 12.5,        // 日付・リンク・ステップラベル
      small: 12,          // キャプション
      xsmall: 11.5,       // メンバーの学習内容
      micro: 11,          // バッジ内テキスト
    },
    /** CONTINUE ラベル用 */
    letterSpacingWide: '.08em',
  },

  layout: {
    /** ページシェルの設計幅。これ未満は横スクロール（潰さない） */
    shellMinWidth: 1700,
    sidebarWidth: 222,
    /** 目標 / ギルドロビー / メンバー の3カラム比 = 実測 390:550:330 */
    mainGridColumns: '1.18fr 1.66fr 1fr',
    /** CONTINUE カードのアート幅 */
    heroArtWidth: 200,
    /** ロビーイラスト枠の最小高 */
    lobbyMinHeight: 210,
  },
} as const;

export type Tokens = typeof t;
