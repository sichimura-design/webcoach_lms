# モック開発ガイド（フロント機能を実BFF無しで作る）

WEBCOACH LMS のフロントに新機能を追加するための手順。**バックエンド（BFF / FastAPI）は変更できない**ため、機能に必要な新しい API は**すべてフロント側のモック（MSW）で用意する**。

## 仕組みの全体像

- モックは `REACT_APP_ENABLE_MOCKS=true` のときだけ有効。
  - **ローカル（`npm start`）**: `frontend/.env.development` で既定 ON → 実 Cognito / 実 BFF 無しで完全オフライン起動。擬似ユーザーで自動ログインされ、`/mypage` に入れる。
  - **dev/XX プレビュー**: `.github/workflows/dev-preview.yml` の build で ON → プレビューURLでも新機能がモックで動く。
  - **本番（master）**: フラグ未設定 = OFF。挙動は従来どおり、モックコードは読み込まれない。
- 実装は `MOCKS_ENABLED`（`frontend/src/mocks/config.ts`）で分岐。
- 認証も `frontend/src/mocks/mockAuth.ts` の擬似セッションでモック（admin + coach 権限）。
- MSW は `onUnhandledRequest: 'bypass'` なので、**モックしていない API は素通し**（ローカルでは実BFFが無いのでエラーになるだけ・画面は落ちない）。

## 新機能を追加する手順

1. **API クライアントにメソッドを足す** — `frontend/src/services/bffClient.ts`
   ```ts
   async getAnnouncements(): Promise<Announcement[]> {
     const response = await this.api.get('/webcoach/announcements');
     return response.data;
   }
   ```
2. **モックハンドラを1つ足す** — `frontend/src/mocks/handlers.ts`
   ```ts
   http.get('*/api/webcoach/announcements', () =>
     HttpResponse.json([{ id: 1, title: '...', body: '...', publishedAt: '2026-07-06T00:00:00Z' }])
   ),
   ```
   - パスは `*​/api/...` のワイルドカードで書く（オリジン・サブパス非依存）。
   - POST / PUT / DELETE は `http.post` / `http.put` / `http.delete`。リクエストボディは `await request.json()`。
3. **画面とルートを作る** — 例: `frontend/src/components/AnnouncementsPage.tsx` + `frontend/src/routes/index.tsx` に `<Route path="/announcements" ...>` を追加。
4. **ローカル確認** — `cd frontend && npm start` → 対象画面を開く。DevTools の Network で該当 `/api/...` が MSW に捕捉され（`[MSW]` ログ）、モックデータが表示されること。
5. **push してプレビュー確認** — `dev/<名前>` ブランチに push → Actions（Dev Preview）成功後、PRコメント/ログのプレビューURL（`/branches/<slug>/`）で確認。

## 実例（このリポジトリに同梱済み）

サンプル機能「お知らせ」が一通り実装済み。写経のベースにする:
- 型: `frontend/src/types/announcement.ts`
- API: `bffClient.getAnnouncements()`
- モック: `handlers.ts` の `*/api/webcoach/announcements`
- 画面: `frontend/src/components/AnnouncementsPage.tsx`（ルート `/announcements`）

## 注意

- **`master` へは入れない**。作業は必ず `dev/<名前>` ブランチで行う。
- モックした画面が動くのは「モック ON のビルド」だけ。本番に出す場合は別途、実BFF側の実装が必要（このリポジトリの範囲外）。
- 実 BFF に接続して開発したいときは `frontend/.env.development.local`（git管理外）に `REACT_APP_ENABLE_MOCKS=false` と実接続先を書いて上書きする。
