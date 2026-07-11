# Moodleサービス (moodle_mobile_app) の機能と制限

## 概要
BFF用に作成したMoodle外部サービス「moodle_mobile_app」の機能説明書

## ✅ このサービスでできること

### 1. 認証・ユーザー情報
- ✅ サイト情報の取得 (`core_webservice_get_site_info`)
- ✅ ユーザー情報の取得 (`core_user_get_users`, `core_user_get_users_by_field`)
- ✅ ユーザー情報の更新 (`core_user_update_users`)

**BFFでの使用例:**
- `/api/user/info` - ログインユーザーの情報取得
- `/api/login` - ユーザー認証時のユーザー情報取得

### 2. コース管理
- ✅ 全コース一覧の取得 (`core_course_get_courses`)
- ✅ フィールド条件でコース検索 (`core_course_get_courses_by_field`)
- ✅ キーワードでコース検索 (`core_course_search_courses`)
- ✅ カテゴリ一覧の取得 (`core_course_get_categories`)
- ✅ コース内容の取得 (`core_course_get_contents`)
- ✅ ユーザーの登録コース取得 (`core_course_get_enrolled_courses_by_timeline_classification`)
- ✅ コース登録ユーザー一覧 (`core_enrol_get_enrolled_users`)
- ✅ ユーザーのコース一覧 (`core_enrol_get_users_courses`)
- ✅ アクティビティの作成 (`core_course_create_activities`) ⚠️ teacher/manager権限必要

**BFFでの使用例:**
- `/api/moodle/courses` - 全コース取得
- `/api/moodle/courses/:userid` - ユーザーの登録コース
- `/api/moodle/courses/search?q=キーワード` - コース検索
- `/api/moodle/getcoursebyfield?field=category&value=1` - カテゴリでコース検索
- `/api/moodle/categories` - カテゴリ一覧
- `/api/moodle/courses/:courseid/contents` - コース内容
- `/api/moodle/courses/:courseid/activities` - アクティビティ作成

### 3. モジュール/コンテンツ
- ✅ フォーラム情報取得 (`mod_forum_get_forums_by_courses`)
- ✅ フォーラムディスカッション取得 (`mod_forum_get_forum_discussions`)
- ✅ 課題一覧取得 (`mod_assign_get_assignments`)
- ✅ クイズ一覧取得 (`mod_quiz_get_quizzes_by_courses`)
- ✅ カレンダーイベント取得 (`core_calendar_get_calendar_events`)

**WebCoach API連携:** API Serverがこれらのデータを使用してAI推奨を生成

### 4. ファイル管理
- ✅ ファイル情報の取得 (`core_files_get_files`)
- ✅ ファイルのアップロード (`core_files_upload`)

**BFFでの使用例:**
- `/api/moodle/files/upload` - ファイルアップロード

### 5. 成績管理
- ✅ 成績の取得 (`core_grades_get_grades`)
- ✅ ユーザー成績アイテム取得 (`gradereport_user_get_grade_items`)

**WebCoach API連携:** 学習進捗分析に使用

### 6. メッセージング
- ✅ メッセージの取得 (`core_message_get_messages`)
- ✅ メッセージの送信 (`core_message_send_instant_messages`)

### 7. バッジ
- ✅ バッジ一覧の取得 (`core_badges_get_badges`)
- ✅ ユーザー獲得バッジ取得 (`core_badges_get_user_badges`)

**BFFでの使用例:**
- `/api/moodle/badges` - バッジ一覧
- `/api/moodle/user-badges/:userid` - ユーザーバッジ

**WebCoach API連携:** バッジ推奨機能に使用

---

## ❌ このサービスでできないこと

### 1. 管理機能
- ❌ ユーザーの作成・削除
- ❌ コースの作成・削除・編集
- ❌ カテゴリの作成・編集・削除
- ❌ ロール・権限の管理
- ❌ プラグインの管理
- ❌ サイト設定の変更

**理由:** 管理機能は管理者のみがWebUIから実行すべきセキュリティ上の制限

### 2. エンロールメント管理
- ❌ ユーザーのコース登録
- ❌ ユーザーのコース登録解除
- ❌ エンロールメントメソッドの管理

**理由:** これらは `enrol_manual_enrol_users` など別の関数が必要（現在未登録）

### 3. 成績編集
- ❌ 成績の作成・更新・削除
- ❌ 評価基準の設定

**理由:** `core_grades_update_grades` など編集系関数は未登録

### 4. 高度なコンテンツ編集
- ❌ セクションの追加・削除・移動
- ❌ モジュール設定の詳細編集
- ❌ コースフォーマットの変更

**理由:** これらには複数の専門的な関数が必要

### 5. システム管理
- ❌ バックアップ・リストア
- ❌ テーマ変更
- ❌ システムログの取得

---

## ⚠️ 現状のBFF実装に対する十分性

### ✅ 十分な権限がある機能
現在のBFF実装 (`/home/ec2-user/moodle-docker/bff-server/index.js`) で使用されている全てのMoodle API関数は、このサービスでカバーされています。

**対応済みの全22関数:**
1. core_webservice_get_site_info
2. core_user_get_users_by_field
3. core_user_get_users
4. core_user_update_users
5. core_course_get_courses
6. core_course_get_courses_by_field
7. core_course_get_contents
8. core_course_get_categories
9. core_course_search_courses
10. core_course_create_activities
11. core_course_get_enrolled_courses_by_timeline_classification
12. core_enrol_get_enrolled_users
13. core_enrol_get_users_courses
14. mod_forum_get_forums_by_courses
15. mod_forum_get_forum_discussions
16. mod_assign_get_assignments
17. mod_quiz_get_quizzes_by_courses
18. core_calendar_get_calendar_events
19. core_files_get_files
20. core_files_upload
21. core_grades_get_grades
22. gradereport_user_get_grade_items
23. core_message_get_messages
24. core_message_send_instant_messages
25. core_badges_get_badges
26. core_badges_get_user_badges

### ⚠️ 注意が必要な設定

#### 1. サービスアカウントの権限
**問題:** `core_course_create_activities` を使用するには、サービスアカウントに **teacher** または **manager** ロールが必要です。

**確認方法:**
```sql
-- サービスアカウントのロールを確認
SELECT u.username, r.shortname as role
FROM mdl_user u
JOIN mdl_role_assignments ra ON u.id = ra.userid
JOIN mdl_role r ON ra.roleid = r.id
WHERE u.username = 'あなたのサービスアカウント名';
```

**対処:** サービスアカウントに適切なロールが付与されていない場合、アクティビティ作成は失敗します。

#### 2. restrictedusers設定
**現状:** `restrictedusers = 0`（すべての認証済みユーザーが使用可能）

**推奨:** セキュリティ上、サービスアカウント専用に制限することを推奨
```sql
UPDATE mdl_external_services
SET restrictedusers = 1
WHERE name = 'moodle_mobile_app';

-- サービスアカウントを許可リストに追加
INSERT INTO mdl_external_services_users (externalserviceid, userid)
SELECT s.id, u.id
FROM mdl_external_services s, mdl_user u
WHERE s.name = 'moodle_mobile_app'
AND u.username = 'あなたのサービスアカウント名';
```

#### 3. ファイルアップロードのcontext
**現状:** BFFでは固定値 `contextid = 1` を使用 (index.js:542)

**問題:** システムコンテキストで固定されているため、コース固有のファイルアップロードができない

**改善案:** コースIDから動的にcontextidを取得する実装が必要

---

## 📝 サービス作成SQLの実行コマンド

```bash
sudo docker exec -i moodle-mysql mysql -u moodleuser -pmoodlepass123 moodle < /home/ec2-user/moodle-docker/bff-server/init-service-db.sql
```

---

## 🔍 サービス確認コマンド

### サービスの存在確認
```bash
sudo docker exec -i moodle-mysql mysql -u moodleuser -pmoodlepass123 -e "
USE moodle;
SELECT id, name, enabled, restrictedusers, downloadfiles, uploadfiles
FROM mdl_external_services
WHERE name = 'moodle_mobile_app';
"
```

### 登録関数の一覧表示
```bash
sudo docker exec -i moodle-mysql mysql -u moodleuser -pmoodlepass123 -e "
USE moodle;
SELECT sf.functionname
FROM mdl_external_services s
JOIN mdl_external_services_functions sf ON s.id = sf.externalserviceid
WHERE s.name = 'moodle_mobile_app'
ORDER BY sf.functionname;
"
```

### 関数数のカウント
```bash
sudo docker exec -i moodle-mysql mysql -u moodleuser -pmoodlepass123 -e "
USE moodle;
SELECT COUNT(*) as function_count
FROM mdl_external_services s
JOIN mdl_external_services_functions sf ON s.id = sf.externalserviceid
WHERE s.name = 'moodle_mobile_app';
"
```

---

## まとめ

### ✅ 十分性の結論
**現在のBFF実装に対して、このサービスは十分な権限を持っています。**

すべてのBFFエンドポイントが正常に動作するために必要なMoodle API関数がサービスに登録されています。

### ⚠️ 次のステップ
1. SQLを実行してサービスを作成
2. サービスアカウントに適切なロール（teacher/manager）を付与
3. 必要に応じて `restrictedusers` を有効化してセキュリティを強化
4. ファイルアップロード機能の contextid 設定を改善（オプション）
