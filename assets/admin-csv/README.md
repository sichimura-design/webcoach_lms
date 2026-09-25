# admin-csv

管理画面（/admin）のCSV一括登録で、学習領域（Moodleカテゴリ）とコース一式を作るためのCSV。
中身は `frontend/src/constants/courseTaxonomy.ts` から生成した（9領域・59コース）。

## 登録手順

1. **カテゴリ管理** で `01_categories.csv` をアップロード（9領域）
2. 同じ画面の「全件ダウンロード」で `all_categories_*.csv` を取得し、
   `python3 fill_categoryid.py all_categories_*.csv` を実行
   → 領域名からカテゴリIDを引いて `03_moodle_courses_upload.csv` ができる
3. **Moodleコース作成** で `03_moodle_courses_upload.csv` をアップロード（59コース）

## 注意

- カテゴリ名は学習領域名と完全一致させること（フロントは `categoryname` で領域を判定する）。
  コースの `shortname` はコースslug。
- `imageUrl` は dev プレビュー（CloudFront `/branches/dev-kanegae/images/courses/`）の WebP。
  サムネ素材が無い tutorial・google-analytics は空欄。
- アップロード画面のパーサは単純な `split(',')` なので、値にカンマ・改行を入れない。BOM無しで保存する
  （Excelで保存し直すとBOMが付き、先頭列名が壊れる）。
- `area` 列は `fill_categoryid.py` 用。アップロード時は無視される。
- 教材本文を登録するCSVは管理画面に無い。下の「教材HTMLの登録」の手順でMoodleに直接登録する。

## 教材HTMLの登録（A-8. コースに教材・アクティビティを追加する）

`lesson_html_urls.csv` が教材HTML 668ページの一覧（Excelで開けるようBOM付き、アップロード用ではない）。

| 列 | 内容 |
|---|---|
| bucket | 教材の書き出し単位（`../materials/<bucket>/`）。学習領域の大きさでコースslugではない |
| order | バケツ内の並び順 |
| section | 元サイト（learn.webcoach.jp）のURLパスの章・フォルダ名。登録先コースを決める手がかり |
| title | ページタイトル。Moodleページの「名前」に使う |
| htmlFile | リポジトリ内のHTMLファイル |
| htmlUrl | dev プレビューのCloudFront（`/materials/<bucket>/html/`）で開けるURL |
| sourceUrl | 元サイトのURL |

`htmlUrl` の実体は dev プレビュー用S3バケット（本番アカウント840513866884の
`dev-devspastack-spabucket48e1059f-yymyziswolti`）の `materials/` に手動で置いたもの。
`branches/<ブランチ>/` はデプロイのたびに `--delete` 付きで同期されるので、その外に置いている。
教材HTMLを差し替えたら、次のコマンドで上げ直す。

```sh
AWS_PROFILE=PowerUserAccess-840513866884 \
  aws s3 sync assets/materials/<bucket>/html \
  s3://dev-devspastack-spabucket48e1059f-yymyziswolti/materials/<bucket>/html \
  --content-type "text/html; charset=utf-8"
```

### 想定ユースケース

- 新しく追加した教材（HTML）をAIコーチの検索対象に反映する
- 全教材を対象にVectorDBを再構築する

> **この操作はMoodle管理画面で直接行う**（SPA管理画面では実施できない）

### Moodle管理画面での操作手順

1. **Moodleにログインする**
   管理者アカウントでMoodleにアクセスする（アカウント情報はリポジトリに書かない。担当者に確認する）。
2. **対象のコースを開く**
   「Home→コース 一覧」から対象コースを選択する。登録先は `lesson_html_urls.csv` の `bucket`・`section` を見て決める。
3. **編集モードを有効にする**
   画面右上の「編集モード ON」をクリックする。
4. **モジュールを追加する**
   「活動またはリソースを追加する」から、リソースの「ページ」を追加する。
5. **コンテンツを設定する（Pageモジュールの場合）**
   1. 「名前」に `title` を入力する
   2. 「コンテンツ」にHTMLを入力する
      - `htmlUrl` をブラウザで開いてソース表示するか、`htmlFile` を開いて `<body>` の中身をコピーし、
        エディタのHTMLソース表示（`</>`）に貼り付ける
      - 画像は A-4 でアップロードしたURLを `<img src="...">` で参照する。
        HTML内の `../../_assets/...` の画像・CSSは未取得のため、そのままでは表示されない
   3. 「保存してコースに戻る」をクリックする
6. **アクティビティ完了条件を設定する（必要な場合）**
   「完了とトラッキング」タブで完了条件を設定する。
   これを設定することで学習者のマイページに進捗率（%）が表示される。
