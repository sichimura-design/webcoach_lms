# UI/UX 指摘記録 — 2026-08-27（コード精読によるレビュー）

対象: `dev/miyabe`（https://dmn2v7nl0g3fq.cloudfront.net/branches/dev-miyabe）
記入者: Claude / 全 87 件（横断 A = 21 件、画面固有 B = 66 件）
方針: **根底の設計は動かさない。** 細部の違和感とユーザー視点の不便さだけを拾う。

## この記録の読み方

- **分類** は [`README.md`](README.md) §1 のルールに従う。**A = 横断**（トークン・共通部品・規約を1箇所直す）/ **B = 画面固有** / **C = 教材語彙**。
  今回 C は 0 件（移行教材の class に対応する CSS がまだ 1 行も無い＝比較の土台が無いため、別途 `/dev/catalog` の教材ブロックを見てから起票する）。
- **重大度**: **高** = できない／誤解する／毎回不快 ・ **中** = 毎回1手増える／迷う ・ **低** = 気になる
- **幅** はその指摘が再現する画面幅（README §3 の 1920 / 1520 / 390 と、それ以外は明記）。
- **根拠** は `ファイル:行`。すべて 2026-08-27 時点の `dev/miyabe` の実コードを読んで確認したもので、推測は含めない。
- スクリーンショットは README §5 のとおりリポジトリに入れない。Drive 側のファイル名だけを CSV に記録する。
- 転記用の CSV は [`findings-2026-08-27-claude.csv`](findings-2026-08-27-claude.csv)（`review-findings.csv` と同じ17列）。

## 先に読む3件

この3件は「壊れている」に近く、他の指摘より先に判断したほうがよい。

| ID | 中身 |
|---|---|
| `CL-A01` | スマホ・タブレットで `/courses` が 0.45〜0.66 倍に縮小され、横スクロールが出る（本文が実効 6px 台） |
| `CL-B39` | ホイールでスクロールしているだけでは「操作」と数えないので、30分読み続けると割り込みが入り、実際の学習時間が削られる |
| `CL-B62` | 利用マニュアル・FAQ が現行 UI と 10 箇所以上食い違っている（廃止済みの「集中ブース」が1節まるごと残っている） |

---

# A. 横断（1箇所直すと全画面に効く）

### CL-A01 モバイルで「学習する」が縮小され横スクロールする 【A / 高 / 390・768・1024px】
- **目的 / 操作**: 移動中にスマホでコースを探す → 下部ナビ「学習する」
- **期待**: 1カラムに折り返って読める
- **実際**: `/courses` は 1440px 固定キャンバスを `transform:scale` で縮小する旧方式。`minScale = 0.45` で下限に張り付くため、390px の端末では **0.45倍・実幅648px** のまま描かれる。`overflow` の指定が無いので**横スクロールが約258px**発生し、本文 13px は実効 5.9px。768px で 0.53倍、1024px で 0.66倍。
- **根拠**: [`src/hooks/useScaleToFit.ts`](../../src/hooks/useScaleToFit.ts)（`minScale = 0.45`）/ [`src/components/MaterialsTopPage.tsx:15,73,239`](../../src/components/MaterialsTopPage.tsx)（`DESIGN_WIDTH=1440`, `position:absolute` + `scale`）
- **改善案**: `/courses` をマイページと同じ流動レイアウト（`.wc-page` + clamp トークン）へ移す。`minScale` を上げるのは対処にならない（文字が縮む問題は残る）。

### CL-A02 `box-sizing: border-box` がグローバルに無い 【A / 高 / 全幅】
- **実際**: `preflight: false` で Tailwind のリセットが入らず、`box-sizing` の指定は `.wc-page` の1箇所だけ。**「はみ出し」修正コミットが繰り返される根本原因**（`ff9fc9b` KPIが枠からはみ出す / `21786ad` 画像のはみ出し / `0d5cd36` / `ff9fc9b`）。実装側も回避策を書いている: 「このプロジェクトは box-sizing のグローバル指定が無いため、パディングを足すと外寸が変数の値と一致しなくなる」。
- **根拠**: [`tailwind.config.js:6-8`](../../tailwind.config.js) / [`src/index.css:267-273`](../../src/index.css) / [`src/components/learning/LessonArticle.tsx:252-254`](../../src/components/learning/LessonArticle.tsx)
- **改善案**: `index.css` 先頭に `*, *::before, *::after { box-sizing: border-box }`。回帰確認は MUI レガシー3画面（`LEG-01`〜`03`）だけでよい。

### CL-A03 フォーカスリングが見えない 【A / 高 / 全幅】
- **目的 / 操作**: キーボードだけで画面を操作する
- **実際**: `focus-visible:ring-[#F6B9BD]` が 109 箇所。白面とのコントラストは **1.68:1** で、WCAG 2.2 の非文字コントラスト 3:1 に足りない。`<button>` は全体で 328 箇所あり、残りはリング指定が無い（`outline-none` だけのものが 10 箇所）。
- **根拠**: `grep 'ring-\[#F6B9BD\]'` = 109 / `grep '<button'` = 328
- **改善案**: `--dc-focus` を定義して1箇所に集約。`#D60934` 2px + 白 2px オフセット。`/dev/catalog` で横並び確認できる。

### CL-A04 トーストが読めない・見えない・読み上げられない 【A / 高 / 全幅・390px】
- **目的 / 操作**: 保存やコピーが成功したか、失敗したかを知る
- **実際**: コーチング・ノートの**唯一のエラー通知**なのに4つ問題がある。
  1. 白文字 × `#E86D78`（error）= **3.05:1**、`#6BBF8A`（success）= **2.22:1**。どちらも 4.5:1 未達。色も旧ピンク系で `--dc-primary`(#D60934) / `--dc-success`(#0E9F6E) と食い違う。
  2. `role` / `aria-live` が無く読み上げされない。
  3. 3秒で自動消滅、閉じるボタン無し、ホバーで止まらない。「コーチング情報を取得できませんでした」を読み切れない。**エラーを自動で消してはいけない。**
  4. `bottom-8 right-8`(32px) なので **SP 下部ナビ(64px) の裏に隠れる**。教材画面では右下 FAB（`right:24 bottom:24`）と重なる。
- **根拠**: [`src/contexts/ToastContext.tsx`](../../src/contexts/ToastContext.tsx)（`toastBg`, `setTimeout(...,3000)`, `bottom-8 right-8`）/ [`src/index.css:394-398`](../../src/index.css)（`.wc-lesson-fab`）
- **改善案**: `role="status"`（error は `role="alert"`）、error は手動クローズ、位置を `bottom: calc(64px + env(safe-area-inset-bottom) + 16px)`、色をトークンへ。

### CL-A05 `--dc-text-subtle` が読めない 【A / 高 / 全幅】
- **実際**: `#9E9E9E` は白面で **2.68:1**（4.5:1 未達）。しかも当たっている文字が 10〜11px（`--dc-fs-3xs` / `--dc-fs-4xs`）。
  使用箇所: 学習記録グラフの目盛りと値ラベル、集計期間、「読み込んでいます…」、ランキング3位の値、各フッター、**「アカウントからログアウトする」**。
- **根拠**: [`src/index.css:94`](../../src/index.css) / [`src/components/AccountSettingsPage.tsx:494`](../../src/components/AccountSettingsPage.tsx) / [`src/components/studyLog/StudyRecordPanel.tsx:425,551`](../../src/components/studyLog/StudyRecordPanel.tsx)
- **改善案**: `--dc-text-subtle` を `#767676`（4.54:1）へ。`--dc-text-muted`(#6B6B6B, 5.17:1) は据え置きでよい。

### CL-A06 本文が小さく、画面をまたぐと文字サイズが変わる 【A / 高 / 1520・390px】
- **実際**: `.mypage-3d` の clamp 下限が 本文 `--dc-fs-base: 11.5px` / `--dc-fs-sm: 11px` / `--dc-fs-xs: 10.5px` / 最小 `--dc-fs-4xs: 9.5px`。vw 連動なので **1520px（表示倍率125%）と 390px（スマホ）では全部が下限に張り付く**。上限でも本文 13px・カード見出し 16px。
  一方コーストップの本文は 15px、レッスン本文は 15px、コーチングは 13px。**マイページ → コーストップと移動すると字が一段大きくなる。**
- **根拠**: [`src/index.css:144-175`](../../src/index.css) / [`src/components/CourseTopPage.tsx:525`](../../src/components/CourseTopPage.tsx) / [`src/index.css:516-521`](../../src/index.css)（`.wc-lesson-prose`）
- **改善案**: clamp 下限を 本文 13px / 補助 12px / 最小 11px に上げ、`--dc-fs-4xs` は廃止。SP は clamp を切って 14〜15px 固定。

### CL-A07 `<html lang="en">`（中身は全画面日本語） 【A / 中 / 全幅】
- **実際**: 読み上げが英語音声になり、改行判定も英語ルールになる。
- **根拠**: [`public/index.html:2`](../../public/index.html)
- **改善案**: `lang="ja"`。1行。

### CL-A08 ブラウザタブがどのページでも「WEBCOACH LMS」 【A / 中 / 全幅】
- **目的 / 操作**: 教材とマイページを2タブで開いて行き来する
- **実際**: `document.title` を設定している箇所が 0 件。**タブを見分けられない**し、履歴・ブックマークもすべて同名になる。
- **根拠**: `grep -rn "document.title" src` = 0 件 / [`public/index.html:6`](../../public/index.html)
- **改善案**: `useDocumentTitle()` を作り、ルート単位で「レッスン名 | WEBCOACH」を入れる。

### CL-A09 「運営へのお問い合わせ」に到達できない 【A / 高 / 全幅】
- **目的 / 操作**: 使い方が分からないので運営に連絡したい
- **実際**: 問い合わせ導線（`https://o4dqp.channel.io/workflows/783132`）は `AppHeader` の中にあるが、その親 `<header>` が **`className="hidden"`**。約270行が表示されない DOM で、同じブロックの通知ベル・ヘルプドロップダウン・「AIコーチに相談」ボタンも出ない。
  **問い合わせ先はアプリ内のどこからも押せない**（`grep` してもこの1箇所しか無い）。
- **根拠**: [`src/components/shared/AppHeader.tsx:618-884`](../../src/components/shared/AppHeader.tsx)（`className="hidden"` / 777行に channel.io）
- **改善案**: 死んだ `<header>` ブロックを削除し、問い合わせをサイドバー補助リンク（利用マニュアル・よくある質問の隣）へ移す。

### CL-A10 新着通知が誰にも届かない 【A / 中 / 全幅】
- **実際**: `useNewContentNotification()` は動き続けて `notificationStore` に新着コースを溜めるが、表示するベルは `CL-A09` の隠れた DOM の中だけ。**溜めて捨てている状態。** 実装側のコメントは「お知らせはレールにもパネルにも置かない（レビューで不要と判断）」と書いてある。
- **根拠**: [`src/components/shared/AppHeader.tsx:38,467-470,807-878`](../../src/components/shared/AppHeader.tsx)
- **改善案**: 「収集を止める」か「出す面を決める」のどちらかに決着させる。判断は運営側。

### CL-A11 モバイルから設定・ヘルプ・ログアウトに行けない 【A / 高 / 390px】
- **目的 / 操作**: スマホでニックネームを変えたい／使い方を読みたい／ログアウトしたい
- **実際**: SP 下部ナビは `navItems` + `manageItems` だけ。アカウント設定・プロフィール・利用マニュアル・よくある質問・**ログアウト**は PC の展開パネルにしか置かれていない（`hidden sm:flex`）。
- **根拠**: [`src/components/shared/AppHeader.tsx:894-914`](../../src/components/shared/AppHeader.tsx)（下部ナビ）/ 同 `503-616`（パネル＝`hidden sm:flex`）
- **改善案**: 下部ナビに「その他」を1枠追加してシートで出す。関連 `CL-A12`（枠数）。

### CL-A12 SP 下部ナビのラベルが 10px、1枠 62.5px 【A / 中 / 390px】
- **実際**: `text-[10px]` + `truncate`。375px で管理者は6枠 = 1枠 62.5px。コード内コメントも「375pxで1枚62.5pxと詰まる」と認めている。
- **根拠**: [`src/components/shared/AppHeader.tsx:899-912`](../../src/components/shared/AppHeader.tsx)
- **改善案**: ラベル 11px、枠は5つ固定（管理・受講生一覧は「その他」へ）。

### CL-A13 アカウントのポップオーバーが 10px の隙間で閉じる 【A / 中 / 1920・1520px】
- **目的 / 操作**: 左下のアイコンにホバーして「プロフィール」を選ぶ
- **実際**: ポップオーバーは `ml-2.5`（10px）離れており、トリガー div の `onMouseLeave` で即閉じる。**アイコンからメニューへマウスを動かす途中の 10px で消える。**
- **根拠**: [`src/components/shared/AppHeader.tsx:352,475-497`](../../src/components/shared/AppHeader.tsx)
- **改善案**: 閉じるのを 150ms 遅延させる、または隙間を透明のブリッジ要素で埋める。

### CL-A14 同じ行き先・同じ操作が画面ごとに別の名前 【A / 中 / 全幅】
- **実際**:

  | 行き先 / 操作 | 出てくる言い方 |
  |---|---|
  | コース目次へ | 「レッスンを選び直す」(マイページ) / 「コース目次を見る」(学習する) / 「コースに戻る」(レッスン) / 「コースの目次へ」(達成カード) |
  | `/study-log` へ | 「詳しく見る」(ストリーク) / 「詳しく見る」(学習記録) / 「もっと見る」(ランキング) ← **同一画面に3つ、うち2つが同名** |
  | 学習の再開 | 「続きから学習する」/「続きから学ぶ」/「続きから →」/「学習を再開する ›」/「再開する ›」 |
  | 設定画面 | 「アカウント設定」(実装) / 「個人設定」(ヘルプ本文) |
- **根拠**: [`StudyChallengeCard.tsx:400`](../../src/components/mypage/StudyChallengeCard.tsx) / [`MaterialsTopPage.tsx:345,352,386`](../../src/components/MaterialsTopPage.tsx) / [`StreakHeroCard.tsx:123`](../../src/components/mypage/StreakHeroCard.tsx) / [`StudyRecordCard.tsx:192`](../../src/components/mypage/StudyRecordCard.tsx) / [`PeerRankingCard.tsx:207`](../../src/components/mypage/PeerRankingCard.tsx) / [`CourseTopPage.tsx:375,581`](../../src/components/CourseTopPage.tsx)
- **改善案**: `frontend/docs/ui-rules.md`（README §8 で「まだ無い」とされているファイル）に用語表を確定させて置換する。既出タスク `CONSISTENCY-004`。

### CL-A15 フッターが4種類 【A / 中 / 全幅】
- **実際**: マイページ・設定 = 地色に小さい文字 / コーストップ = `#2B2440` の黒帯 / ヘルプ・ノート = `#2B2629` の黒帯 / コーチング = `© 2026 WEBCOACH Inc.`（表記の並びまで違う）。
- **根拠**: [`MyPage.tsx:168-172`](../../src/components/MyPage.tsx) / [`CourseTopPage.tsx:594-596`](../../src/components/CourseTopPage.tsx) / [`help/HelpPage.tsx:302-304`](../../src/components/help/HelpPage.tsx) / [`notes/MyNotesPage.tsx:484-486`](../../src/components/notes/MyNotesPage.tsx) / [`CoachingNotesPage.tsx:488`](../../src/components/CoachingNotesPage.tsx)
- **改善案**: 地色 + `2026 © WEBCOACH` の1種に統一。

### CL-A16 コンテンツ幅が画面ごとに違い、コーチングでは遷移中に跳ねる 【A / 中 / 1920px】
- **実際**: `1600px`(マイページ・設定) / `1140px`(コーストップ) / `1080px → 860px`(コーチング。**モードが変わると幅が変わる**) / `980px`(ヘルプ) / `900px`(ノート面) / `1440px`(学習する) / `1040px`(レッスン本文)。
- **根拠**: [`src/index.css:197-201`](../../src/index.css) / [`CourseTopPage.tsx:248`](../../src/components/CourseTopPage.tsx) / [`CoachingNotesPage.tsx:384`](../../src/components/CoachingNotesPage.tsx) / [`help/HelpPage.tsx:225`](../../src/components/help/HelpPage.tsx) / [`notes/MyNotesPage.tsx:213`](../../src/components/notes/MyNotesPage.tsx)
- **改善案**: 2種（一覧系 1440 / 読み物系 1040）に寄せる。コーチングはモードで幅を変えない。

### CL-A17 モーダルの作法が揃っていない 【A / 中 / 全幅】
- **実際**:
  - **Esc で閉じない**: 学習記録の打診・放置確認（`StudySessionPrompt`）、学習終了カード（`FinishSessionModal`）。一方サイドバー・アカウント・記録ピル・ノートの並び替えは Esc で閉じる。
  - 背景クリックの扱いが混在（打診 = 閉じない / 終了カード = 閉じる）。
  - フォーカストラップと背景スクロール固定がどのモーダルにも無い。
  - `role="dialog"` を付けただけで初期フォーカス移動が無いものがある（`ExplainPopover`）。
- **根拠**: [`shared/StudySessionPrompt.tsx:53`](../../src/components/shared/StudySessionPrompt.tsx) / [`focus/FinishSessionModal.tsx:142-164`](../../src/components/focus/FinishSessionModal.tsx) / [`learning/ExplainPopover.tsx:24-41`](../../src/components/learning/ExplainPopover.tsx)
- **改善案**: 共通 `Modal` を1つ作る（README §8 の「不在の共通部品」に挙がっている）。既出タスク `CONSISTENCY-005`。

### CL-A18 アイコンに絵文字・記号が混ざる 【A / 中 / 全幅】
- **実際**: 全体は lucide なのに、`🔍`（コース0件）、`🔥`（記録完了）、`‹` `›`（前週・次週）、`↑` `↓`（増減）、`✓` `・`（パスワード要件）、CTA 末尾の `›`（「学習をはじめる ›」）が混在。絵文字は OS ごとに絵が変わるので、同じ画面が端末で別物に見える。
- **根拠**: [`MaterialsTopPage.tsx:531`](../../src/components/MaterialsTopPage.tsx) / [`focus/FinishSessionModal.tsx:518`](../../src/components/focus/FinishSessionModal.tsx) / [`studyLog/StudyRecordPanel.tsx:357,381,411`](../../src/components/studyLog/StudyRecordPanel.tsx) / [`AccountSettingsPage.tsx:465`](../../src/components/AccountSettingsPage.tsx) / [`CourseTopPage.tsx:375`](../../src/components/CourseTopPage.tsx)
- **改善案**: lucide に統一（`Search` / `Flame` / `ChevronLeft` / `ArrowUp` / `Check` / `ChevronRight`）。既出タスク `CONSISTENCY-006`。

### CL-A19 Inter 400 を読み込んでいないので「今日」の強調が効かない 【A / 中 / 全幅】
- **実際**: 読み込んでいるのは `Inter:wght@600;700;800`。`.dc-num` に `fontWeight: 400` を指定している箇所（グラフの値ラベル・曜日ラベル）は最も近い 600 で描かれるため、**「今日」の 700 との差がほとんど出ない**。強調のつもりの太字が効いていない。
- **根拠**: [`public/index.html:9`](../../public/index.html) / [`src/index.css:189-192`](../../src/index.css) / [`mypage/StudyRecordCard.tsx:275,289`](../../src/components/mypage/StudyRecordCard.tsx)
- **改善案**: Inter に 400 を追加する。または 400 の指定をやめて 500/700 の2段に整理する。

### CL-A20 データが空のカードが「読み込んでいます…」から抜けられない 【A / 中 / 全幅】
- **目的 / 操作**: 初日の受講生がマイページを開く
- **実際**: `loading || !me`（学習時間チャレンジ）、`active.loading || items.length === 0`（みんなのランキング）という判定なので、**空のときも永久に「読み込んでいます…」**。ランキングに載っていない人・初日の人には終わらない読み込みに見える。空状態の文言が無い。
- **根拠**: [`mypage/StudyChallengeCard.tsx:136`](../../src/components/mypage/StudyChallengeCard.tsx) / [`mypage/PeerRankingCard.tsx:249`](../../src/components/mypage/PeerRankingCard.tsx)
- **改善案**: `EmptyState` を作り（README §8 の不在部品）、`loading` と `empty` を分ける。既出タスク `STATE-006` / `CONSISTENCY-003`。

### CL-A21 スマホでフォームに触るたび画面が拡大する 【A / 中 / 390px】
- **実際**: iOS Safari は `font-size < 16px` の入力欄にフォーカスすると自動ズームする。該当: ログインのメール・パスワード(15px)、教材のAI検索(13px)、学習時間の修正(15px)、ノート検索(14px)、メール確認コード。**1文字打つたびに画面が寄り、戻すには手でピンチアウトする。**
- **根拠**: [`LoginPage.tsx:46`](../../src/components/LoginPage.tsx)（`text-[15px]`）/ [`MaterialsTopPage.tsx:417`](../../src/components/MaterialsTopPage.tsx) / [`focus/FinishSessionModal.tsx:252`](../../src/components/focus/FinishSessionModal.tsx) / [`notes/MyNotesPage.tsx:308`](../../src/components/notes/MyNotesPage.tsx)
- **改善案**: SP のみ入力欄を 16px にする（見た目の調整は padding で行う。`transform` は使わない）。

---

# B. 画面固有

## /login

### CL-B01 「パスワードお忘れですか？」に Tab で到達できない 【B / 高 / 全幅】
- **目的 / 操作**: パスワードを忘れたので再設定したい。キーボードで Tab を送る
- **実際**: `<span onClick>` で実装されているため**フォーカスも Enter も効かない**。マウスが使えない人はパスワードを再設定できない。
- **根拠**: [`LoginPage.tsx:355-361`](../../src/components/LoginPage.tsx)
- **改善案**: `<button>` か `<Link to="/password-reset">` にする。関連タスク `SCREEN-012`。

### CL-B02 パスワード表示トグルがキーボードで押せない 【B / 高 / 全幅】
- **実際**: 3箇所すべて `tabIndex={-1}` で、`aria-label` も無い。**キーボードだけの人は打ち間違いを確認できない。** 読み上げでは用途不明のボタンになる。
- **根拠**: [`LoginPage.tsx:264-271,291-298,376-383`](../../src/components/LoginPage.tsx)
- **改善案**: `tabIndex` を外し、`aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}`。同じ実装は `AccountSettingsPage.tsx:420` に既にあるので流用できる。

### CL-B03 メールアドレス欄が `type="text"` 【B / 中 / 390px】
- **実際**: スマホで @ の無い通常キーボードが出る。オートフィルの精度も落ちる。
- **根拠**: [`LoginPage.tsx:337-346`](../../src/components/LoginPage.tsx)
- **改善案**: `type="email" inputMode="email"`。

### CL-B04 ログイン失敗が読み上げられない 【B / 中 / 全幅】
- **実際**: エラーはフィールドの下に描かれるが `role="alert"` が無く、フォーカスも移らない。**読み上げ環境では押した結果が分からない。**
- **根拠**: [`LoginPage.tsx:387-391`](../../src/components/LoginPage.tsx)
- **改善案**: `role="alert"` を付ける。`AccountSettingsPage.tsx:252` の `role="status"` と作りを揃える。

### CL-B05 新パスワードの要件がプレースホルダにしか無い 【B / 低 / 全幅】
- **実際**: 「8文字以上（大文字・小文字・数字を含む）」はプレースホルダなので**入力を始めると消える**。クライアント検証は文字数だけで、文字種は送信後に Cognito のエラーで判明する。アカウント設定側には `passwordRules` の常時チェックリストがあり、同じことを2つの作りでやっている。
- **根拠**: [`LoginPage.tsx:110-113,261`](../../src/components/LoginPage.tsx) / [`AccountSettingsPage.tsx:54-60,456-469`](../../src/components/AccountSettingsPage.tsx)
- **改善案**: 設定画面の `passwordRules` をログイン側でも使う。

## /mypage

### CL-B06 初日のユーザーに「0日連続」「ベスト 0日」「あと0日で自己ベスト」が並ぶ 【B / 高 / 全幅】
- **目的 / 操作**: 初回ログインでマイページを見る
- **実際**: `remain = Math.max(0, best - current)` なので `current = 0, best = 0` のとき **「あと0日で自己ベスト」** という意味の通らない文が出る。画面の主役カードに 0 が3つ並び、次に何をすればよいか書いていない。
- **根拠**: [`mypage/StreakHeroCard.tsx:65-68,144-154`](../../src/components/mypage/StreakHeroCard.tsx)
- **改善案**: `current === 0` のときは「今日はじめると1日目です」に差し替える。関連タスク `SCREEN-001` / `STATE-005`。

### CL-B07 タイに並んだだけで「自己ベスト更新中！」 【B / 中 / 全幅】
- **実際**: `isNewBest = current > 0 && current >= bestDays`。**更新ではなく並んだだけでも祝う。** 祝う条件が甘いと祝いの価値が下がる。
- **根拠**: [`mypage/StreakHeroCard.tsx:67`](../../src/components/mypage/StreakHeroCard.tsx)
- **改善案**: `>` に変え、タイのときは「自己ベストに並びました」を別文で出す。

### CL-B08 同着でも「あと1分で3位！」と出る 【B / 中 / 全幅】
- **実際**: `gap = Math.max(1, target.minutes - me.minutes)` なので、学習時間がまったく同じ相手にも「あと1分」と表示される。差が無いのに追う演出になる。
- **根拠**: [`mypage/StudyChallengeCard.tsx:97`](../../src/components/mypage/StudyChallengeCard.tsx)
- **改善案**: 0 分差のときは「同着です。あと1分で順位が上がります」と事実を書く。

### CL-B09 同じカードの中で時間の単位表記が2種類 【B / 中 / 全幅】
- **実際**: 見出しは生の分（`{gap}` = 「あと125分で3位！」）、その下のピルは `formatMinutesHM`（「あと2時間5分」）。**同じ差を2つの書き方で並べている。**
- **根拠**: [`mypage/StudyChallengeCard.tsx:164,317`](../../src/components/mypage/StudyChallengeCard.tsx)
- **改善案**: 見出しも `formatMinutesHM` に通す。

### CL-B10 「今週の学習時間」が同じカードに2回出る 【B / 中 / 全幅】
- **実際**: 学習記録カードの KPI タイルに「今週の学習時間」、そのすぐ下のグラフ見出しにも「今週の学習時間」。**同じ言葉が縦に2つ並ぶ。**
- **根拠**: [`mypage/StudyRecordCard.tsx:198,207`](../../src/components/mypage/StudyRecordCard.tsx)
- **改善案**: グラフ側を「曜日ごとの内訳」にする。

### CL-B11 「修了レッスン数」が推定値なのに断りが無く、画面によって分母の有無が違う 【B / 中 / 全幅】
- **実際**: マイページの値は進捗率からの**推定**（`useLearningSummary`。実装コメントに「コースの進捗率からの推定値」とある）。`/courses` では「修了レッスン 12 / 40」と分母付き、マイページでは分母なしの裸の数字。**2画面で数え方が違うように見える。**
- **根拠**: [`mypage/StudyRecordCard.tsx:21-22,200-203`](../../src/components/mypage/StudyRecordCard.tsx) / [`MaterialsTopPage.tsx:185-186,261-265`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: どちらかの形に統一する。推定のままなら「（目安）」を添える。

### CL-B12 「0分の日」と「まだ来ていない日」が見分けられない 【B / 中 / 全幅】
- **目的 / 操作**: 今週サボった曜日を確認する
- **実際**: 0分の過去日は高さ 14px・`#EAE4DA`、未来日は高さ 8px・`#F2EDE5`。**差は 6px と淡い色差だけ**なので、金曜に見たときに「木曜が0分」なのか「土曜がまだ来ていない」のか読み取れない。未来を薄くする意図（実装コメント）は良いが、差が足りていない。
- **根拠**: [`mypage/StudyRecordCard.tsx:29-31,245-252`](../../src/components/mypage/StudyRecordCard.tsx)
- **改善案**: 未来日は塗りをやめて破線の枠だけにする（形で区別する。色だけに頼らない）。

### CL-B13 グラフの数値が `title` 属性しか無い 【B / 中 / 390px・全幅】
- **実際**: 棒の値は `title={...}` のネイティブツールチップのみ。**タッチ端末では一切読めず**、キーボードでも読めない。表の代替も無い。
- **根拠**: [`mypage/StudyRecordCard.tsx:257`](../../src/components/mypage/StudyRecordCard.tsx)
- **改善案**: 値ラベルを常時表示にするか、`aria-label` + 折りたたみの表を添える。関連 `CL-B48`。

### CL-B14 1画面に `/study-log` へのリンクが3つ、名前が2種類 【B / 中 / 全幅】
- **実際**: ストリーク「詳しく見る」・学習記録「詳しく見る」・ランキング「もっと見る」がすべて同じ `/study-log` に行く。押す前に「別のものが見られる」と思う。
- **根拠**: [`StreakHeroCard.tsx:106`](../../src/components/mypage/StreakHeroCard.tsx) / [`StudyRecordCard.tsx:175`](../../src/components/mypage/StudyRecordCard.tsx) / [`PeerRankingCard.tsx:189`](../../src/components/mypage/PeerRankingCard.tsx)
- **改善案**: `CL-A14` の用語表で1つに寄せ、カードごとに遷移先のセクションへアンカーを分ける。

### CL-B15 ランキングの期間が種別を切り替えると黙って戻る 【B / 中 / 全幅】
- **実際**: 期間は `timePeriod` / `streakPeriod` の別 state。ストリークで「累計」を選び学習時間タブへ戻ると、何も言わずに「週間」になっている。期間の表示書式も `集計期間：X`（時間）/ `Xの学習日数`（ストリーク）で違う。
- **根拠**: [`mypage/PeerRankingCard.tsx:87-88,259`](../../src/components/mypage/PeerRankingCard.tsx)
- **改善案**: 期間ラベルを選択ピルの隣に常時出す。書式は1つに揃える。

### CL-B16 `role="tab"` に対応する `tabpanel` も矢印キー操作も無い 【B / 低 / 全幅】
- **実際**: 1カード内に `role="tablist"` が2組あるが、`aria-controls` / `tabpanel` が無く、矢印キーでの移動も実装されていない。読み上げ上は「タブ」と言いながらタブとして動かない。
- **根拠**: [`mypage/PeerRankingCard.tsx:37,213`](../../src/components/mypage/PeerRankingCard.tsx) / [`studyLog/StudyRecordPanel.tsx:82,312`](../../src/components/studyLog/StudyRecordPanel.tsx)
- **改善案**: `aria-pressed` のトグルボタン群にする（作りを変えずに正しくなる）。

### CL-B17 挨拶が常に「こんにちは」、日付はタブを開いたまま日が変わっても更新されない 【B / 低 / 全幅】
- **実際**: `{name}さん、こんにちは` は時刻を見ていない（23時でも「こんにちは」）。日付は描画時の `new Date()` を1回読むだけなので、**LMS を開いたまま日付が変わると前日の日付が残る**（学習記録の「今週」も同様）。
- **根拠**: [`mypage/MypageGreeting.tsx:28,40`](../../src/components/mypage/MypageGreeting.tsx) / [`mypage/StudyRecordCard.tsx:107-131`](../../src/components/mypage/StudyRecordCard.tsx)
- **改善案**: 時刻帯で挨拶を変える。日付は日跨ぎで再計算する（可視化タブ復帰時に再評価すれば足りる）。

## /courses（学習する）

### CL-B18 スマホ・タブレットで縮小され横スクロールする 【B / 高 / 390・768px】
- `CL-A01` と同一原因。この画面固有の症状として: ヒーローの「続きから学ぶ」ボタンが実効 6px 台の文字になり、4列のコースタイルが横にはみ出す。
- **関連タスク**: `DEVICE-001` / `DEVICE-004` / `SCREEN-002`

### CL-B19 「続きから学ぶ」というラベルと同名のボタンが同じカードに並ぶ 【B / 中 / 全幅】
- **実際**: 見出しのアイブロウが「続きから学ぶ」、右のボタンも「続きから学ぶ」。押せるものと押せないものが同じ言葉になっている。
- **根拠**: [`MaterialsTopPage.tsx:288,345`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: アイブロウを「学習中のコース」にする。

### CL-B20 押せないのに塗られた検索ボタン 【B / 中 / 全幅】
- **実際**: 未入力時の背景が `t.color.text.subtle`（グレーの塗り）で `cursor: 'default'`。**塗りボタンに見えるのに反応しない。** `disabled` の見た目としてグレー塗りは弱い。
- **根拠**: [`MaterialsTopPage.tsx:419-426`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: 枠＋薄字の `disabled` 表現にし、`cursor: not-allowed` にする。

### CL-B21 検索プレースホルダが長すぎて途中で切れる 【B / 中 / 1520px以下】
- **実際**: 「学びたいこと・つまずいていることを入力（例：配色が苦手）」に対し右パディングが 118px（ボタンぶん）。狭い幅では「学びたいこと・つまずいてい…」で切れ、何を入れる欄か分からなくなる。
- **根拠**: [`MaterialsTopPage.tsx:415-417`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: プレースホルダを「例：配色が苦手」に短縮し、説明は左の見出し側（既にある）に任せる。

### CL-B22 0件の空状態が絵文字 🔍 【B / 低 / 全幅】
- **根拠**: [`MaterialsTopPage.tsx:531`](../../src/components/MaterialsTopPage.tsx) / `CL-A18`・`STATE-004`

### CL-B23 「ほかに学習中」が3列固定で、2件のとき右が空く 【B / 低 / 1920px】
- **根拠**: [`MaterialsTopPage.tsx:363`](../../src/components/MaterialsTopPage.tsx)（`repeat(3,1fr)`）
- **改善案**: `repeat(auto-fill, minmax(260px, 1fr))`。

## /course/:id/curriculum（コーストップ）

### CL-B24 半分終えたコースが一瞬「0% / 全行未着手」で描かれてから跳ねる 【B / 高 / 全幅】
- **目的 / 操作**: 学習中のコースを開いて、次にやるレッスンを探す
- **期待**: 進捗と「いまここ」が最初から正しく出ている
- **実際**: 完了状態を**レッスン1件ずつ** `getActivityCompletion` で取る N+1。`completedIds` の初期値が空 Set なので、**確定するまで 進捗 0%・全行「未着手」・「いまここ」がチャプター1・ヒーローが「学習をはじめる」** で描かれ、その後まとめて書き換わる。30レッスンなら30リクエスト。同じ処理が `/courses`（次に学ぶレッスンの算出）にもある。
- **根拠**: [`CourseTopPage.tsx:186-198,222-229`](../../src/components/CourseTopPage.tsx) / [`MaterialsTopPage.tsx:126-152`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: 完了一覧をまとめて取る API を MSW に足す（`frontend/docs/mock-development.md` の手順）。それまでは `completedIds` 取得中はスケルトンにし、確定後に描く。関連タスク `SCREEN-003` / `STATE-006`。

### CL-B25 レッスン行がキーボードで選べない 【B / 中 / 全幅】
- **実際**: 行は `onClick` 付きの `<div>` で `role` も `tabIndex` も無い。キーボードで到達できるのは右端のボタンだけ。同種のカードは `/courses` 側では `role="button" tabIndex={0}` + `onKeyDown` になっており、**作りが揃っていない**。
- **根拠**: [`CourseTopPage.tsx:494-497`](../../src/components/CourseTopPage.tsx) ↔ [`MaterialsTopPage.tsx:366-372`](../../src/components/MaterialsTopPage.tsx)
- **改善案**: `MaterialsTopPage` の書き方に合わせる。

### CL-B26 1行に同じ意味の表示が3つ 【B / 中 / 全幅】
- **実際**: 未着手のレッスン行に「破線の丸」「未着手ピル」「はじめるボタン」が並ぶ。30行あれば90個。上に凡例（完了/学習中/未着手）もあるので4重。
- **根拠**: [`CourseTopPage.tsx:516,558-560,567-582`](../../src/components/CourseTopPage.tsx)
- **改善案**: ピルを落として「丸 + ボタン」にする（凡例が丸の意味を担っている）。

### CL-B27 ヘッダー右に同じ進捗の3表現 【B / 中 / 全幅】
- **実際**: 「全40レッスン中12レッスン完了」+ バー + 「30%」が横一列。すぐ下のヒーローにも「次のレッスン」がある。
- **根拠**: [`CourseTopPage.tsx:290-309`](../../src/components/CourseTopPage.tsx)
- **改善案**: バー + 「12 / 40（30%）」の2表現に落とす。

### CL-B28 マイページから来ると文字が一段大きくなる 【B / 中 / 1920・1520px】
- `CL-A06` の画面側の症状。行タイトル 15px / h1 32px は px 直書きで、マイページの clamp トークン（本文最大13px）と系統が違う。
- **根拠**: [`CourseTopPage.tsx:270,525`](../../src/components/CourseTopPage.tsx)

### CL-B29 この画面だけ黒帯フッター 【B / 低 / 全幅】
- `CL-A15`。**根拠**: [`CourseTopPage.tsx:594-596`](../../src/components/CourseTopPage.tsx)（`bg-brand-footer` = `#2B2440`）

## /course/:id（レッスン）

### CL-B30 レッスンの一覧が無く、任意のレッスンへ跳べない 【B / 高 / 全幅】
- **目的 / 操作**: 7本目を読んでいて、3本目の内容を確認したくなった
- **実際**: この画面に目次は無い（レビューで「集中が切れる」として廃止）。移動手段は ①トップバー「コースに戻る」 ②本文末尾の「前のレッスンへ / 次のレッスンへ」だけ。**3本目に行くには一度コーストップへ出て、戻ってくる。** トップバーには「レッスン 5 / 9」と位置だけが出ていて、そこから跳べない。
- **根拠**: [`learning/LearningWorkspacePage.tsx:31-45`](../../src/components/learning/LearningWorkspacePage.tsx) / [`learning/LessonTopBar.tsx:5-19,128-150`](../../src/components/learning/LessonTopBar.tsx)
- **改善案**: 「レッスン 5 / 9」自体を押せるようにして、一覧だけのポップオーバー（常設パネルではない）を出す。常設に戻さなければ「集中が切れる」の懸念とも両立する。関連タスク `SCREEN-005` / `FLOW-003`。

### CL-B31 同じ形の進捗バーが、画面によって別の数字を出す 【B / 高 / 全幅】
- **実際**: レッスン画面のバーは**位置**（`lessonIndex / lessonTotal`。5本目なら55%）。コーストップのバーは**完了率**（2/9 なら22%）。同じコースで 55% と 22% の2つのバーが出る。
- **根拠**: [`learning/LessonTopBar.tsx:41-43`](../../src/components/learning/LessonTopBar.tsx) ↔ [`CourseTopPage.tsx:222`](../../src/components/CourseTopPage.tsx)
- **改善案**: レッスン画面はバーをやめて「5本目 / 全9本」の文字だけにする。バーの形は完了率だけに使う。

### CL-B32 「かんたん解説」が長文だと画面の外に出て読めない 【B / 高 / 全幅】
- **目的 / 操作**: 分からない文をなぞって「解説」を押す
- **実際**: 位置は `top = Math.min(window.innerHeight - 230, anchor.top)` で**高さ230px固定の前提**。`max-height` も `overflow` も無いので、AIの回答が長いとポップオーバーが下へ伸びてビューポートを突き抜ける。しかもこの画面は `body { overflow: hidden }` なので**はみ出した部分を読む手段が無い**。本文は 11.5px。
- **根拠**: [`learning/ExplainPopover.tsx:21-22,60`](../../src/components/learning/ExplainPopover.tsx) / [`src/index.css:356-358`](../../src/index.css)
- **改善案**: `max-height: min(60vh, ...)` + `overflow-y: auto`、本文 13px、下に入らないときは上側へ開く。

### CL-B33 「内容をプレビュー」を押すと次のレッスンへ完全に遷移する 【B / 中 / 全幅】
- **実際**: 未完了時の次レッスンボタンのラベルが「内容をプレビュー」だが、処理は `onNavigate(next.lessonId)` で**完了時の「次のレッスンへ」と同じ**。覗くつもりで押した人が読んでいたレッスンから出る。
- **根拠**: [`learning/LessonArticle.tsx:188-197`](../../src/components/learning/LessonArticle.tsx)
- **改善案**: 「次のレッスンを見る」にする（やることを正しく書く）。

### CL-B34 使い方の帯が全レッスンに永久表示で閉じられない 【B / 中 / 全幅・390px】
- **実際**: 「分からない文章はドラッグで選択すると、解説・AIへの質問・クリップができます。右下からAI・メモも開けます」が**すべてのレッスンの本文冒頭に毎回**出る。閉じる手段が無い。25レッスンあれば25回読まされる。加えてタッチ端末に「ドラッグ」と書いている（実際の操作は長押し）。
- **根拠**: [`learning/LessonArticle.tsx:355-374`](../../src/components/learning/LessonArticle.tsx)
- **改善案**: `localStorage` で閉じられるようにする（または初回3レッスンだけ）。SP は文言を「長押しで選択すると」に変える。

### CL-B35 AIパネルを閉じると入力途中の質問文が消える 【B / 中 / 全幅】
- **目的 / 操作**: 質問を打っている途中で本文を見返したくなり、Esc か × でパネルを閉じる
- **実際**: パネルは `support.open && <SupportPanel>` の条件レンダリングでアンマウントされるため、**打っていた質問文が失われる**。メモの下書きは自動保存されるので、同じ画面で挙動が2種類ある。
- **根拠**: [`learning/LearningWorkspacePage.tsx:539-567,392-402`](../../src/components/learning/LearningWorkspacePage.tsx)
- **改善案**: 入力中の文字列を親（`LearningWorkspacePage`）に持つ。または閉じるときに残す。

### CL-B36 レッスン画面から他の柱へ直接戻れない 【B / 中 / 全幅】
- **実際**: この画面は `AppHeader` を描かないので、サイドバーも下部ナビも無い。マイページ・AIコーチ・マイノートへ行くには「コースに戻る」→ サイドバー、の2手。トップバーの `WEBCOACH` ワードマークは押せず（`<span>`）、900px 未満では `display:none` で消える。
- **根拠**: [`learning/LessonTopBar.tsx:56-61`](../../src/components/learning/LessonTopBar.tsx) / [`src/index.css:478-484`](../../src/index.css)
- **改善案**: ワードマークを `/mypage` へのリンクにする（出口が1つ増えるだけで、押せるものは1つ増える程度に収まる）。

### CL-B37 移行教材ではなぞっても何も出ないが、理由がどこにも書かれていない 【B / 中 / 全幅】
- **実際**: Moodle フォールバック教材（iframe）では選択操作が無効（`selectionEnabled = doc.source === 'structured'`）。しかしその教材でも「ドラッグで選択すると…」の帯は**出ないだけ**で、AIパネル側は `disabled` になる。ユーザーには「壊れている」と見える。
- **根拠**: [`learning/LearningWorkspacePage.tsx:121-122,552`](../../src/components/learning/LearningWorkspacePage.tsx) / [`learning/LessonArticle.tsx:355`](../../src/components/learning/LessonArticle.tsx)
- **改善案**: フォールバック教材では「この教材は文章の選択に対応していません。右下からAIに質問できます」を1行出す。

### CL-B38 狭い画面で「5 / 9」だけが残り、何の数かが分からない 【B / 低 / 390px】
- **実際**: 900px 以下で進捗バーが消え、代わりに `aria-hidden` の高さ3pxの帯になる（ラベル無し）。600px 以下では「レッスン」の語が `display:none` になり **「5 / 9」** だけが残る。
- **根拠**: [`src/index.css:478-489`](../../src/index.css) / [`learning/LessonTopBar.tsx:130-133,159-169`](../../src/components/learning/LessonTopBar.tsx)
- **改善案**: 狭い画面では「5/9本目」と単位を残す。

## 学習時間の自動記録（全画面常駐）

### CL-B39 ホイールでのスクロールが「操作」と数えられず、読書時間が削られる 【B / 高 / 全幅】
- **目的 / 操作**: レッスンを30分、マウスホイール（またはトラックパッド）だけでスクロールして読む
- **期待**: 30分が学習時間として残る
- **実際**: 放置検知が見ているのは `pointerdown` / `keydown` / `visibilitychange` の3つだけ。**スクロール・ホイール・マウス移動・タッチ移動は観測していない。** 30分クリックしないまま読み続けると「学習を続けていますか？ 最後の操作から30分ほど経っています」が中央モーダルで割り込み、しかも先に `s.trimToLastActive()` が走って**実際に読んでいた時間が記録から切られる**。
- **根拠**: [`shared/StudySessionHost.tsx:119-136,140-147`](../../src/components/shared/StudySessionHost.tsx)
- **改善案**: `bump` の購読に `wheel` / `scroll`（本文カラム） / `touchmove` / `mousemove` を追加する（既に `ACTIVE_THROTTLE_MS = 10_000` でスロットルされているので負荷は増えない）。関連タスク `STATE-010`。

### CL-B40 打診を3回断ると、その日は記録を始める手段が UI から消える 【B / 高 / 全幅】
- **目的 / 操作**: 朝は記録したくなかったが、夜になって記録しながら学習したくなった
- **実際**: `PROMPT_DECLINE_LIMIT = 3` に達すると打診は出ない。常設の「学習時間を記録する」ピルは撤去済み（実装コメントに経緯あり）ため、**開始の入口が打診しか無く、その打診が止まっている。** 3回目の副ボタンは正直に「今日はもう聞かない」と書いてあるが、**取り消す手段が用意されていない。**
- **根拠**: [`shared/StudySessionHost.tsx:37-58,172,260`](../../src/components/shared/StudySessionHost.tsx) / [`shared/StudySessionIndicator.tsx:186-193`](../../src/components/shared/StudySessionIndicator.tsx)
- **改善案**: 常設ピルを戻さずに、`/study-log` の中に「いまから記録を始める」を1つ置く（学習記録を見に来た人が自然に押せる場所で、学習の邪魔にならない）。

### CL-B41 学習ページに着くたび中央モーダルで答えを求められ、断るボタンが小さい 【B / 中 / 全幅・390px】
- **実際**: 打診は `z-[85]` の中央モーダル＋暗幕で、`/courses`・`/course/:id`・`/ai-coach`・`/coaching` に着いた瞬間に出る（背景クリックでは閉じない）。カタログを眺めに来ただけでも答えさせられ、カテゴリごと最大3回まで繰り返す。副ボタン「あとで」は**高さ28px・文字12px・薄いグレー**で、タップ最小44pxに届かない。
- **根拠**: [`shared/StudySessionPrompt.tsx:53,109-127`](../../src/components/shared/StudySessionPrompt.tsx) / [`shared/StudySessionHost.tsx:163-174`](../../src/components/shared/StudySessionHost.tsx) / [`src/utils/studyCategory.ts`](../../src/utils/studyCategory.ts)（`isStudyEntryPath`）
- **改善案**: 副ボタンを 44px 以上にして色を `--dc-text-muted` へ。打診自体は「レッスン本文を開いたとき」に絞り、一覧系（`/courses`）では出さない。

### CL-B42 記録ピルが既定で右上に重なる／戻せない／0分に見える 【B / 中 / 全幅】
- **実際**: ドラッグで動かせるが3つ不便がある。
  1. 既定位置が右上固定（`top:16 right:16`）で、各画面の見出し・「詳しく見る」等に重なる。
  2. 位置は `localStorage`（`wc-study-pill-pos`）に残るが、**既定に戻す手段が無い**。
  3. 表示が `{minutes}分` なので、最初の1分間は「学習中 0分」。記録されているか不安になる。
  4. ポインタ操作専用でキーボードでは動かせない。
- **根拠**: [`shared/StudySessionIndicator.tsx:25-28,158,264,294-297`](../../src/components/shared/StudySessionIndicator.tsx)
- **改善案**: ポップオーバー内に「位置を戻す」を1行足す。1分未満は `0:42` のように秒を出すか「記録中」だけにする。

### CL-B43 学習終了カードが Esc で閉じない 【B / 中 / 全幅】
- **実際**: 背景クリックは閉じる（＝記録されない）のに Esc は効かない。閉じたときの案内は最下部の12px 1行「閉じるとタイマーに戻ります（記録はされません）」。他のポップは Esc で閉じるので作法が食い違う。
- **根拠**: [`focus/FinishSessionModal.tsx:142-164,383-392`](../../src/components/focus/FinishSessionModal.tsx) / `CL-A17`
- **改善案**: 共通 `Modal` に寄せて Esc・フォーカストラップ・スクロール固定を揃える。

### CL-B44 学習時間の修正が黙って丸められ、「修正」がボタンに見えない 【B / 低 / 全幅】
- **実際**: `type="number"` に大きい値を入れると `maxMinutes`（自動計測 + 上限）に**メッセージ無しで丸められる**。上限の説明は編集中しか出ない。「修正」は `t.chip` に `border:none` を当てたもので、ラベルに見える。
- **根拠**: [`focus/FinishSessionModal.tsx:116,240-244,272-280,352-356`](../../src/components/focus/FinishSessionModal.tsx)
- **改善案**: 「修正」に鉛筆アイコンを付ける。上限は編集前から出し、丸めたときは理由を1行出す。

## /study-log（学習記録）

### CL-B45 似た名前の数字が違う期間で隣に並ぶ 【B / 中 / 全幅】
- **目的 / 操作**: 「1週間」タブで3週前を見る
- **実際**: KPI の1枚目は「この週の学習時間」（＝表示中の週）だが、3枚目の「今週の学習時間」は常に今週。**3週前を見ているのに「今週」の数字が隣にある。**
- **根拠**: [`studyLog/StudyRecordPanel.tsx:24-28,329-332`](../../src/components/studyLog/StudyRecordPanel.tsx)
- **改善案**: 週を遡っているあいだは「今週の学習時間」を隠す（または「今週（参考）」と明記する）。

### CL-B46 前週・次週ボタンが 24×24px 【B / 中 / 390px】
- **実際**: タップ最小 44px の半分強。しかも中身は `‹` `›` のテキスト（`CL-A18`）。スマホで週を遡るのが難しい。
- **根拠**: [`studyLog/StudyRecordPanel.tsx:338-382`](../../src/components/studyLog/StudyRecordPanel.tsx)
- **改善案**: 36px（SP は 44px）にして lucide の `ChevronLeft/Right` を使う。

### CL-B47 差が0でも「↑ 0分」の緑、比較対象が無くても「増えた」に見える 【B / 中 / 全幅】
- **実際**: `delta >= 0` で緑＋↑なので、**前期間と同じ（0分差）でも増加の緑**。さらに前期間のデータが無いとき `prevMinutes = 0` なので、期間合計そのものが増加分として表示される（実際には比較できていない）。
- **根拠**: [`studyLog/StudyRecordPanel.tsx:264,395-413`](../../src/components/studyLog/StudyRecordPanel.tsx)
- **改善案**: 0 は中立色で「±0分」、前期間のデータが無いときは「—」。

### CL-B48 30日・3ヶ月タブでは値がまったく読めない 【B / 中 / 390px・全幅】
- **実際**: この2タブは値ラベルを出さない設計（`label: null`）で、値は `title` 属性だけ。**タッチ端末では1本も数字が読めない。**
- **根拠**: [`studyLog/StudyRecordPanel.tsx:201,232,533`](../../src/components/studyLog/StudyRecordPanel.tsx) / `CL-B13`
- **改善案**: タップで値を出す（選択中の棒の値をグラフ上部に表示する）。

### CL-B49 0分の日と1分の日が見分けられない 【B / 低 / 全幅】
- **実際**: `Math.max(b.minutes > 0 ? 3 : 2, ...)` なので 0分 = 2px、1分 = 3px。差が1px。
- **根拠**: [`studyLog/StudyRecordPanel.tsx:526-528`](../../src/components/studyLog/StudyRecordPanel.tsx)

## /notes（マイノート）

### CL-B50 ノートを書いている途中で、押した覚えのない遷移に連れ出される 【B / 高 / 全幅】
- **目的 / 操作**: ノートを開いて「クリップを追加」を押す
- **期待**: このノートにクリップを足す方法が分かる
- **実際**: トーストを1つ出したあと、**確認も取り消しも無く教材ページ（または `/courses`）へ即座に `navigate` する**。書いていたノートから離脱する。
- **根拠**: [`notes/MyNotesPage.tsx:163-177`](../../src/components/notes/MyNotesPage.tsx)
- **改善案**: その場に説明を出すだけにし、遷移は「教材を開く」という別のボタンに分ける。関連タスク `SCREEN-008` / `FLOW-006`。

### CL-B51 ブラウザの戻るでノート一覧に戻れない 【B / 中 / 全幅】
- **実際**: ノートの開閉が `setSearchParams(..., { replace: true })` なので履歴が積まれない。**ノートを開いて戻るを押すと、一覧ではなく直前の別ページ（マイページ等）へ飛ぶ。**
- **根拠**: [`notes/MyNotesPage.tsx:61-66`](../../src/components/notes/MyNotesPage.tsx)
- **改善案**: `replace` を外す（教材からの `/notes?note=` 直リンクも壊れない）。

### CL-B52 並び替えボタンのアイコンが絞り込みに見える 【B / 低 / 全幅】
- **実際**: `SlidersHorizontal` は一般に「絞り込み」の記号。しかもすぐ下に本物の絞り込みチップが並んでいるので、役割が入れ替わって見える。
- **根拠**: [`notes/MyNotesPage.tsx:338`](../../src/components/notes/MyNotesPage.tsx)
- **改善案**: `ArrowUpDown` にする。

### CL-B53 絞り込み中に件数が2つ食い違う 【B / 低 / 全幅】
- **実際**: `NoteGrid` に渡す `totalCount` は `list.items.length`（全件）、ページャに渡すのは `filtered.length`（絞り込み後）。
- **根拠**: [`notes/MyNotesPage.tsx:457-476`](../../src/components/notes/MyNotesPage.tsx)

## /coaching

### CL-B54 記録を開いて戻るとページごと離脱する 【B / 高 / 全幅】
- **目的 / 操作**: 過去のコーチング記録を開いて読み、一覧に戻る
- **実際**: 画面の状態（一覧 / 参加中 / 生成中 / 確認 / 取り込み）が `mode` state だけで URL に無い。**ブラウザの戻るを押すとコーチングページごと離脱する**（戻れると思って押す人が多い位置）。記録の URL を共有・ブックマークもできない。リロードすると一覧に戻る。
- **根拠**: [`CoachingNotesPage.tsx:37-42,90,339-355`](../../src/components/CoachingNotesPage.tsx)
- **改善案**: `?session=<id>&view=review` を URL に持つ（`/notes` が `?note=` で既にやっている作法に合わせる）。関連タスク `SCREEN-010` / `FLOW-009`。

### CL-B55 「参加する」で LMS は記録中になるが、会議が開かないことがある 【B / 中 / 全幅】
- **実際**: `await bffClient.startCoachingSession()` の**後**に `window.open` を呼ぶ。ユーザー操作から離れた非同期後の `window.open` はブラウザのポップアップブロック対象なので、**LMS 側は「記録中」に切り替わったのに会議のタブが開かない**という状態が起きる。ブロックされたことの表示も、開き直すリンクも無い。
- **根拠**: [`CoachingNotesPage.tsx:281-298`](../../src/components/CoachingNotesPage.tsx)
- **改善案**: セッション開始前に開く。または `RecordingStatus` に「会議を開く」リンクを常設する（`coaching/RecordingStatus.tsx:55` に既に `target="_blank"` のリンクがあるので、そこに寄せられる）。

### CL-B56 モードが変わるとコンテンツ幅が跳ねる 【B / 中 / 1920px】
- **実際**: `--wc-page-max` が一覧 1080px、それ以外 860px。記録を開くたびに本文とヒーローの幅が変わる。
- **根拠**: [`CoachingNotesPage.tsx:384`](../../src/components/CoachingNotesPage.tsx) / `CL-A16`

### CL-B57 取得に失敗すると画面に何も残らない 【B / 低 / 全幅】
- **実際**: 読み込み中は「読み込み中…」の1行。取得失敗はトースト（3秒で消える）だけで、**その後の画面は「次回の予定なし・履歴なし」と見分けが付かない**。再試行のボタンも無い。
- **根拠**: [`CoachingNotesPage.tsx:126-130,402-404`](../../src/components/CoachingNotesPage.tsx) / `CL-A04`・`STATE-007`
- **改善案**: `ErrorState`（README §8 の不在部品）を置いて再試行を出す。

## /account-settings, /profile

### CL-B58 ログアウトが確認なしで、しかも一番読みにくい文字 【B / 中 / 全幅】
- **実際**: 右下に `--dc-text-subtle`（2.68:1）の13pxテキストで「アカウントからログアウトする」。押すと**確認なしで即ログアウト**。破壊的操作としては弱すぎ、可読性としては足りない、という両方の問題が同じ1箇所に出ている。
- **根拠**: [`AccountSettingsPage.tsx:485-500`](../../src/components/AccountSettingsPage.tsx) / `CL-A05`
- **改善案**: 文字色を `--dc-text-body` にし、押したら確認を1回出す。関連タスク `CONSISTENCY-007`。

### CL-B59 確認コードが届かないときの逃げ道が無い 【B / 中 / 全幅・390px】
- **実際**: メール変更の確認コード欄に再送ボタンも「届かないとき」の案内も無い。`type="text"` なのでスマホで数字キーパッドが出ない。「アドレスを直す」で戻ると入力済みのコードは捨てられる。
- **根拠**: [`AccountSettingsPage.tsx:364-392`](../../src/components/AccountSettingsPage.tsx)
- **改善案**: `inputMode="numeric" autoComplete="one-time-code"` を付け、「コードを再送する」を足す。

### CL-B60 エラーだけ読み上げされない 【B / 低 / 全幅】
- **実際**: 成功の `notice` には `role="status"` があるのに、エラーの表示は素の `<div>`。同じ画面で片方だけ読み上げられる。
- **根拠**: [`AccountSettingsPage.tsx:252,357,378,471`](../../src/components/AccountSettingsPage.tsx)

### CL-B61 同じ `.dc-page-main` なのに左余白がマイページと違う 【B / 低 / 1920・1520px】
- **実際**: `padding: '44px 36px 24px'` の直書き。マイページは `var(--dc-sp-page-y) var(--dc-sp-page-x)`（幅に連動）。並べると見出しの開始位置がずれる。
- **根拠**: [`AccountSettingsPage.tsx:244`](../../src/components/AccountSettingsPage.tsx) ↔ [`MyPage.tsx:137`](../../src/components/MyPage.tsx)

## /help/manual, /help/faq

### CL-B62 マニュアルとFAQが現行の画面と食い違っている 【B / 高 / 全幅】
- **目的 / 操作**: 学習時間が記録されていないので、FAQ を読んで原因を調べる
- **実際**: 本文は `HelpPage.tsx` 内の定数（手動同期）で、**現行 UI と 10 箇所以上ずれている。** 読んだ人は存在しない機能を探すことになる。

  | ヘルプの記述 | 実際 |
  |---|---|
  | 「4. 集中して学ぶ（集中ブース）」1節まるごと | 集中ブースは廃止（`/focus-booth` は `/study-log` へリダイレクト） |
  | 「学習時間は集中ブースや教材画面でタイマーを使ったときに記録されます」 | 記録は打診モーダル（`StudySessionPrompt`）から始まる |
  | 「レッスン画面は3ペイン構成です。左の目次、中央の本文、右のサポート」 | 左の目次は廃止（`CL-B30`） |
  | 「画面の主役は『続きからはじめる』です」 | ボタンの文言は「続きから学習する」 |
  | 「上部の帯には、今週の学習時間・累計学習時間・修了レッスン数が出ます」「『学習記録を見る』から」 | 学習記録カードの中へ移動。リンク名は「詳しく見る」 |
  | 「決まった目標がトップの『次回コーチングまでの目標』に入ります」 | そのカードはマイページから撤去済み |
  | 「STEPごとに単元がまとまっています」「『はじめる』『続きから』『復習する』」 | CHAPTER 表記。文言は「はじめる」「再開する」「もう一度見る」 |
  | 「ロードマップはコーチングの画面にある『学習計画 / 現在地』から開きます」 | その入口は存在しない（`CL-B64`） |
  | 「今日ぶんが未達成のときは、あと何分で成立するかがトップに出ます」 | 出ていない |
  | 「サイドバーの左端のロゴを押すと、幅を折りたたんで本文を広くできます」 | 開くのは専用ボタン。ロゴは閉じる側 |
  | 「サイドバー最下部の自分の名前を押すと、個人設定が開きます」 | 画面名は「アカウント設定」 |
- **根拠**: [`help/HelpPage.tsx:27-177`](../../src/components/help/HelpPage.tsx) / [`routes/index.tsx:243-246`](../../src/routes/index.tsx)（`/focus-booth` のリダイレクト）
- **改善案**: 実画面に合わせて全面改稿。合わせて **README に「UI を直したらヘルプ本文も直す」を運用ルールとして書く**（同じずれの再発防止）。

### CL-B63 ヘルプ自体が PC の展開サイドバーからしか行けない 【B / 中 / 390px】
- `CL-A11`。`/help/manual` `/help/faq` へのリンクはパネル下部の補助リンクだけ（`hidden sm:flex` の中）。
- **根拠**: [`shared/AppHeader.tsx:574-577`](../../src/components/shared/AppHeader.tsx)

## 到達できない画面

### CL-B64 学習ロードマップにリンクが1本も無い 【B / 高 / 全幅】
- **実際**: `/learning-plan`（388行）と `/learning-plan/setup`（275行）への遷移を持つ部品は `mypage/RoadmapStrip.tsx` だけで、**その部品はどこからも import されていない**（import 0 の死んだ部品）。つまり UI から到達できない。
  それにもかかわらず ①サイドバーの「コーチング」は `/learning-plan` 配下で点灯する判定を持ち ②ヘルプが使い方（8問・約3分）を説明している。**「あると書かれているのに無い」状態。**
- **根拠**: `grep -rn "learning-plan" src` → 実リンクは [`mypage/RoadmapStrip.tsx:98,140`](../../src/components/mypage/RoadmapStrip.tsx) のみ / `RoadmapStrip` の import 元 = 0 / [`shared/AppHeader.tsx:106-107`](../../src/components/shared/AppHeader.tsx) / [`help/HelpPage.tsx:91-99`](../../src/components/help/HelpPage.tsx)
- **改善案**: **どちらかに決着させる。** (a) コーチングページに入口を作る（ヘルプの記述どおり）か (b) 機能を凍結してサイドバーの点灯判定とヘルプ§7も消す。関連タスク `SCREEN-009` / `STATE-002` / `FLOW-007` / `FLOW-008`（これらのレビュータスクは現状 URL 直打ちでしか実施できない）。

### CL-B65 バッジ画面にもリンクが無い 【B / 中 / 全幅】
- **実際**: `/badges`（212行）へのリンクを持つのは `RecommendBadgeCard` と `ProfileSection` の2つで、**どちらも import 0**。
- **根拠**: [`mypage/RecommendBadgeCard.tsx:43`](../../src/components/mypage/RecommendBadgeCard.tsx) / [`mypage/ProfileSection.tsx:79`](../../src/components/mypage/ProfileSection.tsx)
- **改善案**: `CL-B64` と同じ判断を並べて行う。関連タスク `STATE-012`。

### CL-B66 `mypage/` に import 0 の部品が9件残っている 【B / 低 / 全幅】
- **実際**: `StatsStrip` `QuestCard` `CampaignBanner` `LearningStreakCard` `NextCoachingCardContainer` `NextBadgeCard` `RecommendBadgeCard` `ProfileSection` `GuildLobby` が到達不能。レビューの母数とコード検索のノイズを増やし、`CL-B64/B65` のような「生きているのか死んでいるのか分からない」判断を毎回発生させる。
- **根拠**: 各ファイルの import 元を `grep` で確認（すべて 0）
- **改善案**: 凍結ディレクトリへ移すか削除する。`screen-inventory.csv` の `LEG-01`〜`05` と同じ扱いにする。

---

# 参考：直す順番の提案

`README.md` §1 の「A を画面ごとに直すと同じ修正が画面数ぶん発生する」に従い、**A（土台）を先に**置いた。

| バッチ | 中身 | なぜこの順か |
|---|---|---|
| **1 土台** | `CL-A02` box-sizing → `CL-A03` フォーカスリング → `CL-A05` コントラスト → `CL-A06` 文字下限 → `CL-A04` トースト → `CL-A07` lang → `CL-A19` Inter | ここを先にやらないと B の修正が再発する。`/dev/catalog` で確認できるものが多い |
| **2 到達性と嘘の解消** | `CL-A09` 死んだ `<header>` 削除＋問い合わせ移設 → `CL-A10` 通知の決着 → `CL-A11`/`CL-A12` SPナビ → `CL-B64`/`CL-B65` ロードマップ・バッジの決着 → `CL-B62` ヘルプ改稿 → `CL-A08` タブタイトル | 「押せない・行けない・説明が嘘」は工数が小さく効果が大きい。`CL-B62` は `CL-B64` の判断が出てからでないと書けない |
| **3 壊れている体験** | `CL-A01` `/courses` の scale 廃止 → `CL-B39` スクロール判定 → `CL-B40` 記録の入口 → `CL-B24` N+1 と初期表示 → `CL-B32` 解説ポップオーバー → `CL-B50` ノートの強制遷移 → `CL-B54`/`CL-B55` コーチング → `CL-B51` 戻る | 影響範囲が大きいので土台のあと |
| **4 細部** | `CL-A14` 用語統一 → `CL-A15`/`CL-A16` フッターと幅 → `CL-A17` 共通 Modal → `CL-A18` アイコン → `CL-A20` 空状態 → `CL-A21` 16px 入力 → 残りの `CL-B*` | 共通部品（Modal / EmptyState / ErrorState）を作ってからまとめて直す |

## 既存タスクとの対応

下記は `review-wbs.csv` のタスクで**先に拾えていたはずの内容**。重複起票ではなく、実施時の当たりとして使う。

| レビュータスク | 対応する指摘 |
|---|---|
| `CONSISTENCY-001`（ボタン） | `CL-A03` `CL-B20` |
| `CONSISTENCY-002`（現在地） | `CL-B31` `CL-B36` `CL-B38` |
| `CONSISTENCY-003`（カード・空状態） | `CL-A20` `CL-B22` |
| `CONSISTENCY-004`（用語） | `CL-A14` `CL-B19` `CL-B33` |
| `CONSISTENCY-005`（モーダル・トースト） | `CL-A04` `CL-A17` `CL-B43` |
| `CONSISTENCY-006`（色・余白・アイコン） | `CL-A05` `CL-A15` `CL-A16` `CL-A18` `CL-B61` |
| `CONSISTENCY-007`（アカウント導線） | `CL-A11` `CL-A13` `CL-B58` |
| `DEVICE-001`〜`006`（端末） | `CL-A01` `CL-A11` `CL-A12` `CL-A21` `CL-B18` `CL-B46` `CL-B48` |
| `STATE-006`（ローディング） | `CL-A20` `CL-B24` `CL-B57` |
| `STATE-007`（エラー） | `CL-A04` `CL-B04` `CL-B57` `CL-B60` |
| `STATE-010`（タイマー全状態） | `CL-B39` `CL-B40` `CL-B41` `CL-B42` |
| `STATE-012`（バッジ画面） | `CL-B65` |
| `SCREEN-009` / `STATE-002` / `FLOW-007` / `FLOW-008` | `CL-B64`（現状 URL 直打ちでしか実施できない） |

`review-findings.csv` に入っている 2 行（`FLOW-002-01` / `CONSISTENCY-001-01`）は
備考に「例です」と書かれた雛形なので、重複としては扱っていない。
なお `FLOW-002-01`（「続きからはじめる」を押したらコーストップに着いた）は**現在の実装では起きない**。
マイページの「続きから学習する」は `openLesson` でレッスン本文へ直行し、コーストップへ行くのは
隣の「レッスンを選び直す」になっている（[`mypage/StudyChallengeCard.tsx:360,382`](../../src/components/mypage/StudyChallengeCard.tsx) /
[`MyPage.tsx:128-129`](../../src/components/MyPage.tsx)）。雛形を実データに置き換えるときに削ってよい。
