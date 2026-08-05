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

### レイアウト

要件§12の4状態（左右とも閉／左のみ／右のみ／左右とも開）は、**グリッドの列定義1行**が担う。

```tsx
gridTemplateColumns = `${navOpen ? 300 : 0}px minmax(0, 1fr) ${supportOpen ? supportWidth : 0}px`
```

左右のパネルは教材に重ねず、グリッドの列として幅0まで畳む。教材領域は `minmax(0, 1fr)` なので自動で伸縮する。`transition: grid-template-columns .24s ease` でアニメーションする。

1024px 未満では `minmax(0, 1fr)` の1列に切り替え、左右とも `position: fixed` のオーバーレイドロワーになる。

### 既存シェルとの噛み合わせ

`AppHeader` は固定左レールで `body.with-sidebar { padding-left: 68px/216px }` を当てている（[index.css](../src/index.css)）。ワークスペースはその内側でビューポート高に固定する。

- `body.learning-workspace { overflow: hidden }` を `LearningWorkspacePage` の `useEffect` で付け外し（アンマウント時に必ず除去）
- `.wc-learning-shell { height: 100dvh }`、SPは下部ナビ64px分を差し引く

**AppHeader との衝突**: AppHeader は document 全体の `mouseup` を見て「AIに解説」ボタンを出すため、新しい選択ツールバーと二重表示になる。本文コンテナの `data-lesson-article` を見て AppHeader 側で早期リターンさせた（AppHeader の変更はこの1箇所と、マイノートのナビ項目追加のみ）。

### 状態の置き場所

| 種類 | 置き場所 | 理由 |
|---|---|---|
| パネル状態（開閉・幅・比率・モード） | `store/learningWorkspaceStore.ts`（zustand + persist、`webcoach-learning-workspace`） | 端末ごとの好み。サーバへ送る意味がない |
| 教材本文・目次 | モックAPI（`useLessonDoc`） | 将来サーバ管理 |
| メモ・クリップ・保存回答 | モックAPI（`useNotes`）→ ハンドラ内で localStorage | 実API化がハンドラ削除だけで済む |
| AI会話 | フック内のローカル状態（レッスン単位） | 教材ごとの文脈を混ぜない |

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

### ノート系

| メソッド | パス | 用途 |
|---|---|---|
| GET / PUT | `/api/webcoach/lesson-notes/{lessonId}` | 教材単位のメモ下書き（500msデバウンスで自動保存） |
| GET | `/api/webcoach/notes?kind=&q=&courseId=&lessonId=` | マイノート横断 |
| POST | `/api/webcoach/notes` | メモカード／クリップ／⭐保存したAI回答 |
| DELETE | `/api/webcoach/notes/{id}` | 削除 |

`NoteItem` は3種を1つの型で扱う（`kind: 'memo' | 'clip' | 'answer'`）。クリップは `blockId` と `offset`（ブロック内テキストでの開始位置）を保持し、これで元の位置へ復元する。

### 章立ての単一情報源

`lessonHandlers.ts` の `buildCourseStructure(courseId)` が唯一の章立て定義。`handlers.ts` の `buildSections`（`/moodle/courses/:id/contents`）もここから導出しているため、教材ページの目次とコーストップ・マイページの表示がズレない。

---

## 画面構成（実装済み）

| ファイル | 役割 |
|---|---|
| `components/learning/LearningWorkspacePage.tsx` | シェル。状態の集約のみ |
| `components/learning/LessonTopBar.tsx` | ≡目次 / パンくず / 進捗 / AI・メモ / 完了して次へ |
| `components/learning/LessonNavDrawer.tsx` | 左：セクション＋レッスン、完了/学習中/未学習、検索 |
| `components/learning/LessonArticle.tsx` | 中央：タイトル・ゴール・ブロック列・次にやること・前後導線 |
| `components/learning/LessonBlockView.tsx` | 1ブロック描画。`data-block-id` 付与、確認問題の採点 |
| `components/learning/MoodleFallbackBlock.tsx` | 縮退モードの iframe 描画 |
| `components/learning/SelectionToolbar.tsx` | [💡解説][AIに質問][クリップ] |
| `components/learning/ExplainPopover.tsx` | かんたん解説（`mode: 'brief'`）＋「さらに詳しく質問」 |
| `components/learning/SupportPanel.tsx` | 右：分割/AI/メモ切替＋上下分割 |
| `components/learning/AiCoachPane.tsx` | 引用・画像添付・構造化回答・[コピー][⭐保存][メモに追加] |
| `components/learning/MemoPane.tsx` | 自動保存エディタ＋保存物一覧＋検索 |
| `components/learning/PanelResizer.tsx` | 縦横共通のドラッグリサイザ（pointer capture の自前実装） |
| `components/learning/clipHighlight.ts` | クリップの `<mark>` 復元 |
| `components/learning/moodleContent.ts` | 旧 CourseContentPage から移設した Moodle 描画ヘルパ |
| `components/notes/MyNotesPage.tsx` | `/notes`。横断検索・コース/教材で絞り込み・元教材へ復帰 |

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

- [ ] 左右とも閉／左のみ／右のみ／左右とも開の4状態で本文幅が追従する
- [ ] 右パネル幅のドラッグ、AI/メモの上下比率ドラッグ、リロード後も状態が復元される
- [ ] 本文をドラッグ選択 → ツールバー → 💡解説／AIに質問（引用付き）／クリップ
- [ ] AppHeader の「AIに解説」が本文選択時に二重表示されない
- [ ] AI回答が 結論／教材の根拠／当てはめ／次にやること／参照箇所 の構造で出る
- [ ] 参照チップをクリックすると該当ブロックへスクロール＋ハイライト
- [ ] 教材にない質問（例:「Reactのuseeffectとは」）で警告バナー＋一般補足の区別表示になる
- [ ] 画像添付／スクショ貼り付け → きっかけチップが出て添削回答が返る
- [ ] メモ自動保存、⭐保存、メモに追加、クリップ「元の場所」ジャンプ
- [ ] `/notes` でタブ・検索・コース/教材絞り込み・元教材へ戻る
- [ ] 完了して次へ で `markActivityComplete` が飛び、EXPが付き、次レッスンへ進む
- [ ] 1023px以下で左右がオーバーレイドロワーになり、SP下部ナビと重ならない

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
