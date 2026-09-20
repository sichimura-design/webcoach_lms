# AIアプリのサムネイル画像

AIコーチのアプリ一覧（`/ai-coach`）のカードとアプリ詳細ページのヘッダーに出る絵。

## 入れ方

1. 画像をこのディレクトリに置く。**ファイル名はアプリのID**
   （`src/types/aiSkill.ts` の `AI_SKILL_META` のキー。例: `design-review.png`）。
2. `src/types/aiSkill.ts` の該当エントリに1行足す。

   ```ts
   'design-review': {
     label: '制作物を添削する',
     thumbnail: 'images/ai-apps/design-review.png',
     ...
   },
   ```

描画側（`components/aicoach/AiCoachHome.tsx` / `AiAppDetailPage.tsx`）は既に
`thumbnail ? <img> : <アイコン>` になっているので、**コードの変更は不要**。
未登録のアプリは lucide アイコンのままなので、1枚ずつ足していける。

## 注意

- 🔴 **先頭にスラッシュを付けない。** 参照側が `${process.env.PUBLIC_URL}/` を
  前置する。`/images/...` と書くと dev プレビュー（`/branches/<slug>/` の
  サブパス配信）で 404 になる。
- 枠は **16:9**（`.ai-home-app-thumb`、`objectFit: cover`）。
- 同じIDを `public/content/ai-apps/<id>.md`（アプリの説明本文）も使っている。
