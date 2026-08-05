# 受講生の実績・成果データ トラッキング 要件定義

## 目的

`mypage-real-data-requirements.md`（マイページの実データ移行）に続く整理。今回のテーマは、受講生の**成果データ**（案件獲得・収益化・受講継続率・制作物）をどう記録するかと、運営側が「学習進捗の良い受講生」をリストアップできるようにする、という2つの要望。本ドキュメントは各指標ごとに「現状（ABSENT/PARTIAL）」「手動入力か自動取得か」「必要な作業」を整理し、バックエンドチームへの依頼リストとしてそのまま使える粒度を目指す。

**前提（ユーザーヒアリング済み）**
- 案件獲得・収益化データは、**対象プログラム（案件提供プログラム等）参加者には入力を必須として組み込み**、**それ以外の受講生には任意入力の窓口を用意**する。入力してくれた受講生には案件紹介・審査通過率アップ等のインセンティブを設ける余地を残す（運営フロー側の設計も伴う）。
- 制作物（ポートフォリオ）の追跡は、**初期は軽量カスタム方式**（Moodleの課題機能`mod_assign`は使わない）。**将来的にMoodle正式連携へ移行できる前提**でスキーマを組む。
- 本ドキュメント作成にあたり`api-server`・`bff-server`・管理画面フロントを読み取り専用で調査した（3並列調査）。バックエンドのコード自体はこの作業では変更していない。

**優先度の目安**（`mypage-real-data-requirements.md`と同じ基準）
- **S**：実データが既にあり、フロントの向き先を変えるだけで済む
- **A**：実データの土台はあるが、bff/api側に小さな追加（集計エンドポイント追加など）が必要
- **B**：概念自体が存在せず、テーブル設計・運用フロー設計を含む新規開発が必要

---

## 1. 案件獲得率・初案件までの平均日数

現状：「案件」「acquisition」「placement」に相当するテーブル・フィールドは`api-server`/`bff-server`のどちらにも存在しない。近い項目として`webcoach_user_profile.target_job`（`api-server/entities/webcoach.py`）があるが、これは受講生が自分で入力する**なりたい職業**（願望）であり、実際の案件獲得日を記録するものではない。

| 項目 | 種別 | 優先度 |
|---|---|---|
| 案件獲得（獲得日・初案件日） | **手動**（案件成立を自動検知する手段が存在しない） | **B** |

**次アクション**：新規テーブル`job_acquisitions`（`user_id, program_id[nullable], acquired_at, is_first_job, notes, entered_by`）を設計する。対象プログラム参加者はプログラムのフロー内（オンボーディング/進捗チェックポイント等）で入力必須にし、それ以外の受講生にはマイページ側に任意入力フォームを用意する。

---

## 2. 収益化率・平均月商・平均収益期間

現状：「revenue」「収益」「月商」「売上」は`api-server`/`bff-server`のどちらにも一切ヒットしない。完全にABSENT。

| 項目 | 種別 | 優先度 |
|---|---|---|
| 月次収益額（収益化率・平均月商・平均収益期間の算出元） | **手動**（定期的な自己申告が前提） | **B** |

**次アクション**：新規テーブル`revenue_records`（`user_id, program_id[nullable], period(月), amount, entered_at, entered_by`）を設計する。入力経路は1と同じ方針（対象プログラムは必須、それ以外は任意）。平均収益期間（初収益〜直近収益）はこのテーブルへのレコード蓄積後にサーバー側で集計するだけで済み、追加のテーブルは不要。

---

## 3. 受講継続率

現状：`webcoach_user_course_lastaccess`テーブル（`mdl_user_id, courseid, progress_percent, current_section, create_timestamp`）とMoodle標準の`mdl_user_last_course_access`（`lastaccess, accesscount`）は既に実データとして存在する。ただし「継続中/離脱」を表すステータス列は無い。Moodle標準の`enrolstatus`（0=active/1=suspended）はCSVテンプレートに定義があるだけで、コード上は一度も参照されていない（休眠フィールド）。

| 項目 | 種別 | 優先度 |
|---|---|---|
| 受講継続率 | **自動**（既存タイムスタンプの集計のみ、新規データ収集は不要） | **A** |

**次アクション**：「最終アクセスからN日以上ないユーザーは離脱扱い」のようなしきい値を運営側と合意した上で、既存の`lastaccess`・`progress_percent`を集計する新規エンドポイントを1本追加する。マイページのストリーク集計（`mypage-real-data-requirements.md` 1章）と同系統の作業。

---

## 4. 制作物（ポートフォリオ）

現状：Moodleの課題機能（`mod_assign_*`, `core_grades_*`）は`MoodleAdapter.js`が一度も呼んでいない。フロントの`CourseContentPage.tsx`の`getContentType()`も`modname==='assign'`のケースを扱っておらず、仮にMoodle側に課題モジュールが作られても`unknown`表示になる。提出物用のテーブル・エンドポイントも存在しない（"portfolio"は全文検索でも0件）。

転用できる既存の仕組み：`POST /api/moodle/files/upload`（`core_files_upload`、現在はコーチ側のコンテンツ作成でのみ使用）、`POST /api/admin/s3-upload`。ファイル格納のトランスポート層はそのまま使い回せる。

| 項目 | 種別 | 優先度 |
|---|---|---|
| 提出物の登録（リンク/ファイル） | **手動**（学生が提出） | **B** |
| 提出済みか否か・提出日時 | **自動**（提出という行為自体は手動だが、記録はシステムが自動で行う） | **B**（提出物テーブル新設時に同時に得られる） |
| コーチによる確認・フィードバック | **手動** | **B** |

**次アクション**：新規テーブル`portfolio_submissions`（`user_id, moodle_course_id, activity_label, submission_url, submitted_at, review_status, reviewed_by`）を設計する。合意済みの方針に従い、**初期は軽量カスタム**（Moodleのモジュール技術ID`cmid`等に強く依存させず、`activity_label`のような緩い紐付けにする）とし、将来`mod_assign`に正式移行する際にデータを引き継ぎやすい形にする。ファイルの実体保存は既存の`core_files_upload`/`s3-upload`を再利用する。

---

## 5. 運営向け「受講生リスト」機能（学習進捗・制作物・プログラムステータスでの絞り込み）

現状：`AdminStudentsPage.tsx` / `CoachStudentsPage.tsx` / `AdminCoachMappingPage.tsx`はいずれも`/api/admin/students`・`/admin/users/by-role/:role`・`/coaching/mappings`を呼ぶが、**これらのルートはbff-server/api-serverのどこにも実装されておらず、MSWモックにも存在しない**。つまり実装済みの3画面はいずれもAPI呼び出しの時点で404し、現時点では機能していない。表示項目も`username/fullname/lastaccess/new_user`のみで、学習進捗・完了率・制作物・プログラムステータスは元々含まれていない。

さらに、**複数ユーザーの進捗を一度に返すロスター（名簿）系エンドポイントが一切存在しない**。既存の進捗系エンドポイント（`resumecourse/:userid`, `activities/:cmid/completion`など）はすべて「ログイン中の本人」専用で、「コースID→全受講生の進捗」という向きのクエリが無い。

副次的な発見：Moodleサービストークンには`core_enrol_get_enrolled_users`（コース受講者一覧を取得するMoodle標準機能）の権限が**すでに付与されているが、一度も呼ばれていない**（`bff-server/init-service-db.sql`・READMEに記載のみ）。ロスター取得の入口としては使えるが、これ単体では進捗%までは取れず、各ユーザーの完了状況呼び出しと組み合わせる実装が別途必要。

`AdminCsvPage.tsx`の`users`データ型はプロフィールのテキスト項目（ニックネーム・自己紹介・目標等）のみで進捗データは含まない。`AdminCoachMappingPage.tsx`もコーチ↔受講生の割り当てのみで進捗情報は持たない。

| 項目 | 種別 | 優先度 |
|---|---|---|
| 受講生一覧の表示自体（既存3画面の復旧） | 実装済みだが未接続（バックエンド側の欠落） | **B** |
| ロスター単位の進捗集計エンドポイント | **自動**（既存の完了状況データを再利用。新規データ収集は不要、集計ロジックの新設） | **B** |
| 学習進捗フィルタ（未着手/進行中/完了） | 自動（上記ロスターエンドポイントがあれば導出可能） | 上記に付随 |
| 制作物提出有無フィルタ | 4章の`portfolio_submissions`が前提 | 4章に依存 |
| プログラム別ステータス（受講開始/進捗順調/完了） | **自動**（`mypage-real-data-requirements.md` 6章のロードマップ機能＝プログラムに紐づくコース群を再利用。各コースの進捗から導出可能。ゼロから新設ではない） | **A**（ロードマップの紐付け方針が前提） |

**次アクション**：
1. コース/プログラム単位で「受講生一覧＋進捗%」を返す新規ロスター集計エンドポイントを設計する（`core_enrol_get_enrolled_users`＋各ユーザーの完了状況呼び出しの組み合わせ、または将来的にMoodleのgrade/completion report系webservice機能を有効化する案も検討）。
2. `AdminStudentsPage.tsx`を上記の実エンドポイントに繋ぎ直し、学習進捗・制作物提出有無・プログラム別ステータスでフィルタできるように改修する（実質的にページの再構築に近い）。
3. `CoachStudentsPage.tsx`の詳細画面遷移（`/coach/students/:id`）がルート未登録で現在デッドリンクになっている点も合わせて解消する。

---

## 追加で検討したい指標（残論点への提案。要ユーザー合意）

- **NPS/満足度**：定期アンケート、手動入力
- **コース完了までの平均期間**：既存タイムスタンプから自動算出可能（新規テーブル不要）
- **案件紹介への申込率・審査通過率**：ユーザー自身が挙げていたインセンティブ設計と直結する指標。1章の`job_acquisitions`とは別に、紹介申込・審査結果を記録する運営側フローの記録が必要
- **コーチング実施回数**：`mypage-real-data-requirements.md` 3章で「コーチング関連テーブルは一切存在しない」と判明済み。コーチングのテーブルを新設する際は、この指標も同時に自動集計できるようになる

---

## ユーザーからの2つの質問への回答

**Q. どんなログが取れているといいのか**
- `job_acquisitions`（案件獲得ログ）：user_id, program_id, acquired_at, is_first_job
- `revenue_records`（収益ログ）：user_id, program_id, period, amount
- `portfolio_submissions`（提出物ログ）：user_id, course, submission_url, submitted_at, review_status
- 受講継続率・プログラム別ステータスは**新規ログ不要**。既存の`lastaccess`・`progress_percent`に「離脱判定のしきい値（例：最終アクセスからN日）」を定義して集計すれば十分。

**Q. 今実装しているバックエンドの機能で実現可能なのか**
- 受講継続率・プログラム別ステータス・学習進捗そのものは**既存データの再利用で対応可能**（新規テーブル不要、集計エンドポイントの追加のみ）。
- 案件獲得・収益化・制作物は**ABSENT。新規テーブル・エンドポイントの設計が必要**（手動入力が前提）。
- 運営向け受講生リストは**現状の3画面がそもそも動いていない**（存在しないAPIを呼んでいる）うえ、複数ユーザーの進捗を一度に返す仕組みも無いため、バックエンドのロスター集計エンドポイントとフロント画面の実質的な再構築が必要。

---

## バックエンドチームへのTODOリスト（優先度順）

1. **[A]** 受講継続率の集計エンドポイントを新規追加（離脱判定のしきい値は運営と合意の上で決定）
2. **[A]** ロードマップ機能（`mypage-real-data-requirements.md`済み）を前提に、プログラム別ステータス導出ロジックを実装
3. **[B]** ロスター単位（コース/プログラム→全受講生の進捗%）の集計エンドポイントを新規設計・実装
4. **[B]** `AdminStudentsPage.tsx`を実エンドポイントに接続し、進捗・制作物・プログラムステータスでフィルタできるよう改修。`CoachStudentsPage.tsx`のデッドリンク（`/coach/students/:id`）も解消
5. **[B]** `job_acquisitions`テーブル設計＋入力経路（対象プログラム必須／それ以外任意）の実装
6. **[B]** `revenue_records`テーブル設計＋入力経路の実装
7. **[B]** `portfolio_submissions`テーブル設計＋既存ファイルアップロード機能の再利用（将来のMoodle`mod_assign`移行を見据えた緩い紐付けにする）

## 参照した実装
- `frontend/docs/mypage-real-data-requirements.md`（ロードマップ・継続関連の既存調査結果の再利用元）
- `frontend/src/components/admin/AdminStudentsPage.tsx` / `AdminCsvPage.tsx` / `AdminCoachMappingPage.tsx`、`frontend/src/components/coach/CoachStudentsPage.tsx`
- `bff-server/routes/moodle.js`・`bff-server/adapters/MoodleAdapter.js`
- `bff-server/init-service-db.sql`（未使用の`core_enrol_get_enrolled_users`権限）
- `api-server/entities/webcoach.py`・`api-server/routers/admin.py`
