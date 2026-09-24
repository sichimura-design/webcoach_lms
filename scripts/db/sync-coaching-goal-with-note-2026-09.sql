-- AIコーチングノート(webcoach_coaching_note.client_next_actions)公開時に
-- webcoach_next_coaching_goalへ自動反映するための移行。
-- 対象: dev/uat共用RDS(uat-moodle-db)。

-- 1. webcoach_coaching_schedule.coaching_summary/todoを削除
--    (AIコーチングノートと役割が重複していたコーチ手入力欄)
ALTER TABLE webcoach_coaching_schedule
  DROP COLUMN coaching_summary,
  DROP COLUMN todo;

-- 2. webcoach_next_coaching_goalの主キーを(mdl_user_id, no)から
--    (coaching_schedule_id, no)に変更。
--    既存データは適用時点で3行(mdl_user_id=11)のみで、紐付け先の
--    coaching_scheduleが1件も無い孤立テストデータだったため削除する。
--    (実ユーザーデータが存在する環境で流用する場合はこのDELETEを外し、
--     coaching_schedule_idのバックフィルを別途検討すること)
DELETE FROM webcoach_next_coaching_goal;

ALTER TABLE webcoach_next_coaching_goal
  DROP PRIMARY KEY,
  DROP INDEX idx_webcoach_next_goal_user,
  ADD COLUMN coaching_schedule_id BIGINT NOT NULL COMMENT 'コーチング回ID' AFTER mdl_user_id,
  ADD PRIMARY KEY (coaching_schedule_id, no),
  ADD INDEX idx_webcoach_next_goal_user (mdl_user_id);
