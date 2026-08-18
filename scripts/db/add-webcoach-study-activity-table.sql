-- webcoach_study_activity の新規作成
-- 集中ブース（学習継続・集中ブース機能）の学習セッション記録
-- 適用済み環境: (未適用)
--
-- 学習時間・ストリーク・カレンダー・週次/月次/通算ランキング集計の正データ。
-- 開始/終了それぞれ、Moodle側の mdl_logstore_standard_log にも監査ログとして
-- \local_webcoach_utils\event\study_session_started / study_session_ended が記録される
-- (mod_quizが自前のattemptテーブルとイベントログの両方を持つのと同じ構成。実データはこちら、
-- ログ側は補助的な監査証跡)。既存のログインストリーク機能(\core\event\user_loggedin)とは
-- 意味的に独立しており、学習開始・終了をuser_loggedinに混在させない。

CREATE TABLE `webcoach_study_activity` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mdl_user_id` bigint NOT NULL COMMENT 'MoodleユーザーID',
  `courseid` bigint DEFAULT NULL COMMENT '学習対象のMoodleコースID(任意)',
  `course_title` varchar(256) DEFAULT NULL COMMENT '表示用に非正規化したコース名',
  `status` varchar(16) NOT NULL DEFAULT 'in_progress' COMMENT 'in_progress, completed',
  `started_at` timestamp NOT NULL COMMENT '開始日時',
  `ended_at` timestamp NULL DEFAULT NULL COMMENT '終了日時',
  `local_date` date NOT NULL COMMENT '開始時点のJST日付(YYYY-MM-DD)。カレンダー/ストリーク集計のバケット',
  `target_minutes` bigint DEFAULT NULL COMMENT '開始時に選択した目標時間(分)',
  `duration_minutes` bigint DEFAULT NULL COMMENT '終了時の最終確定学習時間(分)。集計・ランキングの正データ',
  `measured_seconds` bigint DEFAULT NULL COMMENT 'サーバー側で実測した経過秒数(started_at〜ended_at)',
  `paused_seconds` bigint NOT NULL DEFAULT '0' COMMENT '一時停止した合計秒数(クライアント申告)',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_study_activity_user_date` (`mdl_user_id`,`local_date`),
  KEY `idx_study_activity_user_status` (`mdl_user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='集中ブースの学習セッション記録（開始〜終了）';
