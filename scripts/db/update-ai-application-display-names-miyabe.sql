-- 「AIコーチでできること」の表示名（display_name）を dev/miyabe に揃え、実在のアプリ名にする（2026-09-28決定）
--
-- 2026-09-26 は「できること」表記（例: 専門用語をわかりやすくする）にしていたが、
-- dev/miyabe の frontend/src/types/aiSkill.ts（AI_SKILL_META の label）と同じアプリ名表記に戻す。
-- コーチや教材が「デザインフィードバックメンタープロを使って」と案内したときに、画面のどれか通じるようにするため。
-- 表記はアプリ側と1文字もずらさない（「AI面接シュミレーター」もこの綴りのまま）。
-- 行の特定は secret_key で行う。

UPDATE `webcoach_ai_application` SET `display_name` = '専門用語AIアシスタント'            WHERE `secret_key` = 'technical-term-ai-assistant';
UPDATE `webcoach_ai_application` SET `display_name` = 'デザインスプリントチャレンジャー'    WHERE `secret_key` = 'design-sprint-challenger';
UPDATE `webcoach_ai_application` SET `display_name` = 'デザインフィードバックメンタープロ'  WHERE `secret_key` = 'design-feedback-mentor-pro-v2';
UPDATE `webcoach_ai_application` SET `display_name` = 'キャッチコピーアイデアメーカー'      WHERE `secret_key` = 'catchcopy-idea-maker';
UPDATE `webcoach_ai_application` SET `display_name` = '案件応募文 生成・添削メーカー'       WHERE `secret_key` = 'project-application-writer';
UPDATE `webcoach_ai_application` SET `display_name` = 'AI面接シュミレーター'               WHERE `secret_key` = 'ai-interview-simulator';
UPDATE `webcoach_ai_application` SET `display_name` = '案件抽出メーカー（クラウドワークス）' WHERE `secret_key` = 'project-extractor-crowdworks';
UPDATE `webcoach_ai_application` SET `display_name` = '案件抽出メーカー（ココナラ）'         WHERE `secret_key` = 'project-extractor-coconala';
UPDATE `webcoach_ai_application` SET `display_name` = '案件抽出メーカー（ランサーズ）'       WHERE `secret_key` = 'project-extractor-lancers-lite-hardgate';
