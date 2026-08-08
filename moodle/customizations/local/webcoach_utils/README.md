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

## ライセンス / License

This plugin is part of the WebCoach system.

## 作成者 / Author

WebCoach Development Team

## バージョン履歴 / Version History

- **1.0.0** (2026-06-21): 初回リリース
  - コースタグ管理機能
  - ユーザー最終アクセス更新機能
