# AIコーチングノート 設計書 / モック実装仕様

## 1. 機能概要

受講生とコーチが Google Meet または Zoom で実施するコーチング内容を記録し、終了後に以下を自動生成する。

録音 → 文字起こし → AI要約 → 決定事項の整理 → 次回までの目標・タスクの作成 → 次回コーチングで確認する内容の整理

**受講生には技術的な録画設定を意識させず、LMS上から簡単に会議へ参加できる体験を目指す。**

目指す体験:

```
コーチから届いたリンクを貼る
  ↓
LMSからコーチングに参加する
  ↓
終了後にノートとタスクが完成している
```

今回のスコープは**設計＋PoC＋画面モック**まで。`api-server`/`bff-server`/`cdk` は変更しない（CLAUDE.md）。必要なAPIはすべてMSWモックで作る。

---

## 2. 前提条件

### コーチングの実施方法

- コーチングは Google Meet または Zoom で実施する
- **会議リンクはコーチが発行する**
- 発行されたリンクは LINE・メール・チャットなどで受講生に送られる
- **コーチ専用のLMS画面は作らない**
- 会議リンクは受講生がLMSに登録する

### 認証の役割

**コーチ**（会議の主催者なので、録画・文字起こしの持ち主）

- Google Meet を使う場合は Google アカウント、Zoom を使う場合は Zoom アカウントを連携
- 録画・文字起こしの取得をLMSに許可する
- **会議リンクを発行したアカウントと、LMSに連携したアカウントが一致している必要がある**
- 認証はコーチ1人につき初回1回のみ

**受講生**

Google や Zoom のアカウント連携は**行わない**。受講生が行うのは以下だけ。

- AIコーチングノートの説明を確認し、録音・文字起こし・AI要約に同意する
- 会議リンクをLMSに登録する
- LMSから会議に参加する
- 終了後にAIノートを確認・修正し、次回までのタスクを確定する

---

## 3. 「使えないコーチ」が構造的に発生する

コーチは各自の個人アカウントを使っているため、会社が Zoom / Google Workspace を管理している場合に使える Server-to-Server OAuth やドメイン全体の委任（管理者が一度設定すればコーチの操作ゼロ）は使えない。さらに:

| ケース | 自動取得 |
|---|---|
| Zoom 無料プラン | **不可**。クラウド録画が無く、ローカル録画はAPIから取得できない |
| Zoom Pro 以上 | 可 |
| 個人Googleアカウント（@gmail.com） | **不可**。Meetの録画・文字起こしはWorkspace機能 |
| Google Workspace（Business Standard 相当以上） | 可 |

エディションの境界は各社の最新プラン表で**要確認**。

**したがって手動取り込みの経路は撤去できない。** 未連携・プラン非対応・自動取得の失敗はいずれも必ず起きるので、フォールバックとして文字起こしファイル・音声ファイル・テキスト入力の3経路を残している。

日本語の文字起こしについて: Zoomのクラウド録画の音声文字起こしは対応言語に制約があり、日本語で実用品質が出るかは**要検証**。ただし自動化の可否には影響しない — プロバイダーの文字起こしが使えなければ、音声（M4A）を自動ダウンロードして自前で文字起こしすればよく、受講生から見た「アップロード不要」は変わらない。コストと処理時間が増えるだけ。

**受講生自身に録音させる経路は持たない。** Zoom / Meet を別タブで使っている以上、受講生のマイクではコーチの声が録れず、「録れているつもりで片側しか録れていない」事故になるため。

---

## 4. コーチ側の初期設定

コーチ用LMSは作らず、**認証専用の簡易ページ1枚**だけを用意する（`/connect/:token`）。運営がコーチの初回セットアップでURLを発行して渡す。

```
運営: /admin/coach-integrations で認証URLを一括発行
  ↓ その場で画面共有、またはチャット・メールでまとめて送付
コーチ: URLを開く → Google Meet / Zoom を選んで連携 → 完了
  ↓ refresh token を暗号化して保存
以降、LMSに登録された会議だけが面談終了後に自動で取り込まれる
```

コーチがLMSで目にする画面はここ1枚だけ。**ログインもアカウント作成も不要**なので、`/connect/:token` は認証不要ルートにする（`routes/index.tsx` で `ProtectedRoute` の外に置いている）。

認証URLについて:

- 有効期限は14日。期限切れは運営が再発行する（`/admin/coach-integrations` の「認証URLを再送」）
- **URL自体は権限を持たない**。実際の認可はプロバイダー側でコーチ本人がログインして行うため、URLを知っているだけでは連携できない。したがって期限内の再訪・再連携を許可してよい
- トークンは推測不能な乱数にし、レート制限をかける。認証不要なので、総当たりでコーチのメールアドレスが漏れないようにする

### 取得対象の限定は LMS 側の実装責務

OAuthが通ると、技術的には**そのコーチの全録画**（他の受講生との面談、無関係な商談を含む）が読める。絞るのはLMS側の責任。

- 受講生が登録した会議URLから会議ID / 会議コードを抽出して保存する
- Webhook受信時、**登録済みの会議IDに一致しないものは取得せず破棄する**。ダウンロードもしない。ログにも本文を残さない
- 会議URLが未登録のコーチングは照合できないので自動取得の対象外にする
- OAuthスコープは読み取りに必要な最小限に絞る
- この方針を `/connect/:token` に明記する（実装済み）

### 状態

`not_connected` / `connected` / `reauth_required` / `expired` / `plan_unsupported` / `revoked` の6状態。リフレッシュトークンの失効を検知したら `reauth_required` にし、運営に通知して再発行できるようにする。

---

## 5. 会議リンクの登録

受講生に日時・コーチ名・サービス種別を**入力させない**。コーチから届いたメッセージを貼るだけで済ませる。

```
1. コーチから届いたメッセージをコピー
2. LMSで「送られてきたリンクを登録」を押す
3. 貼り付ける
4. LMSがMeet/ZoomのURLを自動抽出
5. 確認して登録
```

抽出は `frontend/src/utils/parseMeetingLink.ts`。対応している入力:

- `meet.google.com/abc-defg-hij`（スキーム有無どちらも）
- `zoom.us/j/1234567890`、サブドメイン付き（`us02web.zoom.us`）
- Zoomのパスコード（URLの `?pwd=` と、本文の「パスコード: 123456」の両方）
- URLの前後に文章・改行がある状態
- URLの末尾に句読点・全角括弧などが付いている状態
- 複数URLが含まれる状態（すべて返し、UIで選ばせる）
- 無関係なURLしか無い場合は「見つからなかった」として扱う

自動判定する項目: Meet か Zoom か / 会議URL / Zoomパスコード / 登録対象の次回コーチング / 担当コーチの連携状態。

---

## 6. 参加時の処理

受講生が「AIノートを開始して参加」を押したときの流れ:

1. 会議リンクの有無を確認
2. 担当コーチを特定
3. コーチの Google / Zoom 連携状態を確認
4. 録画・文字起こしの利用可否を確認
5. AIコーチングノートのセッションを作成
6. Meet / Zoom を別タブで開く
7. コーチング終了後に録画・文字起こしデータを取得
8. AIノートを生成

**ボタン名は「録音を開始」にしない。** 実際に録音するのは受講生の端末ではなく、コーチの認証済み権限を使った会議側の記録機能なので、「録音を開始」だと何が起きているかを取り違えさせる。「AIノートを開始して参加」とする。

同様に、会議前の画面でも「録音開始」と表示しない。録画・文字起こしの開始は Zoom / Meet 側で行われるため、実際には記録されていないのに記録中に見える事故が起きる。

### コーチング中

Meet / Zoom は別タブで開く。LMS側は「記録が続いていること」を示すだけでよい。**このページを閉じても記録は止まらない**ことを明示する（そうしないとタブを閉じられずに不安を抱えたままになる）。モック段階では実際の録画状態と連動せず、見た目のみ。

---

## 7. AI要約

### 参照する情報

文字起こしだけでなくLMS内の情報も使う。一般的な議事録ではなく、**受講生の学習進捗と次の行動を整理するもの**にする。

今回の文字起こし / 前回のコーチングノート / 前回設定した目標 / 現在受講している教材 / 教材の進捗 / 提出済み課題 / 中長期の学習ロードマップ

画面には「整理に使った情報」として何を参照したかを表示する。

### 生成時のルール

- 文字起こしに存在しない内容を補完しない
- コーチと受講生の合意事項だけをタスク化する
- 曖昧な期限を確定事項として扱わない
- コーチの発言と受講生の発言を混同しない
- 重要な決定事項を優先して表示する
- タスクは具体的な行動に変換する
- タスクを増やしすぎない
- 受講生が確認・修正してから確定する

これらを**構造で守る**:

- 期限・完了条件が会話で決まっていない場合は `null` を返させ、画面では「未設定」「確認が必要」と強調して受講生に入力させる。埋めるまで確定できない
- 各項目に**根拠となる発言ID**（`sourceSegmentIds`）を必ず紐づけ、「この会話を見る」で元の発言へジャンプできるようにする。AIが勝手に作ったのか実際に合意したのかを受講生が確認できる
- 話者は `speaker_1` / `speaker_2` として保持し、AIに実名を判定させない。受講生が画面で「話者1＝コーチ」と一度割り当てるとセッション内の同一話者へ一括反映する

### 出力形式（構造化JSON）

Zoom / Meet 標準のAI要約には依存しない。契約プランで利用可否が変わる、出力形式が異なる、WEBCOACH特有の目標形式にできない、教材と連携できない、プロバイダーを追加しにくい、という理由から、共通プロンプトで独自に生成する。

```json
{
  "sessionSummary": "…",
  "progressSinceLast": [{ "title": "…", "sourceSegmentIds": ["seg_002"] }],
  "coachFeedback":     [{ "title": "…", "sourceSegmentIds": ["seg_007"] }],
  "decisions":         [{ "title": "…", "sourceSegmentIds": ["seg_011"] }],
  "goals": [{ "title": "…", "successCriteria": null, "dueDate": null, "needsReview": true, "sourceSegmentIds": [] }],
  "tasks": [{ "title": "…", "successCriteria": "…", "dueDate": "2026-08-09", "needsReview": false, "sourceSegmentIds": [] }],
  "nextSessionAgenda": ["…"],
  "referencedContext": ["今回の文字起こし", "前回のコーチングノート", "…"]
}
```

`api-server/routers/ai.py` が既に Anthropic Claude（`langchain_anthropic.ChatAnthropic`）と連携しているため、LLM呼び出し自体は新規構築が不要。

---

## 8. AIノートの確認フロー

AIが生成した内容をそのまま確定させない。目標・タスクには状態を持たせる。

| 状態 | 画面上の扱い |
|---|---|
| `ai_suggested` | AIが抽出した候補（確定前） |
| `student_confirmed` | 受講生が確認して確定した |
| `shared_with_coach` | コーチに共有済み |
| `coach_confirmed` | コーチと確認済み（将来のコーチ側画面用） |
| `completed` | 完了 |

確定すると、選んだ目標とタスクが**既存の学習目標に追記**される（全件上書きしない）。

---

## 9. 非同期処理

`bff-server` / `api-server` には非同期ジョブの仕組みが一切存在しない（すべて同期リクエスト/レスポンス）。1時間規模の音声処理を同期HTTPリクエスト内で完結させるのは無理があるため、処理状態をDBで持ちフロントがポーリングする構成にする。

```
draft → recording → uploading → transcribing → summarizing → review_required → published
                                                                             ↘ failed
```

音声・文字起こし・要約それぞれに個別のステータスを持たせ、「文字起こしには成功したが要約で失敗した」を区別できるようにする。フロントはMVPではポーリングで十分（WebSocketは不要）。

**プロバイダーの文字起こしやテキスト入力の経路では `transcribing` をスキップする**（画面上もこの差が見える）。

---

## 10. 音声ファイルの保存

ブラウザ経由でアップロードされる動画MP4は、既存の100MBメモリバッファ型アップロード（`POST /api/moodle/files/upload`）では足りない。署名付き（presigned）URLでブラウザからストレージへ直接アップロードし、APIサーバーの帯域とメモリを経由させない構成が必要。

`POST /coaching-sessions/:id/import` には音声の実体を通さず、メタデータだけを送る設計にしてある。

---

## 11. 会議プロバイダー連携レイヤー

Zoom用とMeet用で別々の処理を作らず、バックエンドに抽象層を置き、正規化済みの共通形式に変換してから同じAI処理へ流す。

```ts
interface MeetingProvider {
  getMeeting(id: string): Promise<Meeting>;
  getTranscript(id: string): Promise<TranscriptSegment[]>;
  getRecording(id: string): Promise<RecordingFile | null>;
}
// 実装: ZoomMeetingProvider / GoogleMeetProvider / ManualUploadProvider
```

正規化後の形式（フロントの `frontend/src/types/coaching.ts` と揃えてある）:

```json
{
  "id": "seg_001",
  "speakerId": "speaker_1",
  "speakerRole": "coach",
  "startMs": 10000,
  "endMs": 18000,
  "text": "次回までにバナーを3案作ってみましょう",
  "confidence": 0.91
}
```

**取得の優先順位**はプロバイダーの文字起こし > 音声のみ（M4A）> 動画（MP4）。文字起こしが取得できれば再度AI文字起こしをかける必要がなく、処理時間とコストを抑えられる。

**Zoom**: `recording.completed` / `recording.transcript_completed` Webhook を受けて非同期ジョブを作成する。**Webhookに含まれる録画ダウンロード用トークンは24時間で失効する**ため、受信した時点で速やかに自社ストレージへコピーする。

**Google Meet**: Google Workspace Events API で `transcript.v2.fileGenerated` を購読し、Meet REST API から発言エントリを取得する。**Meet APIが返す文字起こしエントリは会議終了から30日後に削除される**ため、イベント受信後は早めにDBへ取り込む。Meetでは文字起こしと録画が独立しているので、**文字起こしのみオン・動画録画は必要時のみ**を推奨（動画まで保存するとストレージ使用量と個人情報リスクが大きくなる）。

---

## 12. 画面モック（実装済み）

すべて `frontend/` 内 + MSWモック。

### 受講生

| 画面・コンポーネント | 役割 |
|---|---|
| `mypage/NextCoachingCardContainer.tsx` | ダッシュボードの次回コーチングカード（compact）。登録・参加までここで完結する |
| `CoachingNotesPage.tsx`（`/coaching`） | 次回カード（full）・目標・履歴。記録中／生成中／ノート確認への切り替え |
| `coaching/NextCoachingCard.tsx` | 全状態を描き分ける共通カード。マイページと `/coaching` で共有 |
| `coaching/MeetingLinkModal.tsx` | 貼り付け → 自動判定 → 確認 → 登録／変更 |
| `coaching/ConsentModal.tsx` | 初回のみの同意 |
| `coaching/RecordingStatus.tsx` | 記録中の表示。会議画面を開く導線 |
| `coaching/ProcessingStatus.tsx` | 1秒間隔のポーリングと段階表示、失敗時のフォールバック導線 |
| `coaching/SessionReview.tsx` | AIノート本体（後述） |
| `coaching/ImportRecordCard.tsx` | 【フォールバック】手動取り込み3経路 |
| `utils/parseMeetingLink.ts` | 会議リンクの抽出・サービス判定・パスコード抽出 |
| `utils/parseTranscript.ts` | VTT/SRT/TXT を `TranscriptSegment[]` に正規化 |

**AIノートのセクション順**（`SessionReview.tsx`）:

```
今回のまとめ → 前回からの進捗 → コーチからのフィードバック → 決まったこと
→ 次回までの目標 → 次回までのタスク → 次回確認すること
→ ［内容を編集］［この内容で確定］
→ 自分のメモ → 整理に使った情報 →（折りたたみ）文字起こし → 記録の管理
```

**この並びは意図的**。文字起こしと録音は常時表示せず末尾の折りたたみに置く。学習管理システムとして重要なのは記録そのものではなく、次にやることが普段の学習画面に残ること。

### コーチ

`/connect/:token`（認証不要）。Google / Zoom の選択、認証処理中、連携完了、認証失敗、再認証案内、期限切れの各状態を持つ。

### 運営

`/admin/coach-integrations`。コーチ一覧・連携状態・利用サービス・最終自動取得・認証URLの一括発行・再送・解除。プラン非対応のコーチは理由を表示して発行対象から外す。

### モックAPI（`frontend/src/mocks/coachingHandlers.ts`）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/webcoach/coaching-sessions/:userid` | 次回予定 + 履歴 + 同意状況 |
| PUT | `/api/webcoach/coaching-sessions/:userid/meeting-link` | 会議リンクの登録・変更 |
| PUT | `/api/webcoach/coaching-sessions/:userid/consent` | 録音・AI要約への同意 |
| POST | `/api/webcoach/coaching-sessions/:userid/start` | AIノートを開始して参加 |
| POST | `/api/webcoach/coaching-sessions/:sessionId/finish` | **モック専用**。終了→取得とAI生成の開始 |
| GET | `/api/webcoach/coaching-sessions/detail/:sessionId` | 詳細。**ポーリング先** |
| PATCH | `/api/webcoach/coaching-sessions/detail/:sessionId` | メモ・公開範囲・保存期間・話者ラベル・目標/タスクの部分更新 |
| POST | `/api/webcoach/coaching-sessions/:sessionId/import` | 【フォールバック】手動取り込み |
| POST | `/api/webcoach/coaching-sessions/:sessionId/confirm-goals` | 目標・タスクの確定 |
| DELETE | `/api/webcoach/coaching-sessions/detail/:sessionId` | 記録の削除 |
| GET | `/api/webcoach/coaching-auto-import/readiness/:userid` | 自動取得の事前チェック |
| GET | `/api/webcoach/meeting-connections` | コーチごとの連携状態 |
| POST | `/api/webcoach/meeting-connections/invites` | 認証URLの一括発行 |
| POST | `/api/webcoach/meeting-connections/:coachId/resend` | 認証URLの再送 |
| GET | `/api/webcoach/meeting-connections/invites/:token` | 認証URLの内容。**認証不要** |
| POST | `/api/webcoach/meeting-connections/invites/:token/complete` | 連携完了。**認証不要** |
| DELETE | `/api/webcoach/meeting-connections/:id` | 連携解除 |

---

## 13. データベース設計（本番実装時）

AI生成結果は上書きせずバージョンを残す（`ai_summaries`）。「AI生成直後 / 受講生が修正 / コーチが修正」を追える必要があるため。

| テーブル | 内容 |
|---|---|
| `coaching_sessions` | コーチング1回分 |
| `meeting_links` | 登録された会議リンクと会議ID（Webhookの照合キー） |
| `meeting_connections` | コーチのOAuth連携状態とトークン |
| `connection_invites` | 認証URLのトークン・有効期限・使用状況 |
| `recordings` | 音声ファイルと取得状態 |
| `recording_consents` | 録音・AI利用への同意 |
| `transcripts` / `transcript_segments` | 文字起こし（全体 / 発言単位） |
| `ai_summaries` | AI要約（バージョン保持） |
| `goal_candidates` / `goals` | AIが抽出した候補 / 確定された目標 |
| `processing_jobs` | AI処理の状態・エラー |
| `audit_logs` | 閲覧・編集・削除履歴、誰の会議をいつ取得したか |

---

## 14. セキュリティ・プライバシー

音声には受講生の仕事・家庭・収入・健康などの情報が入る可能性があり、通常の教材閲覧履歴より強い制御が必要。

```
受講生     : 自分のセッションのみ
担当コーチ : 担当受講生のみ
運営管理者 : 原則メタデータのみ
特権管理者 : 申請・監査付きでアクセス
```

音声ファイルのURLをDBに保存して公開せず、再生時に短時間だけ有効な署名付きURLを都度発行する。

**保存期間（案。利用規約・プライバシーポリシーと整合させる）**

```
音声          : 90日で自動削除（受講生が「要約後に削除」を選べる。実装済み）
文字起こし    : 契約終了後180日
確定済み目標  : 受講履歴として保持
AI中間生成物  : 30日
```

**AI事業者への送信は工程ごとに最小限にする**

```
文字起こし処理 : 音声のみ
要約処理       : 文字起こしのみ
目標生成       : 文字起こし + 受講プランの最小情報
```

APIキーはブラウザに置かず、必ずバックエンドから呼び出す。

---

## 15. 取得できなかった場合のフォールバック

外部連携は必ず失敗する前提で設計する。よくある失敗: コーチが文字起こしを開始し忘れた / クラウド録画が無効 / 別アカウントが主催者 / OAuthが失効 / プランが非対応 / 録画ファイルが削除された。

そのため受講生には必ず退避先を用意する（実装済み）。

```
記録を取得できませんでした

[文字起こしファイルをアップロード]  VTT / SRT / TXT
[録音・動画をアップロード]          MP3 / M4A / WAV / MP4 / WebM
[コーチングメモから作る]            手入力
```

**「自動で届く」と表示しておいて実は届かない、を作らない。** 事前チェック（`AutoImportReadiness`）で、会議リンク未登録・コーチ未連携・プラン非対応・再認証待ち・**サービス不一致**（登録リンクはZoomなのにコーチはMeet連携、など）を検出し、理由つきで手動導線へ倒す。

---

## 16. 初回セットアップのチェックリスト

**受講生**（Google・Zoomのアカウント連携は入れない）

プロフィールを入力する / 学習の目標を設定する / AIコーチングノートの説明を確認する / 録音・文字起こし・AI要約に同意する / 会議リンクを登録する / 初回コーチングに参加する / AIコーチングノートを確認する

**コーチ**（運営から認証専用URLを送る）

Google または Zoom を連携 / 録画・文字起こし権限を許可 / 普段どおり会議リンクを発行 / 会議リンクを受講生へ送る

---

## 17. 開発順序

### MVP（今回のモックが相当する範囲）

コーチのGoogle・Zoom初回認証 / 受講生による会議リンク登録 / Meet・Zoom URLの自動抽出 / 会議サービスの自動判定 / 次回コーチング予定への紐づけ / AIノートを開始して参加する導線 / 録画・文字起こしデータの取得 / AI要約 / 受講生による内容確認・修正 / 次回までのタスクへの反映

### 後回し

リアルタイム文字起こし表示 / 会話中のAI提案 / スマートフォンの共有メニューから直接登録 / 会議中のリアルタイム要約 / コーチ用の本格的なLMS画面 / コーチング予約機能との完全自動連携

### 将来

LMSからZoom/Meetを作成、自動録画・文字起こし設定 / 過去セッションの横断検索 / コーチング傾向分析 / 次回コーチング用AIブリーフィング（前回の目標・実際の学習進捗・課題提出・学習時間などLMS内の実データと組み合わせる） / コーチ側の最小画面（まとめと目標を見て「確認しました」「コメントする」だけ。文字起こし修正やタスク作成をコーチに求めると運用負荷が高すぎる）

---

## 18. バックエンドチームへの引き渡し事項

1. `MeetingProvider` 抽象と `ZoomMeetingProvider` / `GoogleMeetProvider` / `ManualUploadProvider` の実装（`bff-server/adapters/` の既存アダプタ規約に従う）
2. 招待URL方式のOAuth連携とトークンの暗号化保存・失効管理。**`/connect/:token` 系の2エンドポイントは認証不要**（コーチはLMSアカウントを持たない）。トークンは推測不能な乱数＋レート制限
3. **登録済み会議IDに一致しないWebhookの破棄**。OAuthはコーチの全録画への権限になるため、絞り込みはLMS側の責務
4. プラン判定（Zoom無料 / 個人Googleアカウントの検出）と `plan_unsupported` への振り分け
5. 文字起こしAPI呼び出し（既存アダプタには存在しないリトライ/バックオフが必要）
6. 面談トランスクリプト→構造化JSON抽出のプロンプト実装（`api-server/routers/ai.py` のClaude連携パターンを再利用）
7. 非同期処理基盤（ジョブ状態テーブル＋ポーリングAPI。将来Webhook駆動＋キュー化）
8. presigned URL によるブラウザ→ストレージ直接アップロード
9. 上記のDBテーブル設計と保存期間の自動削除バッチ
10. Secrets Managerへの新規APIキー登録・ECS/Fargateタスクへの注入（現状これらのバックエンドの秘密情報は素の `.env` 管理で、CDKのSecrets Manager連携はRDS/Auroraの認証情報のみ）

---

## 19. PoC：要約・ネクストアクション抽出の精度検証

最もリスクが高い（プロンプト設計・出力の安定性が未知数な）工程は「要約・ネクストアクション抽出」であるため、記録の取得・文字起こしは「サンプルの文字起こしテキストが既にある」という前提でスキップし、この工程だけを単独で検証した。

- 配置：`poc/ai-coaching-notes/`（本体コードとは独立）
- 内容：ダミーの日本語コーチング面談トランスクリプト3パターン＋、Structured Output（JSON Schema）で抽出するPythonスクリプト
- 本番実装ではAnthropic Claude を使う想定だが、手元の `.env` にはOpenAIキーのみ存在したためPoCではOpenAIで検証した。**JSON Schemaで出力の型を固定する**という考え方自体はどちらのAPIでも同じであり、PoCの結論はモデルを問わず有効
- 検証方法・結果は `poc/ai-coaching-notes/README.md` を参照

---

## 20. 検証方法

`cd frontend && npm start`（`REACT_APP_ENABLE_MOCKS=true` が既定）。任意のメール/パスワードでログイン。

**通し**: マイページ or `/coaching` の次回コーチングカードは初期状態が「会議リンク未登録」→「送られてきたリンクを登録」にコーチのメッセージを丸ごと貼る → Meet/Zoomが自動判定される → 登録 →「AIノートを開始して参加」→ 初回のみ同意 → 会議が別タブで開き、LMSは記録中表示 →「（モック）コーチングを終了する」→ 段階表示 → AIノート →「この内容で確定」→ マイページの目標に追記される。

**コーチ**: `/admin/coach-integrations` で認証URLを発行し、**別タブかシークレットウィンドウ**で開く（ログインを要求されないこと）。連携・非対応プラン・認証失敗・再送を確認する。

**例外**: 会議リンク未登録で参加しようとする / 未連携・プラン非対応・サービス不一致のコーチ / 短すぎるメモ。

- 文字起こしファイルの確認には `frontend/docs/sample-coaching-transcript.vtt` を使える（16発言・話者2名のサンプル）
- `npx tsc --noEmit`：エラー無しを確認済み
- 会議リンクのパーサは実入力14パターンで検証済み（仕様の入力例・スキーム無し・末尾の句読点や全角括弧・Zoomサブドメイン＋pwd・本文中のパスコード・複数URL・Meet/Zoom混在・URL無し・無関係URL）
- モックハンドラは Node + `msw/node` で通し検証済み。確認した挙動：リンク未登録で参加すると409 / 参加ボタンの二重押しでセッションが重複しない / 自動取得できない状態で終了すると `failed` になり嘘の「生成中」を見せない / 手動取り込みでは `transcribing` がスキップされ投入した発言がそのまま保持される / AI要約の根拠発言IDがすべて実在する / 確定後に次回カードが「次回待ち」に戻る / 期限切れコーチへの再送で `not_connected` に復帰する / プラン非対応コーチへの再送は409 / 認証失敗は502
