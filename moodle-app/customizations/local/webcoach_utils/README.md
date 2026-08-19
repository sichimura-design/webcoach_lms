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

- **start_study_session**: 集中ブース学習の開始/再開を`mdl_logstore_standard_log`に記録（`local_webcoach_utils\event\study_session_started`）
- **end_study_session**: 集中ブース学習の一時停止/終了を`mdl_logstore_standard_log`に記録（`local_webcoach_utils\event\study_session_ended`）
- **correct_study_session**: 直前に終了した区間の学習時間をユーザーが手動で補正した場合のみ記録（`local_webcoach_utils\event\study_session_corrected`、`other.deltaminutes`）

`mdl_logstore_standard_log`そのものが学習時間の正データ。自前テーブルは持たない。
`study_session_started`/`study_session_ended`のtimecreated差分（区間ごとの合算。一時停止のたびに
end、再開のたびにstartを発火するため、一時停止時間は合算から自然に除外される）で学習時間を算出する。
`correct_study_session`は低頻度（ユーザーが実際に時間を修正した場合のみ）なので、この関数に限り
`other`のJSONパースを集計時に許容する。`\core\event\user_loggedin`は既存の日次ログイン記録専用の
ままとし、学習開始・終了とは意味的に混在させない。

コースごとのアクセス記録・教材（page/url/resource）ごとの閲覧記録は、このプラグインではなく
Moodle標準のwebservice（`mod_page_view_page`/`mod_resource_view_resource`/`mod_url_view_url`。
`course_module_viewed`イベントとcompletion判定を標準機能として発火する）をアプリのwebservice
トークンが属する外部サービス（デフォルトでは`moodle_mobile_app`）に追加登録して利用する。
プラグイン開発は不要（旧`log_course_study_started`は廃止）。

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
   - パラメータ: userid (int), courseid (int, optional)
   - 権限: なし

5. `local_webcoach_utils_end_study_session`
   - パラメータ: userid (int), courseid (int, optional)
   - 権限: なし

6. `local_webcoach_utils_correct_study_session`
   - パラメータ: userid (int), deltaminutes (int), courseid (int, optional)
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
- **1.2.0** (2026-08-19): 学習時間の正データを自前テーブルからMoodleログのみに変更
  - `study_session_started`/`study_session_ended`から`other`(sessionid/durationminutes)を撤去し、timecreated差分で時間を算出する方式に変更
  - `course_study_started`を廃止（教材アクセスはMoodle標準の`mod_*_view_*` webserviceで代替）
  - `study_session_corrected`イベントを追加（学習時間の手動補正、低頻度）
