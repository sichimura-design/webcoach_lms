-- webcoach_coaching_schedule にリマインドメール送信済みフラグ用カラムを追加
-- 適用済み環境: UAT, prod (2026-09-21)。devは未適用
--
-- 前日(JST)に受講生・コーチ双方へリマインドメールを送る定期処理(bff-server側の
-- ReminderService)が、二重送信を防ぐために使う。coaching_scheduleに時刻列が無いため、
-- 「実施日の前日に1回だけ送る」日次バッチ方式を前提にしている。

ALTER TABLE `webcoach_coaching_schedule`
  ADD COLUMN `reminder_sent_at` timestamp NULL DEFAULT NULL COMMENT 'リマインドメール送信日時(前日通知、二重送信防止用)' AFTER `todo`;
