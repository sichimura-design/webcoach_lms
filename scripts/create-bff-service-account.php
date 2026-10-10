<?php
/**
 * bff-server 専用の Moodle サービスアカウントを作成・更新する(何度実行してもよい)
 *
 * 以前は bff-server がサイト管理者 admin のトークンで Moodle を呼んでいた。
 * 管理者権限を持たない専用ユーザーと、BFF が使う Web Service 関数に必要な権限だけを
 * 持つシステムロールを用意し、BFF の接続を切り替えられるようにする。
 *
 * Usage (moodle-app コンテナ内、daemon ユーザーで):
 *   BFF_SERVICE_PASSWORD='...' php create-bff-service-account.php [username] [service_name]
 *   既定: username=bff-service, service_name=moodle-api-service
 *
 * パスワードは Secrets Manager の moodleServicePassword と同じ値を渡すこと。
 */

define('CLI_SCRIPT', true);

require('/bitnami/moodle/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/user/lib.php');

$username = $argv[1] ?? 'bff-service';
$servicename = $argv[2] ?? 'moodle-api-service';
$password = getenv('BFF_SERVICE_PASSWORD');

if (!$password) {
    cli_error('BFF_SERVICE_PASSWORD が未設定です');
}

const BFF_ROLE_SHORTNAME = 'webcoach_bff_service';

// BFF が呼ぶ Web Service 関数(bff-server/adapters/MoodleAdapter.js 等)に必要な権限
$capabilities = [
    // Web Service の利用とトークン発行(login/token.php)
    'webservice/rest:use',
    'moodle/webservice:createtoken',
    // コース・教材の参照(非表示も含めて全件)
    'moodle/course:view',
    'moodle/course:viewhiddencourses',
    'moodle/course:viewhiddenactivities',
    'moodle/course:viewhiddensections',
    'moodle/course:viewparticipants',
    'moodle/category:viewcourselist',
    'moodle/category:viewhiddencategories',
    'mod/page:view',
    // 管理画面からのコース・カテゴリ作成/更新/削除、タグ設定
    'moodle/course:create',
    'moodle/course:update',
    'moodle/course:delete',
    'moodle/course:visibility',
    'moodle/course:changecategory',
    'moodle/course:changefullname',
    'moodle/course:changeshortname',
    'moodle/course:changeidnumber',
    'moodle/course:changesummary',
    'moodle/category:manage',
    // ユーザーの検索・作成・更新(サイト管理者は Moodle 側で更新対象外になる)
    'moodle/user:create',
    'moodle/user:update',
    'moodle/user:viewdetails',
    'moodle/user:viewhiddendetails',
    'moodle/user:viewalldetails',
    'moodle/course:useremail',
    'moodle/site:viewuseridentity',
    'moodle/site:viewfullnames',
    // 受講登録(student のみ割り当て可、下の role_allow_assign 参照)
    'enrol/manual:enrol',
    'moodle/role:assign',
    // 進捗・完了
    'report/progress:view',
    'report/completion:view',
    'moodle/course:viewhiddenuserfields',
    'moodle/course:overridecompletion',
    // バッジ
    'moodle/badges:viewbadges',
    'moodle/badges:viewotherbadges',
];

$syscontext = context_system::instance();

// --- ロール ---
$role = $DB->get_record('role', ['shortname' => BFF_ROLE_SHORTNAME]);
if ($role) {
    $roleid = $role->id;
    echo "ロール既存: " . BFF_ROLE_SHORTNAME . " (id=$roleid)\n";
} else {
    $roleid = create_role('WebCoach BFF サービス', BFF_ROLE_SHORTNAME,
        'bff-server の Web Service 接続専用。手で付与しないこと。');
    echo "ロール作成: " . BFF_ROLE_SHORTNAME . " (id=$roleid)\n";
}
set_role_contextlevels($roleid, [CONTEXT_SYSTEM]);

// 一覧に無い権限は外す(再実行時に権限を絞れるように)
$current = $DB->get_fieldset_select('role_capabilities', 'capability',
    'roleid = ? AND contextid = ?', [$roleid, $syscontext->id]);
foreach (array_diff($current, $capabilities) as $cap) {
    unassign_capability($cap, $roleid, $syscontext->id);
    echo "  権限削除: $cap\n";
}
foreach ($capabilities as $cap) {
    if (!get_capability_info($cap)) {
        echo "  WARN: 権限が存在しません: $cap\n";
        continue;
    }
    assign_capability($cap, CAP_ALLOW, $roleid, $syscontext->id, true);
}
echo "  権限数: " . count($capabilities) . "\n";

// 受講登録で割り当てられるのは student だけにする
$studentid = $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST);
$DB->delete_records_select('role_allow_assign', 'roleid = ? AND allowassign <> ?', [$roleid, $studentid]);
if (!$DB->record_exists('role_allow_assign', ['roleid' => $roleid, 'allowassign' => $studentid])) {
    core_role_set_assign_allowed($roleid, $studentid);
}

// --- ユーザー ---
$user = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
if ($user) {
    update_internal_user_password($user, $password);
    echo "ユーザー既存: $username (id=$user->id) パスワードを更新\n";
} else {
    $userid = user_create_user((object) [
        'username' => $username,
        'password' => $password,
        'auth' => 'manual',
        'confirmed' => 1,
        'mnethostid' => $CFG->mnet_localhost_id,
        'firstname' => 'WebCoach',
        'lastname' => 'BFF',
        'email' => 'noreply@webcoach.jp',
        'emailstop' => 1,
    ], true, false);
    $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
    echo "ユーザー作成: $username (id=$user->id)\n";
}
if (is_siteadmin($user)) {
    echo "  WARN: $username はサイト管理者です。サイト管理者から外してください\n";
}
role_assign($roleid, $user->id, $syscontext->id);

// --- Web Service の利用者登録(restrictedusers=1 にしても使えるように) ---
$service = $DB->get_record('external_services', ['name' => $servicename], '*', MUST_EXIST);
if (!$DB->record_exists('external_services_users', ['externalserviceid' => $service->id, 'userid' => $user->id])) {
    $DB->insert_record('external_services_users', (object) [
        'externalserviceid' => $service->id,
        'userid' => $user->id,
        'timecreated' => time(),
    ]);
}
echo "サービス: $servicename (id=$service->id, restrictedusers=$service->restrictedusers) に登録済み\n";

accesslib_clear_all_caches(true);
echo "完了\n";
