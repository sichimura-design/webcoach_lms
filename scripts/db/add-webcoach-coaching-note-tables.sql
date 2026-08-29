-- webcoach_coaching_schedule / webcoach_study_note の新規作成
-- 設計レビュー内容: docs/dev-miyabe-backend-requirements.md 参照
-- 適用済み環境: UAT (uat-moodle-db) 2026-08-09

CREATE TABLE `webcoach_coaching_schedule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mdl_user_id` bigint NOT NULL COMMENT '受講生のMoodleユーザーID',
  `coach_user_id` bigint NOT NULL COMMENT 'コーチのMoodleユーザーID',
  `coaching_no` bigint NOT NULL COMMENT 'コーチング回数（表示用連番。student-coachペア内で採番）',
  `coaching_date` date NOT NULL COMMENT '実施日',
  `meeting_url` varchar(1024) NOT NULL,
  `coaching_summary` text COMMENT 'コーチング内容の要約',
  `todo` text COMMENT '次回までのTODO',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coaching_schedule_pair_no` (`mdl_user_id`,`coach_user_id`,`coaching_no`),
  KEY `idx_coaching_schedule_coach_date` (`coach_user_id`,`coaching_date`),
  CONSTRAINT `fk_coaching_schedule_student` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coaching_schedule_coach` FOREIGN KEY (`coach_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='コーチングスケジュール・実施記録';

CREATE TABLE `webcoach_study_note` (
  `mdl_user_id` bigint NOT NULL COMMENT 'MoodleユーザーID',
  `courseid` bigint NOT NULL COMMENT 'MoodleコースID',
  `cmid` bigint NOT NULL COMMENT 'Moodleコースモジュール(教材)ID',
  `content` text NOT NULL COMMENT 'メモの内容',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mdl_user_id`,`courseid`,`cmid`),
  KEY `idx_study_note_course` (`courseid`),
  CONSTRAINT `fk_study_note_user` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_study_note_course` FOREIGN KEY (`courseid`) REFERENCES `mdl_course` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='教材ごとの学習メモ（1ユーザー1教材につき1件）';
