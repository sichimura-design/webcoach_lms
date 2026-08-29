# 教材学習ワークスペース 設計書

## 目的

テキスト教材を中心に学びながら、教材の閲覧・AIコーチへの質問・画像を使った添削・自分のメモ・教材のクリップ・AI回答の保存を**同じ画面で**行える学習環境をつくる。

機能を増やしても教材の表示領域を圧迫しないよう、左（教材目次）と右（AI・メモ）を**必要なときだけ開閉できる並列パネル**にし、教材領域が自動で伸縮する構成にした。

今回のスコープはフロントエンド実装のみ。バックエンドは変更禁止のため、新規APIはすべて MSW モックで提供する（[mock-development.md](./mock-development.md)）。

---

## 設計上の判断

### 判断1: 既存 CourseContentPage を全面書き換えた（別ページを新設しなかった）

旧 `CourseContentPage.tsx`（1017行）は Moodle の `mod/page` HTML を **iframe srcdoc** に流し込んでいた。この構造では要件が成立しない。

| 要件 | iframe だと成立しない理由 |
|---|---|
| クリップの位置保存・復元 | 親から iframe 内の `Range` を扱えない |
| AI回答の「参照した教材箇所」 | 教材にブロック境界が存在せず、参照先を指せない |
| 教材検索の優先順位（§8） | 「選択文章を含むブロック」「同じ見出し内」という単位が取れない |
| パネル開閉に応じた本文幅の追従 | 右カラムが固定幅で、開閉の概念がなかった |

URLは `/course/:courseId?module=<lessonId>` のまま据え置き、中身を差し替えた。既存のディープリンク（マイページの「続きから」、コーストップの冒険マップ）が全て生き続けるため。

**却下した案**: `/learn/...` に新ページを作って併存させる。リスクは小さいが、同じ「教材を読む」導線が2つ並ぶことになり、どちらが正なのか運用で判断できなくなる。

### 判断2: 教材を「ブロック配列」で持つ

`LessonDoc.blocks[]` の `LessonBlock.id` が、クリップ位置・AI参照箇所・教材検索単位の**共通アンカー**になる。DOM側は `LessonBlockView` が `data-block-id` / `data-heading` を必ず付与し、`useTextSelection` がそこから解決する。この1点でクリップとAI根拠の両方が成立する。

### 判断3: AI回答は既存の `/webcoach/ai` を使わず、新しいI/Fを定義した

既存の `bffClient.sendAIMessage` は素のテキストしか返さないため、「結論／教材の根拠／今回のケースへの当てはめ／次にやること／参照箇所」という構造も、参照 blockId も持てない。`POST /webcoach/lesson-ai` を新設し、教材検索の優先順位をモック側で**実際にスコアリング実装**した。「それらしい文章を返すだけ」にすると、本番でLLMに置き換えたときに何が要件だったのか分からなくなるため。

同様に `useAiChat` も使っていない。グローバルな `chatStore` を AppHeader のドロワーと共有していて、レッスンをまたいで会話が混ざるため。

### 判断4: モックOFF時は実Moodle教材へ縮退する

master（本番）ではモックが読み込まれず新APIは404になる。`useLessonDoc` がこれを捕捉し、`getCourseContent()` から**1ブロックだけの LessonDoc**（`source: 'moodle-fallback'`）を組み立てて、従来と同じ iframe 描画にフォールバックする。

**この縮退モードでは以下が無効になる**（`source` で判定して UI を出さない）:
- 選択ツールバー（💡解説／AIに質問／クリップ）
- クリップの保存・位置復元
- AI回答のブロック単位の根拠提示

代わりに従来の AppHeader「AIに解説」（iframe からの `postMessage`）が働く。**本番で新UXがフル機能で動くわけではない**点は運用上の前提として共有が必要。

---

## 全体アーキテクチャ

### レイアウト（2026-08 改訂・SCREEN-004）

**旧構成**: 目次・本文・サポートの3ペインをグリッドの列として開閉し、4状態（左右とも閉／左のみ／右のみ／左右とも開）を作っていた。上下分割（split）モードもあった。

**廃止した理由**: UI/UXレビューで「ごちゃごちゃしている」と指摘された。要因は
「LMS全体のサイドバー」「開閉できるコース目次」「開閉できるAI/メモ」が
同時に本文と場所を取り合っていたこと。やれることが多いほど集中が切れる。

**現構成**: 常設は本文だけ。

- **LMSのサイドバーを描かない** — `LearningWorkspacePage` は `AppHeader` をレンダリングしない。
  `body.with-sidebar` の余白は AppHeader 自身の effect が付けているので、描かなければ消える。
  SP下部ナビも AppHeader 内のマークアップなので一緒に消える。
- **目次のドロワーを廃止** — `LessonNavDrawer.tsx` は削除。トップバーの「← コースに戻る」1本にした。
  レッスン間の移動は本文フッターの prev/next で行う。目次データ（outline）は
  「レッスン N / 総数」の表示に使うので取得は続けている。
- **AI／メモはオーバーレイ** — 右下の常設ピル `LessonFloatingActions.tsx` から開く。
  `SupportPanel.tsx` は列ではなく `position: fixed` の器になった（PC=右ドロワー420px、SP=88dvhのボトムシート）。
  `PanelResizer.tsx` は削除。`AiCoachPane` / `MemoPane` の中身は変更していない。
- **PC/SPの分岐をCSSへ** — `useIsDesktop`（`window.innerWidth >= 1024`）を削除。
  ドロワーとボトムシートの差は `index.css` の `.wc-lesson-support` のメディアクエリで表現する。

z-index: フローティングピル 60 / オーバーレイ 70-71 / 選択ツールバー 80（選択UXが最前面）。

### 既存シェルとの噛み合わせ

- `body.learning-workspace { overflow: hidden }` を `useEffect` で付け外し（アンマウント時に必ず除去）
- `body.learning-immersive` を同時に付ける。AppHeader を描かないことの後始末で、
  `index.css` にある「SP下部ナビ64px」前提の `body { padding-bottom }` と
  `.wc-learning-shell { height: calc(100dvh - 64px) }` を打ち消す
- `.wc-learning-shell { height: 100dvh }`

**AppHeader との衝突**: AppHeader は document 全体の `mouseup` を見て「AIに解説」ボタンを出すため、選択ツールバーと二重表示になり得る。本文コンテナの `data-lesson-article` を見て AppHeader 側で早期リターンさせてある。この画面では AppHeader 自体を描かないので現状は発火しないが、他画面のために残している。

### 状態の置き場所

| 種類 | 置き場所 | 理由 |
|---|---|---|
| AI/メモのオーバーレイ（開閉・タブ） | `LearningWorkspacePage` の `useState` | **永続しない**。開いたまま離脱すると次回教材がパネルで覆われた状態から始まり、それが「ごちゃごちゃ」の正体だった |
| 教材本文・目次 | モックAPI（`useLessonDoc`） | 将来サーバ管理 |
| メモ下書き（レッスン単位） | モックAPI（`useNotes`）→ ハンドラ内で localStorage | 実API化がハンドラ削除だけで済む |
| ノート（器＋ブロック） | モックAPI（`useNote` / `useNoteList`）→ `noteHandlers.ts` で localStorage | 同上 |
| 取り込み先ノート（レッスン→ノート） | `store/noteTargetStore.ts`（zustand + persist） | 端末ごとの好み。サーバへ送る意味がない |
| AI会話 | フック内のローカル状態（レッスン単位） | 教材ごとの文脈を混ぜない |

`store/learningWorkspaceStore.ts`（`navOpen` / `supportOpen` / `supportWidth` / `splitPercent` / `supportMode`）は削除した。
既存端末に残る localStorage キー `webcoach-learning-workspace` は読み手がいないので無害。

### 本文の組み方（2026-08 改訂）

- 中央1カラム（`CONTENT_MAX_WIDTH` = 900px）。白カードの枠は外して全面化した
- ヘッダーは 学習タイプ（赤の小見出し）→ 中央寄せH1＋短い赤線 → リード文 → 読了目安
- 本文は `lessonSections.groupByHeading()` で章にまとめ、`01` `02` の赤丸バッジ＋章見出しを出す。
  **APIにフィールドは足していない** — `LessonBlock.heading` が連続一致するブロックを1章として数えている
- `callout` / `task` / `summary` の囲みには `💡 ポイント` `✓ チェックしてみよう` `📝 まとめ` のラベルを付けた
- 章立ては `doc.source === 'structured'` のときだけ。`moodle-fallback` は従来どおり

🔴 `LessonBlockView` の `<section>` が持つ `id` / `data-block-id` / `data-heading` / `scrollMarginTop` は
不変条件。`useTextSelection` / `clipHighlight` / `jumpToBlock` / 読書位置の IntersectionObserver が
すべてこれを辿る。章のラッパーには `data-block-id` を付けないこと。
`scrollMarginTop` は固定トップバーができたため 20 → 72 に上げた。

---

## API 仕様（バックエンドチームへの引き渡し対象）

すべて `frontend/src/mocks/lessonHandlers.ts` に MSW 実装がある。型は `frontend/src/types/lesson.ts` / `frontend/src/types/notes.ts`。

### `GET /api/webcoach/courses/{courseId}/outline`
左の教材目次。セクション → レッスン（`lessonId` / `title` / `minutes` / `state`）と `progressPercent`。

### `GET /api/webcoach/courses/{courseId}/lessons/{lessonId}`
教材本文。

```ts
{
  courseId, courseName, lessonId, title, lead, goals[], estimatedMinutes,
  blocks: [{
    id,            // 安定ID。クリップとAI参照のアンカー。教材改訂でも変えないこと
    heading,       // 属する見出し
    kind,          // text | figure | video | example | callout | quiz | task | summary
    html,          // 表示用（フロントで DOMPurify.sanitize する）
    plain,         // 検索・AI根拠付け用のプレーンテキスト
    quiz?, media?
  }],
  summary, nextAction, prev, next, source: 'structured'
}
```

**`blocks[].id` は永続IDとして扱うこと。** クリップと保存済みAI回答がこのIDを参照しているため、教材を改訂しても既存ブロックのIDは変えない。

### `POST /api/webcoach/lesson-ai`

```ts
// request
{ courseId, lessonId, blockId, heading,
  selectedText, contextBefore, contextAfter,
  question, image?, history[], mode: 'chat' | 'brief' }

// response
{ conclusion, basis, apply, next,
  sources: [{ blockId, heading }],
  groundedInMaterial: boolean,
  generalNote: string | null }
```

**教材検索の優先順位（要件§8）** — モックは以下のスコアリングで実装済み。本番のRAG実装もこの順序を守ること。

| 優先度 | 対象 | モックの判定 |
|---|---|---|
| 1 | 選択された文章 | `block.plain` が `selectedText` を含む |
| 2 | 選択文章を含む教材ブロック | `block.id === blockId` |
| 3 | 同じ見出し内の前後文章 | `block.heading === heading` |
| 4 | 同レッスン内の定義・手順・具体例 | 検索語ヒット数 + `kind` が example/callout/task ならボーナス |
| 5 | 同コース内の関連教材 | 他レッスンのブロックを検索語でヒット |
| 6 | 一般知識 | 上記すべて0件 → `groundedInMaterial: false` + `generalNote` |

日本語は分かち書きがないため、検索語はカタカナ／漢字／英数字の2文字以上の連続を切り出して照合している（`extractTerms`）。本番では形態素解析またはベクトル検索に置き換える。

**教材に答えがない場合**、AIが教材の内容であるかのように回答してはならない。`groundedInMaterial: false` を返し、UIは警告バナー付きで「この教材だけでは判断できません。以下は教材外の一般的な補足です。」と明示する。

### ノート系（2026-08 改訂・SCREEN-008）

**旧**: `NoteItem` 1種類（`kind: 'memo' | 'clip' | 'answer'`）を時系列に並べる平坦な履歴。

**現**: 器（`Note`）＋中身（`NoteBlock`）。「ユーザーが自分でノートを作成し、その中に文章・
クリップ・AI回答を自由に追加して育てていける自由帳」というレビュー要件に合わせた。
実装は `mocks/noteHandlers.ts`（`lessonHandlers.ts` から分離）、型は `types/notes.ts`。

| メソッド | パス | 用途 |
|---|---|---|
| GET / PUT | `/api/webcoach/lesson-notes/{lessonId}` | 教材単位のメモ**下書き**（500msデバウンスで自動保存）。ノートとは別物 |
| GET | `/api/webcoach/notes?q=&sort=&favorite=&lessonId=` | ノート一覧（`NoteSummary[]`＝ブロックを持たない軽量表現） |
| POST | `/api/webcoach/notes` | ノート作成 |
| GET | `/api/webcoach/notes/{id}` | 1件（ブロック込み） |
| PATCH | `/api/webcoach/notes/{id}` | タイトル・お気に入り |
| DELETE | `/api/webcoach/notes/{id}` | 削除 |
| POST | `/api/webcoach/notes/{id}/blocks` | ブロック追加（text / clip / answer） |
| PATCH | `/api/webcoach/notes/{id}/blocks/{blockId}` | ブロック編集 |
| DELETE | `/api/webcoach/notes/{id}/blocks/{blockId}` | ブロック削除 |
| GET | `/api/webcoach/note-clips?lessonId=` | 教材ハイライト復元用の軽量一覧 |

`note-clips` を分けてあるのは、本文に `<mark>` を当てるためだけに全ノートの全ブロックを
取りに行くのを避けるため。

クリップは `source.blockId` と `source.offset`（ブロック内テキストでの開始位置）を保持し、
これで元の位置へ復元する（この仕組み自体は旧実装から変えていない）。

**保存形式の移行**: localStorage キーは `webcoach-lesson-notes` のまま `schemaVersion: 2` へ。
旧レコードは `mocks/noteMigration.ts` が**レッスン単位で1ノートに畳んで**引き継ぐ。
全部を1つの「未整理」に入れると、新画面を開いた瞬間ノートの中に旧画面（平坦な履歴）が
そのまま入ることになるため。レッスンが解決できないものだけ「未整理」へ。
ストアが空のときはデモノートを3件シードする（真っ白だとレイアウトが確認できない）。

**取り込み先の決め方**: 教材やAIコーチからクリップ／AI回答を入れるとき、
どのノートに入るかは `store/noteTargetStore.ts` が覚える（レッスンID → ノートID）。
未定のときだけ `NoteTargetPicker` を出し、選んだら以後は聞かない。
判断は `hooks/useNoteCapture.ts` の1箇所に集約してある。

### 章立ての単一情報源

`lessonHandlers.ts` の `buildCourseStructure(courseId)` が唯一の章立て定義。`handlers.ts` の `buildSections`（`/moodle/courses/:id/contents`）もここから導出しているため、教材ページの目次とコーストップ・マイページの表示がズレない。

---

## 画面構成（実装済み）

| ファイル | 役割 |
|---|---|
| `components/learning/LearningWorkspacePage.tsx` | シェル。状態の集約のみ |
| `components/learning/LessonTopBar.tsx` | WEBCOACH / ←コースに戻る / コース名 / レッスンN／総数＋位置バー |
| `components/learning/LessonFloatingActions.tsx` | 右下の常設ピル [✨AIに聞く][📝メモする] |
| `components/learning/LessonArticle.tsx` | 中央：見出し・ゴール・章立てしたブロック列・次にやること・前後導線 |
| `components/learning/lessonSections.ts` | heading の連続を章にまとめる純関数（01/02 の番号を作る） |
| `components/learning/LessonBlockView.tsx` | 1ブロック描画。`data-block-id` 付与、確認問題の採点 |
| `components/learning/MoodleFallbackBlock.tsx` | 縮退モードの iframe 描画 |
| `components/learning/SelectionToolbar.tsx` | [💡解説][AIに質問][クリップ] |
| `components/learning/ExplainPopover.tsx` | かんたん解説（`mode: 'brief'`）＋「さらに詳しく質問」 |
| `components/learning/SupportPanel.tsx` | AI/メモのオーバーレイ（PC=右ドロワー / SP=ボトムシート） |
| `components/learning/AiCoachPane.tsx` | 引用・画像添付・構造化回答・[コピー][⭐保存][メモに追加] |
| `components/learning/MemoPane.tsx` | 自動保存エディタ＋保存物一覧＋検索 |
| `components/learning/clipHighlight.ts` | クリップの `<mark>` 復元 |
| `components/learning/moodleContent.ts` | 旧 CourseContentPage から移設した Moodle 描画ヘルパ |
| `components/notes/MyNotesPage.tsx` | `/notes`。左＝ノート一覧／右＝ノート面の2カラム |
| `components/notes/NoteEditor.tsx` | ノート面（紙の質感・タイトル編集・3種の追加ボタン） |
| `components/notes/NoteBlockView.tsx` | 本文／クリップ／AI回答の3ブロック描画 |
| `components/notes/NoteTargetPicker.tsx` | 取り込み先ノートを1度だけ聞く |

フック: `useLessonDoc` / `useLessonCompletion` / `useLessonAi` / `useNotes` / `useTextSelection`

### クリップの位置復元

`blockId` + 選択文章 + `offset` を保存する。復元は `clipHighlight.ts` が、ブロック内テキストノードを `TreeWalker` で走査して `Range` を作り `<mark data-clip-id>` で囲む。オフセットを第一候補にするのは、同じ語が複数回出てくる教材で別の箇所を光らせないため。教材改訂でオフセットがズレた場合は文章検索へフォールバックする。選択が要素境界をまたいでいて `surroundContents` に失敗した場合は無理に囲まない。

---

## 引き継いだ既存挙動（変更していないこと）

`useLessonCompletion` は旧 `CourseContentPage.handleToggleComplete` をそのまま移設した。マイページ・バッジ・EXPに効いているため挙動を変えていない。

1. `markActivityComplete(lessonId, true)`
2. `awardExp('lesson:' + lessonId, EXP_RULES.LESSON_COMPLETE)`
3. `updateResumeCourse(userId, { courseid, progress_percent })`
4. 次のレッスンへ遷移
5. 「完了を取り消す」も維持

Moodle 描画（`getContentType` / `buildSrcdoc` / Shift-JIS の「新しいタブで開く」/ `EXPLAIN_INJECT` の postMessage）も `moodleContent.ts` へロジックそのままで移設した。本番の見え方を変えないため。

---

## セキュリティ・プライバシー

- 教材HTMLは描画前に必ず `DOMPurify.sanitize`。Moodle 由来のHTMLは従来どおり sandbox 付き iframe に隔離する（`<style>` が本体へ漏れないため）。
- 添付画像は dataURL としてブラウザ内に留まる。⭐保存すると localStorage（モック）へ入るため、**実API化のときは保存先とサイズ上限の設計が必要**。
- クリップ・メモは学習者本人のものだけを扱う。他学習者の情報は一切表示しない。

---

## 開発順序と現状

- **Phase 1（完了）**: 構造化教材・AI準拠回答・メモ/クリップ/保存・マイノートをモックで通しで実装。
- **Phase 2（バックエンド）**: 教材のブロック化。Moodle の `mod/page` HTML をブロックへ分解して配信するか、教材CMSを別に持つかの判断が要る。`blocks[].id` の永続化が前提。
- **Phase 3（バックエンド）**: `lesson-ai` の実装。上表の優先順位に沿った教材検索 + LLM。`groundedInMaterial` の判定は必須。
- **Phase 4（バックエンド）**: ノート永続化テーブル。

### バックエンドチームへの引き渡し事項

1. `blocks[].id` は永続IDとして扱う（クリップと保存済みAI回答が参照している）。
2. `lesson-ai` の教材検索優先順位を守る。一般知識は最後の手段で、使ったら `groundedInMaterial: false` を返して明示的に区別する。
3. `NoteItem.image` の保存先（S3など）とサイズ上限を決める必要がある。
4. 目次の `state`（完了/学習中/未学習）は現状 Moodle の completion API と別系統。統合するかを決める。
5. 章立て（レッスンIDとタイトル）は現在フロントの `buildCourseStructure` が持っている。実API化のときは `outline` エンドポイントが唯一の情報源になる。

---

## 検証方法

```bash
cd frontend
npx tsc --noEmit    # 型エラーゼロ
npm start           # 既定でモックON（REACT_APP_ENABLE_MOCKS=true）
```

`/courses` → コース → レッスン と進み、以下を確認する。ショーケース教材は **コース「配色の基本とツール」の「基本の考え方」**（`/course/202?module=202012`）。

- [ ] LMSのサイドバーもSP下部ナビも出ない。左に68px/216pxの余白が残っていない
- [ ] トップバーは ←コースに戻る / コース名 / レッスンN／総数 だけ。押すとコース目次へ戻る
- [ ] 右下のピルから AI／メモ が開く。オーバーレイを閉じるとピルが戻る
- [ ] **リロードするとオーバーレイは必ず閉じた状態で始まる**（開閉を永続しないことの確認）
- [ ] 本文に 01/02 の章バッジが出て、番号が本文の見出しと二重になっていない
- [ ] 💡ポイント／✓チェックしてみよう／📝まとめ の囲みにラベルが付く
- [ ] 本文をドラッグ選択 → ツールバー → 💡解説／AIに質問（引用付き）／クリップ
- [ ] AI回答が 結論／教材の根拠／当てはめ／次にやること／参照箇所 の構造で出る
- [ ] 参照チップをクリックすると該当ブロックへスクロール＋ハイライト
- [ ] 教材にない質問（例:「Reactのuseeffectとは」）で警告バナー＋一般補足の区別表示になる
- [ ] 画像添付／スクショ貼り付け → きっかけチップが出て添削回答が返る
- [ ] メモ自動保存、⭐保存、メモに追加、クリップ「元の場所」ジャンプ
- [ ] `/notes` でノート作成・タイトル編集・本文追記・検索・並び替え・お気に入り
- [ ] 教材でクリップ → 初回はピッカーが出る。2回目以降は同じノートへ黙って入る
- [ ] クリップ／AI回答から「元のレッスンへ」で該当箇所に戻る
- [ ] 旧データがある状態で開くと、レッスンごとに1ノートへ畳まれている
- [ ] 本文末尾の「完了して次へ」で `markActivityComplete` が飛び、EXPが付き、次レッスンへ進む
      （トップバーからは外した。長いスクロールの終点に置くほうが読み切ってから押させられる）
- [ ] `/notes` から `?block=` 付きで戻ったとき、着地点がトップバーの下に潜らない
- [ ] 767px以下でオーバーレイがボトムシートになる。1024px 前後でレイアウトが跳ねない
- [ ] 375px でトップバーが1行に収まり、進捗がバー下端の帯として出る

モックOFF（縮退モード）の確認:

```bash
# frontend/.env.development.local（git ignore 済み）
REACT_APP_ENABLE_MOCKS=false
```

- [ ] 実 Moodle 教材が iframe で従来どおり表示され、目次・完了処理が壊れていない
- [ ] 選択ツールバー・クリップUIが出ない（`source: 'moodle-fallback'`）

---

## 参照した実装

- `frontend/src/components/CourseContentPage.tsx`（削除。Moodle 描画は `learning/moodleContent.ts` へ移設）
- `frontend/src/components/shared/AppHeader.tsx`（選択検知の衝突回避・ナビ追加）
- `frontend/src/mocks/coachingHandlers.ts`（ハンドラ分離の作法）
- `frontend/src/store/progressionStore.ts`（zustand + persist の作法）
- `frontend/src/theme/webcoachTheme.ts`（デザイントークン）
