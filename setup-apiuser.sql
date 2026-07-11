-- Moodle APIユーザー（apiuser）初期セットアップSQL
-- BFF用のサービスアカウント設定

USE bitnami_moodle;

-- 1. apiuserが存在するか確認
SELECT CONCAT('チェック: apiuserが存在するか確認中...') as status;
SELECT username, email FROM mdl_user WHERE username = 'apiuser';

-- 2. apiuserが存在しない場合は作成
INSERT INTO mdl_user (
    auth, confirmed, mnethostid, username, password, firstname, lastname,
    email, emailstop, city, country, timezone, lang, theme, mailformat,
    maildigest, maildisplay, autosubscribe, trackforums, timecreated, timemodified
)
SELECT
    'manual', 1, 1, 'apiuser',
    MD5('Admin123!'),
    'API', 'User',
    'apiuser@example.com', 0, 'Tokyo', 'JP', '99', 'ja', '', 1,
    0, 2, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_user WHERE username = 'apiuser'
);

-- 3. apiuserのIDを取得
SET @apiuser_id = (SELECT id FROM mdl_user WHERE username = 'apiuser');
SELECT CONCAT('apiuser ID: ', @apiuser_id) as info;

-- 4. webserviceuserロールのIDを取得
SET @webservice_role_id = (SELECT id FROM mdl_role WHERE shortname = 'webserviceuser');
SELECT CONCAT('webserviceuser Role ID: ', @webservice_role_id) as info;

-- 5. システムコンテキストID取得（contextlevel=10）
SET @system_context_id = (SELECT id FROM mdl_context WHERE contextlevel = 10 LIMIT 1);
SELECT CONCAT('System Context ID: ', @system_context_id) as info;

-- 6. apiuserにwebserviceuserロールを割り当て（システムレベル）
INSERT INTO mdl_role_assignments (roleid, contextid, userid, timemodified, modifierid)
SELECT @webservice_role_id, @system_context_id, @apiuser_id, UNIX_TIMESTAMP(), 2
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_role_assignments
    WHERE roleid = @webservice_role_id
    AND contextid = @system_context_id
    AND userid = @apiuser_id
);

-- 7. webserviceuserロールに必要な権限を追加
-- Note: core_user_get_users_by_field を実行するには管理者レベルの権限が必要なため
-- apiuserにはmanagerロールも併せて付与することを推奨
INSERT INTO mdl_role_capabilities (contextid, roleid, capability, permission, timemodified, modifierid)
SELECT 1, @webservice_role_id, 'moodle/user:viewalldetails', 1, UNIX_TIMESTAMP(), 2
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_role_capabilities
    WHERE roleid = @webservice_role_id
    AND capability = 'moodle/user:viewalldetails'
);

INSERT INTO mdl_role_capabilities (contextid, roleid, capability, permission, timemodified, modifierid)
SELECT 1, @webservice_role_id, 'moodle/user:viewhiddendetails', 1, UNIX_TIMESTAMP(), 2
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_role_capabilities
    WHERE roleid = @webservice_role_id
    AND capability = 'moodle/user:viewhiddendetails'
);

-- 7b. apiuserにmanagerロールも追加（推奨）
SET @manager_role_id = (SELECT id FROM mdl_role WHERE shortname = 'manager');

INSERT INTO mdl_role_assignments (roleid, contextid, userid, timemodified, modifierid)
SELECT @manager_role_id, @system_context_id, @apiuser_id, UNIX_TIMESTAMP(), 2
WHERE NOT EXISTS (
    SELECT 1 FROM mdl_role_assignments
    WHERE roleid = @manager_role_id
    AND contextid = @system_context_id
    AND userid = @apiuser_id
);

-- 8. webserviceトークンを生成
-- Note: トークンは通常Moodleの管理画面から生成することを推奨
-- ここでは既存のトークンを確認のみ
SELECT
    t.token,
    u.username,
    s.name as service_name,
    FROM_UNIXTIME(t.timecreated) as created_at,
    FROM_UNIXTIME(t.validuntil) as valid_until
FROM mdl_external_tokens t
JOIN mdl_user u ON t.userid = u.id
JOIN mdl_external_services s ON t.externalserviceid = s.id
WHERE u.username = 'apiuser';

-- 9. 設定確認
SELECT '========================================' as '';
SELECT '✅ apiuser セットアップ完了' as status;
SELECT '========================================' as '';

-- apiuserの詳細
SELECT
    u.id,
    u.username,
    u.email,
    u.firstname,
    u.lastname
FROM mdl_user u
WHERE u.username = 'apiuser';

-- 割り当てられたロール
SELECT
    r.shortname as role,
    c.contextlevel,
    CASE c.contextlevel
        WHEN 10 THEN 'System'
        WHEN 40 THEN 'Course Category'
        WHEN 50 THEN 'Course'
        ELSE CONCAT('Level ', c.contextlevel)
    END as context_type
FROM mdl_user u
JOIN mdl_role_assignments ra ON u.id = ra.userid
JOIN mdl_role r ON ra.roleid = r.id
JOIN mdl_context c ON ra.contextid = c.id
WHERE u.username = 'apiuser';

-- webserviceuserロールの権限一覧
SELECT capability, permission
FROM mdl_role_capabilities
WHERE roleid = @webservice_role_id
ORDER BY capability;
