-- webcoach_coaching_schedule に status カラムを追加
-- webcoach_coaching_note を新規作成
-- 未適用 (draft) — UAT/本番への適用はユーザー承認後に別途実施

ALTER TABLE `webcoach_coaching_schedule`
  ADD COLUMN `status` enum('completed','interrupted','rescheduled') DEFAULT NULL COMMENT 'コーチング実施結果 (completed=終了, interrupted=中断, rescheduled=リスケ)' AFTER `coaching_date`;

CREATE TABLE `webcoach_coaching_note` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `coaching_schedule_id` bigint NOT NULL COMMENT '対象のコーチング回（webcoach_coaching_schedule.id）',
  `status` enum('ai_suggested','coach_confirmed','published') NOT NULL DEFAULT 'ai_suggested' COMMENT 'ノートの確認状態',
  `session_summary` text COMMENT 'セッション概要',
  `client_status_and_goal` text COMMENT 'Clientの現状と目標',
  `main_issues` text COMMENT '主な課題',
  `coach_feedback` text COMMENT 'Coachからのフィードバック',
  `decisions` text COMMENT '今回決めたこと',
  `client_next_actions` text COMMENT 'Clientの次回までのアクション',
  `coach_follow_up` text COMMENT 'Coach側のフォロー事項',
  `next_session_check` text COMMENT '次回確認すること',
  `published_at` timestamp NULL DEFAULT NULL COMMENT '受講生に公開された日時',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coaching_note_schedule` (`coaching_schedule_id`),
  CONSTRAINT `fk_coaching_note_schedule` FOREIGN KEY (`coaching_schedule_id`) REFERENCES `webcoach_coaching_schedule` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AIコーチングノート（下書き→コーチ確認→公開）';
