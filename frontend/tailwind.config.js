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
          border:    '#EFE7D6',  // ボーダー
          footer:    '#2B2440',  // フッター背景
        },
      },
      // ★ グラデーション（アンバー→ピンク）
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FFC24B, #FF5A7A)',
      },
      // ★ フォント
      fontFamily: {
        ja: ['Noto Sans JP', 'sans-serif'],
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
