-- local_webcoach_utils の webservice 関数を moodle-api-service に登録する
-- bff-server のトークンは db/services.php で自動管理される「WebCoach Utilities Service」ではなく、
-- 手動管理サービス「moodle-api-service」(component IS NULL) で発行されている。
-- プラグインのアップグレードでは moodle-api-service に関数が自動追加されないため、
-- 未登録の関数を呼ぶと「アクセスコントロール例外 (accessexception)」になる。
-- (2026-09-28: get_course_tags が未登録で、コース一覧を開くたびにタグ取得が失敗していた)
--
-- 前提: プラグインをアップグレード済みで、mdl_external_functions に関数が登録されていること。
-- 関数が未登録・登録済みの行は何もしないので、何度流してもよい。
-- 適用後は Moodle のキャッシュをクリアする:
--   php admin/cli/purge_caches.php
-- 適用済み環境: dev/uat (study_session系等は2026-09-09、course_tags は2026-09-28)。prod は未確認

INSERT INTO mdl_external_services_functions (externalserviceid, functionname)
SELECT s.id, f.name
FROM mdl_external_services s
JOIN mdl_external_functions f ON f.name IN (
  'local_webcoach_utils_set_course_tags',
  'local_webcoach_utils_get_course_tags',
  'local_webcoach_utils_update_user_lastaccess',
  'local_webcoach_utils_start_study_session',
  'local_webcoach_utils_end_study_session',
  'local_webcoach_utils_correct_study_session',
  'local_webcoach_utils_log_course_material_viewed'
)
WHERE s.name = 'moodle-api-service'
  AND NOT EXISTS (
    SELECT 1 FROM mdl_external_services_functions sf
    WHERE sf.externalserviceid = s.id AND sf.functionname = f.name
  );
