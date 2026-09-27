-- webcoach_ai_application に一覧の分類・並び順を追加し、説明・分類・並び順を dev/miyabe の一覧に合わせる
--
-- 「AIコーチでできること」の一覧は、顔ぶれ・表示名・説明・分類・並び順をすべてDBで決める（2026-09-28決定）。
-- 画面側（frontend/src/types/aiSkill.ts）に残すのはアイコン・入力例・モード中の文言だけ。
-- 値は dev/miyabe の frontend/src/types/aiSkill.ts（AI_SKILL_META の説明・分類・宣言順）に合わせた。
--   ・分類の見出しと順: 学習サポート → 制作サポート → 案件獲得（各分類の sort_order の最小値の順に並ぶ）
--   ・miyabe の「動画編集フィードバックPro」(sort_order 40 の位置) はDBにアプリが無いため出ない
--   ・表示名（display_name）は「できること」表記のまま（2026-09-26決定）。ここでは変えない
-- 前提: add-webcoach-ai-application-display-columns.sql 適用済み。行の特定は secret_key で行う。

ALTER TABLE `webcoach_ai_application`
  ADD COLUMN `display_category` varchar(64) NULL COMMENT '一覧で束ねる分類の見出し（例: 学習サポート）' AFTER `display_description`,
  ADD COLUMN `sort_order` int NULL COMMENT '一覧の並び順（小さい順。分類の並びも各分類の最小値で決まる）' AFTER `display_category`;

UPDATE `webcoach_ai_application` SET `display_category` = '学習サポート', `sort_order` = 10,
  `display_description` = '専門用語や回りくどい文章を、身近な言葉とたとえに置き換えて説明します。'
WHERE `secret_key` = 'technical-term-ai-assistant';

UPDATE `webcoach_ai_application` SET `display_category` = '学習サポート', `sort_order` = 20,
  `display_description` = '使える時間と分野を答えると、その日のデザイン課題を出します。仕上げて出すとフィードバックが返ります。'
WHERE `secret_key` = 'design-sprint-challenger';

UPDATE `webcoach_ai_application` SET `display_category` = '制作サポート', `sort_order` = 30,
  `display_description` = '画像をアップロードすると、教材と課題の基準に沿って改善点を項目別に確認できます。'
WHERE `secret_key` = 'design-feedback-mentor-pro-v2';

UPDATE `webcoach_ai_application` SET `display_category` = '制作サポート', `sort_order` = 50,
  `display_description` = '誰に何を伝えたいかを渡すと、狙いの違うコピー案を並べて比べられます。'
WHERE `secret_key` = 'catchcopy-idea-maker';

UPDATE `webcoach_ai_application` SET `display_category` = '案件獲得', `sort_order` = 60,
  `display_description` = '募集内容と自分の実績から、相手が判断できる応募文を組み立てます。'
WHERE `secret_key` = 'project-application-writer';

UPDATE `webcoach_ai_application` SET `display_category` = '案件獲得', `sort_order` = 70,
  `display_description` = 'AIが面接官役になって質問し、答えたその場で伝わり方を振り返ります。'
WHERE `secret_key` = 'ai-interview-simulator';

UPDATE `webcoach_ai_application` SET `display_category` = '案件獲得', `sort_order` = 80,
  `display_description` = 'できることと使える時間を整理して、クラウドワークスで受けられる案件の条件まで絞ります。'
WHERE `secret_key` = 'project-extractor-crowdworks';

UPDATE `webcoach_ai_application` SET `display_category` = '案件獲得', `sort_order` = 90,
  `display_description` = 'できることと使える時間を整理して、ココナラで受けられる案件の条件まで絞ります。'
WHERE `secret_key` = 'project-extractor-coconala';

UPDATE `webcoach_ai_application` SET `display_category` = '案件獲得', `sort_order` = 100,
  `display_description` = 'できることと使える時間を整理して、ランサーズで受けられる案件の条件まで絞ります。'
WHERE `secret_key` = 'project-extractor-lancers-lite-hardgate';
