# WEBCOACH LMS — Claude 作業ルール

このリポジトリで Claude が作業するときの必須ルール。

## 大前提
- **バックエンドは変更禁止**。`api-server/`（FastAPI）と `bff-server/`（Node/Express）、`swagger.yaml`、`cdk/` などバックエンド・インフラのファイルは編集しない。
- 作業対象は **`frontend/`（React SPA）のみ**。

## 新機能に API が必要なとき
実BFFに無い API は**必ずフロント側のモック（MSW）で作る**。実装手順の詳細は [`frontend/docs/mock-development.md`](frontend/docs/mock-development.md)。要点:
1. `frontend/src/services/bffClient.ts` に API メソッドを追加。
2. `frontend/src/mocks/handlers.ts` に対応するモックハンドラを追加（パスは `*/api/...`）。
3. 画面・ルートを作る。
4. `cd frontend && npm start`（既定でモック ON・オフライン）で確認。

サンプル実装「お知らせ」（`/announcements`）が写経のベースとして同梱済み。

## ブランチ運用
- 作業は必ず **`dev/<名前>` ブランチ**で行い、push する（例: `dev/feature-xxx`）。
- `dev/**` への push で GitHub Actions（Dev Preview）が発火し、`/branches/<slug>/` にプレビュー配信される。プレビューでもモックが有効。
- **`master` には直接コミット・マージしない**（本番。モックはOFF）。

## モードの仕組み
- すべて `REACT_APP_ENABLE_MOCKS` フラグで制御（`frontend/src/mocks/config.ts` の `MOCKS_ENABLED`）。
  - ローカル: `frontend/.env.development` で既定 `true`。
  - プレビュー: `.github/workflows/dev-preview.yml` で `true`。
  - 本番(master): 未設定 = OFF（挙動は従来どおり、モックコードは読み込まれない）。
- モック時は認証も擬似化（`frontend/src/mocks/mockAuth.ts`、admin + coach）。
