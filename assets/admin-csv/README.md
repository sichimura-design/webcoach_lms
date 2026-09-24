# admin-csv

管理画面（/admin）のCSV一括登録で、学習領域（Moodleカテゴリ）とコース一式を作るためのCSV。
中身は `frontend/src/constants/courseTaxonomy.ts` から生成した（9領域・56コース）。

## 登録手順

1. **カテゴリ管理** で `01_categories.csv` をアップロード（9領域）
2. 同じ画面の「全件ダウンロード」で `all_categories_*.csv` を取得し、
   `python3 fill_categoryid.py all_categories_*.csv` を実行
   → 領域名からカテゴリIDを引いて `03_moodle_courses_upload.csv` ができる
3. **Moodleコース作成** で `03_moodle_courses_upload.csv` をアップロード（56コース）

## 注意

- カテゴリ名は学習領域名と完全一致させること（フロントは `categoryname` で領域を判定する）。
  コースの `shortname` はコースslug。
- `imageUrl` は dev プレビュー（CloudFront `/branches/dev-kanegae/images/courses/`）の WebP。
  サムネ素材が無い tutorial・google-analytics は空欄。
- アップロード画面のパーサは単純な `split(',')` なので、値にカンマ・改行を入れない。BOM無しで保存する
  （Excelで保存し直すとBOMが付き、先頭列名が壊れる）。
- `area` 列は `fill_categoryid.py` 用。アップロード時は無視される。
- 教材本文（`../materials/`）を登録するCSVは管理画面に無い。
