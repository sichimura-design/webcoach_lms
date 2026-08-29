/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // ─── デザイントークン ───────────────────
      colors: {
        // shadcn/ui 用 HSL 変数（既存）
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ★ プロジェクト固有ブランドカラー（デザイン方向性: ポップ・クエスト）
        brand: {
          DEFAULT:   '#FF5A7A',  // プライマリ（ビビッドピンク）
          secondary: '#FFC24B',  // セカンダリ（サニーアンバー）
          text:      '#2B2440',  // ダークテキスト（ディープネイビー）
          muted:     '#7A7392',  // ミュートテキスト
          subtle:    '#B7B0C4',  // サブテキスト・アイコン
          bg:        '#FFFDF8',  // ページ背景（明るいクリーム）
          surface:   '#FFFFFF',  // カード面
          tint:      '#FFF0EF',  // 淡いピンクの面（チップ/ホバー）
          border:    '#EFE7D6',  // ボーダー
          footer:    '#2B2440',  // フッター背景
          // セマンティック
          success:   '#3FC79A',  // 成功（ミント）
          warning:   '#E0A84E',  // 注意（アンバー）
          danger:    '#EF6B6B',  // エラー
          ink:       '#221E33',  // サイドバー等のダーク面
        },
        // ★ ダッシュボード/サイドバー改修用トークン（既存 brand.* とは別系統。
        //   既存28ファイルのピンク系表示への影響を避けるため、brand.* は変更せず追加のみ）
        dash: {
          primary:        '#E0242B',  // プライマリ（レッド、差し色）
          'primary-dark': '#D30F1A',  // プライマリ濃色（グラデーション/hover用）
          soft:           '#FFF1F2',  // 淡いレッド（hover/アクティブ面）
          bg:          '#FAF8F7',  // ページ背景（暖かいオフホワイト）
          sidebar:     '#FCF8F7',  // サイドバー面（ごく薄いグレージュ/ピンク）
          surface:     '#FFFFFF',  // カード面
          text:        '#171D2A',  // メインテキスト
          muted:       '#68707C',  // サブテキスト
          border:      '#EBE7E5',  // ボーダー
        },
      },
      // ★ グラデーション（アンバー→ピンク）
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FFC24B, #FF5A7A)',
        'dash-gradient': 'linear-gradient(135deg, #E0242B, #D30F1A)',
      },
      // ★ フォント（見出し=丸ゴシック、本文=Noto Sans JP）
      fontFamily: {
        ja: ['Noto Sans JP', 'sans-serif'],
        display: ['"Zen Maru Gothic"', '"Noto Sans JP"', 'sans-serif'],
      },
      boxShadow: {
        'brand-soft': '0 1px 2px rgba(43,36,64,0.04), 0 8px 24px rgba(43,36,64,0.06)',
        'brand-pop': '0 8px 0 rgba(43,36,64,0.05), 0 16px 34px rgba(255,90,122,0.22)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
