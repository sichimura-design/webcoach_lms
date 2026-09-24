# Clipkit 教材エクスポートツール

Clipkit の教材ページを取得して `materials/source/` 配下にローカル保存する。
LMS 移行の「取得 → 変換 → 投入」のうち **取得だけ** を担当する。
LMS へのアップロードは一切しないし、`frontend/` のコードも触らない。

## セットアップ

```bash
cd tools/clipkit-export
npm install
npx playwright install chromium
```

## 1. 認証（初回とセッション切れのときだけ）

ID・パスワードはこのツールに渡さない。ブラウザが開くので**自分で**ログインする。

```bash
node src/cli.js login --base-url https://<host> --verify-url https://<host>/<教材ページ>
```

Cookie と localStorage が `.auth/<host>.json` に保存される（パーミッション 600、`.gitignore` 済み）。

完了の合図は実行環境で変わる。

- **対話ターミナルから実行した場合**: ログイン後にターミナルで Enter を押す。
- **非対話（Claude Code などが起動した場合）**: ターミナル入力を待てないので、ログイン成功を
  自動検知する。`--verify-url` に教材ページを渡すと、**そのページが実際に開けるか**で判定するので
  確実。渡さないと「ログイン不要のトップページ」を見て誤検知することがある。

> ログイン画面は JavaScript で遅れてリダイレクトすることがある。判定は
> `networkidle` + 待機のあとに最終 URL を見るようにしてある。

保存先を変えたいときは `--state <path>`、または環境変数 `CLIPKIT_STORAGE_STATE`
でパスを指定できる（環境変数に入れるのはパスだけ。認証情報そのものは入れない）。

## 2. 設定ファイル

```bash
cp clipkit.config.example.json clipkit.config.json
```

`clipkit.config.json` は実際のホスト名と教材 URL を含むため `.gitignore` している。
コミットするのは `clipkit.config.example.json` の方。

```json
{
  "baseUrl": "https://example.clipkit.co",
  "storageState": ".auth/example.clipkit.co.json",
  "outDir": "../../materials/source",
  "content": {
    "include": ["article.item-body", "main article"],
    "exclude": ["script", "header", "nav", ".share"],
    "allowedEmbedHosts": ["www.youtube.com", "player.vimeo.com"],
    "attributes": ["href", "src", "alt", "title", "colspan", "rowspan"]
  },
  "courses": [
    { "slug": "web-marketing-basic", "urls": ["https://example.clipkit.co/items/1"] }
  ]
}
```

| キー | 意味 |
| --- | --- |
| `content.include` | 本文コンテナの CSS セレクタ候補。**先頭から順に試し、最初にヒットしたものを本文とする**。Clipkit は1ページが多数の `.article-item` ブロックに分かれるので、**それら全部を含む親**（WEBCOACH では `.article`）を先頭に置く。1ブロックだけを指すセレクタ（`.item-body` など）を先に置くと、最初のブロックしか取れない |
| `content.titleSelectors` | ページタイトルの取得元。先頭から順に試す。全滅なら `h1` → `<title>` の順。`<title>` は「レッスン名 - サイト名」になりがちなので、専用のセレクタを指定したほうがきれい |
| `content.exclude` | 本文の**内側**から取り除くセレクタ。ヘッダーやサイドバーは本文ルートを取った時点で外れるので、ここは本文中のシェアボタン・コメント欄・script などを指定する。**`nav` や `header` を安易に入れないこと** — 教材が自前の目次を `<nav>` で書いていると本文が消える |
| `content.allowedEmbedHosts` | `iframe` を残すホスト。ここに無いホストの iframe は削除される |
| `content.downloadMediaHosts` | **動画・音声を手元にダウンロードする**ホスト。ここに挙げたホストの `<video>`/`<audio>`/`<source>` は `media/` に保存し、HTML からは `../media/...` で参照する。挙げなければ元 URL のまま残す |
| `content.attributes` | 残す属性。`style` と `on*` は常に削除。`class` をここに入れると全クラスを保持し、入れなければ `pre`/`code` の `language-*` だけ残す。`data-*` は個別に列挙したものだけ残る |
| `courses[].slug` | 出力ディレクトリ名。半角英数字・ハイフン・アンダースコアに正規化される |

動画（`<video>` / `<audio>`）はダウンロードせず、`src` を絶対 URL にして HTML に残し、
manifest の `media` にも記録する。`<details>` のアコーディオンは `open` を付けて保存するので、
CSS が無い状態でも中身が読める。

### なぜ class を残しているか

WEBCOACH の設定では `class` と `data-item-type` / `data-item-id` を残している。
見た目のためではなく、**次工程（構造化データへの変換）でブロックの意味を判定する唯一の手がかり**
だから。`quiz-opt` / `quiz-feedback-text` / `goal-box` / `summary-box` / `tocLink` や
Clipkit のブロック種別（`ItemHtml` / `ItemMarkdown` / `ItemImage` / `ItemLink` …）が該当する。
これらを落とすと、クイズの設問・選択肢・正解・解説を本文の言い回しから推測するしかなくなる。
`<style>` は除外したまま（LMS 側が自前のスタイルを当てるため不要）。

`include` が 1 つもヒットしない場合は「テキスト量 − リンクテキスト量×3」が最大の
ブロックを本文とみなすフォールバックが働く（`nav`/`sidebar` 等を名前に含む要素は減点）。

## 3. 取得

まず 1 ページだけ `--debug` で試し、抽出セレクタを詰める。

```bash
node src/cli.js export --config ./clipkit.config.json --limit 1 --debug
```

`--debug` は `include` 候補のヒット状況、フォールバックのスコア上位、削除した要素数を
標準エラーに出す。これを見て `include` / `exclude` を調整する。

問題なければ全件取得する。

```bash
node src/cli.js export --config ./clipkit.config.json
node src/cli.js export --config ./clipkit.config.json --zip     # ZIP も作る
```

### 主なオプション

| オプション | 既定 | 説明 |
| --- | --- | --- |
| `--course <slug>` | 全コース | 指定コースのみ処理 |
| `--limit <n>` | 制限なし | 各コース先頭 n 件だけ処理（動作確認用） |
| `--concurrency <n>` | `2` | 並列取得数 |
| `--delay <ms>` | `500` | ページ間の待機 |
| `--force` | off | 内容が同じでも再取得・再書き込み |
| `--allow-shrink` | off | 本文が前回より激減しても上書きする（既定では保護して失敗扱い。下記「退行ガード」参照） |
| `--debug` | off | 抽出の内訳を表示 |
| `--headed` | off | ブラウザを表示して実行 |
| `--state <path>` | 設定値 | storageState のパスを上書き |
| `--zip` | off | 取得後に ZIP を作る |
| `--slug-source title` | `url` | ファイル名をページタイトルから作る（英語タイトル向け。並列取得だと衝突時の連番が決定的にならないので通常は使わない） |

終了コード: `0` = 全件成功、`1` = 失敗ページあり、`2` = 設定・引数エラー。

## 4. 出力

```
materials/source/<course-slug>/
  html/<page-slug>.html      # 1ページ = 1ファイル
  images/img-<hash>.<ext>    # 画像。HTML からは ../images/... で参照
  media/med-<hash>.<ext>     # downloadMediaHosts の動画・音声。../media/... で参照
  manifest.json              # URL・タイトル・保存先・取得結果
  failures.json              # 失敗ページ（成功したら自動で削除される）
  failures.txt               # 1行1URL。そのまま再投入できる
```

HTML は `<body>` だけ切り出して再利用できる最小のラッパーになっている。
元 URL と取得時刻は `<meta name="clipkit-source-url">` / `clipkit-fetched-at` に入る。

### manifest.json

```json
{
  "version": 1,
  "courseSlug": "web-marketing-basic",
  "baseUrl": "https://example.clipkit.co",
  "generatedAt": "2026-08-20T12:00:00.000Z",
  "pages": [
    {
      "url": "https://example.clipkit.co/items/1",
      "title": "はじめに",
      "slug": "items-1",
      "htmlPath": "html/items-1.html",
      "status": "ok",
      "extractedBy": "selector:article.item-body",
      "contentHash": "sha256:...",
      "contentLength": 4805,
      "fetchedAt": "2026-08-20T12:00:01.000Z",
      "error": null,
      "images": [{ "sourceUrl": "https://.../a.png", "path": "images/img-ab12cd34ef.png", "status": "ok" }],
      "embeds": ["https://www.youtube.com/embed/xxxx"],
      "media": ["https://media.example.jp/videos/lesson.mp4"],
      "internalLinks": ["https://example.clipkit.co/items/2"]
    }
  ],
  "failures": []
}
```

`internalLinks` は同一ホストへのリンク。次段（LMS 内リンクの付け替え）で使う。

## 5. 元ページのフルHTMLとして書き出す（snapshot）

`export` は本文だけを抜き出して再構成する。エンジニアに渡すなど**元ページそのもの**が要るときは
`snapshot` を使う。`<head>` もテーマCSSも込みで、ローカルで開けば見た目が再現される形にする。

```bash
node src/cli.js snapshot --config ./clipkit.config.json --course knowledge --limit 3 --screenshot
node src/cli.js snapshot --config ./clipkit.config.json                      # 全件
node src/cli.js check    --out ../../materials/handoff                       # ローカルで開いて点検
node src/cli.js handoff  --out ../../materials/handoff --no-media --prune    # README・一覧・ZIP
```

### 出力

```
materials/handoff/
  index.html                 全ページの一覧
  README.md                  受け取る人向けの説明（自動生成）
  assets.json                元URL → _assets/ のファイル名
  _assets/<hash>.<ext>       CSS・画像・フォント（全コース共通・内容ハッシュ名）
  <course>/
    html/<slug>.html         表示された最終形のHTML（資産はローカル相対パス）
    raw/<slug>.html          サーバーが返した生HTML（JS実行前）
    media/<file>             動画・音声（materials/source からの複製）
    manifest.json            元URL・タイトル・未解決の参照
```

### 速い理由

**画像を取り直さない。** `materials/source` の各コースの `images/` にある 700MB 超を
資産ストアの種にする（Pass 1）。取りに行くのは HTML と CSS だけになる。
画像はこの取り込みのときに横幅1600px・WebP へ変換して**最終ファイル名まで確定させる**ので、
後から一括変換して HTML と CSS を置換し直す工程が要らない。

### 忘れると壊れる勘所

- **レスポンス本体は page を閉じる前に待ち切る。** `page.on('response')` の中で始めた
  `response.body()` を待たずに閉じると `Target closed` で握りつぶされ、資産が黙って欠ける。
- **リダイレクトの body は取れない。** `redirectedFrom()` の鎖を全部たどって、
  鎖の全URLを最終URLへ結びつけないと、HTML が指す元URLで引けなくなる。
- **`<base>` と `integrity` は必ず落とす。** base が残ると相対パスが元サイトへ解決され、
  SRI が残ると差し替えた CSS が検証に落ちてページが真っ白になる。
- **`srcset` は残さない。** ブラウザは現在の DPR の1候補しか取っていないので、他候補は 404 になる。
  `img.currentSrc` を `src` に固定し、`<picture>` の `<source>` は消す。
- **`url(#gradient)` を書き換えない。** SVG の filter/mask 参照。触ると SVG が崩壊する。
- **スクロール後のDOM状態に頼らない。** `autoScrollInPage` は最後に先頭へ戻るので、
  出現アニメーションを class で出し入れする実装だと上部が隠れたまま保存される。
  `content.forceVisibleSelectors` に該当セレクタを足して、スタイルで強制的に見せる。
- **`--prune` は全コースを取り切ってから。** 部分実行のあとに掛けると、
  まだ作っていないページの資産まで消える。

### check が効く

`check` は出力した HTML を `file://` で開き、**ローカル参照の 404** と、
残っていると事故る属性（`base` / `integrity` / `srcset` / `blob` / `script`）を数える。
相対パスの取り違えも資産の取りこぼしも、ここに全部出る。ZIP を展開した先に対しても掛けられる。

`--screenshot` を付けて取得すると `screenshots/<slug>.live.png`（元ページ）が残り、
`check` が同じ条件で `<slug>.local.png` を撮る。高さが一致していれば、まず再現できている。

## 6. ZIP だけ作り直す

```bash
node src/cli.js zip --config ./clipkit.config.json --course web-marketing-basic
# -> materials/source/web-marketing-basic.zip
```

`failures.json` / `failures.txt` は作業ログなので ZIP には含まれない。

## 再実行したときの挙動

- **URL がキー。** 同じ URL は必ず同じファイル名になる（manifest の割り当てを優先する）。
  設定の URL 順を入れ替えても既存ファイルが別名で二重化しない。
- **内容が同じならファイルを書かない。** 本文の `contentHash` が前回と一致すれば
  HTML を書き換えず、manifest も差分が無ければ書かない。再実行が完全な no-op になり、
  `git status` にも mtime にも何も出ない。
- **書き込みは原子的。** 一時ファイル → rename なので、途中で落ちても既存ファイルは壊れない。
- **失敗は既存の成功結果を壊さない。** 失敗したページの HTML と画像は前回のものが残り、
  manifest の該当エントリだけ `status: "failed"` + `error` に更新される。
- **画像は消さない。** 参照されなくなった画像も削除しない（誤削除を避けるため）。
  不要になったら `images/` を消して `--force` で取り直すのが確実。
- 設定に含めなかったコースの既存エントリも manifest から消えない。コースを分割実行できる。

### 退行ガード（取得済みの内容を守る仕組み）

セッションが切れると、ログイン画面ではなくマイページ等へ飛ばされて
「取得は成功したが中身がサイトのフッターだけ」という状態になり得る。
これを取り違えて上書きすると、取得済みの教材が壊れる。3段の防御を入れている。

1. **リダイレクト検知** — 教材ページが別パスへ飛ばされたら、その時点で**全体を中断**する。
   ログイン画面のURLパターンやパスワード欄の有無だけでは、この事故は検知できない。
2. **退行ガード** — 本文の文字数が前回の **半分未満** になったら、そのページを失敗扱いにして
   **既存ファイルを上書きしない**。教材が実際に短くなった場合は `--allow-shrink` を付ける。
3. **フォールバック検知** — 前回はセレクタで取れていたのにフォールバック抽出になったら失敗扱いにする。

いずれも manifest の `contentLength` / `extractedBy` を前回値と比べて判定するので、
`--force` を付けても効く（`--allow-shrink` だけが 2 を無効化する）。

## トラブルシュート

**`認証状態が見つかりません`**
`login` を実行していない。表示されるコマンドをそのまま実行する。

**`ログイン画面にリダイレクトされました` で全体が止まる**
セッションが切れている。`login` をやり直す。ここで部分リトライせず全体を止めるのは、
ログイン画面の HTML を大量に保存してしまう事故を防ぐため。

**本文にサイドバーやナビが混ざる / 本文が空になる**
`--limit 1 --debug` で `extractedBy` を確認する。
`fallback:` になっていれば `include` が全滅している。実ページの DOM を見て
`include` に正しいセレクタを足す。逆に本文の一部が消えているときは `exclude` が
効きすぎているので、該当セレクタを外す。

**画像が表示されない**
`manifest.json` の `images[].status` を見る。`failed` の場合、HTML 側は元の絶対 URL に
戻してあるのでオンラインでは表示される。認証付き画像で失敗する場合は `login` をやり直す。

**特定ページだけ失敗する**
`failures.txt` の URL を新しい設定に入れて再実行する。取得済みの他ページは
`unchanged` になるので、全体を取り直しても安全。

## 対象外（このツールがやらないこと）

- LMS へのアップロード・投入
- 動画ファイル・PDF 等の添付のダウンロード（`iframe` は許可ホストのみ `src` を保持する）
- HTML → Moodle 形式への変換、見出し構造の再編
