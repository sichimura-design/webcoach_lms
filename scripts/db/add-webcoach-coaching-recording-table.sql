-- webcoach_coaching_recording の新規作成
-- コーチングセッションの録画（Zoom/Google Meet）をS3に保存し、そのメタデータを管理する
-- 適用済み環境: (未適用)

CREATE TABLE `webcoach_coaching_recording` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `coaching_schedule_id` bigint NOT NULL COMMENT '対象のコーチング回（webcoach_coaching_schedule.id）',
  `recording_type` enum('video','audio','transcript','chat') NOT NULL COMMENT '録画ファイルの種別',
  `source` enum('zoom','google_meet') NOT NULL COMMENT '取得元サービス',
  `external_recording_id` varchar(255) COMMENT '取得元サービス側の録画ID（重複取得防止用）',
  `s3_bucket` varchar(255) NOT NULL COMMENT '保存先S3バケット名',
  `s3_key` varchar(1024) NOT NULL COMMENT '保存先S3オブジェクトキー',
  `status` enum('pending','downloading','completed','failed') NOT NULL DEFAULT 'pending' COMMENT '取得処理の状態',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recording_schedule_type` (`coaching_schedule_id`,`recording_type`),
  KEY `idx_recording_schedule` (`coaching_schedule_id`),
  CONSTRAINT `fk_recording_schedule` FOREIGN KEY (`coaching_schedule_id`) REFERENCES `webcoach_coaching_schedule` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='コーチング録画ファイルのメタデータ管理（実データはS3）';
