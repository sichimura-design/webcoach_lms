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
        // ★ プロジェクト固有ブランドカラー
        brand: {
          DEFAULT:   '#E86D78',  // プライマリピンク
          secondary: '#FA9262',  // セカンダリオレンジ
          text:      '#4B3A33',  // ダークテキスト
          muted:     '#7E6E68',  // ミュートテキスト
          subtle:    '#C2B9B3',  // サブテキスト・アイコン
          bg:        '#FDFCF8',  // ページ背景
          border:    '#F0EAE6',  // ボーダー
          footer:    '#7E6E68',  // フッター背景
        },
      },
      // ★ グラデーション
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #E86D78, #FA9262)',
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
