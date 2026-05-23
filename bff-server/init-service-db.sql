-- Moodle外部サービスの作成SQL
-- BFF用のMoodleサービス (moodle-api-service) を作成し、必要な機能を有効化

USE bitnami_moodle;

-- 既存のサービスを確認
SELECT id, name, enabled, restrictedusers FROM mdl_external_services WHERE name = 'moodle-api-service';

-- サービスが存在しない場合は作成
INSERT INTO mdl_external_services (name, enabled, restrictedusers, downloadfiles, uploadfiles, shortname, timecreated, timemodified)
SELECT 'moodle-api-service', 1, 0, 1, 1, 'moodle-api-service', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_external_services WHERE name = 'moodle-api-service'
);

-- サービスIDを取得
SET @service_id = (SELECT id FROM mdl_external_services WHERE name = 'moodle-api-service');

-- 主要な外部関数をサービスに追加
-- 認証関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_webservice_get_site_info'),
    (@service_id, 'core_user_get_users_by_field'),
    (@service_id, 'core_user_get_users'),
    (@service_id, 'core_user_update_users');

-- コース関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_course_get_courses'),
    (@service_id, 'core_course_get_courses_by_field'),
    (@service_id, 'core_course_get_contents'),
    (@service_id, 'core_course_get_categories'),
    (@service_id, 'core_course_search_courses'),
    (@service_id, 'core_course_create_activities'),
    (@service_id, 'core_course_get_enrolled_courses_by_timeline_classification'),
    (@service_id, 'core_enrol_get_enrolled_users'),
    (@service_id, 'core_enrol_get_users_courses');

-- コンテンツ/モジュール関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'mod_forum_get_forums_by_courses'),
    (@service_id, 'mod_forum_get_forum_discussions'),
    (@service_id, 'mod_assign_get_assignments'),
    (@service_id, 'mod_quiz_get_quizzes_by_courses'),
    (@service_id, 'core_calendar_get_calendar_events');

-- ファイル関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_files_get_files'),
    (@service_id, 'core_files_upload');

-- グレード関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_grades_get_grades'),
    (@service_id, 'gradereport_user_get_grade_items');

-- メッセージ関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_message_get_messages'),
    (@service_id, 'core_message_send_instant_messages');

-- バッジ関連
INSERT IGNORE INTO mdl_external_services_functions (externalserviceid, functionname)
VALUES
    (@service_id, 'core_badges_get_badges'),
    (@service_id, 'core_badges_get_user_badges');

-- 確認: 作成されたサービスと関数を表示
SELECT
    s.id,
    s.name,
    s.enabled,
    s.restrictedusers,
    s.downloadfiles,
    s.uploadfiles,
    COUNT(sf.functionname) as function_count
FROM mdl_external_services s
LEFT JOIN mdl_external_services_functions sf ON s.id = sf.externalserviceid
WHERE s.name = 'moodle-api-service'
GROUP BY s.id;

-- 登録された関数一覧
SELECT functionname
FROM mdl_external_services_functions
WHERE externalserviceid = @service_id
ORDER BY functionname;

SELECT CONCAT('✅ Moodleサービス "moodle-api-service" が作成されました (ID: ', @service_id, ')') as status;
