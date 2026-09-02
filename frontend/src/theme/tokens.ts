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

    /**
     * 学習領域の色（文字色 fg と、サムネ・見出しの地色 bg）。
     *
     * 領域は10個あるが、色は5つしか作らない。10領域に10色を割ると近い色相が並んで
     * 「色が違うこと」自体が情報を持たなくなるため、constants/courseTaxonomy.ts の
     * family（何をしているか）でまとめる。領域名はタイルに文字で出るので、
     * 色が担うのは family までの粗さでよい。
     *
     *   create … Webデザイン / 動画編集
     *   build  … Web制作
     *   grow   … Webマーケティング / SNS運用
     *   career … ソフトスキル / キャリア / 案件獲得攻略プログラム
     *   ai     … 生成AI基礎 / Web×AI
     *
     * create/build/grow/career の4色は旧カテゴリ色（design_handoff_materials の
     * README「カテゴリ色」表）をそのまま引き継ぐ。ai だけ、赤・琥珀・紫・緑の隣で
     * 唯一空いていた青緑を足した。
     */
    category: {
      create: { fg: '#D60934', bg: '#FDEEEF' },
      build: { fg: '#D9930D', bg: '#FBF1DC' },
      grow: { fg: '#8B5CD6', bg: '#F2ECFC' },
      career: { fg: '#2FA35C', bg: '#EAF6ED' },
      ai: { fg: '#1E88A8', bg: '#E7F2F6' },
      /** family が引けない領域（実BFFの独自カテゴリ名など） */
      unknown: { fg: '#8A8082', bg: '#F4F1F1' },
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

    /*
     * コースタイルのサムネ地色（thumb: 赤/ダーク/クリームの3テーマ）は廃止した。
     * courseId を3で割った余りで振り分けていて、領域とも進捗とも関係が無く、
     * 一覧が意味の読めない色の寄せ集めになっていた。
     * いまは上の category（family 単位の淡いトーン）を CourseArt が使う。
     */
  },

  radius: {
    /** 大カード */
    card: 20,
    /** カード内のカード（メンバー行）・イラスト枠 */
    inner: 14,
    /** タイル（コースタイル・学習中の行・AI検索バー） */
    tile: 16,
    /** ナビ項目 */
    nav: 12,
    /** 主要ボタン */
    button: 12,
    /** イラスト上のボタン */
    buttonOnImage: 10,
    /**
     * プルダウン・入力補助など「押しボタンではないが操作はできる」コントロール。
     * pill にすると押しボタンと見分けがつかなくなるので一段浅くする。
     */
    control: 9,
    /** クリックできない状態ラベル（受講中・修了などのバッジ）。pill と明確に差をつける */
    badge: 5,
    /**
     * pill はクリックできる要素だけに使う（ボタン・チップ・タブ）。
     * 進捗バーのような「線の端の丸め」も対象外ではないが、
     * 面を持つ矩形に使うときは必ずクリックできるものに限る。
     */
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

  /**
   * 🔴 size はここに持たない。フォントサイズは index.css の :root にある
   *    CSS カスタムプロパティ（--dc-fs-caption / -body / -lead / -title /
   *    -display）が唯一の情報源。詳細は frontend/docs/typography.md。
   *
   *    かつてここに size を持っていたが、実際に参照されていたのは pageTitle の
   *    1箇所だけで、残りは各コンポーネントの生px直書き（13 / 12.5 / 11.5 / 11px）
   *    に散っていた。結果この系統の画面（学習する・領域一覧）だけが
   *    他ページより一段小さい文字のまま取り残されたので、size は撤去した。
   */
  font: {
    family: "'Noto Sans JP', sans-serif",
    /**
     * 400 説明・補足 / 500 UIラベル・ナビ / 600 ボタン・タスク名 / 700 見出し・重要な数値。
     * 🔴 800〜900 は作らない。かつて black: 900 があり、この系統の画面は
     *    見出しから小さなバッジまで全部 900 で組まれていた。赤が強いUIなので
     *    太字まで強くすると画面全体がうるさくなる（typography.md §4）。
     */
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
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
