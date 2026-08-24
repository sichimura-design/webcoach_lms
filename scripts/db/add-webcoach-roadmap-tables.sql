-- webcoach_roadmap_* の新規作成
-- 設計検討: docs/career-roadmap-table-design.md 参照
-- 適用済み環境: (未適用)
--
-- 注: 移植元(feature/dify-ai-integrationブランチ等)では旧 webcoach_learning_roadmap /
-- webcoach_learning_roadmap_step を実質デッドと判断してDROPしているが、このブランチ(dev/kanegae)では
-- それらのテーブルが既存の別機能 api-server/routers/roadmaps.py (末尾s、モックカタログ系API)から
-- 依然として参照されているため、DROPは意図的に行わない。

-- スキル種別マスタ（Webデザイナー/動画編集 等）
CREATE TABLE `webcoach_roadmap_skill` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL COMMENT 'システム内部識別子。例: web_design',
  `name` varchar(128) NOT NULL COMMENT '表示名。例: Webデザイナー',
  `goal_label` varchar(256) NOT NULL COMMENT '画面表示用の最終ゴール文言。例: Webデザイナーとして初案件を獲得する',
  `display_order` smallint NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roadmap_skill_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ロードマップのスキル種別マスタ';

-- スキルごとのフェーズ・テンプレート
CREATE TABLE `webcoach_roadmap_phase` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `skill_id` bigint NOT NULL COMMENT 'スキルの種類(webデザイナー/動画編集など)',
  `phase_no` smallint NOT NULL COMMENT 'phase no',
  `name` varchar(128) NOT NULL COMMENT 'phase名',
  `goal` text NOT NULL COMMENT 'このフェーズの目的',
  `milestone` text DEFAULT NULL COMMENT '完了の目安となるマイルストーン',
  `duration_days` smallint DEFAULT NULL COMMENT '想定期間(日数)。フェーズ開始時にendを自動算出する用途',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roadmap_phase_skill_no` (`skill_id`,`phase_no`),
  CONSTRAINT `fk_roadmap_phase_skill` FOREIGN KEY (`skill_id`) REFERENCES `webcoach_roadmap_skill` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='スキル別ロードマップのフェーズ・テンプレート';

-- フェーズ内で取り組むテーマのテンプレート（画面の一覧表示に使用。スキルはphase_id経由で暗黙的に決まる）
CREATE TABLE `webcoach_roadmap_todo` (
  `phase_id` bigint NOT NULL COMMENT '対象フェーズ(webcoach_roadmap_phase.id)',
  `todo_no` smallint NOT NULL COMMENT 'フェーズ内の表示順',
  `description` varchar(256) NOT NULL COMMENT '取り組むテーマ。例: バナー制作',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`phase_id`,`todo_no`),
  CONSTRAINT `fk_roadmap_todo_phase` FOREIGN KEY (`phase_id`) REFERENCES `webcoach_roadmap_phase` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='フェーズで取り組むテーマのテンプレート';

-- ユーザーが選択したロードマップ（掛け持ち非対応、同時アクティブは1件のみ）
CREATE TABLE `webcoach_user_roadmap` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mdl_user_id` bigint NOT NULL COMMENT 'userid',
  `skill_id` bigint NOT NULL COMMENT 'スキルの種類(webデザイナー/動画編集など)',
  `is_completed` smallint NOT NULL DEFAULT '0' COMMENT '完了か',
  `active_marker` tinyint GENERATED ALWAYS AS (CASE WHEN `is_completed` = 0 THEN 1 ELSE NULL END) STORED COMMENT '未完了時のみ1。同時アクティブ1件制約の補助列',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_roadmap_one_active` (`mdl_user_id`,`active_marker`),
  CONSTRAINT `fk_user_roadmap_user` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roadmap_skill` FOREIGN KEY (`skill_id`) REFERENCES `webcoach_roadmap_skill` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザーが選択したロードマップ';

-- ユーザーのフェーズ進捗（旧名webcoach_learning_roadmapは削除した実在テーブルと衝突するため改名）
CREATE TABLE `webcoach_roadmap_progress` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_roadmap_id` bigint NOT NULL COMMENT '対象ロードマップ(webcoach_user_roadmap.id)',
  `phase_id` bigint NOT NULL COMMENT '対象フェーズ(webcoach_roadmap_phase.id)',
  `status` enum('not_started','in_progress','completed','skipped') NOT NULL DEFAULT 'not_started',
  `start` date DEFAULT NULL COMMENT '開始日',
  `end` date DEFAULT NULL COMMENT '終了日（期日）。コーチが直接編集可',
  `updated_by` bigint DEFAULT NULL COMMENT '期日を最後に編集したコーチのmdl_user_id',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roadmap_progress_phase` (`user_roadmap_id`,`phase_id`),
  KEY `idx_roadmap_progress_status` (`user_roadmap_id`,`status`),
  CONSTRAINT `fk_roadmap_progress_user_roadmap` FOREIGN KEY (`user_roadmap_id`) REFERENCES `webcoach_user_roadmap` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roadmap_progress_phase` FOREIGN KEY (`phase_id`) REFERENCES `webcoach_roadmap_phase` (`id`),
  CONSTRAINT `fk_roadmap_progress_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `mdl_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザーのフェーズ進捗';

-- 見直し用の固定質問（全ユーザー・全スキル共通）
CREATE TABLE `webcoach_roadmap_question` (
  `review_no` smallint NOT NULL COMMENT 'n回目の質問か',
  `question_no` smallint NOT NULL COMMENT '質問番号',
  `question` text NOT NULL COMMENT '質問',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_no`,`question_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='見直し用の固定質問';

-- 見直し質問への回答
CREATE TABLE `webcoach_roadmap_answer` (
  `mdl_user_id` bigint NOT NULL COMMENT 'userid',
  `review_no` smallint NOT NULL COMMENT 'n回目の質問か',
  `question_no` smallint NOT NULL COMMENT '質問番号',
  `answer` smallint NOT NULL COMMENT '解答の選択肢',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '回答日時',
  PRIMARY KEY (`mdl_user_id`,`review_no`,`question_no`),
  CONSTRAINT `fk_roadmap_answer_user` FOREIGN KEY (`mdl_user_id`) REFERENCES `mdl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roadmap_answer_question` FOREIGN KEY (`review_no`,`question_no`) REFERENCES `webcoach_roadmap_question` (`review_no`,`question_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='見直し質問への回答';
