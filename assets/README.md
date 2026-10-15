# assets

教材とサムネイルの原本を保管するフォルダ。アプリのビルド・配信には含まれない。

```
assets/
├── materials/    教材の原本（コースごとにフォルダを切る: materials/<コースslug>/）
└── thumbnails/   コースサムネイルの原本（ファイル名はコースslug: thumbnails/<コースslug>.png）
```

- コースslug は `frontend/src/constants/courseTaxonomy.ts` のもの。
- アプリで表示するには、配信用に書き出したものを別途配置する。
  - 教材: `frontend/public/materials/<コースslug>/`
  - サムネ: `frontend/public/images/courses/` に置き、`frontend/src/mocks/courseThumbnails.ts` に登録

## 現在の中身

- `materials/<領域バケツ>/` … Clipkit(learn.webcoach.jp)からの取得結果（2026-09-17取得）。
  `manifest.json`（ページ一覧）・`html/`（スクリプト除去済み）・`raw/`（取得したままのHTML）。
  `html/` はdevプレビューのCloudFrontでも配信している（URL一覧と手順は `admin-csv/lesson_html_urls.csv`・`admin-csv/README.md`）。
  バケツ名（web-design・coding・sns 等）はコースslugではなく**学習領域サイズ**なので、
  アプリへ載せるときはコース単位に割り直す（`frontend/src/mocks/migratedMaterials.ts` の注意参照）。
  `html/` が参照する `../../_assets/` は未取得。
- `materials/canva/` … Clipkit の新しい Canva 教材（`/web-design/canva/chap-0〜3/`、18件、2026-10-14 取得）。
  Canva コースはこれを使う。`web-design/` の旧 Canva 3件（7woh9・dhtba・qpnfo）は UAT の Moodle で非表示にした（削除はしていない）。
  `html/` が参照する `../../_assets/` の画像は UAT の S3 にだけある（dev プレビューのバケットには未配置）。
- `materials/_clipkit/` … `html/` が参照していた Clipkit(cdn.clipkit.co) の画像（約3,400枚・464MB、git管理外）。
  `html/` のリンクは相対パス `../../_clipkit/<cdn.clipkit.co以降のパス>` に書き換え済みで、
  実体は S3 の `materials/_clipkit/`。`scripts/materials/localize_clipkit_images.py` で再取得・書き換え・アップロードできる
  （UAT・本番はS3上のHTMLがローカルと違うので `--pull` を付ける。`admin-csv/README.md` 参照）。
- `materials/_assets/lms-embed.js`・`lms-skin.css` … 教材HTMLが読み込む LMS 埋め込み用のJS・CSS。S3 の `materials/_assets/` が配信元で、
  ここはその原本（2026-10-11 に S3 から取り込み）。直したら S3 へ上げて CloudFront を無効化する
  （`--content-type "application/javascript; charset=utf-8"`／`text/css`）。教材HTML側は書き換えない方針。
  `lesson-map.prod.json` は本番用の `lesson-map.json`（旧サイトの記事ID→LMSのレッスンURL）。Moodle のコース・モジュール番号は
  環境ごとに違うので、UAT 用の表を本番に置くと別のレッスンへ飛ぶ（2026-10-11 に本番DBの mod/url から作り直した）。
  S3 へは `materials/_assets/lesson-map.json` の名前で上げる。
- `thumbnails/<コースslug>.png` … 54枚。`instagram.png` は原本名「Instagram広告運用」だが、対応する広告コースが無いため「インスタグラム運用」(instagram)に割り当てた。
