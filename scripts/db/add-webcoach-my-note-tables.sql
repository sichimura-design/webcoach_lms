-- webcoach_my_note_folder / webcoach_my_note の新規作成
-- 教材に紐づかない自由記述のマイノート機能（フォルダは入れ子対応、本文はMarkdown）
-- 適用済み環境: なし（draft、UAT/本番適用は別途承認後）

CREATE TABLE `webcoach_my_note_folder` (
  `folder_id` bigint NOT NULL AUTO_INCREMENT,
  `mdl_user_id` bigint NOT NULL COMMENT 'MoodleユーザーID',
  `name` varchar(255) NOT NULL COMMENT 'フォルダ名',
  `parent_folder_id` bigint DEFAULT NULL COMMENT '親フォルダ（NULLはルート直下）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`folder_id`),
  KEY `idx_my_note_folder_user` (`mdl_user_id`),
  KEY `idx_my_note_folder_parent` (`parent_folder_id`),
  CONSTRAINT `fk_my_note_folder_user` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_my_note_folder_parent` FOREIGN KEY (`parent_folder_id`) REFERENCES `webcoach_my_note_folder` (`folder_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='マイノート フォルダ（入れ子対応）';

CREATE TABLE `webcoach_my_note` (
  `noteid` bigint NOT NULL AUTO_INCREMENT,
  `mdl_user_id` bigint NOT NULL COMMENT 'MoodleユーザーID',
  `folder_id` bigint DEFAULT NULL COMMENT '所属フォルダ（NULLはルート直下）',
  `courseid` bigint DEFAULT NULL COMMENT '関連コース（任意）',
  `cmid` bigint DEFAULT NULL COMMENT '関連レッスン（Moodleコースモジュール(教材)ID）。教材画面からの逆引き用',
  `favorite` smallint NOT NULL DEFAULT '0' COMMENT '重要ラベル',
  `from_ai` smallint NOT NULL DEFAULT '0' COMMENT 'AIコーチの回答から作られたか',
  `from_coaching` smallint NOT NULL DEFAULT '0' COMMENT 'コーチングから作られたか',
  `title` varchar(255) NOT NULL COMMENT 'タイトル',
  `contents` mediumtext NOT NULL COMMENT 'Markdown形式の本文',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`noteid`),
  KEY `idx_my_note_user` (`mdl_user_id`),
  KEY `idx_my_note_folder` (`folder_id`),
  KEY `idx_my_note_course` (`courseid`),
  KEY `idx_my_note_cmid` (`cmid`),
  CONSTRAINT `fk_my_note_user` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_my_note_folder` FOREIGN KEY (`folder_id`) REFERENCES `webcoach_my_note_folder` (`folder_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_my_note_course` FOREIGN KEY (`courseid`) REFERENCES `mdl_course` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='マイノート 本体';
