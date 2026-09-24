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
- `thumbnails/<コースslug>.png` … 54枚。`instagram.png` は原本名「Instagram広告運用」だが、対応する広告コースが無いため「インスタグラム運用」(instagram)に割り当てた。
