# WEBCOACH LMS タイポグラフィガイドライン

## これは何か

文字サイズ・ウェイト・行間・文字色の決め方。実装は `frontend/src/index.css` の
`.mypage-3d` スコープにある CSS カスタムプロパティが唯一の情報源で、
このドキュメントはその値を「なぜそうしたか」とセットで説明するもの。

トークンの実寸は `/dev/catalog`（`components/dev/DevCatalogPage.tsx`）の
「3. タイポグラフィと可変スケール」で実行時に測って表示している。
**ブラウザ幅を変えながらそこを見るのが、この文書を読むより早い。**

## 1. 基本方針

LMS では「おしゃれさ」よりも、**長時間見ても疲れず、何をすべきか瞬時に理解できること**を優先する。

WEBCOACH では

> 学習する → 次にやることを確認する → 記録を見る

という行動を迷わせないため、サイズの種類を増やしすぎず、重要度で明確な強弱をつける。

- **12px = 補足情報専用**
- **14px = UI の最低基本サイズ**
- **16px = 行動に関わる文字**
- **20px = コンテンツタイトル**
- **28px以上 = 成果・数値**

## 2. サイズトークン

| トークン | 実寸 | 役割 | 例 |
|---|---|---|---|
| `--dc-fs-caption` | 12px 固定 | 補足専用 | 日時、目安時間、曜日、脚注、単位ラベル |
| `--dc-fs-body` | 14px 固定 | UI 標準 | タブ、ナビ、説明文、カード内サブ情報、セカンダリボタン |
| `--dc-fs-lead` | 16px 固定 | 行動と主要ラベル | CTA、タスク名、カード見出し h2、数値の単位 |
| `--dc-fs-title` | 20px 固定 | コンテンツ名 | レッスン名、編集中の主役の値 |
| `--dc-fs-display` | clamp(28px, 1.68vw, 32px) | h1・KPI の数値 | ページタイトル、総学習時間、連続日数 |
| `--dc-fs-hero` / `-sm` / `-xs` | clamp(36〜28px, …, 62〜42px) | ストリークの巨大数字 | StreakHeroCard の日数（桁数で3段） |

**21〜27px は意図的に空けている。** 見出しとコンテンツ名が 2px 差で並ぶと、
どちらも太字のときに階層が読めなくなる。

### なぜ 20px 以下は固定 px なのか

`index.css` の `--dc-sp-*`（余白）は幅に連動する可変スケール（`clamp` + `vw`）で、
表示倍率125%の環境で情報が入らなくなる問題を解くために入れたもの。
**フォントサイズも同じ仕組みに乗せていたが、それが失敗だった。**

可変にすると、表示倍率125%（＝実効幅1520px相当）でほぼ全段が `clamp` の下限に張り付く。
移行前の実効サイズは:

| 旧トークン | 用途 | 1520px での実寸 |
|---|---|---|
| `--dc-fs-title` | カード見出し h2 | 13.5px |
| `--dc-fs-xs` | 最頻出のラベル・コース名 | 10.5px |
| `--dc-fs-3xs` | 脚注・カレンダー日付 | 10px |
| `--dc-fs-4xs` | 曜日・棒グラフの値 | 9.5px |

つまり「14px が UI の下限」に対して、最新画面が 10.5px を主力サイズにしていた。
幅に関係なく下限を守るため、20px 以下は固定 px に戻した。

28px 以上だけ可変を残しているのは、逆の理由。125%環境で成果の数値が原寸のまま残ると、
カードが縦に伸びて画面に情報が入らなくなる。可変の係数は
`最大値 × 100 / 1900`（基準幅1900pxで最大値）で出す。

### なぜ名前を役割ベースにしたのか

旧トークンは `4xs / 3xs / 2xs / xs / sm / base / 14 / 15 / lesson / md / lg / xl / 2xl` と
**サイズで名付けていた**。そのため同じトークンが「注記」と「主要ラベル」の両方に使われ、
名前を見てもどちらを大きくすべきか判断できなかった（`--dc-fs-xs` は20箇所で使われ、
その内訳は注記とコース名とボタンが混在していた）。19トークンを7つに畳んだ。

## 3. 文字サイズの下限

**12px 未満は作らない。**

11px 以下だと

- 日本語の漢字が潰れる
- 補足情報が「読まなくていい情報」に見える
- 画面全体が管理画面のようになる
- モニタ環境によってかなり読みにくくなる

12px を使ってよいのは「目安15分」「前回：昨日 21:32」「5/11ページ」のように、
**読めなくても主要操作に影響しない情報だけ**。
タスク名・ボタン・ナビゲーションに 12px は使わない。

## 4. Weight

| weight | 用途 |
|---|---|
| 400 | 説明、補足、通常の文章 |
| 500 | UI ラベル、ナビゲーション、統計のラベル |
| 600 | ボタン、タスク名、少し重要な情報 |
| 700 | 見出し、重要な数値、ページタイトル |

**800〜900 は使わない。** WEBCOACH は赤が強い UI なので、太字まで強くすると画面全体がうるさくなる。

🔴 移行前の `.mypage-3d` 系は見出しに 800 を多用していた。数値を大きくするぶん、
ラベル側は 500 に落とす（§6 参照）。

## 5. 行間

日本語は英語より広めに取る。

| トークン | 値 | 用途 |
|---|---|---|
| `--dc-lh-hero` | 1.2 | 28px 以上の数値 |
| `--dc-lh-heading` | 1.4 | 16px / 20px の見出し |
| `--dc-lh-ui` | 1.6 | 14px の1行 UI・ラベル |
| `--dc-lh-prose` | 1.7 | 2行以上になる説明文 |

2行以上の文章を 1.3 台にすると窮屈なので避ける。逆に 1.8〜1.9 も使わない
（移行前は 1.9 が多かったが、文字を大きくしたので行間比率は下げてよい）。

数字だけの箱（`StreakHeroCard` の日数など）は `lineHeight: 1` のままでよい。
1.2 にすると 62px の数字に 12px の余分な行送りが付いてカードが伸びるだけ。

## 6. 数値は文章より大きくする

学習状況系の UI で重要。

```
連続学習日数        ← --dc-fs-body (14px) / 500
5 日連続で学習中     ← 数字 --dc-fs-hero-xs、「日連続で学習中」 --dc-fs-lead (16px)
```

「5日」を全部同じサイズで組むより、**数字を大きく・単位を小さく**したほうが
ダッシュボードとして読める。`128時間45分` も同様に数字だけ `--dc-fs-display` にする。

対になるルールとして、**ラベルは太字にしない**（500）。
ラベルまで 700 にすると隣の数字と強さが並んで、どちらが主役か分からなくなる。

## 7. 文字色

| 用途 | トークン |
|---|---|
| 主要文字 | `--dc-text` |
| 通常文字 | `--dc-text-body` |
| 補足文字 | `--dc-text-muted` |
| 非活性・かなり弱い情報 | `--dc-text-subtle` |
| ブランド・CTA | `--dc-primary` |

すべて真っ黒にはしない。

## 8. 赤を使う場所

WEBCOACH は赤がブランドカラーなので、使いすぎると全部重要に見える。赤にしてよいのは

- CTA
- リンク
- 現在地（今日・選択中）
- 達成・進捗の強調
- 学習時間などの一部の重要数値

だけ。カードタイトルや本文まで赤にはしない。

## 9. 太字 × 赤 × 大サイズを重ねない

`--dc-fs-display` 以上 + 700 + `--dc-primary` は最強の表現。
1画面でこれを使えるのは**本当に強調したいもの1〜2個まで**。

現状これを使っているのは:

- `ResumeStudyCard` の「続きから学習する」（マイページ唯一の Primary CTA）
- `StudyDashboardCard` の連続学習日数
- `StudyChallengeCard` の「あと◯分で◯位！」

それ以外は「大きいけど黒」「赤だけど小さい」「太字だけど14px」のように強さを落とす。

## 10. レイアウトが壊れたときの直し方

文字を大きくすると、狭い幅で溢れる箇所が出る。**ブレークポイントを上げて逃げる前に、
構造で塞げないかを見る。** しきい値を上げると、まだ横並びで読める幅なのに縦積みになって
密度が落ちる。

- 見出しの `whiteSpace: 'nowrap'` は基本外して2行折り返しを許す
  （ただし「みんなのランキ／ング」のように語中で割れるのを防ぐ目的の nowrap は残す。
   その場合は親を `flexWrap: 'wrap'` にして右の要素を次の行へ落とす）
- グリッドの列に入る数値ラベルは `min-width: 0` + `ellipsis` で切る
  （`.mypage-dash-col` がこれ。grid の子は既定で `min-width: auto` なので、
   0 にしないと `overflow` も `ellipsis` も効かない）
- 数値＋単位の組は nowrap を保ち、親の `flexWrap: 'wrap'` で逃がす
- `minmax()` の下限がフォントサイズから算出されている箇所は必ず再計算する
  （`.mypage-kpi-grid` の 132px = ラベル7文字 × 14px + パディング24px + 余裕）

## 11. レビュー時のチェックリスト

画面を見るときはこれだけ確認する。

- [ ] 12px 未満が存在していないか
- [ ] タスク名・ボタンが 14px 未満になっていないか
- [ ] 主要コンテンツ名が 20px になっているか
- [ ] 補足情報と主要情報に明確な差があるか
- [ ] 赤・700・28px 以上を重ねているのが1画面に1〜2個までか
- [ ] 同じ意味の要素でサイズがバラバラになっていないか（全カードの h2 が `--dc-fs-lead` に揃っているか）
- [ ] **1520px 幅**（＝1920px を表示倍率125%）で溢れていないか

機械的にはこう確認できる。

🔴 対象を**移行済みファイルだけ**に絞ってあるのが重要。`components/mypage/` を丸ごと
grep すると、5a 時代の未使用カード（`StatsStrip` `LearningStreakCard` `RoadmapStrip`
`ContinueLearningHero` `GuildLobby*` `PeopleActivityCard` `NextCoachingPlan` `RoadmapRail`）が
生px直書きのまま残っているので、常にヒットして役に立たない。

```bash
cd frontend/src
FILES="components/MyPage.tsx components/shared/RankingRow.tsx
components/mypage/MypageGreeting.tsx components/mypage/ResumeStudyCard.tsx
components/mypage/CoachingTaskCard.tsx components/mypage/StudyDashboardCard.tsx
components/mypage/WeeklyGoalModal.tsx components/mypage/StreakHeroCard.tsx
components/mypage/StudyChallengeCard.tsx components/mypage/PeerRankingCard.tsx
components/mypage/StudyRecordCard.tsx components/studyLog/StudyLogPage.tsx
components/studyLog/StudyRecordPanel.tsx components/studyLog/StreakCalendarCard.tsx
components/studyLog/RankingListCard.tsx
components/MaterialsTopPage.tsx components/materials/AreaCoursesPage.tsx
components/materials/CourseTile.tsx components/shared/LearningBreadcrumb.tsx"

# 旧トークンが残っていないか
grep -n "dc-fs-\(4xs\|3xs\|2xs\|xs\|sm\|base\|lesson\|14\|15\|kpi-sub\|unit\|md\|lg\|xl\|2xl\)\b" $FILES
# 800/900 が残っていないか（t.font.weight.black は撤去済みなので復活させない）
grep -n "fontWeight: [89]00\|font\.weight\.black" $FILES
# 行間が 1.8 以上のまま残っていないか
grep -n "lineHeight: 1\.[89]" $FILES
# 生px直書きが増えていないか
grep -n "fontSize: [0-9]" $FILES
```

すべて0件が正。

## 12. 適用範囲（2026-09-01 時点）

| 状態 | 対象 |
|---|---|
| ✅ 適用済み | 上の grep の `$FILES` 19ファイル（マイページ・学習記録・**学習する導線**・`shared/RankingRow.tsx`）と `index.css` の `:root` |
| ❌ 未適用 | `components/mypage/` に残る 5a 時代の未使用カード 8ファイル（`StatsStrip` `LearningStreakCard` `RoadmapStrip` `RoadmapRail` `ContinueLearningHero` `GuildLobby` `GuildLobbyCard` `PeopleActivityCard` `NextCoachingPlan`）。どれも現在の 8a マイページでは描画されておらず、5a に戻すとき用に残してあるだけ。**戻すなら先にここを移行すること**（`fontWeight: 900` や 10px が残っている） |
| ❌ 未適用 | `theme/webcoachTheme.ts` の `font.*` を参照する約60ファイル（教材・コーストップ・レッスン・AIコーチ・コーチング・管理・設定）。`font.caption` = 11.5px が112箇所、`font.meta` = 12.5px が52箇所など、**12px 未満が多数残っている** |
| ❌ 未適用 | `fontSize` の生px直書き約600箇所 |
| 🗑 撤去済み | `theme/tokens.ts` の `font.size` と `font.weight.black`(900)。参照は `pageTitle` の1箇所だけで、残りは生px直書きに散っており、**この系統の画面（学習する・領域一覧）だけが一段小さいまま取り残される原因**になっていたので型から消した |

### ⚠️ 「学習する」だけに残っている構造的な差

`MaterialsTopPage`（`/courses`）は `useScaleToFit(1440)` で **1440px 固定キャンバスを
`transform: scale()` で縮小している**。アプリ中でこの方式を使っているのはこのページだけ
（姉妹ページの `AreaCoursesPage` は普通の折り返し）。

- 幅 1512px 以上・サイドバー折りたたみ → `scale = 1`。**他ページと文字サイズが完全に一致する**
- サイドバー展開時、または幅 1512px 未満 → `scale ≒ 0.9`。**14px が 12.6px、12px が 10.8px** になり、
  この条件下では 12px 下限が守れない

トークン側では解決できない（固定pxを何pxにしても scale 倍される）。直すには
固定キャンバスをやめて折り返しにする必要があり、その場合 `.wc-area-cards` の固定3列と
AI検索結果の4列グリッドにメディアクエリを足すことになる。**フォントではなくレイアウトの
変更なので、必要になったら別で扱う。**

未適用の画面に手を入れるときは、`webcoachTheme.ts` の `font.*` 定義側を
このガイドラインの値に書き換えるのが最小の変更になる（参照側はトークン名が同じなら自動で追従する）。
ただし影響が約60ファイルに及ぶので、画面単位ではなく一度にやること。

## 13. 参考

- 実装: `frontend/src/index.css`（`.mypage-3d` スコープ）
- 実寸の確認: `/dev/catalog` の「3. タイポグラフィと可変スケール」
- 色・角丸・影のトークン: `frontend/docs/design-token-spec.md`
