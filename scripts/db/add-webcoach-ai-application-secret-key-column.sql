-- webcoach_ai_application に secret_key カラムを追加
-- AIチャットからそのAIアプリを外部AI（Dify等）連携ツールとして呼び出せるようにする。
-- 値はAWS Secrets Managerに保存された認証情報JSON内のキー名を指す（実際のAPIキーはDBに保存しない）。
-- NULLの場合はチャット連携なし（既存のリンク先URLを開くだけのカードのまま）。
-- 適用済み環境: dev/uat (uat-moodle-db) 2026-08-26

ALTER TABLE `webcoach_ai_application`
  ADD COLUMN `secret_key` varchar(256) NULL COMMENT '外部AI連携用の認証情報キー名（Secrets Manager JSON内のキー、Dify等）' AFTER `tags`;
