-- webcoach_user_profile に weekly_target_minutes(週間学習時間目標、分)カラムを追加
-- api-server/entities/webcoach.py で以前から参照されていたが、追跡済みのマイグレーションSQLが
-- 存在しなかったため、UAT/本番の実スキーマから直接再構築して追加(2026-09-21)。
-- 適用済み環境: dev/uat (uat-moodle-db、適用時期不明), prod (2026-09-21)

ALTER TABLE `webcoach_user_profile`
  ADD COLUMN `weekly_target_minutes` smallint DEFAULT NULL AFTER `avatar_id`;
