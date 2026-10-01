-- デザインフィードバックメンターPro（制作物添削モード）の一覧の説明を、アプリの進め方に合わせる
--
-- 以前の説明「画像をアップロードすると、教材と課題の基準に沿って改善点を項目別に確認できます。」は
-- dev/miyabe の独自添削機能（/webcoach/ai-skill、未実装）向けの文言だった。実際に動く Dify アプリは
-- 「デザインの種類・目的・ターゲット → クライアントとターゲットを選ぶ → 最後に画像」の順で進み、
-- 教材の内容も受け取らない。案内どおり最初に画像を送ると「プロジェクトの情報と異なる内容」と弾かれていた。
-- 画面側の文言（frontend/src/types/aiSkill.ts の design-review）も同じ内容に揃えている。
-- 前提: add-webcoach-ai-application-display-columns.sql 適用済み。行の特定は secret_key で行う。

UPDATE `webcoach_ai_application`
SET `display_description` = 'デザインの種類・目的・ターゲットを伝え、クライアントとターゲットを選んでから画像を送ると、その目線で講評します。'
WHERE `secret_key` = 'design-feedback-mentor-pro-v2';
