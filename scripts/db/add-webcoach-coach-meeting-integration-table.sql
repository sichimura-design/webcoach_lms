-- webcoach_coach_meeting_integration の新規作成
-- コーチのZoom/Google Meet連携情報（OAuthトークン）を管理する
-- トークンはbff-server側でAES-256-GCM暗号化された文字列として保存される（api-serverは暗号文をそのまま保存・返却するのみ）
-- 適用済み環境: uat (2026-08-10)

CREATE TABLE `webcoach_coach_meeting_integration` (
  `coach_user_id` bigint NOT NULL COMMENT 'コーチのMoodleユーザーID',
  `provider` varchar(32) NOT NULL COMMENT '連携先 (zoom, google)',
  `access_token_enc` text NOT NULL COMMENT '暗号化済みアクセストークン',
  `refresh_token_enc` text NOT NULL COMMENT '暗号化済みリフレッシュトークン',
  `token_expires_at` timestamp NOT NULL COMMENT 'アクセストークン有効期限',
  `scope` varchar(512) DEFAULT NULL COMMENT '付与されたスコープ',
  `provider_account_email` varchar(256) DEFAULT NULL COMMENT '連携先アカウントのメールアドレス（表示用）',
  `connected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '初回連携日時',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  PRIMARY KEY (`coach_user_id`,`provider`),
  KEY `idx_coach_meeting_integration_coach` (`coach_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='コーチのZoom/Google Meet連携情報（OAuthトークン）';
