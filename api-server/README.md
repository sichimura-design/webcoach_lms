# api-server

WebCoach LMS のバックエンド API。FastAPI (Python 3.11) で実装し、Moodle の DB に直接接続して WebCoach 独自テーブル（`webcoach_*`）の読み書きと AI チャットを担当します。フロントエンドからは直接呼ばず、必ず BFF 経由でアクセスします。

## 構成

```
api-server/
├── main.py              # FastAPI アプリ本体・ルーター登録
├── config.py            # 設定読み込み（環境変数 / SSM Parameter Store）
├── database.py          # SQLAlchemy 接続（Moodle DB）
├── crud.py              # DB 操作
├── entities/            # SQLAlchemy エンティティ
├── dto/  mappers/       # レスポンス DTO と変換
├── routers/             # エンドポイント（下表）
├── agents/              # AI エージェント関連
├── tools.py             # LangGraph 用ツール（Dify 動的ツール等）
├── vector_db.py  moodle_to_chromadb.py   # 教材ベクトル検索
├── tests/               # pytest
└── swagger.yaml
```

## 主なルーター（`routers/`）

| ファイル | 内容 |
|---|---|
| `health.py` | ヘルスチェック |
| `courses.py` / `profiles.py` | コースアクセス履歴・プロフィール設定 |
| `webcoach.py` | WebCoach 共通（学習状況・目標など） |
| `ai.py` / `ai_langgraph.py` | AI チャット（LangGraph 版、Dify アプリ連携を含む） |
| `faiss_ingest.py` | 教材の FAISS 取り込み |
| `coaching.py` / `notes.py` / `recordings.py` | コーチング管理・AI コーチングノート・録画メタデータ |
| `integrations.py` | Zoom / Google Meet 連携 |
| `study.py` | 集中ブースの学習セッション記録 |
| `roadmap.py` / `roadmaps.py` | キャリアロードマップ |
| `my_note.py` | マイノート |
| `badges.py` / `tags.py` / `admin.py` | バッジ・タグ・管理機能 |

## セットアップ

```bash
cd api-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `MOODLE_DB_HOST` / `MOODLE_DB_PORT` | `localhost` / `3306` | Moodle DB |
| `MOODLE_DB_USER` / `MOODLE_DB_PASSWORD` / `MOODLE_DB_NAME` | `moodleuser` / なし / `moodle` | 同上 |
| `API_SERVER_HOST` / `API_SERVER_PORT` | `0.0.0.0` / `8001` | 待ち受け |
| `ENV` | `production` | `development` でホットリロード |
| `USE_PARAMETER_STORE` | `false` | `true` で SSM Parameter Store から設定を読む |
| `PARAMETER_STORE_PREFIX` | `/moodle/prod` | 読み込むパラメータのパス |
| `AWS_REGION` | `ap-northeast-1` | |

Dify アプリの API キーは DB（`webcoach_ai_application.secret_key` にキー名）と Secrets Manager（実キー）に分けて管理しています。

## 起動

```bash
ENV=development python main.py          # http://localhost:8001 （ホットリロード）
```

Docker では `start-with-parameter-store.sh` 経由で起動します（ポート 8001）。

```bash
docker build -t api-server .
docker run -p 8001:8001 --env-file .env api-server
```

API ドキュメントは起動後 `http://localhost:8001/docs` で確認できます。

## テスト

```bash
pytest
```

## 注意

- 新しいテーブル・カラムを追加する場合は、実装前にチームへ相談してください（dev/uat は RDS を共用しています）。
- Dify 会話キャッシュと非同期ジョブストアはプロセス内の辞書です。ワーカー数を増やす・複数台構成にする場合は Redis などへの移行が必要です。
