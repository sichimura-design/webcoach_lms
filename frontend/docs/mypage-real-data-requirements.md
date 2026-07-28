# マイページ 実データ移行 要件定義

## 目的

マイページ（`frontend/src/components/MyPage.tsx`）は design_handoff 系の作業で全面的に再構築したが、表示しているデータは現状すべて MSW モック（`frontend/src/mocks/handlers.ts`）である。本ドキュメントは、各カードの表示要素ごとに「実バックエンド（`api-server`/`bff-server`）にどこまで実データがあるか」を洗い出し、実データへの移行に必要な作業を優先度付きで整理したもの。バックエンドチームへの依頼リストとしてそのまま使える粒度を目指す。

**前提（ユーザーヒアリング済み）**
- コーチングの次回日程・目標は現在、社内でもExcel等の手作業管理。連携すべき既存の外部システムは無いため、ゼロから設計してよい。
- 本ドキュメント作成にあたり `api-server`・`bff-server` は読み取り専用で調査した。バックエンドのコード自体はこの作業では変更していない。

**優先度の目安**
- **S**：実データが既にあり、フロントの hooks/`bffClient.ts` の向き先を変えるだけで済む
- **A**：実データの土台はあるが、bff/api側に小さな追加（既存カラムの露出、集計エンドポイント追加など）が必要
- **B**：概念自体が存在せず、テーブル設計・運用フロー設計を含む新規開発が必要

---

## 1. ヘッダー（挨拶・ストリーク・週間ドット）

現状（`MyPage.tsx` / `mocks/handlers.ts`）: `useMypageData` が返す `userProfile.nick_name` で挨拶名を表示。`streak.days` / `streak.week`（`streakMock`）でストリーク数と7日分のドットを表示。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| 挨拶名 | `webcoach_user_profile.nick_name`（`GET /api/webcoach/profile/:userid`、既に実ルート） | **S** |
| 🔥ストリーク日数・週間ドット | 生ログテーブルは無いが、活動完了タイムスタンプ（`core_completion_get_activities_completion_status`の`timecompleted`）とコースアクセスタイムスタンプ（`mdl_user_last_course_access.lastaccess`）は実在。「その日に何かアクティビティを完了/アクセスしたか」を日付でバケット化すれば導出可能 | **A**：新規の日別集計エンドポイント（例 `GET /webcoach/streak/:userid`）を1本追加。**新しいログ収集は不要**、既存タイムスタンプの集計のみ |

**次アクション**: バックエンドに「直近8週間分の日別アクティビティ有無」を返す集計エンドポイントを1本依頼する。フロント側の`getStreak(userId)`（`bffClient.ts:390`）は既にこの想定のURLを叩いているため、ルートを実装するだけで繋がる。

---

## 2. 続きから学習ヒーロー（`ContinueLearningHero.tsx`）

現状: `course.title`（コース名）、`course.currentLesson`／`course.currentChapter`／`course.remainingMinutes`（すべて`mocks/handlers.ts`の`resumeCourses`にハードコード）、`course.progress`。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| コース名・進捗% | `webcoach_user_course_lastaccess` ＋ `CourseService.calculateCourseProgress()`（`GET /api/webcoach/resumecourse/:userid`、既に実ルート） | **S** |
| 現在チャプター | `webcoach_user_course_lastaccess`テーブルに**`current_section`列が既に存在**するが、APIレスポンスに含まれていない | **A**：api-server/bffのレスポンスに`current_section`を追加するだけ。新規データ収集は不要 |
| 現在のレッスン名（Lesson 4 バナー制作の基礎、のような具体名） | 未確認。`current_section`がセクション番号だけの可能性が高く、レッスン名までは無いかもしれない | **A〜B**（`current_section`の実際の値を確認してから再判定） |
| 残り約◯分 | どこにも実データが無い（教材ごとの想定時間メタデータ自体が未確認） | **B**（3の「学習時間」と同じ根本課題） |

**次アクション**: まず`current_section`の実際の値の形（セクション番号かレッスンIDか）を確認する。「残り時間」は当面「進捗%」の表示のみに簡略化するのが現実的。

---

## 3. 次回コーチングまでの目標（`NextCoachingPlan.tsx`）

現状: 完全にモック（`coachingGoalsStore`・`GET /api/webcoach/coaching-sessions/:userid`）。3件の目標（完了/次に取り組む/未着手）と、次回日程・コーチ名。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| 次回コーチング日時・コーチ名 | **無し**。コーチング関連のテーブル・API・Moodle webservice機能が一切存在しない | **B** |
| 目標リスト＋完了状態 | **無し**。`webcoach_user_profile.goal`は自由記述1件のみで、リスト化・完了フラグ・履歴が無い | **B** |

**次アクション**: これは新規機能開発になる。最低限、以下のテーブル設計が必要:
- `coaching_sessions`（`id, mdl_user_id, coach_name, scheduled_at, created_at`）
- `coaching_goals`（`id, session_id, description, is_completed, display_order`）

運用フロー自体（コーチが誰の画面からセッション・目標を登録するのか）も未設計。現状Excel等の手作業管理とのことなので、**まず「コーチ側の入力手段をどう作るか」を先に決める**必要がある（管理画面を新設するか、既存の`admin/AdminCoachMappingPage.tsx`系に相乗りするか）。フロントの`getNextCoachingGoals`/`getCoachingSessions`（`bffClient.ts:345,430`）は既にこの想定のURLを叩いている。

---

## 4. ギルドロビー・ギルドメンバー（`GuildLobbyCard.tsx` / `PeopleActivityCard.tsx`）

現状: 完全にモック（`focusBoothMembersStore`・`focus-booth/pulse`等）。オンライン人数・在室メンバー3名・elapsedMinutes。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| オンライン人数・在室メンバー・学習中の内容 | **無し**。プレゼンス（誰が今オンラインか）を追う仕組みが一切存在しない | **B** |

**次アクション**: 新規のリアルタイム/準リアルタイム基盤が必要（WebSocketか、フロントから定期的に「アクティブです」を送るハートビート方式のポーリングAPI）。これは他の項目と比べて実装コストが高い部類なので、**優先度としては後回みを推奨**（体験としての価値は高いが、独立した基盤構築プロジェクトになる）。

---

## 5. 統計バー（`StatsStrip.tsx`）

現状: `useLearningSummary`が`course.durationMinutes`・`course.totalLessons`（いずれもモック専用フィールド）× 進捗率で推定。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| レッスン完了数 | `core_completion_get_activities_completion_status`の`state`集計（既に実データで取得可能） | **S** |
| 修了コース数 | コース進捗100%の件数（既に実データで取得可能） | **S** |
| 今週の完了数の「先週比」 | 現在はlocalStorageスナップショットという代替実装。実データなら`timecompleted`で直近7日/その前7日をサーバー側で集計するだけ | **A** |
| 今週の学習時間・累計学習時間 | **無し**。分単位の実測ログが一切無く、教材ごとの「想定時間」メタデータも実データでは未確認（今の`durationMinutes`はモック専用） | **B** |

**次アクション**: 「学習時間」は以下のいずれかを選ぶ意思決定が必要:
1. コンテンツごとの想定時間を運営側でメタデータとして入力する運用にし、「想定時間×進捗率」を今のロジックのまま実データに置き換える（データ入力コストのみ、開発コストは低い）
2. 実際の視聴/学習セッション時間を計測する仕組み（ページ滞在時間トラッキング等）を新規開発する（開発コストは高いが精度が出る）

「レッスン完了数」「修了コース数」は実データ化を先に進めてよい。

---

## 6. ロードマップ（`RoadmapSection.tsx` / `useHomeRoadmap.ts`）

現状: `journey`モック（`GET /api/webcoach/journey/:userid`）が6ステップ分の状態をハードコードで返す。

| 表示項目 | 実データ | 優先度 |
|---|---|---|
| 複数コースをまとめた順序付きロードマップ | ロードマップ**詳細**API（`GET /api/webcoach/roadmap/:id`）は実在し、ロードマップに紐づくコース一覧を順序付きで返す | **A** |
| 各ステップの状態（done/current/todo） | 新規保存は不要。各コースの実進捗（0%/100%/その間）から導出可能 | **A** |
| ロードマップの一覧取得 | `GET /api/webcoach/roadmaps`は実装済みだが**中身がTODOスタブで常に空配列** | **A**（一覧が無くても、ユーザーに紐づくロードマップIDが1つ分かれば詳細APIで代替可能） |
| ユーザーとロードマップの紐付け | 未設計。1人1ロードマップ固定か、選択制か、コースカテゴリから自動判定か | **A〜B**（方針決定が先） |
| シードデータ | ロードマップ・ステップのテーブルスキーマは実在するが、実際にデータが投入されているか未確認 | **A** |

**次アクション**: この項目は「新規テーブル設計」までは不要で、**既存の仕組みを繋ぐだけで実現できる可能性が高い**。まず①ロードマップのシードデータが実際にDBに入っているか、②ユーザー↔ロードマップの紐付け方針、の2点を確認するのが次の一手。

---

## バックエンドチームへのTODOリスト（優先度順）

1. **[S]** `GET /api/webcoach/profile/:userid`・コース進捗・完了数系はフロントの向き先を実APIに変更するだけ（バックエンド作業ゼロ）
2. **[A]** `webcoach_user_course_lastaccess.current_section`をAPIレスポンスに追加
3. **[A]** 日別アクティビティ有無の集計エンドポイントを新規追加（ストリーク用）
4. **[A]** 直近7日/その前7日の完了件数集計エンドポイントを新規追加（統計バーの先週比用）
5. **[A]** ロードマップのシードデータ確認＋ユーザー↔ロードマップ紐付け方針の決定
6. **[B]** 「学習時間」の算出方針（想定時間メタデータ入力 or セッション時間計測）を意思決定
7. **[B]** コーチング（次回セッション・目標）のテーブル設計＋コーチ側入力手段の設計
8. **[B]** ギルドロビー・在室メンバーのプレゼンス基盤（優先度は最も低くてよい）

## 参照した実装
- モック定義: `frontend/src/mocks/handlers.ts`
- 実フィールド/モック専用フィールドの区別: `frontend/src/types/api.ts`（`Profile`, `ResumeCourse`）
- どのメソッドが実ルートを叩き、どれが未実装ルートを叩いているか: `frontend/src/services/bffClient.ts`
- マイページの各コンポーネント/hooks: `frontend/src/components/mypage/*.tsx`, `frontend/src/hooks/use*.ts`
