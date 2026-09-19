-- 学習の日別振り返り(達成度・メモ)を持つテーブルを新規追加
-- UAT: 適用済み(2026-09-19)。dev/本番は未適用 — 適用はユーザー承認後に別途実施
--
-- 学習時間・教材・区間はMoodleログ(mdl_logstore_standard_log)から都度算出するものを
-- 正とし、このテーブルには持たない(二重管理・ストリーク/ランキング定義の分岐を避けるため)。
-- ここが持つのは本人にしか分からない自己申告(達成度・メモ)だけ。1ユーザー1日につき1件。

CREATE TABLE `webcoach_study_reflection` (
  `mdl_user_id` bigint NOT NULL COMMENT 'MoodleユーザーID',
  `local_date` date NOT NULL COMMENT '振り返り対象の日(JSTローカル日付)',
  `achievement` varchar(8) DEFAULT NULL COMMENT '自己申告の達成度 (low, mid, high)',
  `memo` text COMMENT 'その日の振り返りメモ',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mdl_user_id`, `local_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
