# Moodle SPA AI テストエージェント

Claude AI（Agent SDK）と Playwright MCP を使ったE2Eテスト自動化ツールです。
テストの実行・失敗分析・修正提案をClaudeが自律的に行います。

## 仕組み

```
agent.ts
  └─ @anthropic-ai/claude-agent-sdk (query)
       └─ Claude Opus 4.6
            └─ @playwright/mcp (MCP Server)
                 └─ Chromium ブラウザ
                      └─ http://localhost:3000
```

1. `agent.ts` がテストシナリオをプロンプトとしてClaudeに渡す
2. ClaudeはPlaywright MCPのツールを使ってブラウザを操作する
3. スクリーンショット・DOM解析・クリック・入力など全てClaudeが判断して実行
4. 失敗した場合は原因分析と修正提案を自動で出力する

Playwright MCPが提供する主なツール:
- `browser_navigate` — URLに移動
- `browser_screenshot` — スクリーンショット取得
- `browser_snapshot` — DOM構造の取得
- `browser_click` — 要素クリック
- `browser_type` — テキスト入力
- `browser_wait_for` — 要素・状態の待機

## ディレクトリ構成

```
tests/ai-agent/
├── agent.ts        # メインエージェント（シナリオ定義 + 実行ロジック）
├── package.json    # 依存パッケージ
├── tsconfig.json   # TypeScript設定
└── USAGE.md        # このファイル
```

## セットアップ

```bash
# 1. 依存パッケージのインストール（初回のみ）
cd tests/ai-agent
npm install

# 2. 環境変数の設定
export ANTHROPIC_API_KEY="sk-ant-..."   # 必須: Anthropic APIキー
export TEST_EMAIL="user@example.com"    # 任意: テストユーザーのメール
export TEST_PASSWORD="password"         # 任意: テストユーザーのパスワード
export ADMIN_EMAIL="admin@example.com"  # 任意: 管理者メール
export APP_URL="http://localhost:3000"  # 任意: テスト対象URL（デフォルト: localhost:3000）
```

APIキーの取得: https://console.anthropic.com/settings/keys

## 実行方法

```bash
# フロントエンドをあらかじめ起動しておく（別ターミナル）
cd frontend && npm start

# エージェント実行
cd tests/ai-agent

npm run agent           # デフォルト: ログインページの基本テスト
npm run agent:login     # ログインフォームのテスト（無効な認証情報でのエラー表示確認）
npm run agent:courses   # コース一覧・詳細ページのテスト（要ログイン）
npm run agent:admin     # 管理画面アクセス制御のテスト
```

## シナリオの追加方法

`agent.ts` の `TEST_SCENARIOS` に追記するだけです:

```typescript
const TEST_SCENARIOS: Record<string, string> = {
  // 既存シナリオ...

  mypage: `
  以下のテストを実行してください:
  1. ログインして /mypage にアクセスしてください
  2. プロフィール情報が表示されることを確認してください
  3. バッジ一覧が表示されることを確認してください
  `,
};
```

追加後は以下で実行:
```bash
npm run agent mypage   # または ts-node agent.ts mypage
```

## 出力例

```
============================================================
Moodle SPA AI テストエージェント
シナリオ: login
対象URL: http://localhost:3000
============================================================

[Tool] browser_navigate
[Tool] browser_screenshot
[PASS] /login にリダイレクトされました
[Tool] browser_snapshot
[PASS] メール入力欄 (input[type=email]) が存在します
[PASS] パスワード入力欄 (input[type=password]) が存在します
[Tool] browser_type
[Tool] browser_click
[Tool] browser_wait_for
[FAIL] エラーメッセージが表示されませんでした
  実際の動作: ボタンクリック後、画面が変化しませんでした
  期待された動作: エラーメッセージが表示される
  考えられる原因: APIレスポンス待ちでローディング中の可能性
  修正提案: ローディングスピナーが消えるまで待機するロジックを追加

============================================================
テスト完了: 3/4 PASS
============================================================
```

## 注意事項

- Playwright MCPは実行時に自動インストールされる（`npx @playwright/mcp@latest`）
- ヘッドレスモードで動作する（ブラウザウィンドウは表示されない）
- `maxTurns: 30` に設定しているため、30ステップ以内に完了する
- APIコストはClaude Opus 4.6の料金が適用される（$5/1M input tokens）
