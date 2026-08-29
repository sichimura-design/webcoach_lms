# 教材HTML → LessonDoc JSON 変換ツール

`tools/clipkit-export/` が取得した教材HTML（`materials/source/`）を、
フロントエンドの構造化教材型 [`LessonDoc`](../../frontend/src/types/lesson.ts) に合わせた
JSON（`materials/lessons/`）へ変換する。

**`materials/source/` は読み取りのみ。** 書き込むのは `materials/lessons/` だけ。
LMS・S3・Moodle への投入は一切行わない。

## 使い方

```bash
cd tools/lesson-convert
npm install

node src/cli.js convert            # 変換して materials/lessons へ書き出す
node src/cli.js verify             # 変換結果を機械検査する
node src/cli.js preview            # ブラウザ確認用の静的HTMLを生成する
```

`--course <slug>` で1コースだけ処理できる。内容が変わったファイルだけ書き込むので、
何度実行しても結果は同じになる。

## 出力

```
materials/lessons/
  index.html                  # 全コースの確認用インデックス（ダブルクリックで開ける）
  <course>/
    index.json                # コースの目次
    <page-slug>.json          # 1レッスン = 1ファイル（LessonDoc）
    preview/<page-slug>.html  # 確認用（ブロックの区切りと種別が見える）
```

`LessonDoc` の主な項目は `frontend/src/types/lesson.ts` に準拠する。
加えて、追跡のために `origin`（元URL・取得HTMLのパス・抽出セレクタ・分割方法）を持たせている。

## ブロックの切り方

Clipkit のページは2種類ある。

1. **`data-item-type` があるページ** … Clipkit のブロック境界をそのまま使う。
   入れ子になっていることがあるので、**最も外側のブロックだけ**を採る
   （親子の両方を採ると本文が二重に入る）。
2. **無いページ**（自前HTMLで書かれた教材） … 本文の入れ物（`div.lesson-wrapper` など）まで降りてから、
   その子要素を1ブロックとする。`section` のような章立ての入れ物はさらに展開するが、
   **子要素だけで中身の9割以上を説明できるときに限る**。
   本文が入れ物の直下のテキストノードに書かれていることがあり、
   条件を付けずに展開すると本文ごと落ちてしまう。

見出し（`h2`/`h3`/`ItemHeading`）はブロックにせず、以降のブロックの `heading` に入れる。

## 種別（`kind`）の判定

上から順に評価し、最初に当たったものを採る。

| 判定 | 条件 |
| --- | --- |
| `quiz` | `quiz-box`（選択式）または `check-box`（理解度チェック） |
| `summary` | `summary-box` |
| （設定の対応表） | `data-item-type` が `ItemImage`→`figure`、`ItemMovie`→`video` など |
| `video` | `video` / `iframe` を含む |
| `task` | 見出しか冒頭に「課題・演習・ワーク・提出」 |
| `callout` | 冒頭に「TIPS・ポイント・補足・注意・💡」 |
| `example` | 見出しか冒頭に「具体例・Before・After・比較」 |
| `figure` | 画像があり本文が80字未満 |
| `text` | 上記以外 |

## クイズの抽出

教材の選択肢は `<button class="quiz-opt" data-q="q1" data-correct="true">` の形で、
**正解が `data-correct` に入っている**。これがあれば正解は確定できる。

`data-correct` が無い教材向けに、フィードバック文の「正解は◯◯です」と選択肢を
突き合わせる経路も用意しているが、**どちらでも確定できないものは推測で埋めず、
`convert` の出力に未確定として一覧表示する**。

> 取得ツール側で `button` タグと `data-correct` / `data-q` 属性を残していないと、
> この情報は失われる。`tools/clipkit-export/clipkit.config.json` を変更するときは注意。

## ブロックID

`data-item-id` があれば `ck-<item-id>`、無ければ `<page-slug>-<連番>`。
**再実行しても同じIDになる**ことが重要で、これはクリップの保存位置と
AIコーチが参照した教材箇所のアンカーになる。

## 検査（`verify`）

いちばん大事なのは「取得HTMLの本文が、ブロックに切る過程で落ちていないか」。
取得HTMLの文字数とブロックの文字数を突き合わせ、カバー率が90%を切ったら要確認にする。

比較の対象からは、変換で意図的に別項目へ移したもの（レッスン見出し・ゴール枠・
自動生成の目次・章送り）を除く。見出しは `heading` に入るのでカバー率に加算する。

このほか、ブロック0件・タイトル空・ID重複・選択式クイズの構造化漏れを検出する。
