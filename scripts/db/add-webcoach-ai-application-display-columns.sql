-- webcoach_ai_application に一覧表示用カラムを追加し、Dify連携アプリ(id=14〜22)の表示名・説明を入れる
--
-- name/description はAIチャットのツール説明文（LLMがどのアプリを呼ぶか決める材料）にも使われるため、
-- 受講生向けの「AIコーチでできること」一覧の文言は別カラムに分けた。
-- NULLの間は画面側が既定の文言（frontend/src/types/aiSkill.ts の AI_SKILL_META）を出す。
-- 表示名は「アプリ名」ではなく「できること」で書く方針（2026-09-26決定）。
-- 行の特定は環境ごとにずれうる id ではなく secret_key で行う。

ALTER TABLE `webcoach_ai_application`
  ADD COLUMN `display_name` varchar(256) NULL COMMENT '一覧（AIコーチでできること）に出す表示名' AFTER `secret_key`,
  ADD COLUMN `display_description` varchar(512) NULL COMMENT '一覧（AIコーチでできること）に出す説明文' AFTER `display_name`;

UPDATE `webcoach_ai_application` SET
  `display_name` = '今日のデザイン課題に挑戦する',
  `display_description` = '使える時間と挑戦したい分野を伝えると、その日のデザイン課題を出します。仕上げた画像を送るとフィードバックが返ります。'
WHERE `secret_key` = 'design-sprint-challenger';

UPDATE `webcoach_ai_application` SET
  `display_name` = '専門用語をわかりやすくする',
  `display_description` = '教材や募集文に出てきた専門用語を、身近な言葉とたとえに置き換えて説明します。'
WHERE `secret_key` = 'technical-term-ai-assistant';

UPDATE `webcoach_ai_application` SET
  `display_name` = '制作物を添削する',
  `display_description` = '制作物の画像と、案件の概要・届けたい相手を伝えると、プロの視点で改善点を返します。'
WHERE `secret_key` = 'design-feedback-mentor-pro-v2';

UPDATE `webcoach_ai_application` SET
  `display_name` = 'キャッチコピーを考える',
  `display_description` = '誰に何を伝えたいかを渡すと、狙いの違うコピー案を並べて比べられます。'
WHERE `secret_key` = 'catchcopy-idea-maker';

UPDATE `webcoach_ai_application` SET
  `display_name` = '応募文をつくる・添削する',
  `display_description` = '募集内容と自分の実績から、相手が判断しやすい応募文をつくります。書いた応募文の添削もできます。'
WHERE `secret_key` = 'project-application-writer';

UPDATE `webcoach_ai_application` SET
  `display_name` = 'AIと面接練習をする',
  `display_description` = 'AIが面接官役になって質問し、答えたその場で伝わり方を振り返ります。応募する求人に合わせた練習もできます。'
WHERE `secret_key` = 'ai-interview-simulator';

UPDATE `webcoach_ai_application` SET
  `display_name` = 'クラウドワークスで案件を探す',
  `display_description` = '得意な作業や希望の条件に答えていくと、クラウドワークスで受けられそうな案件を探します。検索には1〜2分かかります。'
WHERE `secret_key` = 'project-extractor-crowdworks';

UPDATE `webcoach_ai_application` SET
  `display_name` = 'ランサーズで案件を探す',
  `display_description` = '得意な作業や希望の条件に答えていくと、ランサーズで受けられそうな案件を探します。検索には1〜2分かかります。'
WHERE `secret_key` = 'project-extractor-lancers-lite-hardgate';

UPDATE `webcoach_ai_application` SET
  `display_name` = 'ココナラで案件を探す',
  `display_description` = '得意な作業や希望の条件に答えていくと、ココナラで受けられそうな案件を探します。検索には1〜2分かかります。'
WHERE `secret_key` = 'project-extractor-coconala';
