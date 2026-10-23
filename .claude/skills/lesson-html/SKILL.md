---
name: lesson-html
description: 教材HTMLを WEBCOACH 学習システム（LMS）に載せる・崩れを直す。新しい教材ページを作る、Clipkit や自作の HTML を LMS 用に整える、「教材だけがスクロールする」「前後のボタンが二重」「スマホではみ出す」「画像が出ない」などの崩れを調べて直すときに使う。教材作成者（エンジニアでない人）向け。
---

# 教材HTMLを載せる・直す

教材作成者が Claude Code に頼むときの手順。道具は `tools/lesson-html/`（説明は同じフォルダの README.md）。

## 触ってよい範囲（必ず守る）
- **触ってよい**: その教材の HTML と、その教材だけが使う画像（`assets/materials/<領域>/` の下）。
- **触らない**: `assets/materials/_assets/`（lms-skin.css・lms-embed.js・lesson-map）、`frontend/`、`api-server/`、`bff-server/`、`cdk/`、`swagger.yaml`。
  - これらは全教材・全画面に効く。原因がここにあると分かったら、直さずに「エンジニア相談メモ」（下）を作って止まる。
- 本番の S3・Moodle への書き込みは、作成者本人が画面で行う。Claude は手順を案内するだけにする。

## 最初の1回だけ
```bash
cd tools/lesson-html && npm install
```
`verify`（自動でブラウザ診断）を使うには Playwright が要る。無ければ `preview`（ブラウザで目視）で代わりにする。

## 作業の流れ
1. **ブランチ**: `git switch -c dev/<名前>-<教材名> origin/master`。master には直接コミットしない。
2. **置き場所**: `assets/materials/<領域>/html/<ファイル名>.html`。
   - 画像は `assets/materials/<領域>/images/` に置き、HTML からは `../images/xxx.webp` と書く。
   - 既存の教材を直すときは、本番の今の HTML を取ってから始める。リポジトリの版は古いことがある。
     `curl -s -o <置き場所> https://study.webcoach.jp/materials/<領域>/html/<ファイル名>.html`
3. **新しく作るとき**: `tools/lesson-html/template.html` を写して書く。決まりは雛形のコメントのとおり。
4. **整える**: `node tools/lesson-html/src/cli.js prepare <html>`。何度かけても同じ結果になる。
   - 2行（lms-skin.css・lms-embed.js）と viewport を入れる。
   - 前後ボタンと、ボタンしか入っていない枠を消す。
   - 崩れる CSS を直す。
   - レッスン名と同じ h1 を消す。
5. **チェック**: `node tools/lesson-html/src/cli.js check <html>`。NG が 0 になるまで直す。
6. **見た目の確認**:
   - 自動で診断する: `node tools/lesson-html/src/cli.js verify <html>`（PC・スマホ 390px の両方）。
   - 自分の目で見る: `node tools/lesson-html/src/cli.js preview <html>` を実行し、出てきた URL を開いてもらう。
   - **prepare だけでは消えないもの**は、ここで見つけて手で直す。Clipkit を真似て作ったサイドバー・目次・ヘッダー・フッターなどが当たる。
7. **コミット・PR**: 変えたファイルだけを `git add` して、`dev/<名前>-…` に push し、master への PR を出す。PR には次を書く。
   - 何の教材か。
   - check と verify の結果。
   - 本番のどのパスへ上げるか。
8. **本番に反映**（PR が承認されたあと、作成者が行う）:
   - 本番の管理画面「コンテンツUP」（`https://study.webcoach.jp/admin/image-upload`）を使う。
   - 既存レッスンは同じパスに上書きする。キャッシュは自動で消えるので、すぐ反映される。
   - **新しいレッスン**（Moodle にまだ無いもの）は、上げたあとに Moodle への登録が要る。登録は管理者（宮部さん）に頼む。伝えるのはコース・並び順・HTML の URL。
9. **本番で確認**: 受講生のアカウントで開く。PC とスマホで、下の表の症状が出ていないかを見る。

## 症状 → 原因 → 直し方
| 症状 | よくある原因 | 直し方 |
|---|---|---|
| 教材だけが枠の中でスクロールする | lms-embed.js の行が無い／`height: 100vh`＋`overflow: auto` の箱がある | prepare。それでも出るなら preview の「中だけスクロールする箱」に出た要素の CSS を直す |
| 下に空白が伸び続ける・ページがやたら長い | `html, body { height: 100% }` や `min-height: 100vh` | prepare（verify に「高さが伸び続けている」と出る） |
| 教材の中に「前の章へ」「次の章へ」が出る | 教材にボタンが書いてある | prepare で消える。文言が違って消えないときは HTML から手で消す |
| 見出しが二重（上部バーと本文） | 本文の h1 | prepare で消える |
| スマホで横にはみ出す | 幅の px 固定・横並びの固定幅 | preview（スマホ 390px）で要素名を見て、`max-width: 100%` や縦並びにする |
| 画像が出ない | パス違い・置き忘れ・Clipkit／Notion／Dropbox の URL | check の「手元に無いファイル」「外の置き場所」を直す。画像は `images/` に置いて一緒に上げる |
| 押しても開かない（Q&A など） | `.toggle > .open-btn + .toggle-content` の形が崩れている | 雛形と同じ形に直す |
| 動画が再生できない | URL 違い・Dropbox の制限 | media.webcoach.jp の URL にする（置き場所はエンジニアに確認） |
| 上のどれでもない・全教材で起きている | lms-skin.css／lms-embed.js／LMS 画面側 | **直さない**。相談メモを作る |

## エンジニア相談メモ（共通ファイル・LMS 画面が原因のとき）
次の形で書いて作成者に渡し、Slack などでエンジニアと宮部さんに送ってもらう。
```
【教材の表示の相談】
- どの教材: <レッスン名>（本番URL: https://study.webcoach.jp/course/..?module=..）
- 症状: <何が・どう見えるか。PC／スマホ>
- 再現: <手順>
- 調べたこと: check / verify の結果、原因と思われるファイルと箇所
- 教材HTML側で避けられるか: <できる／できない、できるならその方法>
```

## 受講生向けの書き方
- 「LMS」と書かず「WEBCOACH学習システム」と書く。
- LMS にある機能は、その画面へ案内する。例: 目標は `/study-log`、AIコーチは `/ai-coach`。
  - リンクには `data-lms-route="/パス"` を付ける。付けると同じタブのまま移れる。
