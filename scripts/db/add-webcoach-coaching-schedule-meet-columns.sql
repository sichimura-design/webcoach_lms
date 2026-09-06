-- webcoach_coaching_schedule に Google Meet連携(Organizer中心モデル)用カラムを追加
-- 未適用 (draft) — UAT/本番への適用はユーザー承認後に別途実施
--
-- 予約(coaching_schedule)ごとにMeeting Spaceを1つ発行する方式(1予約=1 Space)にすることで、
-- 開催記録(Conference Record)と予約の紐づけを作成時点で確定させる。時間窓や参加者メールでの
-- 事後マッチングは不要。

ALTER TABLE `webcoach_coaching_schedule`
  ADD COLUMN `meeting_provider` varchar(32) DEFAULT NULL COMMENT 'ミーティングURLの発行元 (google_meet=システム自動発行, NULL=手動入力)' AFTER `meeting_url`,
  ADD COLUMN `meet_space_name` varchar(255) DEFAULT NULL COMMENT 'Google Meet APIのSpaceリソース名 (例: spaces/aBcD1234)。議事録取得時にConference Recordを検索するための内部ID。meeting_provider=google_meetの場合のみセット' AFTER `meeting_provider`;
