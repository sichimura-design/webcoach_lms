# frontend

WebCoach LMS の SPA。React 18 + TypeScript（Create React App / `react-scripts`）で実装し、Tailwind CSS と MUI を併用しています。API 呼び出しはすべて BFF 経由です。

## 構成

```
frontend/src/
├── App.tsx / index.tsx
├── routes/index.tsx   # ルーティング定義
├── components/        # 画面・部品（mypage, coaching, aicoach, learning, studyLog, focus, notes ...）
├── services/          # bffClient.ts, api.ts, cognitoAuth.ts, mypageApi.ts
├── store/             # zustand ストア
├── hooks/ contexts/ utils/ types/ constants/
├── theme/             # デザイントークン（webcoachTheme.ts ほか）
├── mocks/             # MSW モック（REACT_APP_ENABLE_MOCKS=true のとき有効）
└── setupProxy.js      # 開発サーバーのプロキシ設定
```

`public/content/ai-apps/*.md` は AI アプリ詳細ページが実行時に読み込む本文です。削除しないでください。

## セットアップ・起動

```bash
cd frontend
npm install
npm start        # http://localhost:3000
npm run build    # build/ に本番ビルド
npm test
npx tsc --noEmit # 型チェック
```

### 環境変数（`.env`）

| 変数 | 説明 |
|---|---|
| `REACT_APP_BFF_URL` | BFF の URL |
| `REACT_APP_API_SERVER_URL` | api-server の URL（一部の直接呼び出し用） |
| `REACT_APP_MOODLE_URL` | Moodle の URL |
| `REACT_APP_COGNITO_USER_POOL_ID`, `REACT_APP_COGNITO_CLIENT_ID` | Cognito |
| `REACT_APP_ENABLE_MOCKS` | `true` で MSW モックを使う（バックエンドなしで UI 開発） |

## デザインシステム

新規・改修コンポーネントは `src/theme/webcoachTheme.ts`（`color` / `font` / `radius` / `t` を export）を使ってください。Tailwind クラスに hex を直書きしている旧スタイルのコンポーネントは、順次置き換える対象です。フォントは Noto Sans JP です。

## 注意

- モックにはあるが実バックエンドにないフィールドに依存すると、実環境で「0件」「読み込み中のまま」になります。実 BFF のレスポンスで動作を確認してください。
- エラー表示にはシステムの例外メッセージをそのまま出さず、`getUserMessage` ユーティリティを通してください。

## デプロイ

`dev/*` ブランチへの push で GitHub Actions（`.github/workflows/dev-preview.yml`）が `branches/<slug>/` 配下にプレビューをデプロイします。
