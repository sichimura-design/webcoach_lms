# dev/miyabe モック実装 → バックエンド要件整理

`dev/miyabe`ブランチではフロントエンド（`frontend/`）に多数の新機能をMSW（Mock Service Worker）でモック実装している。実バックエンド（`api-server`=FastAPI、`bff-server`=Express.js）は変更されていないため、実データ化には別途バックエンド対応が必要。本ドキュメントはその洗い出し。

**優先度の目安**
- **S**：実データが既にあり、フロントの向き先を変えるだけで済む
- **A**：実データの土台はあるが、bff/api側に小さな追加（既存カラムの露出、集計エンドポイント追加など）が必要
- **B**：概念自体が存在せず、テーブル設計・運用フロー設計を含む新規開発が必要

**現状の実バックエンド構成**
- `api-server`(FastAPI): `ai.py`/`ai_langgraph.py`（Claude+LangChain+RAGの単発チャット）、`webcoach.py`（プロフィール/続きから学習/ロードマップ/アバター）、`courses.py`/`roadmaps.py`/`badges.py`
- `bff-server`(Express.js): `webcoach.js`/`moodle.js`/`admin.js`/`auth.js`/`faiss.js`の5ルートのみ
- コーチング・学習プラン・フォーカスブース・ノート系のテーブル/ルートは一切存在しない

参照元: `origin/dev/miyabe`の`frontend/docs/mypage-real-data-requirements.md`、`frontend/docs/student-outcomes-tracking-requirements.md`、`frontend/docs/{ai-coach-skill-modes-design,ai-coaching-notes-design,learning-workspace-design}.md`、および`frontend/src/mocks/*`・`frontend/src/types/*`の実装調査。

---

## A. マイページ

| 項目 | 現状 | 判定 | 対応 |
|---|---|---|---|
| 挨拶名 | `GET /api/webcoach/profile/:userid` → `nick_name`。実データ済み | S | 対応不要 |
| ストリーク（🔥日数・週間ドット） | `timecompleted`/`lastaccess`は既存データ。フロントは`getStreak(userId)`で`GET /webcoach/streak/:userid`を既に呼んでいる（404中） | A | 日別バケット集計の新規エンドポイント1本 |
| 続きから学習：コース名・進捗% | `GET /api/webcoach/resumecourse/:userid`で実データ済み | S | 対応不要 |
| 続きから学習：現在チャプター | `webcoach_user_course_lastaccess.current_section`列は既存だがAPIレスポンス未露出 | A | レスポンスに1列追加するだけ |
| 続きから学習：レッスン名・残り分数 | 教材ごとの想定時間メタデータが存在しない | B | 新規メタデータテーブル要（後述） |
| 次回コーチング目標 | コーチング関連テーブル・API・Moodle webservice機能が皆無 | B | E章のコーチングノート機能と統合実装 |
| ギルドロビー・在室メンバー | プレゼンス基盤が皆無 | B | 優先度最低。G章と統合 |
| 統計バー：完了数・修了コース数 | 既存の完了状況集計で算出可能 | S | 対応不要 |
| 統計バー：先週比 | 現状localStorage代替。`timecompleted`で集計可能 | A | 直近7日/前7日集計エンドポイント新設 |
| 統計バー：学習時間 | 分単位の実測ログが皆無 | B | H章の学習アクティビティ記録で解決 |
| ロードマップ：詳細 | `GET /api/webcoach/roadmap/:id`は実装済み | A | 対応小 |
| ロードマップ：一覧 | `GET /api/webcoach/roadmaps`は実装済みだが常に空配列のTODOスタブ | A | スタブ実装＋ユーザー紐付け方針決定 |

## B. 受講生実績トラッキング

| 項目 | 現状 | 判定 | 対応 |
|---|---|---|---|
| 案件獲得率・初案件日数 | 「案件」相当のテーブル・フィールドが皆無。`target_job`は願望であり実績ではない | B | 新規テーブル`job_acquisitions` |
| 収益化率・平均月商 | 完全にABSENT | B | 新規テーブル`revenue_records` |
| 受講継続率 | `webcoach_user_course_lastaccess`・`mdl_user_last_course_access`は既存。「継続/離脱」ステータス列は無し。Moodle標準`enrolstatus`はコード上未参照の休眠フィールド | A | しきい値合意の上、既存データの集計エンドポイント新設のみ（テーブル変更不要） |
| 制作物（ポートフォリオ） | `mod_assign`系はMoodleAdapter.jsから一度も呼ばれていない。提出物テーブルが皆無 | B | 新規テーブル`portfolio_submissions`（`core_files_upload`/`s3-upload`は流用可） |
| 運営向け受講生リスト | `AdminStudentsPage.tsx`等3画面が呼ぶAPIはbff/api/MSWのどこにも実装が無く**既に404**。複数ユーザー分をまとめて返すロスターAPIも皆無。Moodleサービストークンの`core_enrol_get_enrolled_users`権限は付与済みだが未使用 | B | ロスター集計エンドポイント新設＋3画面の実接続。`CoachStudentsPage.tsx`のデッドリンク（`/coach/students/:id`）解消 |

## C. AIコーチ

- モック: `POST /api/webcoach/lesson-ai`（教材根拠付き構造化回答）、`POST /api/webcoach/ai-skill`（添削等の専門モード）。会話は`sessionStorage`のみでサーバー永続化なし。
- 実装済み: `POST /api/webcoach/ai`（単発チャット、Claude+RAG）は疎通済み。ただし教材ブロック単位の根拠付け・専門モード分岐・会話履歴保存は無い。
- 判定: **B**。専門モードは「BFFがDifyアプリを代理呼び出しする境界」として設計済み（`ai-coach-skill-modes-design.md`）。既存の`webcoach_ai_application.tags`列に`skill:xxx`を入れる運用で、この部分は新規テーブル不要。
- 次アクション: (a) `lesson-ai`は既存RAGの教材検索・根拠付け拡張、(b) `ai-skill`はBFFにDify資格情報解決層を追加、(c) 会話永続化テーブル新設（後述）。

## D. 学習ワークスペース（教材＋AIコーチ併用画面）

- モック: `GET /courses/:id/outline`・`/lessons/:id`（ブロック化教材）、`POST /lesson-ai`、`GET/PUT /lesson-notes/:lessonId`、`GET/POST/DELETE /notes`。
- 実バックエンド: 該当機能なし。教材は現状Moodleのiframe描画のみで、ブロック単位ID・完了状態統合もない。
- 判定: **B**。最大の設計判断点はPhase2「教材のブロック化」（Moodle `mod/page`分解 or 別CMS導入）— これが決まるまでテーブル設計も確定できない。
- 引き渡し事項（`learning-workspace-design.md`）: `blocks[].id`の永続ID化、教材検索の優先順位遵守、画像保存先、completion APIとの統合要否、outlineを唯一の情報源にすること。

## E. コーチングノート・セッションレビュー（最大規模）

- モック: Zoom/Google Meet連携 → 自動録画取得 → 文字起こし → AI要約 → 目標確定の一連フロー。`coachingHandlers.ts`に17エンドポイント。ConnectCoachPage（コーチ招待URL連携）もこの一部。
- 実バックエンド: OAuth連携、Webhook、非同期ジョブ基盤、presigned URLアップロードすべて未着手。
- 判定: **B**（規模最大だが設計文書が最も充実）。`ai-coaching-notes-design.md`に本番用テーブル11本の設計と引き渡し事項10項目が既にある。要約生成プロンプトのPoCも実施済み（`poc/ai-coaching-notes/`）。
- 次アクション: `MeetingProvider`抽象層（`bff-server/adapters/`規約に従う）の実装が起点。

## F. 学習プラン

- モック: 初回ヒアリング(intake) → AI生成プラン(フェーズ/マイルストーン) → 週次チェックイン → AI差分提案(revision)。
- 実バックエンド: 概念自体が存在しない。既存`webcoach_user_learning_roadmap`は「コース順序の静的テンプレート」で別物。
- 判定: **B**。ロジックは`utils/learningPlanTemplate.ts`の純関数に集約されておりサーバー移植しやすい。機能自体の必要性再確認を推奨。

## G. フォーカスブース

- モック: 学習タイマー本体（自分の記録）＋他ユーザーの在室状況＋応援ボタン。他ユーザー分は固定モックのみで実データ連携ゼロ。
- 判定: **B**。「他人の在室状況」はリアルタイム性が要る。まず自分専用のタイマー記録（H章と統合）を先行し、社会的機能は後回し推奨。

## H. 学習ログ・マイノート

- モック: `study-activities`（タイマー記録CRUD、現状localStorage）、`study-stats`（日次集計・ストリーク）、`notes`（マイノート）。
- 判定: **A〜B**。ストリークはA-2の集計で対応可能だが、**タイマーで能動的に記録した学習時間そのもの**は既存ログに無い新規データ。A-2（ストリーク改修）とセットで一本化するのが効率的。

## I. その他

- コーチ紹介/マッチング（ConnectCoachPage）はE章の一部。
- MaterialsTopPage / CourseTopPageは既存の実bffエンドポイントのみ使用。追加対応ほぼ不要（**S**）。

---

# テーブル定義の変更が必要な点

## 1. 既存テーブルの変更（ALTER・カラム追加）

| テーブル | 変更内容 | 理由 |
|---|---|---|
| `webcoach_user_course_lastaccess` | **変更不要**（`current_section`列は既存）。APIレスポンス側で露出させるだけ | A-3 |
| `webcoach_ai_application` | **変更不要**（既存`tags`列を`skill:xxx`形式で利用する運用のみ） | C |
| Moodle標準の`enrolstatus`関連 | **変更不要**（既存の休眠フィールドを参照するだけ） | B-受講継続率 |

→ 上記3件は「テーブル定義の変更は不要」で、API実装のみで対応できる点として明記しておく（誤って新規カラム追加をしないよう）。

## 2. 新規テーブルが必要なもの

### 2-1. コーチング（A-4簡易版はE章に統合。E章の設計を正とする）

`ai-coaching-notes-design.md`で設計済みの11テーブル。下記はフロントの型定義（`types/coaching.ts`）から具体化したカラム案。

- **`coaching_sessions`** — コーチング1回分
  `id, mdl_user_id, coach_id, meeting_link_id(FK), scheduled_at, status(draft/recording/uploading/transcribing/summarizing/review_required/published/failed), created_at, updated_at`

- **`meeting_links`** — 登録された会議リンクと会議ID（Webhook照合キー）
  `id, session_id(FK), provider(zoom/google_meet), url, meeting_id, passcode(nullable), registered_at`

- **`meeting_connections`** — コーチのOAuth連携状態とトークン
  `id, coach_id, provider(zoom/google_meet), oauth_account_email, refresh_token_encrypted, token_expires_at, connected_at, status(active/revoked/expired)`

- **`connection_invites`** — 認証URLのトークン・有効期限・使用状況
  `id, token(乱数), coach_id, expires_at, used_at(nullable), created_by`

- **`recordings`** — 音声ファイルと取得状態
  `id, session_id(FK), source(auto_recording/provider_transcript/uploaded_audio/pasted_text), imported_from(auto/manual), file_url, duration_seconds, fetch_status(pending/success/failed), deleted_at`（90日自動削除）

- **`recording_consents`** — 録音・AI利用への同意
  `id, session_id(FK) or user_id, consented_at, consent_version`

- **`transcripts`** — 文字起こし全体
  `id, session_id(FK), full_text, language, created_at`

- **`transcript_segments`** — 発言単位の文字起こし
  `id, transcript_id(FK), segment_id, speaker_id, speaker_role(coach/student/unknown), start_ms, end_ms, text, confidence`

- **`ai_summaries`** — AI要約（バージョン保持。上書きせず追加）
  `id, session_id(FK), version, session_summary, progress_since_last(JSON), coach_feedback(JSON), decisions(JSON), next_session_agenda(JSON), referenced_context(JSON), generated_at, generated_by(ai/student_edit/coach_edit)`

- **`goal_candidates`** — AIが抽出した候補
  `id, session_id(FK), title, success_criteria(nullable), due_date(nullable), estimated_minutes(nullable), priority(high/normal/low), source_segment_ids(JSON), needs_review(bool), state(ai_suggested/student_confirmed/shared_with_coach/coach_confirmed/completed), selected(bool)`

- **`goals`** — 確定された目標
  `id, candidate_id(FK, nullable), user_id, title, success_criteria, due_date, status, completed_at`

- **`processing_jobs`** — AI処理の状態・エラー（非同期処理基盤）
  `id, session_id(FK), job_type(transcribe/summarize/…), status, error_message, started_at, finished_at`

- **`audit_logs`** — 閲覧・編集・削除履歴
  `id, actor_id, actor_role, action, target_session_id, occurred_at, ip_address`

  ※A-4「次回コーチングまでの目標」は`coaching_sessions`/`goals`をそのまま参照すれば別テーブル不要。

### 2-2. 学習プラン（F章）

- **`learning_plans`**
  `id, user_id, status(lms_generated/student_reviewed/confirmed_with_coach/archived), created_at, updated_at`

- **`plan_phases`**
  `id, plan_id(FK), phase_key(foundation/tools/practice/mock_project/portfolio/job_hunting/client_work/custom), start_date, end_date, priority, display_order`

- **`plan_milestones`**
  `id, phase_id(FK), title, skill_keys(JSON), status(todo/in_progress/done/missed), target_date, source(template/custom)`
  ※`artifact_count`等の自動判定指標はB-4`portfolio_submissions`実装後でないと算出不可（依存関係あり）

- **`plan_checkins`**
  `id, plan_id(FK), checkin_date, notes, created_by`

- **`plan_revisions`**
  `id, plan_id(FK), revised_at, diff(JSON), proposed_by(ai/student), accepted(bool)`

### 2-3. 学習アクティビティ記録（H章・G章・A-6共通の受け皿）

- **`webcoach_study_activity`**
  `id(varchar, クライアント生成の冪等キー), user_id, kind(study_session固定・将来拡張), occurred_at, started_at, ended_at, local_date(YYYY-MM-DD),`
  `course_id, course_title, lesson_id(nullable), lesson_title(nullable), progress_percent_at_start(nullable), progress_percent_at_end(nullable),`
  `mode, target_minutes(nullable), duration_minutes, measured_seconds, adjusted(bool), paused_count, paused_seconds, completed_target(bool),`
  `goal_text(nullable), content_note(nullable), memo(nullable), achievement(low/mid/high, nullable)`
  ※ソーシャル系（リアクション・コメント）は今回未実装のため`visibility`列のみ持たせ、他は将来拡張時に別テーブル切り出しでよい

### 2-4. AIコーチ会話永続化（C章）

- **`ai_coach_conversations`**
  `id, user_id, course_id(nullable), lesson_id(nullable), created_at, updated_at`

- **`ai_coach_messages`**
  `id, conversation_id(FK), role(user/assistant/proposal/system), content, quote(nullable), answer_json(nullable), skill_result_json(nullable), suggestion_json(nullable), proposal_json(nullable), resolution(nullable), created_at`

### 2-5. 教材メタデータ（A-3レッスン名・A-6学習時間の前提）

- **`webcoach_lesson_metadata`**（案。既存のMoodleコンテンツテーブルへのカラム追加でも可）
  `course_id, cmid, estimated_minutes, lesson_title`
  ※運用側でのメタデータ入力が前提。または実測セッション時間計測（2-3のテーブル）に一本化する案も検討可

### 2-6. ユーザー↔ロードマップ紐付け（A-7）

- **`webcoach_user_roadmap`**（既存で同等のテーブルが無い場合のみ新設）
  `user_id, roadmap_id, assigned_at`
  ※着手前に既存スキーマに同等の紐付けが無いか要確認

### 2-7. 受講生実績（B章、既出のため要点のみ再掲）

- **`job_acquisitions`**: `user_id, program_id(nullable), acquired_at, is_first_job, notes, entered_by`
- **`revenue_records`**: `user_id, program_id(nullable), period(月), amount, entered_at, entered_by`
- **`portfolio_submissions`**: `user_id, moodle_course_id, activity_label, submission_url, submitted_at, review_status, reviewed_by`

### 2-8. プレゼンス基盤（A-5・G章、優先度最低）

- **`presence_heartbeats`**: `user_id, room, last_seen_at`
  ※RDBではなくRedis等の短TTLストアが適切。テーブル化するなら定期パージのバッチが必須

---

## テーブル変更サマリ（件数）

- **変更不要（API実装のみ）**: 3件（`webcoach_user_course_lastaccess`の列露出、`webcoach_ai_application.tags`運用、`enrolstatus`集計）
- **新規テーブル**: 約24テーブル（コーチング11 + 学習プラン4 + 学習アクティビティ1 + AIコーチ会話2 + 教材メタデータ1 + ロードマップ紐付け1 + 受講生実績3 + プレゼンス1）
- 優先実装順は本ドキュメント冒頭の機能別TODOに準拠。特にコーチング11テーブルは設計文書が最も充実しているため着手しやすい一方、教材ブロック化（D章）の方針決定が他の複数機能（C・H）の前提になっている点に留意。

---

## Moodle標準API・機能の活用調査

新規テーブル/独自実装の前に、Moodle標準機能で代替・削減できる箇所がないかを調査した結果。調査対象: `bff-server/adapters/MoodleAdapter.js`, `bff-server/init-service-db.sql`（Web Service権限一覧）, `moodle-app/customizations/local/`（既存カスタムプラグイン）。本番/開発ともBitnami Moodle（本番`4.3.6`、開発`4.1`）。

### 1. 権限は付与済みだが未使用のWeb Service関数

`init-service-db.sql`で有効化済み、かつMoodleコアに標準搭載（追加インストール不要）だが、`bff-server`のどのroute/serviceからも呼ばれていないもの。

| 関数 | 活用候補 |
|---|---|
| `core_calendar_get_calendar_events` / `create_calendar_events` | コーチングセッション予定のMoodleカレンダー登録・表示。マイページ「Next Coaching Plan」カードのデータソース |
| `core_message_get_messages` / `send_instant_messages` | Connect Coachのコーチ⇔生徒メッセージ、AIコーチ・セッションリマインドなど一方向通知の配信チャネル |
| `core_grades_get_grades`, `gradereport_user_get_grade_items` | 受講生実績トラッキングのスキル習熟度表示、AIコーチの文脈情報 |
| `mod_forum_get_forum_discussions`, `get_forums_by_courses` | コースQ&A・ディスカッション（フォーラム活動が設定されている場合） |
| `mod_quiz_get_quizzes_by_courses` | 学習プランのマイルストーン達成判定シグナル |
| `core_enrol_get_enrolled_users` | コーチ担当生徒一覧（既知・要検討） |

### 2. 未リストだがMoodleコア標準で追加可能な関数

外部サービス定義に関数を追加するだけで使える（プラグイン追加不要）。

| 関数 | 活用候補 |
|---|---|
| `core_group_get_course_groups`, `get_group_members`, `create_groups`, `add_group_members` | マイページ「Guild Lobby」、コーチ担当生徒のグルーピング |
| `core_cohort_get_cohorts`, `add_cohort_members` | コーチ⇔生徒の恒久的な紐付け（コーチングマッピングの代替候補） |

### 3. 存在するが採用に注意が必要なもの

- **Competency / Learning Plans**（`core_competency_list_plans`, `create_plan`, `tool_lp_data_for_plans_page`等）: コア標準機能として存在するが、事前にコンピテンシーフレームワークを管理画面で設計する必要があり、LLM生成の柔軟な学習プラン（`learning_plans`等の新規テーブル案）とはUX面で相性が悪い可能性が高い。「呼べるが採用非推奨」
- **Notes機能**（`core_notes_create_notes`, `get_course_notes`）: コア標準機能として存在するが、近年のMoodle UIでは非推奨・レガシー扱い。将来的な縮小/廃止リスクがあり新機能の土台には非推奨

### 4. 標準APIでは呼べないもの（誤りの訂正）

- **`mod_scheduler`（面談予約）**: Moodleコアではなくサードパーティ製の追加プラグイン。`local_webcoach_*`と同様に別途インストール・カスタマイズが必要で「標準API」ではない
- **ログストア（`mdl_logstore_standard_log`）**: これを読む標準Web Service関数はMoodleコアに存在しない。取得するにはDB直接参照か、`local_webcoach_utils`のようなカスタムプラグインでのラップが必要

### 5. 通知・リマインダーの仕組み

Moodle標準の通知は「配信チャネル」と「送信トリガー判定」が分離した構造になっている。

- **配信チャネル（`core_message`／Message Provider基盤）**: 各プラグインが`db/messages.php`でメッセージプロバイダーを宣言し、ユーザーは「通知設定」画面でプロバイダーごとに配信チャネル（アプリ内ポップアップ/メール/モバイルPush）をON/OFFできる。送信側は`message_send()`（Web Service経由なら`core_message_send_instant_messages`）を呼ぶだけ
- **送信トリガー判定**: 上記の配信基盤には「いつ送るか」は含まれない。`mod_assign`の締切リマインドなど、各プラグインが自前のスケジュールタスク（cron）で判定している
- **訂正: 汎用カレンダーイベントの自動リマインダーは存在しない**。`core_calendar_create_calendar_events`で作った任意のイベント（コーチングセッション等）に対し、Googleカレンダーのような「◯分前に自動通知」機能はMoodleコアにはない。表示されるだけで自動リマインドは飛ばない
- **WebCoachでの実装方針**: 「いつ送るか」の判定ロジックは自前で持つ必要がある。選択肢は (a) `local_webcoach_utils`にスケジュールタスクを追加してMoodle cronで判定、(b) `bff-server`/`api-server`側に定期実行ジョブを追加し`core_message_send_instant_messages`で配信のみMoodleに任せる、の2択。(b)の方が既存の`webcoach_*`テーブルやAI要約結果と組み合わせた条件分岐がしやすく、自チームのデプロイサイクルで変更できるため現実的

### 6. メール送信基盤（SES関連）

- 現状`docker-compose.yml`/`docker-compose.ecs.yml`にはMoodleのSMTP設定が入っておらず（`MOODLE_EMAIL`のみ）、**Moodleからのメール送信は現状機能していない**
- Moodleのメール送信（Server > Email > Outgoing mail configuration）はPHPの`mail()`かSMTP直接設定のいずれかで、「メールサーバー/リレー無しで送る」という選択肢はない
- **SESはMoodleから利用可能**: SESはSMTPインターフェース（`email-smtp.<region>.amazonaws.com`、ポート587/465、SES専用SMTP認証情報）を提供しており、Moodleの標準SMTP設定にそのまま差し込める。Moodle側にAWS SDK等は不要
- ポート587/465を使うため、EC2/Fargateのデフォルトのポート25アウトバウンドブロック（自前MTA構築時の課題）とは無関係
- 前提条件: SES本番アクセス（現状サンドボックスのまま、`memory/ses-sandbox-release.md`参照）、送信ドメイン/アドレスの検証（`webcoach.jp`は実際には未検証）、MoodleのECSタスクからSES SMTPエンドポイントへの到達性（NAT Gateway経由 or `com.amazonaws.<region>.email-smtp`のVPCエンドポイント）
- SES以外の代替: SendGrid/Mailgun/Postmark等の外部SMTPリレー（SESの本番アクセス審査を待たずに導入できる可能性）、Google Workspace SMTPリレー（送信量制限が厳しく本番向きではない）。自前Postfix構築はポート25解除申請＋SPF/DKIM/DMARC/IPレピュテーション管理が必要で運用負荷が高く非推奨
- CognitoのメールとMoodleのメールは別系統。将来SES本番アクセスが下りれば同じ検証済みドメインを両方で使い回せる
