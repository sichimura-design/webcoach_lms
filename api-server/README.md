# Moodle SPA API Server

このディレクトリは Moodle SPA プロジェクトの API サーバーです。

## 概要

- FastAPI を使ったバックエンド API
- ユーザーのコースアクセス、プロフィール、WebCoach、AI などの機能を提供

## 必要条件

- Python 3.11 以上
- 依存関係は `requirements.txt` からインストール

## 起動方法

1. api-server に移動
   ```powershell
   cd api-server
   ```
2. 依存関係をインストール
   ```powershell
   pip install -r requirements.txt
   ```
3. サーバーを起動
   ```powershell
   python main.py
   ```

## 環境変数

- `API_SERVER_HOST` - デフォルト `0.0.0.0`
- `API_SERVER_PORT` - デフォルト `8001`
- `ENABLE_DOCS` - `true` で `/docs` と `/redoc` を有効化
