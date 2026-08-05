# AIコーチを唯一の入口にする — 専門モード設計

## 目的

従来の `/ai-apps` は、AIアプリをカード一覧で並べ、`webcoach_ai_application.url`（Difyアプリ）を別タブで開いていた。この形には2つの問題があった。

1. **ユーザーが最初に「どのアプリか」を判断させられる。** 困りごとを言語化する前に、正解のカードを選ばせている。
2. **別タブに飛んだ時点で文脈が切れる。** 教材・選択文章・添付画像・会話が引き継がれず、Difyアプリ側でもう一度説明し直すことになる。

そこで構造を次のように変えた。

> **AIコーチは相談相手。Difyアプリは、AIコーチが必要に応じて使う専門スキル。**

ユーザーの目に映るのは「AIコーチが専門モードに切り替わった」だけで、**`Dify` という語も「アプリ」という語もUIには出さない**。利用の深さで段階を分ける。

```
教材上の 💡かんたん解説
      ↓ 深掘り
右パネルの AIコーチ
      ↓ 専門的な処理が必要
専門モード（添削・文章改善…）＝ 裏でDifyアプリ
      ↓ 作業領域が必要
AI専用ページへ拡大（会話・教材・画像・モードを引き継ぐ）
```

---

## 設計上の判断

### 1. 判定しても自動では切り替えない

`detectSkill()` は「どのモードが適しているか」と「どれくらい確かか」を返すだけで、モードを変えるのはユーザーの操作。判定強度で3段階に分ける。

| 強度 | 例 | 挙動 |
|---|---|---|
| `none` | 「余白ってどういう意味？」 | AIコーチがそのまま回答する |
| `suggest` | 「このデザインどう思う？」＋画像 | **まず通常回答**し、回答の下に `[項目別に添削する]` を出す |
| `explicit` | 「このバナーを教材の内容に沿って添削して」＋画像 | 回答の前に**確認カード**を出し、`[制作物添削を開始]` を押すまで専門処理を走らせない |

「このデザインどう思う？」に対してユーザーは軽い意見だけを求めている可能性がある。毎回専門モードへ飛ばすと、AIが勝手に画面と挙動を変える違和感になる。

### 2. 追従（stickiness）を持たせる

すでに専門モードにいるなら、別スキルの `explicit` なシグナルが出るまで提案し直さない。これが無いと発話ごとにモードが揺れる。実装は [utils/aiSkillRouting.ts](../src/utils/aiSkillRouting.ts) の `detectSkill()` 末尾。

### 3. 判定ロジックは純粋関数に置き、UIとモックで共有する

[utils/learningPlanTemplate.ts](../src/utils/learningPlanTemplate.ts) と同じ方針。UIが送信前に出す確認カードと、サーバが返す `suggestion` が食い違うと「AIが言っていることと画面が違う」状態になるため、判定は1箇所に集約する。

### 4. 会話は store に置く（拡大表示のため）

会話を `useLessonAi` のローカル state で持つと、右パネルからAI専用ページへ拡大するときに引き継げない。[store/aiCoachStore.ts](../src/store/aiCoachStore.ts) にセッション単位で持ち、両画面が同じ会話オブジェクトを見る。

- セッションキー: 教材由来は `lesson:{lessonId}`、単独相談は `page:{n}`、常駐ドロワーは `drawer`
- レッスンを移るとキーが変わるので、「レッスンが変わったら会話をリセット」が自動的に成り立つ
- 永続化は **sessionStorage**（会話は「そのとき相談していた話」なのでタブを閉じたら残らない方が自然、かつ容量事故を避けられる）
- **画像（dataURL）は永続化しない。** 数MBになり容量を溢れさせる。復元時は `imageDropped` を立て、UIに「再添付してください」を出させる

### 5. 教材に根拠が無い判断を、あるように見せない

既存の `LessonAiResponse.groundedInMaterial` と同じ扱いを専門モードにも通した。添削の観点ごとに教材ブロックを実際に検索し、根拠が見つからない観点は `basis: null` にして「この観点は教材に直接の記述がないため、一般的な見方として扱ってください」と明示する。根拠なしの観点で `critical`（直したい）は出さない。

### 6. 教材ページ以外にはAIコーチの入口を1つだけ置く

以前は `AppHeader` の常駐ドロワー＋FABが全ページに出ており、教材ページでは右パネルのAIコーチと**二重の入口**になっていた。いまは [GlobalAiCoachDrawer](../src/components/aicoach/GlobalAiCoachDrawer.tsx) を「専用のAI面を持たないページ」でのみ描画する。ドロワーの中身は教材ページと同じ `AiCoachPane` で、独自のチャットUIは持たない（2系統あると必ず挙動がズレる）。

---

## モックAPI一覧

| メソッド | パス | 実装 | 用途 |
|---|---|---|---|
| POST | `/api/webcoach/ai-skill` | [mocks/aiSkillHandlers.ts](../src/mocks/aiSkillHandlers.ts) | 専門モードの実行。**Dify呼び出しの唯一の境界** |
| POST | `/api/webcoach/lesson-ai` | [mocks/lessonHandlers.ts](../src/mocks/lessonHandlers.ts) | 教材準拠の通常回答。`suggestion` を同梱するよう拡張 |
| POST | `/api/webcoach/ai` | [mocks/handlers.ts](../src/mocks/handlers.ts) | 教材の文脈が無い相談（ドロワー・集中ブース）。既存 |

`POST /webcoach/ai-skill` のI/Fは [types/aiSkill.ts](../src/types/aiSkill.ts) の `AiSkillRequest` / `AiSkillResponse` が正。

```ts
// リクエスト（フロントは skillId までしか知らない。アプリIDやURLは持たない）
{
  skillId: 'design-review' | 'writing' | 'idea' | 'tooling',
  question: string,
  image?: string,        // dataURL
  quote: string | null,  // 引用していた教材本文
  courseId: number | null,
  lessonId: number | null,
  blockIds: string[],    // 参照する教材ブロック
  history: { role: 'user' | 'assistant'; content: string }[],
}

// レスポンス（「項目ごとに見て、直して、もう一度見る」ための形）
{
  skillId,
  summary: string,                 // 全体講評
  findings: {
    label: string,                 // 観点名
    verdict: 'good' | 'improve' | 'critical',
    comment: string,
    basis: string | null,          // 教材の根拠。null なら教材に記述なし
    blockId: string | null,        // 教材へジャンプするアンカー
  }[],
  revision: string | null,         // 文章改善モードの修正案
  next: string,
  sources: { blockId: string; heading: string }[],
  groundedInMaterial: boolean,
}
```

---

## 本番実装時（バックエンドチームへの引き渡し事項）

1. **`POST /webcoach/ai-skill` が Dify 呼び出しの唯一の境界。** BFF が `skillId` を Difyアプリの資格情報へ解決し、`/chat-messages` を代理呼び出しする。フロントにアプリIDやURLを返してはいけない（ユーザーに「アプリ」を見せない設計が崩れる）。

2. **スキル対応表は既存テーブルを流用できる。** `webcoach_ai_application.tags` に `skill:design-review` のような値を入れる運用にすれば**新規カラム不要**。`url` 列は本番のDifyアプリURLとして残す。モック側の対応表は [mocks/aiSkillCatalog.ts](../src/mocks/aiSkillCatalog.ts) の `internalApp`。

3. **`conversation_id` は (user, skillId) 単位で保持する。** フロントの `sessionId` はUI都合なので送らない。

4. **意図判定は本番ではサーバ側で行う。** `detectSkill()` と同等の判定をBFFに置き、`LessonAiResponse.suggestion` をサーバの正とする。フロント側の判定は「確認カードを先に出す」ための先読みに降格させる（`LessonAiRequest.skillId` に現在のモードを送っているので、追従判定もサーバ側で再現できる）。

5. **ストリーミングはこのリポジトリに存在しない。** `EventSource` / `ReadableStream` の実装はゼロで、通信は axios のみ。今回もモック＝1発JSONで作ってある。SSE化する場合の差分は `bffClient.runAiSkill` の1箇所に閉じる。

6. **添削の観点は「一般的なデザインチェックリスト」ではなく教材の判断基準に寄せる。** モックでは教材本文の語彙（目的の絞り込み／優先順位／検証）に合わせてある。教材と無関係な観点を並べると、教材基準で添削していることにならない。

---

## 検証方法

モックONで完結する。バックエンドもDifyも不要。

```
cd frontend && npm start
```

1. `/course/{id}?module={n}` を開く。右パネルは**AIコーチとメモだけ**。右下FABが出ないこと
2. 「余白ってどういう意味？」→ 通常の構造化回答のみ。提案カードが出ないこと
3. 画像を添付し「このデザインどう思う？」→ **まず通常回答**が出て、その下に `[項目別に添削する]`
4. 画像を添付し「このバナーを教材の内容に沿って添削して」→ 回答の前に確認カード。`参照予定` に見出し・課題の評価基準・添付画像が並び、**押すまで `/api/webcoach/ai-skill` が飛ばない**
5. `[制作物添削を開始]` → `[MSW] POST /api/webcoach/ai-skill`。ヘッダーが `[制作物添削モード ▼]` になり参照中リストが出る。項目別の添削結果が並び、各項目から教材ブロックへ飛べる
6. 続けて「じゃあ配色は？」→ 添削モードを維持（`おまかせ` に戻らない）
7. `[おまかせ ▼]` から `文章を改善` を直接選び、そのまま専門モードに入れる
8. 本文をドラッグ →`[AIに質問]`→ `制作物に当てはめると？` → 画像添付の促し → 添削モード提案まで繋がる
9. `[広い画面で続ける ↗]` → `/ai-coach` で会話・添付画像・専門モードが引き継がれる。左に会話履歴、右に参照情報
10. `/ai-apps` が `/ai-coach` にリダイレクトされ、どこにも「アプリを開く ↗」が残っていない
11. `REACT_APP_ENABLE_MOCKS=false` で起動し、Moodleフォールバックでも画面が壊れない

判定ロジックとモック応答は純粋関数なので、Node から直接確認できる（`detectSkill` / `aiSkillHandlers`）。CRA には lint/typecheck スクリプトが無いため、`npm start` のコンパイルが型検証を兼ねる。
