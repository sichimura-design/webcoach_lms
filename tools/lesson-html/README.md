# lesson-html

教材 HTML を WEBCOACH 学習システム（LMS）に載せる前に、次の3つを行う道具です。

- **整える**（prepare）
- **チェックする**（check）
- **LMS の枠で見る**（preview / verify）

Claude Code からは `/lesson-html` スキルで使います（`.claude/skills/lesson-html/SKILL.md`）。

## なぜ要るか

LMS は、教材 HTML を iframe（ページの中の窓）に入れて表示します。このとき次の決まりがあります。

- **窓の高さ**: 教材が読み込む `lms-embed.js` が「自分の高さ」を LMS に知らせ、LMS が窓をその高さまで伸ばします。
  - 知らせが届かないと、窓は画面の 85% の高さのまま止まり、**教材だけが中でスクロール**します。
- **前後ボタン**: LMS が自分で「前のレッスンへ／次のレッスンへ」を出します。
  - 教材の中にもボタンがあると二重になります。
- **見た目**: `lms-skin.css` が文字・幅・余白を LMS に合わせます。

Clipkit から移した教材には、この2つのファイルを読み込む行が入っています。自作した教材には入らないので、`prepare` で入れます。

## 使い方

最初の1回だけ、次を実行します。

```bash
cd tools/lesson-html && npm install
```

| やること | コマンド |
|---|---|
| LMS 用に整える（上書き。`--out <フォルダ>` で別に出す） | `node src/cli.js prepare <html またはフォルダ...>` |
| チェックする（NG があれば終了コード 1） | `node src/cli.js check <html...>` |
| LMS の枠でブラウザ表示する | `node src/cli.js preview <html>` → 表示された URL を開く |
| PC とスマホ（390px）で自動診断する | `node src/cli.js verify <html...>` |

### prepare がやること

何度かけても同じ結果になります。

1. `<head>` に次の3つを入れます（無いときだけ）。
   - `lms-skin.css` を読み込む行
   - `lms-embed.js` を読み込む行
   - viewport
2. 「前の章へ」「次のレッスンに進む」などのボタンを消します。ボタンしか入っていない枠も消します。
3. LMS の中で崩れる CSS を直します。
   - 画面の高さで止めて中をスクロールさせる箱（`height: 100vh` ＋ `overflow: auto`）
   - 画面に貼りつく箱（`position: fixed` ＋ `height: 100vh`）
   - 高さが伸び続ける指定（`html, body { height: 100% }`、`min-height: 100vh`）
4. `<title>` と同じ h1 を消します。LMS の上部バーにレッスン名が出るためです。残すときは `--keep-h1` を付けます。

prepare で消えないものは、preview や verify で見つけて手で直します。たとえば、Clipkit を真似て作ったサイドバーや目次は消えません。

### preview / verify

`preview/index.html` は、LMS の `EmbeddedLessonFrame.tsx` と同じ条件で教材を開きます。同じなのは次の3点です。

- sandbox の設定
- 高さの追従
- 高さが届かないときの 85vh

そのうえで、次のものを一覧にします。

- 高さが届いているか
- 中だけスクロールする箱
- 見えている前後ボタン
- 横へのはみ出し
- 表示されない画像
- 二重の見出し

`verify` は Playwright でこの画面を開き、PC とスマホの両方の結果を出します。Playwright は次の順に探します。

1. このフォルダ
2. `tools/clipkit-export`
3. 環境変数 `PLAYWRIGHT_DIR`

配信のしかたは次のとおりです。

- `/materials/...` は `assets/materials/...` を返します。本番 S3 の `materials/` と同じ並びです。
- 共通ファイルは `assets/materials/_assets/` のものを使います。
- リポジトリ内のそれ以外の場所は、`/local/<パス>` で開けます。
- `_assets/` と `_clipkit/` の画像は S3 にしかありません。そのため、ここでは表示されなくて正常です。

## ファイル

- `src/rules.js`: 前後ボタンの文言・共通ファイルの場所などの決まり。prepare・check・preview で共通に使います。
- `src/css.js`: 崩れる CSS を見つける・直す。
- `src/prepare.js`、`src/check.js`、`src/serve.js`、`src/cli.js`
- `preview/index.html`: LMS の枠を真似たプレビュー。
- `template.html`: 新しい教材の雛形。
- `test/broken.html`、`test/runaway.html`: 崩れる見本。道具を直したら、これに prepare をかけて verify が OK になることを確かめます。
