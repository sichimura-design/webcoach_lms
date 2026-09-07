# コースのサムネイル画像

コース名の左（マイページの「続きから学習」／学習トップの「前回学習したもの」／
「ほかに学習中」の行）とコース一覧タイル、それに**教材ページのヘッダーのカバー**に出る絵。

## 入れ方

1. 画像をこのディレクトリに置く。**ファイル名はコースの slug**
   （`src/constants/courseTaxonomy.ts` の `slug`。例: `design-basics.png`）。
2. `src/mocks/courseThumbnails.ts` の `COURSE_THUMBNAILS` に1行足す。

   ```ts
   export const COURSE_THUMBNAILS: Record<string, string> = {
     'design-basics': 'design-basics.png',
   };
   ```

これだけで マイページ／学習トップのヒーロー／「ほかに学習中」の行／コース一覧タイル／
教材ページのヘッダーの全部に反映される。**未登録のコースは領域ごとの図形／文字組みサムネ
のまま**（教材ヘッダーは淡いグラデ）なので、1枚ずつ足していける。

表が `courseCatalog.ts` ではなく専用ファイルに居るのは、教材API（`mocks/lessonHandlers.ts`）
からも同じ表を引く必要があり、`courseCatalog.ts` を import すると循環するため。

## 注意

- 🔴 **コースIDをキーにしないこと。** IDは `領域code*100+連番` で採番されるので、
  領域内の並びを1つ変えると全部ずれる。slug は動かない。
- 参照は `${process.env.PUBLIC_URL}/images/courses/<file>` として組まれる
  （`courseCatalog.ts`）。dev プレビューは `/branches/<slug>/` のサブパス配信なので、
  自分でパスを書くときも先頭 `/` から書かない。
- 推奨比率は **5:3〜16:9**。枠は `objectFit: cover` なので中心が切られる。
  40px の行サムネにも同じ画像が入る（正方形に切られる）ので、主題は中央に置く。
- 本番（実BFF）はここではなく Moodle の `courseimage` を使う。ここは
  モック（`REACT_APP_ENABLE_MOCKS`）専用。
