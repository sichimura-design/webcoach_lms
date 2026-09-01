# design-canvas のキャプチャツール

Claude Design のアートボード（`.dc.html`）を**手写しで**作るための材料を、
動いている実装から機械的に吸い出す。手写しの寸法・色を目分量にしないためのもの。

キャプチャ結果そのものをアートボードに貼ることはしない。生成された DOM は入れ子が深く
クラス名も機械的で、canvas エディタ上で要素を掴んで直せなくなるため。

## 使い方

別ターミナルで開発サーバを上げる（既定でモック ON・オフライン）:

```
cd frontend
npm start
```

`http://localhost:3000` が開いたら、もう一方で:

```
cd frontend/design-canvas/tools
node capture.cjs              # 全画面
node capture.cjs STU-01 STU-03  # 画面IDを指定して一部だけ
```

サーバが別ポートのときは `CAPTURE_BASE_URL=http://localhost:3001 node capture.cjs`。

## 出力

`frontend/design-canvas/_capture/<画面ID>/`（git 管理外）に画面ごと・幅ごとで:

| ファイル | 中身 | 手写しでの使いどころ |
|---|---|---|
| `1440.png` | フルページのスクリーンショット | 完成したアートボードと並べて見比べる |
| `1440.html` | `#root` の outerHTML | 構造の確認。DOM の入れ子を追いたいとき |
| `1440.styles.json` | 見えている要素の computed style と矩形 | **カード幅・font-size・padding・box-shadow の実値**（px / rgb に解決済み）をここから拾う。写経の一次資料 |
| `1440.tokens.json` | カスタムプロパティの宣言一覧と、どの selector が定義しているか | どのトークンがどこで定義されているかの地図 |

`--dc-*` は `:root` ではなく `.mypage-3d` のようなスコープクラスに置かれている。
また custom property は `clamp(...)` のまま返るので、**clamp の解決後の実値は `tokens.json` ではなく
`styles.json` 側**（`fontSize: "16px"`、`padding: "26px 28px"` のような形）を見る。

`_capture/report.json` に画面ごとの成否・最終 URL・見出しが残る。
`finalPath` が指定ルートとずれていたら、ログイン弾きやリダイレクトを疑う。

`styles.json` は**文字を直接持つ要素**と**箱として見えている要素**（背景・枠線・影・背景画像のいずれかがある）
だけに絞ってある。レイアウト用の透明な div は写経に要らないので落としている。

## 前提

- Playwright は frontend の依存ではなく、`tools/clipkit-export/node_modules` のものを借りている。
  Chromium も導入済みなので、このツールのために `npm install` は要らない。
- ログインは `localStorage['webcoach-mock-logged-in'] = '1'` を仕込むだけ
  （`src/mocks/mockAuth.ts`）。ログイン画面を経由しない。
- `/connect/:token` だけは特別扱い。招待トークンは MSW のページ内メモリに発行されるので、
  同じページで発行 → `history.pushState` による画面内遷移で開く（`goto` するとストアが消える）。

## 既知の壊れている画面

- **STU-14 `/badges`**: モック環境では必ず ErrorBoundary（「予期しないエラーが発生しました /
  REACT_APP_BFF_URL is not configured」）になる。`BadgesPage.tsx:21-32` が `bffClient` を通さず
  `process.env.REACT_APP_BFF_URL` を直接読んでいて、モックでは未設定なので throw する。
  リクエストが MSW に届かないため、キャプチャからは本来の見た目を取れない。
  アートボードを作るなら `BadgesPage.tsx` を読んで起こすしかない。

## つまずきどころ

- **開発サーバのコンパイル／実行時エラーのオーバーレイ**が画面全体を覆う。撮る前に検出して
  最大 3 回やり直し、それでも残ったら消したうえで `compileOverlay: true` を結果に残す。
  ログに出たら、そのキャプチャは信用せず開発サーバを直してから撮り直す。
- **`useScaleToFit` を使う画面は幅に注意**。`/courses`（`MaterialsTopPage.tsx:25,57`）だけが
  1440px 固定キャンバスを `transform: scale` で縮めて収める作りになっている。1440 ビューポートで撮ると
  サイドバー 72px ぶん足りず `scale 0.95` がかかり、`styles.json` の px が全部 0.95 倍になって
  写経の値に使えない（しかも縮尺が決まるまで数秒かかり、待たずに撮ると右端が切れた絵になる）。
  そのため 1520px で撮っている。他の 2 画面（MyPage / StudyLogPage）はこのフックを**使わない**と
  ソースにコメントで明記されているので 1440 のままでよい。
- **MSW の起動待ち**。`networkidle` は `worker.start()` の完了より先に来る。待たずに fetch すると
  ハンドラを素通りして 404 になる（`/connect` のトークン発行がこれで落ちていた）。
  `navigator.serviceWorker.controller` を待ったうえで、さらに数秒置いている。

## 画面を足すとき

`capture.cjs` の `SCREENS` に 1 行足す。`id` は
`frontend/docs/ui-review/screen-inventory.csv` の画面ID に合わせる。
非同期の描画が重い画面は `settle` を伸ばし、SP も撮るなら `sp: true` を付ける。
