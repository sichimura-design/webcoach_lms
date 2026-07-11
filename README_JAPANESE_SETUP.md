# Moodle 日本語設定 - クイックスタートガイド

本ガイドでは、Moodle Docker環境で日本語設定を適用する最も簡単な方法を説明します。

## 📋 概要

このプロジェクトには、Moodleの日本語設定を自動化するための以下のツールが含まれています：

- ✅ 新規構築時の自動日本語設定
- ✅ 既存環境への日本語設定適用
- ✅ 本番運用を考慮した設定管理

---

## 🚀 新規構築の場合

### ステップ1: 環境変数の確認

`.env`ファイルに以下の設定が含まれていることを確認：

```bash
# デフォルト言語を日本語に設定
MOODLE_LANG=ja
```

### ステップ2: コンテナの起動

```bash
# コンテナを起動
sudo docker-compose up -d

# ログを確認（起動完了まで2-3分）
sudo docker-compose logs -f moodle
```

### ステップ3: 日本語設定の適用

```bash
# 日本語設定を適用（adminユーザーの言語設定）
./apply-japanese-lang.sh
```

**これで完了です！** https://52.194.117.196/ にアクセスして日本語表示を確認してください。

---

## 🔧 既存環境への適用

既に稼働中のMoodleシステムに日本語設定を適用する場合：

```bash
# 日本語設定を適用
./apply-japanese-lang.sh
```

このスクリプトは以下を自動的に実行します：
- ✅ adminユーザーの言語を日本語に設定
- ✅ システムのデフォルト言語を日本語に設定
- ✅ 既存データを保持したまま設定を変更

---

## 📝 設定ファイルの説明

### 1. docker-compose.yml

```yaml
services:
  moodle:
    environment:
      MOODLE_LANG: ${MOODLE_LANG:-ja}  # 初期インストール時の言語
```

### 2. .env

```bash
# デフォルト言語（ja=日本語, en=英語）
MOODLE_LANG=ja
```

### 3. スクリプト

- `apply-japanese-lang.sh` - 日本語設定を適用（既存環境で使用）
- `scripts/init-japanese-lang.sh` - 内部的に使用される初期化スクリプト

---

## 🔍 動作確認

### 言語設定の確認

```bash
# adminユーザーの言語を確認
sudo docker exec moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle \
  -e "SELECT username, lang FROM mdl_user WHERE username='admin';"

# システムのデフォルト言語を確認
sudo docker exec moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle \
  -e "SELECT name, value FROM mdl_config WHERE name='lang';"
```

期待される出力：
```
username  lang
admin     ja

name  value
lang  ja
```

---

## 🐛 トラブルシューティング

### 問題1: ログイン後も英語のまま

**解決策:**
```bash
# 日本語設定を再適用
./apply-japanese-lang.sh

# ブラウザのキャッシュをクリアして再ログイン
```

### 問題2: 一部のユーザーが英語のまま

**解決策:**
```bash
# 全ユーザーの言語を日本語に設定
sudo docker exec moodle-mysql mysql -u moodleuser -pmoodlepass123 bitnami_moodle \
  -e "UPDATE mdl_user SET lang='ja' WHERE deleted=0;"
```

### 問題3: 日本語言語パックが見つからない

**解決策:**
1. Moodle管理画面にログイン
2. `サイト管理` → `言語` → `言語パック`
3. `日本語(ja)`をインストール

---

## 📚 詳細ドキュメント

より詳しい情報は以下のドキュメントを参照してください：

- [完全な日本語設定ガイド](docs/JAPANESE_LANGUAGE_SETUP.md)
  - カスタムDockerイメージの作成
  - 高度な設定オプション
  - 本番運用のベストプラクティス

---

## 🎯 よくある質問

### Q: 既存のデータは消えますか？

A: いいえ、`apply-japanese-lang.sh`は既存のデータを保持したまま言語設定のみを変更します。

### Q: 他の言語に変更できますか？

A: はい。`.env`ファイルの`MOODLE_LANG`を変更してください：
```bash
MOODLE_LANG=en  # 英語
MOODLE_LANG=es  # スペイン語
MOODLE_LANG=fr  # フランス語
```

### Q: 新規ユーザーのデフォルト言語は？

A: システムのデフォルト言語（日本語）が適用されます。ユーザーは個別に変更可能です。

---

## 📞 サポート

問題が発生した場合：

1. ログを確認: `sudo docker-compose logs moodle`
2. コンテナの状態を確認: `sudo docker ps`
3. データベース接続を確認: `sudo docker exec moodle-mysql mysqladmin ping`

---

**最終更新:** 2025年12月28日
