import { query } from "@anthropic-ai/claude-agent-sdk";

// ============================================================
// テストシナリオ定義
// ============================================================
const TEST_SCENARIOS: Record<string, string> = {
  login: `
以下のテストを実行してください:
1. http://localhost:3000 にアクセスしてください
2. ログインページ(/login)が表示されることを確認してください
3. メールアドレス欄とパスワード欄が存在することを確認してください
4. 無効なパスワード(wrong@example.com / wrongpassword)でログインを試みてください
5. エラーメッセージが表示されることを確認してください
6. 各ステップの結果と最終的なPass/Failを報告してください
`,

  courses: `
以下のテストを実行してください（ログインが必要です）:
1. http://localhost:3000/login にアクセスしてください
2. ログインしてください（環境変数 TEST_EMAIL, TEST_PASSWORD を使用）
3. /courses ページに移動してください
4. コース一覧が表示されることを確認してください
5. コースカードが1件以上存在することを確認してください
6. 最初のコースをクリックしてください
7. コース詳細ページが表示されることを確認してください
8. 各ステップの結果と最終的なPass/Failを報告してください
`,

  admin: `
以下のテストを実行してください:
1. http://localhost:3000/admin にアクセスしてください
2. 管理者でない場合 /mypage にリダイレクトされることを確認してください
3. 管理者ユーザーでログインしてください（環境変数 ADMIN_EMAIL, ADMIN_PASSWORD を使用）
4. /admin ページが表示されることを確認してください
5. 管理メニュー（CSVアップロード、ユーザー管理など）が存在することを確認してください
6. 各ステップの結果と最終的なPass/Failを報告してください
`,
};

// デフォルトのシナリオ（引数なし時）
const DEFAULT_TASK = `
以下のE2Eテストを実行してください:

1. http://localhost:3000 にアクセスしてください
2. /login にリダイレクトされることを確認してください
3. ログインフォームの要素（メール入力、パスワード入力、送信ボタン）を確認してください
4. ページのタイトルやロゴが表示されていることを確認してください
5. 各確認項目のPass/Failと、ページのスクリーンショットを取得してください
6. テスト結果サマリーを報告してください

問題が見つかった場合は、何が問題で、どう修正すべきかも提案してください。
`;

// ============================================================
// メイン処理
// ============================================================
async function main() {
  const scenario = process.argv[2];
  const task = scenario && TEST_SCENARIOS[scenario]
    ? TEST_SCENARIOS[scenario]
    : DEFAULT_TASK;

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  console.log("=".repeat(60));
  console.log("Moodle SPA AI テストエージェント");
  console.log(`シナリオ: ${scenario ?? "default"}`);
  console.log(`対象URL: ${baseUrl}`);
  console.log("=".repeat(60));

  for await (const message of query({
    prompt: task.replace("http://localhost:3000", baseUrl),
    options: {
      model: "claude-opus-4-6",
      maxTurns: 30,
      mcpServers: {
        // Playwright MCP: ブラウザ操作ツールを自動提供
        playwright: {
          command: "npx",
          args: ["@playwright/mcp@latest", "--browser", "chromium"],
        },
      },
      systemPrompt: `あなたはWebアプリケーションのE2Eテストエンジニアです。
Playwright MCPツールを使ってブラウザを操作し、テストを実行してください。

テスト報告のフォーマット:
- 各ステップ: [PASS] または [FAIL] + 説明
- スクリーンショット: 重要な画面は必ず撮影
- 最後に: テスト結果サマリー（合格数/総数）

失敗した場合:
- 何が起きたか（実際の動作）
- 何が期待されたか
- 考えられる原因
- 修正提案

環境変数:
- TEST_EMAIL: ${process.env.TEST_EMAIL ?? "(未設定)"}
- TEST_PASSWORD: ${process.env.TEST_PASSWORD ? "***" : "(未設定)"}
- ADMIN_EMAIL: ${process.env.ADMIN_EMAIL ?? "(未設定)"}
`,
    },
  })) {
    // ツール実行ログ
    if (message.type === "assistant" && "content" in message) {
      const content = (message as any).content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            process.stdout.write(block.text);
          }
          if (block.type === "tool_use") {
            console.log(`\n[Tool] ${block.name}`);
          }
        }
      }
    }

    // 最終結果
    if ("result" in message) {
      console.log("\n" + "=".repeat(60));
      console.log("テスト完了");
      console.log("=".repeat(60));
      console.log(message.result);
    }
  }
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
