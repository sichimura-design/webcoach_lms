# WEBCOACH LMS — UI・UX改善 WBS

- 作成日: 2026-08-06
- 対象: `frontend/`（React SPA）のみ。バックエンド（`api-server/` `bff-server/` `cdk/`）は対象外。
- 前提: この文書は**コードを一切変更せず**、現在の実装（ブランチ `dev/miyabe`）を読んだ結果に基づく。
- 新規ファイル（既存の同名ファイルは存在しなかった）。

---

## 0. 調査結果サマリ（WBSの前提となる現状把握）

### 0-1. 画面とルーティング一覧

`frontend/src/routes/index.tsx` 定義。

| ルート | 画面 | 保護 | 主要ファイル | 到達導線 |
|---|---|---|---|---|
| `/login` | ログイン | 公開 | `components/LoginPage.tsx` | 初期リダイレクト先 |
| `/password-reset` | パスワード再設定 | 公開 | `components/PasswordResetPage.tsx` | ログイン画面から |
| `/connect/:token` | コーチ向け録画連携 | 公開（意図的） | `components/ConnectCoachPage.tsx` | メールリンク（LMS外） |
| `/mypage` | マイページ（ホーム） | 受講生 | `components/MyPage.tsx` | サイドバー・下部ナビ |
| `/courses` | 学習コンテンツ（教材トップ） | 受講生 | `components/MaterialsTopPage.tsx` | サイドバー・下部ナビ |
| `/courses/category/:categoryId` | 学習領域詳細 | 受講生 | `components/CategoryDetailPage.tsx` | コーストップのパンくずのみ |
| `/course/:courseId/curriculum` | コーストップ（目次） | 受講生 | `components/CourseTopPage.tsx` | 教材トップ・マイページ |
| `/course/:courseId` | レッスン学習ワークスペース | 受講生 | `components/learning/LearningWorkspacePage.tsx` | コーストップ・ノート・集中ブース |
| `/focus-booth` | 自習室：集中ブース | 受講生 | `components/FocusBoothPage.tsx` | サイドバー（PCのみ） |
| `/study-log` | 自習室：学習記録 | 受講生 | `components/studyLog/StudyLogPage.tsx` | 自習室タブ |
| `/notes` | 自習室：ノート | 受講生 | `components/notes/MyNotesPage.tsx` | 自習室タブ |
| `/coaching` | コーチング | 受講生 | `components/CoachingNotesPage.tsx` | サイドバー（PCのみ） |
| `/learning-plan` | 学習ロードマップ | 受講生 | `components/learningPlan/LearningPlanPage.tsx` | サイドバー（PCのみ） |
| `/learning-plan/setup` | ロードマップ初回設定 | 受講生 | `components/learningPlan/LearningPlanSetupPage.tsx` | ロードマップ・マイページ |
| `/ai-coach` | AIコーチ | 受講生 | `components/aicoach/AiCoachPage.tsx` | サイドバー・下部ナビ |
| `/ai-apps` | → `/ai-coach` へ転送 | 受講生 | — | 旧ブックマーク互換 |
| `/badges` | バッジ一覧 | 受講生 | `components/BadgesPage.tsx` | 未使用コンポーネント経由のみ（実質到達不能） |
| `/profile` | プロフィール編集 | 受講生 | `components/ProfilePage.tsx` | バッジ画面／未使用コンポーネント経由 |
| `/account-settings` | アカウント設定 | 受講生 | `components/AccountSettingsPage.tsx` | サイドバー下部アカウント行 |
| `/webcoach` | 旧ダッシュボード | 受講生 | `components/WebCoachDashboard.tsx` | **到達導線なし（孤立）** |
| `/career-path/:pathId` | キャリアパス | 受講生 | `components/CareerPathPage.tsx` | **到達導線なし（孤立）** |
| `/content-list` | 旧コンテンツ一覧 | 受講生 | `components/ContentListPage.tsx` | **到達導線なし（孤立）** |
| `/learning-courses` | 旧学習済みコース | 受講生 | `components/LearningCoursesPage.tsx` | **到達導線なし（孤立）** |
| `/admin/*` | 管理（CSV・ユーザー等12画面） | 管理者 | `components/admin/*` | サイドバー「管理」 |
| `/coach/students` | 受講生一覧 | コーチ | `components/coach/CoachStudentsPage.tsx` | サイドバー「受講生一覧」 |
| `*` | → `/login` へ転送 | — | — | 404画面なし |

### 0-2. 主要ユーザーフロー（実装から読み取れるもの）

1. **ログインして今日の学習を始める**: `/login` → `/mypage` →「続きからはじめる」→ `/course/:id/curriculum` → `/course/:id`
2. **教材を探して学ぶ**: `/courses`（領域→段階でギャラリー）→ `/course/:id/curriculum` → `/course/:id`（本文＋目次＋AI/メモの3ペイン）
3. **集中して学習し、振り返る**: `/focus-booth`（タイマー）→ 終了カード → `/study-log`（累計・グラフ）／`/notes`（メモ・クリップ・AI回答）
4. **コーチングを受ける**: `/coaching` → 会議リンク登録 → 参加（別タブ）→ 記録の自動生成 or 手動取り込み → レビュー → 目標・タスク確定
5. **学習計画を立てて見直す**: `/learning-plan/setup`（8問）→ `/learning-plan`（閲覧・編集・月次チェックイン・更新案の採否）
6. **AIに相談する**: `/ai-coach`（ホーム→セッション→専門モード）／教材ページ内のAIペイン／常駐ドロワー
7. **プロフィール・アカウントを設定する**: `/account-settings` `/profile`

### 0-3. デザインシステムの現状

**プライマリ赤が7系統併存している**（最大の一貫性課題）。

| 系統 | 定義場所 | プライマリ値 | 使用画面 |
|---|---|---|---|
| 旧MUI | `theme/colors.ts` | `#C62828` | `shared/PageHeader.tsx` ほかMUI系13ファイル |
| Tailwind `brand.*` | `tailwind.config.js` | `#FF5A7A`（ピンク） | ProfilePage / LearningCoursesPage / CategoryDetailPage / BadgesPage ほか |
| Tailwind `dash.*` | `tailwind.config.js` | `#E0242B` | AppHeader サイドバー |
| `webcoachTheme` | `theme/webcoachTheme.ts` | `#E0213A` | マイページ・自習室・コーチング・ロードマップ・AIコーチ |
| `tokens` | `theme/tokens.ts` | `#E60012` | 学習コンテンツ・コーストップ・パンくず |
| ログイン独自 | `LoginPage.tsx` 直書き | `#d40032` / `#e00039` | ログイン |
| 管理・コーチ系 | 各ファイル直書き | `#E86D78`（サーモン） | 管理12画面・受講生一覧・トーストのエラー色・`.moodle-content` のリンク色・`ProtectedRoute` のスピナー（34箇所／12ファイル） |

加えて `index.css` の CSS 変数 `--primary: 348 100% 68%`（ピンク）が別系統。

- スタイル手法も3系統: インライン `style={{}}`（2,014箇所）／Tailwind ユーティリティ／MUI `sx`。
- ボタン実装も3系統: `components/ui/button.tsx`（19ファイル）／MUI `Button`／素の `<button>` にインライン style。
- `frontend/docs/design-token-spec.md` には「`theme/tokens.ts` に集約」と書かれているが、実際は `webcoachTheme.ts` の方が使用箇所が多い（正が二重）。

### 0-4. 状態表示（ローディング／エラー／空）の現状

- 共通部品は3つあり系統が分かれる: `shared/LoadingState.tsx`（MUI `CircularProgress`）、`shared/ErrorState.tsx`（MUI `Alert`）、`shared/DataRenderer.tsx`（Tailwind + `lucide` の `Loader2`、色は `#FF5A7A` 固定）。
- 実際の主要画面はいずれも使わず、各ページが独自にスピナーを書いている（`MyPage` / `CourseTopPage` / `ProfilePage` / `LearningCoursesPage` はTailwindの `animate-spin`、`LearningWorkspacePage` / `MyNotesPage` はインライン style、`CoachingNotesPage` / `LearningPlanPage` はテキスト「読み込み中…」のみ）。
- エラー時の再試行ボタンの有無がページごとにバラバラ（`MyPage`＝再読み込み、`CourseTopPage`＝戻るのみ、`LearningPlanPage`＝文言のみ、`MaterialsTopPage`＝catchで握り潰し）。
- 空状態の文言はページごとに独自。`MaterialsTopPage` は初期ロード中も「条件に合うコースが見つかりませんでした」と誤表示する。

### 0-5. レスポンシブの現状

- 5画面（`MyPage` / `MaterialsTopPage` / `FocusBoothPage` / `StudyLogPage` / `MyNotesPage`）が `hooks/useScaleToFit.ts` による **「1440px固定レイアウトを `transform: scale` で縮小」** 方式。`minScale = 0.45`。
- この方式では 375px 幅のとき scale が 0.45 で下限に張り付き、内容の実効幅は 1440 × 0.45 = 648px になる。**375px には収まらず横スクロールが発生し、本文14pxは実効6.3pxになる**（推測ではなく計算値）。
- `index.css` の `.home-3col` `.focus-2col` `.studylog-2col` `.home-rail` はいずれも px 固定のグリッドで、メディアクエリによる1カラム化を持たない。
- 一方 `LearningWorkspacePage` と `AiCoachPage` は `window.innerWidth >= 1024` の JS 判定で PC/SP を切り替える別方式。`CourseTopPage` `CoachingNotesPage` `LearningPlanPage` は `max-width` + 通常フローの第3方式。**レスポンシブ方式が3系統に分かれている。**
- SP下部ナビは4項目（マイページ／学習する／AIコーチ／管理 or 受講生一覧）で、**自習室・コーチング・学習ロードマップへの導線がSPに存在しない**。

### 0-6. 文言・ラベルの一貫性

- 同一機能の呼称ゆれ: PCサイドバー「学習コンテンツ」 vs SP下部ナビ「学習する」／ヘッダー内非表示ナビ「学習する」。
- CTA表記ゆれ: 「続きからはじめる　→」（教材トップ）/「続きから：レッスン名　→」（コーストップ）/「続きから」（単元カード）/「はじめる」。
- フッター表記ゆれ: `<footer>` の背景色・高さ・文字色が画面ごとに別実装（`#2B2629` 直書き / `bg-brand-footer` / `<p>` テキストのみ）。
- 開発者向け文言が本番文言に混在: `StudyLogPage` の「この機能はモック環境でのみ利用できます」、`LearningPlanPage` の「初回設定をやり直す」（コメントに「モック確認用」）。

### 0-7. アクセシビリティの現状（機械的計測値）

| 指標 | 件数 |
|---|---|
| `<input>` 要素 | 68 |
| `htmlFor` によるラベル紐付け | 3 |
| `aria-label` | 62 |
| `role=` | 26 |
| `onKeyDown`（キーボード対応） | 8 |
| `focus-visible` を持つファイル | 35 / 全 tsx |
| `<img>` | 28（`alt=` は 35 なので概ね付与済み） |

- 良い点: サイドバー・パンくず・自習室タブは `aria-current` / `aria-selected` / `role="tablist"` / フォーカスリング（`#F6B9BD`）を持つ。`prefers-reduced-motion` にも対応済み。
- 課題: フォームのラベル紐付けがほぼ無い／クリック可能な `div`（教材トップの残りレッスン行、コーストップのレッスン行・単元開閉ヘッダ等）がキーボード操作不能／モーダル・ドロワーにフォーカストラップと `aria-modal` が無い／トーストとAI応答が `aria-live` で読み上げられない。

### 0-8. デッドコード

- 孤立ルート4件（0-1参照）。
- `components/mypage/` の15コンポーネント（`GuildLobby` `PeopleActivityCard` `QuestCard` `ProfileSection` `CampaignBanner` `CourseProgressCard` `ResumeCourseCard` `ActivityItem` `TaskItem` `NextBadgeCard` `RecommendBadgeCard` `StatsCard` `ActionMenuItem` `CourseCard` `GuildLobbyCard`）がどこからも import されていない。
- `AppHeader.tsx` の 403〜669 行の `<header className="hidden">` は常に非表示だが、ナビ項目定義が二重管理になっている（サイドバーは6項目、こちらは3項目）。

---

## 1. WBS

改善分類は指定の13種から選択。ステータス初期値は「要件確認」「未着手」「対応可能」のいずれか。
「対応可能」= 仕様判断が不要で、依存タスクも無く、いますぐ着手できるもの。

### 1-0. ユーザーフロー: 全フロー共通（共通基盤）

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F0-01 | 全フロー共通 | 共通ナビ | ナビゲーション | SP下部ナビに載せる項目と、載せない項目の到達手段を決める | 下部ナビは4項目のみで、自習室・コーチング・学習ロードマップへのリンクがSPに存在しない | SPユーザーは主要6機能のうち3機能に到達できない | 5項目＋「その他」シート、または6項目横スクロールのいずれかを選定し決定事項として文書化する | 下部ナビの項目・並び順・「その他」の有無が本WBSの決定欄に記載され、レビュー承認されている | P1 | S | — | `frontend/src/components/shared/AppHeader.tsx` | 要件確認 |
| F0-02 | 全フロー共通 | 共通ナビ | ナビゲーション | F0-01の決定に沿ってSP下部ナビを実装する | 同上 | 同上 | `AppHeader` の `navItems` を下部ナビでも共有し、決定した項目構成で描画する | 375pxで自習室・コーチング・学習ロードマップに下部ナビ（または「その他」）から到達でき、現在地がハイライトされる | P1 | M | F0-01 | `frontend/src/components/shared/AppHeader.tsx` | 未着手 |
| F0-03 | 全フロー共通 | 共通ナビ | 文言 | 教材セクションの呼称を「学習コンテンツ」に統一する | サイドバー「学習コンテンツ」／下部ナビ「学習する」／非表示ヘッダー「学習する」で3表記 | 同じ場所を指すのに名前が違い、同一機能と認識できない | ナビ・パンくず・見出しの表記を「学習コンテンツ」に揃える | `/courses` を指すすべてのラベルが「学習コンテンツ」になっている（grep で「学習する」が0件） | P2 | S | F0-02 | `frontend/src/components/shared/AppHeader.tsx` | 未着手 |
| F0-04 | 全フロー共通 | 共通ナビ | コンポーネント | AppHeader内の常時非表示 `<header>` ブロックを削除しナビ定義を1箇所に集約する | 403〜669行の `className="hidden"` ヘッダーが残り、サイドバー(6項目)と別のナビ定義(3項目)を二重管理している | 改修時に片方だけ直る事故が起き、表記ゆれの原因になる | 非表示ブロックを削除し、通知ドロップダウンなど生きている部分のみサイドバー側へ移す | AppHeaderにナビ項目の配列定義が1つだけ存在し、画面表示に差分が無い | P2 | M | F0-03 | `frontend/src/components/shared/AppHeader.tsx` | 未着手 |
| F0-05 | 全フロー共通 | 共通ナビ | ナビゲーション | 孤立ルート4件（`/webcoach` `/career-path/:pathId` `/content-list` `/learning-courses`）の存続可否を決める | どこからもリンクされていないが、ルートとコンポーネントが残っている | 直リンクで旧デザインの画面に到達し、別プロダクトのように見える | 各画面を「削除」「導線を作る」「リダイレクト」のいずれかに振り分けて決定を記録する | 4ルートすべてに処遇が決まり、本WBSに記載されている | P2 | S | — | `frontend/src/routes/index.tsx` | 要件確認 |
| F0-06 | 全フロー共通 | 共通ナビ | ナビゲーション | 未定義URLを404画面に変更する | `path="*"` が `/login` へリダイレクトするため、ログイン中でもログイン画面に飛ばされる | 誤ったURLを踏むとログアウトしたように見え、混乱する | 404コンポーネントを作り、ログイン中は「マイページへ戻る」、未ログインは「ログインへ」を出す | 存在しないURLで404画面が表示され、ログイン状態が維持されたままマイページへ戻れる | P2 | M | — | `frontend/src/routes/index.tsx` | 対応可能 |
| F0-07 | 全フロー共通 | 共通ナビ | アクセシビリティ | キーボード操作でナビを読み飛ばして本文にフォーカスを移すリンクを追加する（画面の見た目は変えない） | どのページでもサイドバーのロゴ・トグル・ナビ6項目・マニュアル・FAQ・通知・アカウントを順に通過しないと本文にフォーカスが届かない（毎回11回のTab） | キーボードのみで操作する利用者が、ページを開くたびに本文到達までに11回Tabを押す必要がある | 通常は視覚的に隠し、Tabでフォーカスが当たったときだけ表示されるリンクをAppHeader先頭に置く。遷移先として各ページの `<main>` に `id` と `tabIndex={-1}` を付与する。※サイドバーの折りたたみ（実装済みのトグル）とは別物で、レイアウトは一切変化しない。※`<main>` を持たない5画面（AIコーチ・学習領域詳細・受講生一覧ほか）は先に `<main>` 化が必要 | Tabキー1回目でリンクが表示され、Enterで本文先頭にフォーカスが移る。マウス操作のみの場合はリンクが一度も表示されず、レイアウトにも差分が無い | P2 | S | — | `frontend/src/components/shared/AppHeader.tsx`, 各ページの `<main>` | 対応可能 |
| F0-08 | 全フロー共通 | 共通ナビ | アクセシビリティ | 通知ドロップダウンをEscで閉じられるようにし、開閉をSRに伝える | 外側クリックでしか閉じられず、`aria-expanded` も無い | キーボードのみの利用者が通知を閉じられない | トリガーに `aria-expanded` / `aria-controls`、パネルに `role="dialog"`、Escハンドラを追加する | Escで閉じ、閉じた後トリガーにフォーカスが戻る。SRで開閉状態が読まれる | P2 | M | — | `frontend/src/components/shared/AppHeader.tsx` | 対応可能 |
| F0-10 | 全フロー共通 | 共通デザイン | デザイン統一 | 7系統あるプライマリ赤から正となる1色を決定する | `#C62828` `#FF5A7A` `#E0242B` `#E0213A` `#E60012` `#d40032` `#E86D78` が同時に使われている | 画面を移動するたびにブランド色が変わり、別サービスに見える | 使用箇所数（`#E0213A` 系が最多）とデザインハンドオフ資料を突き合わせ、正の1色とグラデーション・淡色・枠線色を決める | プライマリ／ホバー／淡色／枠線／フォーカスリングの5値が確定し、本WBSに記載されている | P1 | S | — | `frontend/src/theme/tokens.ts`, `frontend/src/theme/webcoachTheme.ts`, `frontend/tailwind.config.js` | **完了（決定D-01）** |
| F0-11 | 全フロー共通 | 共通デザイン | デザイン統一 | トークンの正を `webcoachTheme.ts` と `tokens.ts` のどちらにするか決める | 2ファイルとも「唯一の情報源」と自称し、値も微妙に違う（`#E0213A` vs `#E60012`） | 新規実装のたびにどちらを参照するか判断が要り、ズレが増え続ける | 片方を正とし、もう片方を再エクスポートの薄いラッパにする移行方針を決める | 正のファイルが決まり、移行順序（画面単位）が一覧化されている | P1 | M | F0-10 | `frontend/src/theme/tokens.ts`, `frontend/src/theme/webcoachTheme.ts`, `frontend/docs/design-token-spec.md` | 要件確認 |
| F0-12 | 全フロー共通 | 共通デザイン | デザイン統一 | Tailwind `brand.*`（ピンク系）を参照している画面を洗い出して一覧化する | `bg-brand` `text-brand-muted` 等が旧ピンクを指したまま複数画面に残る | 赤系の新デザインの中にピンクの画面が混ざる | grepで参照箇所を抽出し、画面単位の移行リストを作る | 参照ファイルと該当クラスの一覧が本WBSに追記されている | P2 | S | F0-10 | `frontend/tailwind.config.js` | 対応可能 |
| F0-13 | 全フロー共通 | 共通デザイン | デザイン統一 | `index.css` の CSS 変数（`--primary` `--ring` `--secondary`）を確定パレットに更新する | `--primary: 348 100% 68%`（ピンク）のままで、shadcn系 `ui/*` コンポーネントがピンクを描く | `ui/button` `ui/progress` 等を使う箇所だけ色が違う | `--primary` と `--ring` を `352 76% 50%`（= `#E0213A`）に置き換える | `ui/button` の primary variant が `#E0213A` で描画される | P2 | S | F0-10 | `frontend/src/index.css` | 対応可能 |
| F0-14 | 全フロー共通 | 共通デザイン | コンポーネント | ボタンの実装系統（`ui/button` / MUI Button / 素の button）を1系統に寄せる方針を決める | 3系統が併存し、同じ「主要ボタン」でも高さ・角丸・影が異なる | 押せる要素の見た目が統一されず、どれが主要操作か学習できない | プライマリ／セカンダリ／ゴースト／破壊的の4バリアントを定義し、どの実装に集約するか決める | 4バリアントの寸法・色・状態（hover/active/disabled/focus）が確定し、集約先が決まっている | P1 | M | F0-10 | `frontend/src/components/ui/button.tsx`, `frontend/src/theme/webcoachTheme.ts` | 要件確認 |
| F0-15 | 全フロー共通 | 共通デザイン | コンポーネント | 共通フッターコンポーネントを作り、全画面の `<footer>` を置き換える | 背景 `#2B2629` 直書き／`bg-brand-footer`／テキストのみ の3実装がある | 画面下端の見え方が毎回変わる | `shared/AppFooter.tsx` を作り、既存の各 footer を差し替える | すべての画面のフッターが同一コンポーネント経由になり、高さ・色・文言が一致する | P3 | M | F0-10 | `frontend/src/components/MyPage.tsx`, `frontend/src/components/CourseTopPage.tsx`, ほか | 対応可能 |
| F0-16 | 全フロー共通 | 共通デザイン | デザイン統一 | `tokens.ts` のプライマリ `#E60012` を `#E0213A` 系に置き換える | 学習コンテンツ・コーストップ・パンくずだけ隣の画面と赤が違う | 学習フローの中で画面ごとに赤が変わる | `t.color.primary` と `primarySoft` `primaryBorder` `primaryDashed` `progressTrack` を `webcoachTheme` の対応値に合わせる | `tokens.ts` に `#E60012` が残っておらず、`/courses` と `/mypage` を並べて赤の差が無い | P1 | S | F0-10 | `frontend/src/theme/tokens.ts` | 対応可能 |
| F0-17 | 全フロー共通 | 共通デザイン | デザイン統一 | `tailwind.config.js` の `dash.*` を `#E0213A` 系に置き換える | サイドバーだけ `#E0242B`／`#D30F1A`／`#ef454c`／`#ff7d82` の4赤で組まれ、本文と色が違う | サイドバーと本文で左右に赤の差が出る | `dash.primary` `dash.primary-dark` `dash-gradient` `dash.soft` を確定値から導出し直し、`AppHeader` 内の直書き `rgba(224,36,43,…)` 6箇所も合わせる | `AppHeader.tsx` と `tailwind.config.js` に `#E0242B` `#E0242B` 系の値が残っていない | P1 | S | F0-10 | `frontend/tailwind.config.js`, `frontend/src/components/shared/AppHeader.tsx` | 対応可能 |
| F0-18 | 全フロー共通 | 共通デザイン | デザイン統一 | `tailwind.config.js` の `brand.*`（ピンク `#FF5A7A`）を `#E0213A` 系に置き換える | 旧ピンク系のクラスが207箇所で使われており、ProfilePage 等が丸ごとピンク | 赤の画面とピンクの画面が混在し、最も目立つ分裂になっている | `brand.DEFAULT` `brand.tint` `brand.gradient` を確定値から導出し、207箇所の見た目を画面単位で確認する | 全画面のスクリーンショットにピンク（`#FF5A7A` 系）が残っていない | P2 | M | F0-10, F0-12 | `frontend/tailwind.config.js` | 未着手 |
| F0-19 | 全フロー共通 | 共通デザイン | デザイン統一 | `#E0213A` を直書きしている26箇所／7ファイルをトークン参照に置き換える | トークンを経由せず hex を直書きしているため、今後トークンを変えても追従しない | （直接の影響なし。次回の色変更時に再び分裂する） | `color.primary` 参照に置き換える。`rgba(224,33,58,…)` 6箇所も同様に扱えるようトークン側に rgba ヘルパを用意するか検討する | `grep '#E0213A' src --include=*.tsx` が0件になる（`webcoachTheme.ts` の定義行のみ許容） | P2 | M | F0-10 | `AdminCoachIntegrationsPage.tsx`(9), `MascotSvg.tsx`(5), `RoadmapPath.tsx`(5), `CategoryDetailPage.tsx`(2), `GuildLobby.tsx`(2), `MyPage.tsx`(2), `CharacterAvatar.tsx`(1) | 対応可能 |
| F0-20 | 全フロー共通 | 共通状態表示 | 状態表示 | ローディング／エラー／空の共通コンポーネントをどれに統一するか決める | MUI系（`LoadingState` `ErrorState`）とTailwind系（`DataRenderer`）が併存し、主要画面はどちらも使っていない | 待ち時間の見え方が画面ごとに変わり、読み込み中かエラーかを判断しづらい | 現行デザインに合う1系統を選び、`empty` を含む4状態のAPIを定義する | ローディング／エラー／空の3コンポーネントのProps定義が確定し、既存2系統の廃止順序が決まっている | P1 | M | F0-10 | `frontend/src/components/shared/LoadingState.tsx`, `frontend/src/components/shared/ErrorState.tsx`, `frontend/src/components/shared/DataRenderer.tsx` | 要件確認 |
| F0-21 | 全フロー共通 | 共通状態表示 | 状態表示 | 共通ローディング表示を実装する（スピナー・文言・高さの1パターン化） | 各ページが独自にスピナーを書き、色・サイズ・文言（「読み込み中...」「読み込み中…」）が不揃い | 同じサービス内で待ち時間の表現が毎回変わる | F0-20の決定に沿って共通コンポーネントを実装する（ページ全体用／セクション用の2サイズ） | 共通コンポーネントが2サイズで存在し、Storybook相当の確認ページまたはスクリーンショットで両方の見た目が確認できる | P1 | M | F0-20 | `frontend/src/components/shared/` | 未着手 |
| F0-22 | 全フロー共通 | 共通状態表示 | 状態表示 | 共通エラー表示を実装し、再試行操作を必須Propsにする | `CourseTopPage` は「戻る」だけ、`LearningPlanPage` は文言のみで、再試行できない画面がある | 一時的な通信失敗でも、リロード以外に復帰手段が無い | `onRetry` を必須にした共通エラーコンポーネントを実装する | 再試行ボタンを省略できないAPIになっており、押すと再取得が走る | P1 | M | F0-20 | `frontend/src/components/shared/` | 未着手 |
| F0-23 | 全フロー共通 | 共通状態表示 | 状態表示 | 共通の空状態コンポーネント（アイコン・主文・補足・任意CTA）を実装する | 空状態の文言・余白・アイコン有無がページごとに独自 | 「データが無い」のか「絞り込みで0件」なのかが画面ごとに読み取りづらい | 「データ0件」用と「絞り込み0件（リセットCTA付き）」用の2バリアントを実装する | 2バリアントが存在し、絞り込み0件時にリセットCTAを渡せる | P2 | M | F0-20 | `frontend/src/components/shared/` | 未着手 |
| F0-24 | 全フロー共通 | 共通フィードバック | アクセシビリティ | トーストに `role="status"` / `aria-live="polite"` を付与する | トーストコンテナに live region 指定が無い | スクリーンリーダー利用者に保存成功・失敗が伝わらない | コンテナに `role="status"` `aria-live="polite"` `aria-atomic="true"` を付ける | SRでトースト文言が自動読み上げされる | P2 | S | — | `frontend/src/contexts/ToastContext.tsx` | 対応可能 |
| F0-25 | 全フロー共通 | 共通フィードバック | レスポンシブ | SPでトーストが下部ナビに重ならないようにする | トーストは `bottom-8`（32px）固定、下部ナビは 64px + safe-area | SPで通知が下部ナビに隠れて読めない | SP時は `bottom` を `calc(64px + env(safe-area-inset-bottom) + 16px)` に切り替える | 375pxでトースト表示時に下部ナビと重ならず全文が読める | P2 | S | — | `frontend/src/contexts/ToastContext.tsx` | 対応可能 |
| F0-26 | 全フロー共通 | 共通フィードバック | フィードバック | ProfilePage の独自トースト実装を共通ToastContextに置き換える | ProfilePage だけ緑/赤の固定バーを自前で出している | 同じ「保存しました」でも画面によって出る場所と色が違う | `useToast` に置き換え、独自の toast/error state を削除する | ProfilePage の保存成功・失敗が共通トーストで表示され、独自トーストのJSXが残っていない | P2 | S | — | `frontend/src/components/ProfilePage.tsx` | 対応可能 |
| F0-27 | 全フロー共通 | 共通フィードバック | フィードバック | 破壊的操作用の共通確認ダイアログを実装する | ノート削除・AI会話削除・ロードマップ初期化に確認が無い。既存の確認は `window.confirm` が2箇所のみ | 誤タップで復元不能なデータが消える | タイトル・本文・破壊的ラベル・キャンセルを受け取る `ConfirmDialog` を実装する（Escとフォーカストラップ付き） | ダイアログが単体で動作し、Esc・背景クリック・キャンセルで閉じ、確認ボタンで `onConfirm` が呼ばれる | P0 | M | F0-14 | `frontend/src/components/shared/` | 未着手 |
| F0-30 | 全フロー共通 | 共通レイアウト | レスポンシブ | `transform: scale` 方式をSPでも継続するかを決める | 5画面が1440px固定＋`minScale=0.45`。375px では実効幅648pxで横スクロールが発生し、本文14pxが実効6.3pxになる | SPで文字がほぼ読めず、横スクロールが常時発生する | 「SPのみ通常フローの1カラムに切り替える」「scale方式を全廃する」「現状維持でPC専用と割り切る」から選定する | 方式が決定し、対象5画面それぞれのSP時の扱いが本WBSに記載されている | P1 | M | — | `frontend/src/hooks/useScaleToFit.ts`, `frontend/src/index.css` | 要件確認 |
| F0-31 | 全フロー共通 | 共通レイアウト | 動作確認 | 375px / 768px / 1024px / 1440px の4幅で全主要画面のスクリーンショットを取得し、崩れ箇所を一覧化する | レスポンシブ方式が3系統に分かれており、どこが崩れているかの把握が無い | 崩れの全体像が分からず、改善の順番が決められない | 主要12画面 × 4幅のスクリーンショットを取り、横スクロール発生・要素重なり・文字潰れを表に起こす | 12画面×4幅の確認結果表が本WBSに追記され、崩れ箇所ごとに対応タスクIDが割り当てられている | P1 | L→分割（画面群ごとにM×3） | F0-30 | 全主要画面 | 未着手 |
| F0-32 | 全フロー共通 | 共通レイアウト | レスポンシブ | `index.css` の固定グリッド（`.home-rail` `.home-3col` `.focus-2col` `.studylog-2col`）に1カラム化のブレークポイントを追加する | いずれも px 固定でメディアクエリを持たない | 狭い画面で列が潰れるか、はみ出す | F0-30の決定に沿って、指定幅未満で `grid-template-columns: 1fr` に落とす | 767px以下で4つのグリッドがすべて1カラムになり、横スクロールが発生しない | P1 | M | F0-30 | `frontend/src/index.css` | 未着手 |
| F0-40 | 全フロー共通 | 共通フォーム | アクセシビリティ | 入力要素のラベル紐付けルールを決めて共通の入力コンポーネントに反映する | `<input>` 68件に対し `htmlFor` は3件のみ | SR利用者に入力欄の名前が伝わらず、ラベルタップでフォーカスも当たらない | `id`/`htmlFor` の命名規則を決め、`profile/FormInput.tsx` を全フォームの標準にするか判断する | 命名規則が決まり、標準入力コンポーネントが `label` を必須Propsとして受け取る | P2 | M | F0-14 | `frontend/src/components/profile/FormInput.tsx` | 要件確認 |
| F0-41 | 全フロー共通 | 共通モーダル | アクセシビリティ | モーダル／ドロワー共通のフォーカストラップとEsc閉じを実装する | `MaterialPickerModal` `EnvironmentSettingsPanel` `MeetingLinkModal` `ConsentModal` `FinishSessionModal` 等に `aria-modal` とフォーカストラップが無い | キーボード利用者がモーダルの外にフォーカスを逃がしてしまい、操作不能になる | 共通の `Modal` ラッパ（`role="dialog"` `aria-modal="true"` フォーカストラップ・Esc・復帰フォーカス）を作る | 共通ラッパが存在し、Tabがモーダル内で循環し、Escで閉じたあと起動元にフォーカスが戻る | P1 | M | — | `frontend/src/components/focus/MaterialPickerModal.tsx`, `frontend/src/components/coaching/MeetingLinkModal.tsx`, ほか | 未着手 |
| F0-50 | 全フロー共通 | 共通 | パフォーマンス | 完了状態の取得がN+1になっている箇所の一括取得可否を確認する | `MaterialsTopPage` と `CourseTopPage` がモジュール数ぶん `getActivityCompletion` を並列発行している | レッスン数が多いコースで初期表示が遅く、進捗表示が後追いで変化する | BFFに一括取得APIがあるか調べ、無ければモック側で一括APIを定義する（バックエンドは変更しない） | 一括取得の可否と、無い場合のモックAPI設計が本WBSに記載されている | P2 | M | — | `frontend/src/services/bffClient.ts`, `frontend/src/mocks/handlers.ts` | 要件確認 |

### 1-1. ユーザーフロー: ログインして学習を始める

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F1-01 | ログインして学習を始める | ログイン | アクセシビリティ | メールアドレス・パスワードの `<label>` を `htmlFor`/`id` で入力欄に紐付ける | ラベルとinputが独立しており関連付けが無い | SRで入力欄の名前が読まれず、ラベルをタップしてもフォーカスが当たらない | 各inputに `id` を付け、labelに `htmlFor` を付ける | ラベルをクリックすると対応する入力欄にフォーカスが移る（4フォーム分すべて） | P2 | S | — | `frontend/src/components/LoginPage.tsx` | 対応可能 |
| F1-02 | ログインして学習を始める | ログイン | アクセシビリティ | 「パスワードお忘れですか？」を `<span onClick>` からリンク/ボタンに変更する | キーボードでフォーカスできず、Enterで押せない | キーボード操作のみのユーザーがパスワード再設定に到達できない | `<Link to="/password-reset">` に置き換え、フォーカスリングを付ける | Tabでフォーカスが当たり、Enterで `/password-reset` に遷移する | P1 | S | — | `frontend/src/components/LoginPage.tsx` | 対応可能 |
| F1-03 | ログインして学習を始める | ログイン | アクセシビリティ | パスワード表示切替ボタンに `aria-label` と `aria-pressed` を付け `tabIndex={-1}` を外す | 3箇所すべてでラベル無し・タブ順から除外されている | SR利用者は表示切替の存在を知れず、キーボードでも押せない | `aria-label="パスワードを表示"/"非表示にする"` と `aria-pressed` を付け、`tabIndex={-1}` を削除する | Tabで到達でき、押下ごとにSRが表示/非表示状態を読み上げる | P2 | S | — | `frontend/src/components/LoginPage.tsx`, `frontend/src/components/AccountSettingsPage.tsx` | 対応可能 |
| F1-04 | ログインして学習を始める | ログイン | フィードバック | ログイン失敗メッセージを `role="alert"` にし、送信後にフォーカスを移す | エラーは表示されるがSRに通知されない | 失敗したことに気づけず、同じ操作を繰り返す | エラーコンテナに `role="alert"` を付け、エラー発生時にそのコンテナへフォーカスを移す | 誤ったパスワードで送信するとSRがエラー文言を読み上げる | P2 | S | — | `frontend/src/components/LoginPage.tsx` | 対応可能 |
| F1-05 | ログインして学習を始める | ログイン | デザイン統一 | ログイン画面独自の赤（`#d40032` `#e00039` `#b9002b`）を `#E0213A` 系に置き換える | ログイン直後のマイページと赤の色味が変わる | 最初に見る画面と次の画面でブランド色が違う | ボタンのグラデーションを `webcoachTheme` の値に合わせ、`rgba(212,0,50,…)` 12箇所も置き換える | ログイン画面内に `#d40032` `#e00039` `#b9002b` `rgba(212,0,50` のリテラルが残っていない | P3 | S | F0-10 | `frontend/src/components/LoginPage.tsx` | 対応可能 |
| F1-06 | ログインして学習を始める | ログイン | 動作確認 | 375pxでログインフォームがフッターと重ならず1画面に収まることを確認する | フッターが `absolute bottom-0` で、フォームは中央寄せ | 小さい画面でフッターが送信ボタンに被る可能性がある | 375×667 と 375×812 で表示確認し、崩れがあれば余白を調整する | 375×667でログインボタン全体が見え、フッターと重ならない | P2 | S | F1-01 | `frontend/src/components/LoginPage.tsx` | 未着手 |
| F1-10 | ログインして学習を始める | マイページ | 情報設計 | マイページのファーストビューに何を置くかを決める | 現在は プロフィール帯 → 続きから → 目標 → 右レール（ストリーク・次回コーチング）→ ロードマップの順 | 「今日やること」が一目で決まらず、次の操作を探す | 主要CTA「続きからはじめる」がスクロールなしで見える構成を定義する | ファーストビューに置く要素と順序が決定され、本WBSに記載されている | P1 | S | — | `frontend/src/components/MyPage.tsx` | 要件確認 |
| F1-11 | ログインして学習を始める | マイページ | 操作導線 | 学習中コースが0件のとき「続きからはじめる」の代わりに出す導線を定義・実装する | `primaryCourse` が無いと `ContinueLearningHero` ごと消え、主要CTAが画面から無くなる | 初回ログインの受講生が最初に何をすればよいか分からない | コース未受講時に「学習コンテンツから選ぶ」CTAを出す空状態カードを追加する | 受講コース0件のアカウントでマイページに主要CTAが1つ表示され、押すと `/courses` に遷移する | P1 | M | F0-23, F1-10 | `frontend/src/components/MyPage.tsx`, `frontend/src/components/mypage/ContinueLearningHero.tsx` | 未着手 |
| F1-12 | ログインして学習を始める | マイページ | 状態表示 | ローディング／セッション切れ／エラーの3画面を共通コンポーネントに置き換える | 3状態それぞれに独自マークアップとグラデーションボタン（`#E0213A→#B81026` 直書き）がある | 待ち・エラーの見え方がほかの画面と揃わない | F0-21/F0-22の共通コンポーネントに差し替える | マイページ内にスピナー・エラーの独自マークアップが残っていない | P2 | M | F0-21, F0-22 | `frontend/src/components/MyPage.tsx` | 未着手 |
| F1-13 | ログインして学習を始める | マイページ | レスポンシブ | F0-30の決定に沿ってマイページのSPレイアウトを実装する | `.home-rail`（960px + 1fr 固定）で1カラム化しない | 375pxで横スクロールが発生し文字が読めない | 767px以下で1カラム、右レールをメイン列の下に積む | 375pxで横スクロールが発生せず、本文文字サイズが13px以上で表示される | P1 | M | F0-30, F0-32 | `frontend/src/components/MyPage.tsx`, `frontend/src/index.css` | 未着手 |
| F1-14 | ログインして学習を始める | マイページ | 動作確認 | 375pxでマイページの主要CTAとカード内テキストが重ならないことを確認する | — | — | 375pxでスクリーンショットを取り、重なり・見切れを確認する | 375pxで「続きからはじめる」ボタン全体が見え、カード内テキストと重ならない | P2 | S | F1-13 | `frontend/src/components/MyPage.tsx` | 未着手 |

### 1-2. ユーザーフロー: 教材を探して学ぶ

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F2-01 | 教材を探して学ぶ | 学習コンテンツ | 状態表示 | カタログ読み込み中に空状態文言が出ないようローディング状態を分離する | `catalog` の初期値が `[]` のため、取得中に「条件に合うコースが見つかりませんでした」と表示される | 実際にはコースがあるのに「無い」と誤解し、検索をやり直す | `loading` state を追加し、ローディング中はスケルトンまたはスピナーを出す | 通信を遅延させた状態で `/courses` を開くと、空状態文言ではなくローディング表示になる | P1 | M | F0-21 | `frontend/src/components/MaterialsTopPage.tsx` | 未着手 |
| F2-02 | 教材を探して学ぶ | 学習コンテンツ | 状態表示 | カタログ取得失敗をユーザーに見えるようにし再試行を出す | `.catch(() => setCatalog([]))` でエラーを握り潰している | 通信エラー時も「コースが無い」と表示され、復帰方法が無い | エラー state を持ち、共通エラーコンポーネント＋再試行を表示する | APIを失敗させると「取得に失敗しました」と再試行ボタンが出て、押すと再取得される | P1 | M | F0-22 | `frontend/src/components/MaterialsTopPage.tsx` | 未着手 |
| F2-03 | 教材を探して学ぶ | 学習コンテンツ | 情報設計 | 「このコースの残りレッスン」に表示する範囲を定義する | 見出しは「残り」だが、完了済みも含む全レッスンを描画している | 見出しと中身が一致せず、残量を誤認する | 「全レッスン（完了状態付き）」に見出しを変えるか、未完了のみに絞るかを決める | 見出しと表示内容の対応が決定され、本WBSに記載されている | P2 | S | — | `frontend/src/components/MaterialsTopPage.tsx` | 要件確認 |
| F2-04 | 教材を探して学ぶ | 学習コンテンツ | 状態表示 | 残りレッスンカードが0件のときの空状態を実装する | レッスン取得前・0件時に見出しと「0 / 0 完了」だけのカードが残る | 情報が無いカードが場所を占め、壊れて見える | 取得中はスケルトン行、0件時は空状態文言を表示する | レッスン0件のコースで「表示できるレッスンがありません」等の文言が出る | P2 | S | F0-23, F2-03 | `frontend/src/components/MaterialsTopPage.tsx` | 未着手 |
| F2-05 | 教材を探して学ぶ | 学習コンテンツ | アクセシビリティ | 残りレッスン行とカテゴリジャンプチップを `<button>` 化する | どちらも `div`/`span` に `onClick` を付けており、フォーカスもEnter操作もできない | キーボード利用者はレッスンを開けず、領域ジャンプもできない | 意味的に `<button type="button">` に置き換え、フォーカスリングを付ける | Tabで各レッスン行と各領域チップにフォーカスでき、Enterで同じ動作をする | P1 | S | — | `frontend/src/components/MaterialsTopPage.tsx` | 対応可能 |
| F2-06 | 教材を探して学ぶ | 学習コンテンツ | レスポンシブ | コースギャラリーの列数をブレークポイントごとに定義する | `gridTemplateColumns: 'repeat(4,1fr)'` 固定 | 狭い画面でカード内の文字とサムネイルが潰れる | 1440px=4列 / 1024px=3列 / 768px=2列 / 375px=1列 を実装する | 4幅すべてで指定列数になり、カード内テキストが省略記号で収まる | P1 | M | F0-30 | `frontend/src/components/MaterialsTopPage.tsx`, `frontend/src/components/materials/CourseCard.tsx` | 未着手 |
| F2-07 | 教材を探して学ぶ | 学習コンテンツ | 状態表示 | 検索0件時に「検索条件をクリア」ボタンを追加する | 0件メッセージのみで、入力をクリアする手段が検索欄の手動削除しかない | 0件から復帰する操作が分かりづらい | 空状態コンポーネントのCTAとしてクリアボタンを渡す | 検索で0件にしたときボタンが表示され、押すと全件表示に戻る | P2 | S | F0-23 | `frontend/src/components/MaterialsTopPage.tsx` | 未着手 |
| F2-08 | 教材を探して学ぶ | 学習コンテンツ | 動作確認 | 375pxで「いま取り組むレッスン」カードの文字とボタンが重ならないことを確認する | `gridTemplateColumns: '1.55fr 1fr'` の2カラム構成で、内部にも画像200px固定がある | SPで画像とテキストが押し合い、CTAが潰れる | 375pxで表示確認し、崩れがあれば1カラム化する | 375pxでカード内の見出し・進捗バー・2つのボタンがすべて重ならず表示される | P2 | S | F2-06 | `frontend/src/components/MaterialsTopPage.tsx` | 未着手 |
| F2-10 | 教材を探して学ぶ | コーストップ | 状態表示 | エラー時に「戻る」だけでなく再試行を出す | エラー画面のボタンが `navigate(-1)` のみ | 一時的な通信失敗でこの画面を諦めるしかない | 共通エラーコンポーネントに置き換え、再試行と戻るの2アクションにする | APIを失敗させたあと再試行ボタンで再取得され、成功すればコース内容が表示される | P1 | S | F0-22 | `frontend/src/components/CourseTopPage.tsx` | 未着手 |
| F2-11 | 教材を探して学ぶ | コーストップ | 状態表示 | 単元0件のコースに空状態を表示する | `sections` が空でもタイトルと「全0単元・0レッスン」だけを描画する | 準備中のコースを開くと壊れているように見える | 空状態コンポーネントで「このコースにはまだ公開されたレッスンがありません」を出す | 単元0件のコースで空状態文言と学習コンテンツへ戻るCTAが表示される | P2 | S | F0-23 | `frontend/src/components/CourseTopPage.tsx` | 未着手 |
| F2-12 | 教材を探して学ぶ | コーストップ | アクセシビリティ | レッスン行と単元の開閉ヘッダを `<button>` 化する | どちらも `div onClick` で、開閉ヘッダには `aria-expanded` も無い | キーボードでレッスンを開けず、開閉状態もSRに伝わらない | レッスン行を `<button>`、開閉ヘッダを `<button aria-expanded>` にする | Tabで全レッスン行と全開閉ヘッダに到達でき、Enterで動作し、SRが開閉状態を読む | P1 | M | — | `frontend/src/components/CourseTopPage.tsx` | 対応可能 |
| F2-13 | 教材を探して学ぶ | コーストップ | 操作導線 | 主要CTAと各単元CTAの優先順位を定義する | 画面上部の「続きから：レッスン名」と、各単元カードの「はじめる/続きから/復習する」が同格の赤ボタンで並ぶ | 単元数ぶん同じ見た目のボタンが並び、どれを押すべきか判断に時間がかかる | 主要CTAは1つだけ塗り、単元CTAはアウトライン/テキストリンクに落とす方針を決める | 主要CTAと副次CTAの見た目ルールが決定され、本WBSに記載されている | P2 | S | F0-14 | `frontend/src/components/CourseTopPage.tsx` | 要件確認 |
| F2-14 | 教材を探して学ぶ | コーストップ | 操作導線 | F2-13の決定に沿ってCTAの見た目を実装する | 同上 | 同上 | 単元カードのボタンをアウトラインに統一し、現在の単元のみ強調する | 塗りつぶしCTAが画面内に1つだけ存在し、それ以外はアウトラインで描画される | P2 | S | F2-13 | `frontend/src/components/CourseTopPage.tsx` | 未着手 |
| F2-15 | 教材を探して学ぶ | コーストップ | 動作確認 | 375pxで単元カードのヘッダ行（STEP／単元名／完了数）が重ならないことを確認する | ヘッダ行が横一列固定で `flex-wrap` を持たない | 長い単元名で完了数が押し出される | 375pxで確認し、必要なら折り返しを許可する | 375pxで全単元カードのヘッダ行が省略記号または折り返しで収まる | P2 | S | F2-12 | `frontend/src/components/CourseTopPage.tsx` | 未着手 |
| F2-20 | 教材を探して学ぶ | レッスン学習 | 状態表示 | 読み込み中のトップバー（コース名・単元名・進捗）にスケルトンを表示する | 本文だけスピナーになり、トップバーは空文字のまま | 読み込み中にどのレッスンを開いているのか分からない | トップバーにスケルトン行を出し、取得後に差し替える | 通信遅延時にトップバーの3項目がスケルトン表示され、レイアウトが跳ねない | P2 | M | F0-21 | `frontend/src/components/learning/LearningWorkspacePage.tsx`, `frontend/src/components/learning/LessonTopBar.tsx` | 未着手 |
| F2-21 | 教材を探して学ぶ | レッスン学習 | アクセシビリティ | SPの目次ドロワーとサポートパネルに `role="dialog"` とフォーカストラップを付ける | 現在は `position:fixed` の素のdivで、背景は `role="presentation"` のみ | SPでドロワーを開いてもフォーカスが背後の本文に残り、閉じ方が分からない | F0-41の共通ラッパを適用する | SPでドロワーを開くと最初の操作要素にフォーカスが移り、Tabが内部で循環し、Escで閉じて起動ボタンにフォーカスが戻る | P2 | M | F0-41 | `frontend/src/components/learning/LearningWorkspacePage.tsx` | 未着手 |
| F2-22 | 教材を探して学ぶ | レッスン学習 | フィードバック | 「完了にする」押下後の遷移仕様を決める | 完了済みの状態で押すと次レッスンへ、未完了なら完了マークのみ、という2挙動が同じボタンに乗っている | 押した結果が予測できず、意図せずページが変わる | 「完了にする」と「次のレッスンへ」を別ボタンにするか、完了後に確認を挟むかを決める | ボタン構成と押下後の挙動が決定され、本WBSに記載されている | P2 | S | — | `frontend/src/components/learning/LearningWorkspacePage.tsx`, `frontend/src/components/learning/LessonArticle.tsx` | 要件確認 |
| F2-23 | 教材を探して学ぶ | レッスン学習 | 動作確認 | 375pxで選択ツールバーと解説ポップオーバーが画面外に出ないことを確認する | どちらも選択範囲の座標を基準に絶対配置している | 画面端の文字を選択するとツールバーが見切れて押せない | 375pxで左端・右端・下端の文字を選択して確認し、はみ出す場合はクランプする | 375pxで画面のどの位置の文字を選択してもツールバー全体が表示される | P2 | S | — | `frontend/src/components/learning/SelectionToolbar.tsx`, `frontend/src/components/learning/ExplainPopover.tsx` | 未着手 |
| F2-24 | 教材を探して学ぶ | レッスン学習 | 動作確認 | 1024px境界での3ペイン⇔オーバーレイ切替を確認する | `window.innerWidth >= 1024` のJS判定で、リサイズ中に状態が入れ替わる | 幅を変えたときにパネルの開閉状態が意図せず変わる | 1023px→1025pxのリサイズで目次とサポートパネルの状態を確認する | 境界をまたいでリサイズしても本文が隠れたままにならず、開閉状態が復元される | P3 | S | — | `frontend/src/components/learning/LearningWorkspacePage.tsx` | 未着手 |
| F2-30 | 教材を探して学ぶ | 学習領域詳細 | ナビゲーション | `/courses/category/:id` への入口を増やすかを決める | 入口がコーストップのパンくずのみ | 学習コンテンツから領域単位で見たいときに辿れない | 学習コンテンツの領域見出しから遷移させるか、この画面を廃止するかを決める | 処遇が決定され、本WBSに記載されている | P2 | S | F0-05 | `frontend/src/components/CategoryDetailPage.tsx`, `frontend/src/components/MaterialsTopPage.tsx` | 要件確認 |
| F2-31 | 教材を探して学ぶ | 学習領域詳細 | デザイン統一 | 独自カテゴリ配色パレット（7色・ピンク基調）を確定パレットに合わせる | `categoryColorPalette` が `#FF5A7A` 等の旧ピンク系で、`tokens.ts` の `category` 4色と別定義 | 同じ「Webデザイン」領域でも画面ごとに色が違う | `tokens.ts` の `color.category` を参照するよう置き換える | カテゴリ色の定義が `tokens.ts` の1箇所のみになる | P3 | M | F0-10, F2-30 | `frontend/src/components/CategoryDetailPage.tsx`, `frontend/src/theme/tokens.ts` | 未着手 |

### 1-3. ユーザーフロー: 集中して学習し、振り返る（自習室）

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F3-01 | 集中して学習し振り返る | ノート | フィードバック | ノートの「削除」に確認ダイアログを挟む | `onClick={() => void notes.remove(note.id)}` で即削除、取り消し不可 | 誤タップで手書きメモ・クリップ・保存したAI回答が復元不能に失われる | F0-27の共通確認ダイアログを適用し、対象の種別と冒頭テキストを本文に出す | 削除ボタン押下で確認ダイアログが出て、キャンセルするとノートが残る | P0 | S | F0-27 | `frontend/src/components/notes/MyNotesPage.tsx` | 未着手 |
| F3-02 | 集中して学習し振り返る | ノート | 状態表示 | 絞り込み0件時に「条件をリセット」ボタンを追加する | 0件文言は種別分けされているが、リセット操作が無い | 絞り込みを重ねたあと全件に戻す手順が分かりづらい | 空状態コンポーネントのCTAでフィルタ・検索・コース・レッスンを一括リセットする | 絞り込みで0件にしたときリセットボタンが出て、押すと全件表示に戻る | P3 | S | F0-23 | `frontend/src/components/notes/MyNotesPage.tsx` | 未着手 |
| F3-03 | 集中して学習し振り返る | 集中ブース | レスポンシブ | `.focus-2col`（660px + 1fr）をSPで1カラム化する | メディアクエリが無く、scale方式に依存している | 375pxでタイマーと右カラムが横に並んだまま縮小され、操作しづらい | F0-30の決定に沿って767px以下で1カラムにし、タイマーを先頭に置く | 375pxでタイマーカードが全幅で表示され、右カラムの4カードがその下に縦積みされる | P1 | M | F0-30, F0-32 | `frontend/src/components/FocusBoothPage.tsx`, `frontend/src/index.css` | 未着手 |
| F3-04 | 集中して学習し振り返る | 学習記録 | レスポンシブ | 日別グラフの固定幅（`CHART_WIDTH = 870`）を可変にする | 親カードの幅に関わらず870px固定で描画される | SPでグラフがはみ出し、横スクロールの原因になる | コンテナ幅を計測して渡すか、recharts の `ResponsiveContainer` を使う | 375pxでグラフがカード幅に収まり、横スクロールが発生しない | P1 | M | F0-30 | `frontend/src/components/studyLog/StudyLogPage.tsx`, `frontend/src/components/studyLog/DailyStudyChart.tsx` | 未着手 |
| F3-05 | 集中して学習し振り返る | 学習記録 | レスポンシブ | `.studylog-2col`（1fr + 384px）をSPで1カラム化する | メディアクエリが無い | SPで右カラムのサマリが極端に細くなる | 767px以下で1カラム、サマリカードを先頭に置く | 375pxで累計カードが先頭に全幅表示され、グラフ・一覧がその下に縦積みされる | P1 | M | F0-30, F0-32 | `frontend/src/components/studyLog/StudyLogPage.tsx`, `frontend/src/index.css` | 未着手 |
| F3-06 | 集中して学習し振り返る | 学習記録 | 文言 | 「この機能はモック環境でのみ利用できます」を利用者向けの文言に変える | 開発者向けの内部事情がそのまま表示される | 受講生に意味が伝わらず、不具合と受け取られる | 「学習記録を表示できませんでした。時間をおいて再度お試しください」＋再試行に変更する | 画面上に「モック」という語が残っていない | P2 | S | F0-22 | `frontend/src/components/studyLog/StudyLogPage.tsx` | 対応可能 |
| F3-07 | 集中して学習し振り返る | 集中ブース／マイページ | 情報設計 | 「今日／今週の学習時間」を出す場所を1つに決める | マイページの `ProfileSummaryStrip`・`StreakMiniCard`、集中ブースの `StudyStatsCard`、学習記録の `TotalsCard` に同じ指標が分散している | 同じ数字が複数画面に出て、どれが正か分からない | 各指標（今日・今週・累計・ストリーク）の正の置き場を1つずつ決める | 4指標それぞれの主たる表示画面が決定され、本WBSに記載されている | P2 | S | — | `frontend/src/components/mypage/ProfileSummaryStrip.tsx`, `frontend/src/components/focus/StudyStatsCard.tsx`, `frontend/src/components/studyLog/TotalsCard.tsx` | 要件確認 |
| F3-08 | 集中して学習し振り返る | 集中ブース | 状態表示 | 教材未選択のまま計測を開始したときの表示を定義する | `choice` が null でも `start()` でき、「現在の学習教材」カードが空になる | 何を学習した記録なのか後から分からない | 未選択時のカード文言と、記録側の表示（「教材の指定なし」等）を決める | 未選択開始時のカード文言と学習記録一覧での表示が決定され、本WBSに記載されている | P2 | S | — | `frontend/src/components/FocusBoothPage.tsx`, `frontend/src/components/focus/CurrentMaterialCard.tsx` | 要件確認 |
| F3-09 | 集中して学習し振り返る | 集中ブース | アクセシビリティ | タイマーの経過時間と状態変化を `aria-live` で伝える | 数値は毎秒更新されるがlive region指定が無く、目標到達もビジュアルのみ | SR利用者は残り時間と目標到達に気づけない | 経過時間は `aria-live="off"` のまま、状態変化（開始・一時停止・目標到達・終了）のみ `role="status"` で通知する | 開始・一時停止・目標到達の各操作でSRが状態を1回ずつ読み上げる（毎秒読み上げない） | P2 | M | — | `frontend/src/components/focus/FocusTimerCard.tsx`, `frontend/src/components/focus/TimerDial.tsx` | 未着手 |
| F3-10 | 集中して学習し振り返る | 全画面（常駐タイマー） | 動作確認 | 375pxで `FloatingStudyTimer` が下部ナビ・トーストと重ならないことを確認する | 常駐タイマーはAppRoutesの外に固定配置されている | SPで下部ナビやトーストと重なり、操作を塞ぐ | タイマー稼働中に375pxで各画面を巡回し、重なりを確認する | 375pxでタイマー表示中に下部ナビの全ボタンが押せ、トーストが読める | P2 | S | F0-25 | `frontend/src/components/shared/FloatingStudyTimer.tsx` | 未着手 |
| F3-11 | 集中して学習し振り返る | 自習室3画面 | 動作確認 | 自習室3タブを375pxで巡回し、タブ位置と見出しが同じ位置に留まることを確認する | 3画面とも同じ padding にしてある前提だが、scale値は各画面の内容高で変わりうる | タブ切替のたびに見出しが動くと、同じ場所にいる感覚が失われる | 375px・768px・1440pxで3タブを切り替えてヘッダ位置を比較する | 3タブ間で「自習室」見出しとタブ行のY座標が一致している | P2 | S | F3-03, F3-05 | `frontend/src/components/studyRoom/StudyRoomHeader.tsx` | 未着手 |

### 1-4. ユーザーフロー: コーチングを受ける

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F4-01 | コーチングを受ける | コーチング | 状態表示 | 取得失敗時に画面上のエラー表示と再試行を出す | 失敗時はトーストのみで、本文は `sessions=null` のまま空になる | トーストが消えると、なぜ何も無いのか分からない | エラー state を持ち、共通エラーコンポーネント＋再試行を表示する | APIを失敗させると本文にエラーと再試行が出て、押すと再取得される | P1 | M | F0-22 | `frontend/src/components/CoachingNotesPage.tsx` | 未着手 |
| F4-02 | コーチングを受ける | コーチング | 状態表示 | ローディングをテキスト1行からカードのスケルトンに変える | 「読み込み中…」の中央テキストのみ | 読み込み後に一気にレイアウトが変わり、視線が飛ぶ | 次回コーチングカード・目標カード・履歴の3ブロックのスケルトンを出す | 読み込み中に3ブロックのスケルトンが表示され、読み込み後にレイアウトが跳ねない | P3 | S | F0-21 | `frontend/src/components/CoachingNotesPage.tsx` | 未着手 |
| F4-03 | コーチングを受ける | コーチング | フィードバック | 「参加する」で別タブが開くことを操作前に明示する | `window.open` で新規タブを開くが、事前の説明が無い | タブが増えたことに気づかず、LMS側の記録中表示を見失う | ボタンラベルまたは補助テキストに「（別タブで開きます）」を追加し、外部リンクアイコンを添える | 参加ボタンの近傍に別タブで開く旨の表示があり、SRにも読まれる | P2 | S | — | `frontend/src/components/coaching/NextCoachingCard.tsx`, `frontend/src/components/CoachingNotesPage.tsx` | 対応可能 |
| F4-04 | コーチングを受ける | コーチング／マイページ | 情報設計 | 「次回までの目標」の正の置き場を決める | コーチング画面の `renderCurrentGoals` とマイページの `NextCoachingPlan` に同じ目標が出る | どちらで完了操作をすればよいか分からない | 一覧・編集の役割をどちらが持つかを決め、他方は要約＋リンクにする | 目標の表示・操作の責務分担が決定され、本WBSに記載されている | P2 | S | F3-07 | `frontend/src/components/CoachingNotesPage.tsx`, `frontend/src/components/mypage/NextCoachingPlan.tsx` | 要件確認 |
| F4-05 | コーチングを受ける | コーチング | 操作導線 | 会議リンク未登録の初回状態で次にやることを明示する | 次回予定が無いと `NextCoachingCard` 自体が描画されず、目標と履歴だけになる | 初回利用者がこの画面で何をすべきか分からない | 予定が無いときの空状態カード（「コーチから届いたリンクを登録する」CTA付き）を追加する | 次回予定が無いアカウントでコーチング画面に説明文と登録CTAが表示される | P2 | M | F0-23 | `frontend/src/components/CoachingNotesPage.tsx` | 未着手 |
| F4-06 | コーチングを受ける | コーチング | 動作確認 | 375pxで履歴カードの見出し・タグ・日付が重ならないことを確認する | ヘッダ行は `flex-wrap` 済みだが、タグが最大4種類並ぶケースがある | SPでタグが折り返して要約が押し出される | 375pxでタグ4種類のケースを確認する | 375pxで履歴カードのタイトル・日付・タグ・要約2行がすべて重ならず表示される | P2 | S | — | `frontend/src/components/CoachingNotesPage.tsx` | 未着手 |

### 1-5. ユーザーフロー: 学習計画を立てて見直す

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F5-01 | 学習計画を立てて見直す | 学習ロードマップ | フィードバック | 「初回設定をやり直す」に確認ダイアログを挟む | 押下で即 `resetLearningPlan` を呼び、確定済みロードマップが破棄されて setup に飛ぶ | 誤タップでコーチと確定した学習計画が失われる | F0-27の共通確認ダイアログを適用し、失われる内容（フェーズ数・確定状態）を明記する | 押下で確認ダイアログが出て、キャンセルすると計画が残る | P0 | S | F0-27 | `frontend/src/components/learningPlan/LearningPlanPage.tsx` | 未着手 |
| F5-02 | 学習計画を立てて見直す | 学習ロードマップ | ナビゲーション | 「初回設定をやり直す」を本番でも出すかを決める | コード上「モック確認用。実運用では管理者操作にする想定」とあるが、受講生に常時表示されている | 本番で受講生が自分の計画を消せてしまう | 非表示／管理者限定／確認付きで残す のいずれかを決める | 表示条件が決定され、本WBSに記載されている | P1 | S | — | `frontend/src/components/learningPlan/LearningPlanPage.tsx` | 要件確認 |
| F5-03 | 学習計画を立てて見直す | 学習ロードマップ | 状態表示 | エラー時に再試行ボタンを出す | エラー文言を中央に出すだけ | 通信失敗時にリロード以外の復帰手段が無い | 共通エラーコンポーネントに置き換える | APIを失敗させると再試行ボタンが出て、押すと再取得される | P1 | S | F0-22 | `frontend/src/components/learningPlan/LearningPlanPage.tsx` | 未着手 |
| F5-04 | 学習計画を立てて見直す | 学習ロードマップ | 情報設計 | 通常表示のブロック順序と、ファーストビューに置く要素を決める | 更新案／サマリ／全体ロードマップ／今月／見直し案内／ペース調整／前提 の7ブロックが同じ重みで縦に並ぶ | 「今月なにをするか」に辿り着くまでスクロールが要る | 「今月やること」を上位に置くなど、優先順位を定義する | ブロックの順序が決定され、本WBSに記載されている | P2 | M | — | `frontend/src/components/learningPlan/LearningPlanPage.tsx` | 要件確認 |
| F5-05 | 学習計画を立てて見直す | 学習ロードマップ | ナビゲーション | 編集モード・チェックインモードにパンくず／戻る導線を追加する | モードごとに画面全体が差し替わり、戻る手段が下部のキャンセルボタンのみ | 編集に入ったあと、どこにいるか・どう戻るかが分かりにくい | 各モードの先頭に「← 学習ロードマップに戻る」を置く（コーチング画面の `backLink` と同形式） | 編集・チェックイン・更新案の3モードすべてで画面上部に戻るリンクがある | P2 | S | — | `frontend/src/components/learningPlan/LearningPlanPage.tsx` | 対応可能 |
| F5-06 | 学習計画を立てて見直す | 学習ロードマップ | 動作確認 | 375pxで `StageRail` と `PhaseTimeline` が潰れないことを確認する | フェーズ数ぶんの列をインラインで組んでおり、フェーズ数は受講生の回答で変わる | フェーズが多いと横に潰れてラベルが読めない | フェーズ6件・10件のケースを375pxで確認する | 375pxでフェーズ10件でもラベルが読め、横スクロールで全フェーズを辿れる | P2 | S | F0-30 | `frontend/src/components/learningPlan/StageRail.tsx`, `frontend/src/components/learningPlan/PhaseTimeline.tsx` | 未着手 |

### 1-6. ユーザーフロー: AIに相談する

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F6-01 | AIに相談する | AIコーチ | フィードバック | 会話履歴の削除に確認ダイアログを挟む | `onClick={() => onDelete(session.id)}` で即削除 | 誤タップで相談履歴と添付画像が復元不能に失われる | F0-27の共通確認ダイアログを適用する | 削除アイコン押下で確認ダイアログが出て、キャンセルすると会話が残る | P0 | S | F0-27 | `frontend/src/components/aicoach/ConversationList.tsx`, `frontend/src/components/aicoach/AiCoachPage.tsx` | 未着手 |
| F6-02 | AIに相談する | AIコーチ | アクセシビリティ | AI応答の生成中／完了を `aria-live` で伝える | 応答領域にlive region指定が無い | SR利用者は回答が出たことに気づけない | 応答コンテナに `aria-live="polite"` `aria-busy` を付ける | 送信後、生成完了時にSRが回答冒頭を読み上げる | P2 | S | — | `frontend/src/components/aicoach/AiCoachSessionView.tsx`, `frontend/src/components/learning/AiCoachPane.tsx` | 対応可能 |
| F6-03 | AIに相談する | AIコーチ／レッスン学習 | 状態表示 | AI応答待ちの表現を教材ページとAI専用ページで統一する | 教材ページの `AiCoachPane`、AI専用ページの `AiCoachSessionView`、`ExplainPopover` でそれぞれ待ち表現が異なる | 同じAIなのに待ち方の見え方が変わり、止まっているのか判断しづらい | 3箇所を同じローディング表現（タイピングインジケータ等）に揃える | 3画面のAI応答待ちが同じ見た目・同じ文言になっている | P2 | M | F0-21 | `frontend/src/components/aicoach/AiCoachSessionView.tsx`, `frontend/src/components/learning/AiCoachPane.tsx`, `frontend/src/components/learning/ExplainPopover.tsx` | 未着手 |
| F6-04 | AIに相談する | AIコーチ／レッスン学習 | 情報設計 | AIの入口3つ（教材内ペイン／AI専用ページ／常駐ドロワー）の役割分担を明文化する | `hasOwnAiSurface` で出し分けているが、同じセッションが2画面に現れうる | どこで話した内容がどこに残るのか分からない | 各入口が扱う会話スコープ（レッスン単位／横断）と、相互遷移時の引き継ぎ仕様を定義する | 3入口の役割と会話の引き継ぎ仕様が決定され、本WBSに記載されている | P2 | M | — | `frontend/src/components/shared/AppHeader.tsx`, `frontend/src/components/aicoach/GlobalAiCoachDrawer.tsx` | 要件確認 |
| F6-05 | AIに相談する | AIコーチ | ナビゲーション | PC⇔SPの幅変更で履歴パネルの開閉状態が失われないようにする | `showHistory = historyOpen && isDesktop` で、SPに落ちるとオーバーレイ表示に切り替わる | 幅を変えると履歴が突然オーバーレイになる | 幅変更時に `historyOpen` をリセットするか、表示形態のみ切り替えるかを揃える | 1023px⇔1025pxのリサイズで履歴の開閉状態が意図どおりに保たれる | P3 | S | — | `frontend/src/components/aicoach/AiCoachPage.tsx` | 対応可能 |
| F6-06 | AIに相談する | AIコーチ | 動作確認 | 375pxで入力欄とスキルドックが会話本文を覆わないことを確認する | 画面全体を `100dvh` に固定し、入力欄は下部固定 | SPで入力欄とスキル一覧が高さを占め、会話が数行しか見えない可能性がある | 375×667で会話5往復の状態を確認する | 375×667で会話領域が画面高の50%以上を占め、最新メッセージが見える | P2 | S | — | `frontend/src/components/aicoach/AiCoachSessionView.tsx`, `frontend/src/components/aicoach/AiSkillDock.tsx` | 未着手 |

### 1-7. ユーザーフロー: プロフィール・アカウントを設定する

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F7-01 | プロフィールを設定する | プロフィール編集 | 入力フォーム | 未保存の変更がある状態での離脱時に警告を出す | 戻るボタンで確認なく `/mypage` へ遷移し、入力が破棄される | 入力した内容が確認なく消える | 変更検知（初期値との比較）を入れ、離脱時に共通確認ダイアログを出す | 内容を変更したあと戻るボタンを押すと確認ダイアログが出て、キャンセルすると入力が残る | P1 | M | F0-27 | `frontend/src/components/ProfilePage.tsx` | 未着手 |
| F7-02 | プロフィールを設定する | プロフィール編集 | 入力フォーム | 3つの `<label>` を `htmlFor`/`id` で入力欄に紐付ける | ラベルとinput/textareaが関連付けされていない | SRで入力欄の名前が読まれない | 各要素に `id` を付け、labelに `htmlFor` を付ける | ラベルクリックで対応する入力欄にフォーカスが移る（3項目すべて） | P2 | S | F0-40 | `frontend/src/components/ProfilePage.tsx` | 対応可能 |
| F7-03 | プロフィールを設定する | プロフィール編集 | デザイン統一 | 旧ピンク系（`brand.*`）の配色を確定パレットに置き換える | ページ全体が `bg-brand-bg` `text-brand-muted` `focus:ring-brand`（ピンク）で組まれ、背景に3つのピンク円がある | サイドバーが赤、本文がピンクという配色の分裂が最も目立つ画面 | F0-10で確定した色に置き換え、装飾円の色も合わせる | ProfilePage内に `brand-` プレフィックスのクラスが残っていない | P3 | M | F0-10, F0-12 | `frontend/src/components/ProfilePage.tsx` | 未着手 |
| F7-04 | アカウントを設定する | アカウント設定 | 入力フォーム | メール変更とパスワード変更を1つの「保存」で処理する構成を見直すか決める | 両方を1ボタンで処理し、片方だけ変更してもモード遷移が起こる | 何が保存されたのか分かりづらく、失敗時にどちらが原因か不明 | セクションごとに独立した保存ボタンを持たせるかを決める | フォーム構成が決定され、本WBSに記載されている | P2 | S | — | `frontend/src/components/AccountSettingsPage.tsx` | 要件確認 |
| F7-05 | アカウントを設定する | アカウント設定 | 入力フォーム | パスワード要件チェックリストを入力に応じてリアルタイム表示する | `passwordRules` は定義済みだが、判定は保存押下時のエラー文言としてのみ使われる | 要件を満たすまで何度も保存を押すことになる | 入力中に5項目のチェック状態を表示する | 入力するたびに5項目のチェック表示が更新され、すべて満たすまで保存が無効になる | P2 | M | — | `frontend/src/components/AccountSettingsPage.tsx` | 未着手 |
| F7-06 | アカウントを設定する | アカウント設定 | 動作確認 | 375pxでアカウント設定の入力欄とパスワード表示切替が重ならないことを確認する | 入力欄に右寄せの目アイコンが重なる構成 | SPで入力文字がアイコンに隠れる | 375pxで長いメールアドレスとパスワードを入力して確認する | 375pxで入力文字列とアイコンが重ならず、末尾まで読める | P2 | S | F1-03 | `frontend/src/components/AccountSettingsPage.tsx` | 未着手 |
| F7-07 | プロフィールを設定する | プロフィール／バッジ | ナビゲーション | `/profile` と `/badges` への到達導線を用意する | 両画面へのリンクは未使用コンポーネント（`ProfileSection` 等）にしか存在せず、実質到達不能 | プロフィール編集とバッジ一覧に辿り着けない | アカウント設定またはマイページのプロフィール帯からリンクする | サイドバー／マイページ／アカウント設定のいずれかから2画面へ遷移できる | P1 | M | F0-05 | `frontend/src/components/shared/AccountSettingsDropdown.tsx`, `frontend/src/components/mypage/ProfileSummaryStrip.tsx` | 未着手 |

### 1-8. 保守・整理（フロー横断）

| ID | ユーザーフロー | 画面 | 改善分類 | タスク | 現状の課題 | ユーザーへの影響 | 対応方針 | 完了条件 | 優先度 | 工数 | 依存タスク | 関連ファイル | ステータス |
| -- | ------- | -- | ---- | --- | ----- | -------- | ---- | ---- | --- | -- | ----- | ------ | ----- |
| F8-01 | 保守 | 共通 | コンポーネント | 未使用の `components/mypage/` 15コンポーネントの削除可否を判断する | どこからも import されていないコンポーネントが15個残っている | （直接の影響なし。改修時の参照先を誤る二次リスク） | 各コンポーネントが将来使う予定かを確認し、不要なものを削除する | 15コンポーネントそれぞれに「残す／削除」の判断が付き、削除分が実際に削除されている | P3 | M | F0-05 | `frontend/src/components/mypage/` | 要件確認 |
| F8-02 | 保守 | 共通 | デザイン統一 | `frontend/docs/design-token-spec.md` を確定トークンに合わせて更新する | 「`tokens.ts` に集約」と書かれているが実態は `webcoachTheme.ts` が主流で、記載色（`#E0213A`）と `tokens.ts` の値（`#E60012`）も食い違う | 今後のデザイン依頼で誤った色が指定され続ける | F0-10/F0-11の決定に沿って記載値と参照先を更新する | ドキュメント記載のトークン値がコードの正の定義と一致している | P2 | S | F0-10, F0-11 | `frontend/docs/design-token-spec.md` | 未着手 |
| F8-04 | 保守 | 管理・コーチ画面 | デザイン統一 | 管理12画面・受講生一覧の `#E86D78`（34箇所／12ファイル）を `#E0213A` 系に置き換える | 管理・コーチ画面だけサーモン系の別ブランドになっている | （受講生には影響しない。運用担当者から見て別サービスに見える） | 受講生フローの色統一が終わった後、まとめて置き換える。`ToastContext` のエラー色と `.moodle-content` のリンク色もここで揃える | 管理・コーチ画面のスクリーンショットに `#E86D78` が残っていない | P3 | M | F0-10, F0-16, F0-17 | `frontend/src/components/admin/`, `frontend/src/components/coach/CoachStudentsPage.tsx`, `frontend/src/contexts/ToastContext.tsx`, `frontend/src/index.css` | 未着手 |
| F8-05 | 保守 | 共通 | デザイン統一 | 旧MUIパレット `theme/colors.ts`（`#C62828`）の廃止可否を判断する | MUI系13ファイルが参照し続けており、`muiTheme.ts` のプライマリも `#C62828` | （管理画面と孤立ルートのみ。受講生への影響は小さい） | MUI依存の残る画面（管理・孤立ルート）の処遇が決まってから、`colors.ts` を削除するか値だけ差し替えるかを決める | `colors.ts` の処遇が決定され、本WBSに記載されている | P3 | S | F0-05, F0-11, F8-04 | `frontend/src/theme/colors.ts`, `frontend/src/theme/muiTheme.ts` | 要件確認 |
| F8-03 | 保守 | 共通 | 動作確認 | 主要フロー（ログイン→マイページ→コース→レッスン→完了）を1440pxと375pxで通しで確認する | 個別修正後の通しの動作確認手順が無い | リグレッションに気づけない | 手順書化し、改修のたびに実施する | 通し確認の手順書が本WBSに追記され、1440px・375pxの両方で完走した記録がある | P2 | M | — | — | 未着手 |

---

## 2. 全体所見（主要な問題 5点）

1. **同じプロダクト内でデザインシステムが6系統に分裂している。**
   プライマリ赤だけで `#C62828` / `#FF5A7A` / `#E0242B` / `#E0213A` / `#E60012` / `#d40032` / `#E86D78` の7色。ボタン実装3系統、スタイル手法3系統（インライン2,014箇所／Tailwind／MUI `sx`）。マイページ（赤）→プロフィール編集（ピンク）のような遷移で別サービスに見える。**個別画面のUI改善より先に、この正を1つ決めないと、改善のたびに新しい亜種が増える。**

2. **スマートフォンで主要機能の半分に到達できず、到達できる画面も実用的に読めない。**
   SP下部ナビは4項目のみで、自習室・コーチング・学習ロードマップへのリンクが存在しない。さらに主要5画面が「1440px固定＋`transform: scale`（下限0.45）」方式のため、375px幅では実効幅648pxで横スクロールが発生し、14pxの本文が実効6.3pxになる。レスポンシブ方式自体も3系統（scale方式／JS幅判定／通常フロー）に分かれている。

3. **復元不能な削除に確認がなく、誤操作でデータが失われる。**
   ノート削除、AI会話削除、学習ロードマップの「初回設定をやり直す」がいずれもワンタップで即実行される。確認ダイアログは全アプリで `window.confirm` 2箇所のみ。ロードマップのリセットに至っては「モック確認用」とコメントされたボタンが受講生に常時表示されている。

4. **ローディング・エラー・空状態の扱いが画面ごとに独自で、誤った状態が表示される箇所がある。**
   共通部品が3つ（MUI系2つ＋Tailwind系1つ）あるのに主要画面はどれも使わず自作。結果として、学習コンテンツ画面は読み込み中に「条件に合うコースが見つかりませんでした」と表示し、カタログ取得失敗は `catch` で握り潰されてエラーが見えない。再試行ボタンの有無も画面ごとにバラバラ。

5. **キーボード操作とフォームのアクセシビリティが構造的に欠けている。**
   `<input>` 68件に対し `htmlFor` によるラベル紐付けは3件。主要な操作（教材トップの残りレッスン行、コーストップのレッスン行・単元開閉）がクリック可能な `div` で実装されておりキーボードで操作できない。モーダル・ドロワーにフォーカストラップと `aria-modal` が無い。一方でサイドバー・パンくず・自習室タブは `aria-current` やフォーカスリングを持っており、**品質が画面ごとに大きくばらついている**。

---

## 3. 最優先ユーザーフロー

**「ログインして学習を始める → 教材を探して学ぶ」（F1 → F2）を最優先とする。**

理由:

- **利用頻度が最も高い唯一の必須フロー。** コーチング・ロードマップ・AIコーチは補助機能で、使わなくても学習は成立する。一方このフローは全受講生が毎回通る。ここでの迷いは全ユーザーに毎回発生する。
- **このフローに現在の問題が最も濃く集中している。** 学習コンテンツ画面には「読み込み中に空状態を誤表示」「取得失敗が見えない」「レッスン行がキーボード操作不能」「4列固定グリッド」が同居し、コーストップにも同種の問題（再試行なし・div onClick・CTA階層なし）がある。
- **共通基盤の改善結果を最短で検証できる。** F0で決めるデザイントークン・状態表示・レスポンシブ方式は、このフロー3画面（マイページ／学習コンテンツ／コーストップ）に適用すると効果が最も分かりやすく、他フローへ展開する際のテンプレートになる。
- **中断されるとプロダクトの価値がゼロになる。** 学習に到達できないことは、ほかのどの機能の使いにくさよりも損失が大きい。

進め方の推奨: **F0の意思決定タスク（F0-10 / F0-30 / F0-20）を先に片付けてから、F1 → F2 の実装タスクに入る。** 意思決定を飛ばして個別画面を直すと、後で全部やり直しになる。

---

## 4. 次に着手する3タスク

### ① F0-10 — プライマリカラーの正を1色に決める

- **タスクID**: F0-10
- **作業内容**: 現在併存する6系統の赤（`#C62828` / `#FF5A7A` / `#E0242B` / `#E0213A` / `#E60012` / `#d40032`）の使用箇所を数え、デザインハンドオフ資料（`design_handoff_lms_app/`、`frontend/docs/design-token-spec.md`）と突き合わせて、プライマリ／ホバー／淡色（選択・チップ地）／枠線／フォーカスリングの5値を確定する。コードは変更しない。
- **先に行う理由**: 配色に関わるタスクが本WBSに14件あり、すべてこの決定に依存している。ここが決まらないまま個別画面を直すと、7系統目の赤が増えるだけになる。所要は最小（S）なのに解除する依存が最も多い。
- **完了条件**: プライマリ／ホバー／淡色／枠線／フォーカスリングの5値が確定し、本WBSの「決定事項」として記載され、レビュー承認されている。
- **想定工数**: S（30分以内）

### ② F0-30 — `transform: scale` 方式をSPでも継続するかを決める

- **タスクID**: F0-30
- **作業内容**: `useScaleToFit` 方式の5画面について、375px時の実測（scale値・実効幅・実効文字サイズ・横スクロール有無）を取り、「SPのみ通常フローの1カラムに切り替える」「scale方式を全廃する」「PC専用と割り切る」の3案を比較して1つを選ぶ。コードは変更しない。
- **先に行う理由**: レスポンシブ関連タスク10件と、全画面の動作確認タスクがこの決定に依存する。また、この方式を続けるかどうかで各画面のレイアウト改修の規模が根本的に変わるため、個別のSP対応に着手する前に決める必要がある。①と独立しているので並行して進められる。
- **完了条件**: 方式が決定し、対象5画面（マイページ／学習コンテンツ／集中ブース／学習記録／ノート）それぞれのSP時の扱いが本WBSに記載されている。
- **想定工数**: M（30分〜2時間）

### ③ F2-05 — 学習コンテンツの残りレッスン行・領域チップを `<button>` 化する

- **タスクID**: F2-05
- **作業内容**: `MaterialsTopPage.tsx` の「このコースの残りレッスン」の各行（現在は `div onClick`）と、学習領域ジャンプチップ（現在は `span onClick`）を `<button type="button">` に置き換え、既存の共通フォーカスリング（`focus-visible:ring-[#F6B9BD]`）を適用する。
- **先に行う理由**: ①②の意思決定を待っている間に着手できる、依存ゼロの実装タスク。最優先フロー上にあり、キーボード利用者にとっては「操作不能」に近い状態を解消する。配色にもレイアウトにも触れないため、①②の結論がどちらに転んでも手戻りしない。
- **完了条件**: Tabキーで残りレッスンの全行と全領域チップにフォーカスでき、Enterキーでクリックと同じ遷移・スクロールが起きる。見た目に変化がない（ボタンのデフォルトスタイルがリセットされている）。
- **想定工数**: S（30分以内）

---

## 5. 要確認事項（実装前に人間の判断が必要なもの）

| # | 論点 | なぜ判断が必要か | 判断者の想定 | 関連タスク |
|---|---|---|---|---|
| ~~Q-01~~ | ~~プライマリカラーの正の1色~~ | **解決済み → 決定D-01（`#E0213A`）** | — | F0-10 |
| Q-17 | 小さい文字用に濃い赤（`#D40032` 相当）を第2トークンとして持つか | `#E0213A` の白背景コントラストは 4.72:1 で、WCAG AA（4.5:1）を余裕0.22で通過する。11.5px の `font.caption` や 12px の `font.label` をプライマリ色で書いている箇所が多く、実運用では厳しい可能性がある | デザイン責任者 | F0-16, F0-19 |
| Q-02 | トークンの正を `webcoachTheme.ts` と `tokens.ts` のどちらにするか | 両ファイルが同じ役割を主張しており、値も異なる | デザイン責任者＋実装者 | F0-11, F8-02 |
| Q-03 | スマートフォン対応の位置づけ（本気で対応する／PC前提で最低限に留める） | `transform: scale` 方式は「レイアウトを崩さずズームアウトする」という明示的な設計判断の結果であり、外部から良し悪しを断定できない。ただし375pxでは実用に耐えない（実効文字6.3px、横スクロール発生）ことは計測で確定している | プロダクト責任者 | F0-30, レスポンシブ全般 |
| Q-04 | SP下部ナビに載せる項目と、載せない機能の到達手段 | 6機能を4枠に収める配分はプロダクト判断 | プロダクト責任者 | F0-01, F0-02 |
| Q-05 | 孤立ルート4件（`/webcoach` `/career-path` `/content-list` `/learning-courses`）の存続 | 「旧デザインの残骸」なのか「導線を作り忘れている現役機能」なのかコードからは判断できない | プロダクト責任者 | F0-05, F8-01 |
| Q-06 | `/badges` と `/profile` に到達導線が無い状態が意図的か | 現在は未使用コンポーネント経由でしかリンクされておらず、実質到達不能 | プロダクト責任者 | F7-07 |
| Q-07 | 学習ロードマップ「初回設定をやり直す」を本番で受講生に出すか | コード上「モック確認用。実運用では管理者操作にする想定」とあるが、現状は常時表示 | プロダクト責任者 | F5-01, F5-02 |
| Q-08 | 「今日／今週／累計の学習時間」「ストリーク」の正の置き場 | マイページ・集中ブース・学習記録の3画面に重複表示されており、どれを主とするかは設計判断 | プロダクト責任者 | F3-07 |
| Q-09 | 「次回までの目標」の表示・操作の責務（コーチング画面 vs マイページ） | 同上 | プロダクト責任者 | F4-04 |
| Q-10 | AIの入口3つ（教材内ペイン／AI専用ページ／常駐ドロワー）の役割分担と会話の引き継ぎ仕様 | `hasOwnAiSurface` による出し分けはあるが、同じセッションが複数画面に現れる条件が仕様として書かれていない | プロダクト責任者 | F6-04 |
| Q-11 | 「このコースの残りレッスン」の表示範囲（全件 vs 未完了のみ） | 見出しと実装が食い違っているが、どちらが正しい意図か不明 | プロダクト責任者 | F2-03, F2-04 |
| Q-12 | 教材ページ「完了にする」ボタンの押下後挙動（次へ自動遷移するか） | 完了済み時のみ次レッスンへ進む二重挙動が意図的かどうか不明 | プロダクト責任者 | F2-22 |
| Q-13 | 集中ブースで教材未選択のまま開始できる仕様の是非 | 「入力を増やさない」という明示的な設計判断（コードコメント）があるため、記録の質とのトレードオフはプロダクト判断 | プロダクト責任者 | F3-08 |
| Q-14 | コーストップ／教材トップの完了状態取得（N+1）を一括APIに変えるか | バックエンド変更は禁止されているため、モック側で一括APIを定義するか、フロントで件数を制限するかの判断が要る | 実装者＋プロダクト責任者 | F0-50, F2-07相当 |
| Q-15 | ボタン実装の集約先（`ui/button` / インライン style / 新規共通コンポーネント） | 既存19ファイルが `ui/button` を使う一方、新デザインの画面はすべてインライン style。移行コストと一貫性のトレードオフ | 実装者 | F0-14 |
| Q-16 | アカウント設定のメール変更とパスワード変更を分離するか | 現在は1つの保存ボタンで両方を処理している。セキュリティ運用上の意図がある可能性 | プロダクト責任者 | F7-04 |

### 推測であることを明記する項目

- 「375pxでの実効文字サイズ6.3px・横スクロール発生」は `useScaleToFit` の計算式（`Math.max(0.45, Math.min(1, outerWidth / 1440))`）からの**計算値であり、実機での目視確認は未実施**。F0-31で実測して裏付ける必要がある。
- 「孤立ルート4件は旧デザインの残骸」というのは、コード内容（旧ピンクパレット・MUI依存）からの**推測**。プロダクト側の意図は未確認（Q-05）。
- 各タスクの工数（S/M/L）は、対象ファイルの行数と変更範囲からの**見積もりであり、実測ではない**。

---

## 6. 決定事項（記入欄）

意思決定タスク（ステータス「要件確認」）の結論はここに追記していく。

| 決定ID | 関連タスク | 決定内容 | 決定日 | 決定者 |
|---|---|---|---|---|
| **D-01** | F0-10 | **プライマリカラーを `#E0213A` に統一する（案A）。** 下表の5値を正とし、`webcoachTheme.ts` の既存定義をそのまま採用する。`#D40032`（案B）は不採用 | 2026-08-06 | 宮部 |
| （未記入） | F0-30 | | | |
| （未記入） | F0-20 | | | |
| （未記入） | F0-11 | | | |
| （未記入） | F0-14 | | | |

### D-01 の確定値

| 役割 | 値 | 出典 |
|---|---|---|
| プライマリ | `#E0213A` | `webcoachTheme.color.primary`（既存） |
| ホバー | `#C4102A` | `webcoachTheme.color.primaryHover`（既存） |
| プレス | `#A80B21` | `webcoachTheme.color.primaryPressed`（既存） |
| 淡色（チップ・選択面） | `#FFECEE` | `webcoachTheme.color.primarySoft`（既存） |
| 枠線（アウトラインボタン） | `#F3C3C9` | `webcoachTheme.color.primaryBorder`（既存） |
| フォーカスリング | `#F6B9BD` | 既に35ファイルで共通使用 |
| HSL（CSS変数用） | `352 76% 50%` | `#E0213A` の変換値 |
| 白背景コントラスト比 | 4.72 : 1（WCAG AA 通過） | 実測計算値 |

**D-01 の根拠**: (1) `frontend/docs/design-token-spec.md` が既に「ブランドレッド `#E0213A`、全体で108箇所使用、最重要トークン」と明記している。(2) `webcoachTheme.color.primary` を72ファイルが参照済みで、主要画面の見た目が一切変わらないため回帰確認の範囲が最小。(3) 派生値13個（hover/soft/border/gradient/shadow）を再設計せずに流用できる。

**D-01 で変わる画面**: 学習コンテンツ・コーストップ（`#E60012` → 統一）、サイドバー（`#E0242B` → 統一）、ログイン（`#d40032` → 統一）、ProfilePage・BadgesPage等の旧ピンク系、管理・コーチ画面（`#E86D78` → 統一）。マイページ・自習室・コーチング・ロードマップ・AIコーチ・レッスン学習は**見た目が変わらない**。

**D-01 の残課題**: Q-17（小さい文字用の濃い赤を第2トークンとして持つか）。未決の間は第2トークンを作らない前提で進める。
