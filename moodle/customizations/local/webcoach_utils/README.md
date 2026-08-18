# WebCoach Utils - Moodle Local Plugin

**Moodle local plugin for WebCoach system utilities**

このプラグインは、WebCoachシステムで使用するMoodleのユーティリティ機能を提供します。

## 概要 / Overview

WebCoach Utils は、Moodle の local プラグインとして実装されたユーティリティプラグインです。
外部サービス（Web Services）を通じて、コースタグの管理やユーザー情報の更新などの機能を提供します。

This is a Moodle local plugin that provides utility functions for the WebCoach system.
It exposes external web service functions for managing course tags and user information.

## プラグインタイプ / Plugin Type

- **Type**: Local Plugin (local)
- **Component**: `local_webcoach_utils`
- **Version**: 1.0.0
- **Requires**: Moodle 3.11+

## 主な機能 / Features

### 1. コースタグ管理 / Course Tag Management

- **set_course_tags**: コースにタグを設定
- **get_course_tags**: コースのタグを取得

### 2. ユーザー管理 / User Management

- **update_user_lastaccess**: ユーザーの最終アクセス時刻を更新

### 3. 学習セッション記録 / Study Session Logging（集中ブース）

- **start_study_session**: 集中ブース学習開始を`mdl_logstore_standard_log`に記録（`local_webcoach_utils\event\study_session_started`）
- **end_study_session**: 集中ブース学習終了を`mdl_logstore_standard_log`に記録（`local_webcoach_utils\event\study_session_ended`）
- **log_course_study_started**: コース学習開始を1ユーザー×1コース×1日1件だけ記録（`local_webcoach_utils\event\course_study_started`）

実測時間・一時停止等の実データはapi-server側の`webcoach_study_activity`テーブルが正であり、
ここで記録するイベントは開始/終了の監査ログ（mod_quizが自前のattemptテーブルとイベントログの
両方を持つのと同じ構成）。`\core\event\user_loggedin`は既存の日次ログイン記録専用のままとし、
学習開始・終了とは意味的に混在させない。

## ディレクトリ構成 / Directory Structure

```
local/webcoach_utils/
├── version.php          # プラグインバージョン情報
├── externallib.php      # 外部サービス関数の実装
├── db/
│   └── services.php     # Web サービス定義
└── README.md           # このファイル
```

## インストール / Installation

1. このディレクトリを Moodle の `local/webcoach_utils/` に配置
2. Moodle の管理画面にアクセスし、プラグインをインストール
3. 必要に応じて Web サービスを有効化

```bash
# Moodleのルートディレクトリから
cp -r moodle/customizations/local/webcoach_utils moodle/local/
```

## Web サービスの使用 / Using Web Services

### サービス名 / Service Name
`WebCoach Utilities Service`

### 提供する関数 / Available Functions

1. `local_webcoach_utils_set_course_tags`
   - パラメータ: courseid (int), tags (array)
   - 権限: moodle/course:update

2. `local_webcoach_utils_get_course_tags`
   - パラメータ: courseid (int)
   - 権限: なし

3. `local_webcoach_utils_update_user_lastaccess`
   - パラメータ: userid (int)
   - 権限: なし

4. `local_webcoach_utils_start_study_session`
   - パラメータ: userid (int), sessionid (int), courseid (int, optional)
   - 権限: なし

5. `local_webcoach_utils_end_study_session`
   - パラメータ: userid (int), sessionid (int), durationminutes (int), courseid (int, optional)
   - 権限: なし

6. `local_webcoach_utils_log_course_study_started`
   - パラメータ: userid (int), courseid (int)
   - 権限: なし

## ライセンス / License

This plugin is part of the WebCoach system.

## 作成者 / Author

WebCoach Development Team

## バージョン履歴 / Version History

- **1.0.0** (2026-06-21): 初回リリース
  - コースタグ管理機能
  - ユーザー最終アクセス更新機能
- **1.1.0** (2026-08-16): 集中ブース学習セッション記録機能を追加
  - `study_session_started` / `study_session_ended` / `course_study_started` イベントを追加
