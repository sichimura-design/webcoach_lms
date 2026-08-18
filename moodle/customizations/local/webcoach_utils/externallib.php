<?php
/**
 * WebCoach Utils Plugin
 * External functions implementation
 */
defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

class local_webcoach_utils_external extends external_api {

    // ==================== TAG FUNCTIONS ====================

    /**
     * Parameters for set_course_tags
     */
    public static function set_course_tags_parameters() {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'tags' => new external_multiple_structure(
                new external_value(PARAM_TAG, 'Tag name'),
                'Array of tag names'
            ),
        ]);
    }

    /**
     * Set tags for a course
     *
     * @param int $courseid Course ID
     * @param array $tags Array of tag names
     * @return array Result status
     */
    public static function set_course_tags($courseid, $tags) {
        global $DB;

        // Validate parameters
        $params = self::validate_parameters(self::set_course_tags_parameters(), [
            'courseid' => $courseid,
            'tags' => $tags,
        ]);

        // Get course and context
        $course = $DB->get_record('course', ['id' => $params['courseid']], '*', MUST_EXIST);
        $context = context_course::instance($course->id);

        // Check capabilities
        self::validate_context($context);
        require_capability('moodle/course:update', $context);

        // Set tags using Moodle's core tag API
        core_tag_tag::set_item_tags('core', 'course', $params['courseid'], $context, $params['tags']);

        return [
            'success' => true,
            'courseid' => $params['courseid'],
            'tags' => $params['tags'],
            'message' => 'Tags successfully set for course ' . $params['courseid'],
        ];
    }

    /**
     * Returns description of set_course_tags return value
     */
    public static function set_course_tags_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'tags' => new external_multiple_structure(
                new external_value(PARAM_TAG, 'Tag name'),
                'Array of tag names that were set'
            ),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    /**
     * Parameters for get_course_tags
     */
    public static function get_course_tags_parameters() {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
        ]);
    }

    /**
     * Get tags for a course
     *
     * @param int $courseid Course ID
     * @return array Tags
     */
    public static function get_course_tags($courseid) {
        global $DB;

        // Validate parameters
        $params = self::validate_parameters(self::get_course_tags_parameters(), [
            'courseid' => $courseid,
        ]);

        // Get course and context
        $course = $DB->get_record('course', ['id' => $params['courseid']], '*', MUST_EXIST);
        $context = context_course::instance($course->id);

        // Validate context
        self::validate_context($context);

        // Get tags using Moodle's core tag API
        $tags = core_tag_tag::get_item_tags_array('core', 'course', $params['courseid']);

        return [
            'success' => true,
            'courseid' => $params['courseid'],
            'tags' => array_values($tags),
        ];
    }

    /**
     * Returns description of get_course_tags return value
     */
    public static function get_course_tags_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'tags' => new external_multiple_structure(
                new external_value(PARAM_TAG, 'Tag name'),
                'Array of tag names'
            ),
        ]);
    }

    // ==================== USER LASTACCESS FUNCTION ====================

    /**
     * Parameters for update_user_lastaccess
     */
    public static function update_user_lastaccess_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
        ]);
    }

    /**
     * Update user's lastaccess timestamp
     *
     * この関数はAPIリクエストのたびに呼ばれるため、\core\event\user_loggedin は
     * 「その日まだ記録が無い場合のみ」発火させる（継続日数集計用の日次アクティビティ記録）。
     * 毎回発火させるとmdl_logstore_standard_logが同一ユーザーのログインイベントで埋まってしまう。
     *
     * @param int $userid User ID
     * @return array Result status
     */
    public static function update_user_lastaccess($userid) {
        global $DB;

        // Validate parameters
        $params = self::validate_parameters(self::update_user_lastaccess_parameters(), [
            'userid' => $userid,
        ]);

        // Get user record
        $user = $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        // Validate context
        $context = context_system::instance();
        self::validate_context($context);

        // Update lastaccess
        $currenttime = time();
        $DB->set_field('user', 'lastaccess', $currenttime, ['id' => $params['userid']]);

        // 今日まだこのユーザーのログインイベントが無ければ、標準ログストアに1件だけ記録する
        $todaystart = usergetmidnight($currenttime);
        $alreadyloggedtoday = $DB->record_exists_select(
            'logstore_standard_log',
            'userid = :userid AND eventname = :eventname AND timecreated >= :todaystart',
            [
                'userid' => $params['userid'],
                'eventname' => '\\core\\event\\user_loggedin',
                'todaystart' => $todaystart,
            ]
        );

        if (!$alreadyloggedtoday) {
            $event = \core\event\user_loggedin::create([
                'userid' => $params['userid'],
                'objectid' => $params['userid'],
                'other' => ['username' => $user->username],
            ]);
            $event->add_record_snapshot('user', $user);
            $event->trigger();
        }

        return [
            'success' => true,
            'userid' => $params['userid'],
            'lastaccess' => $currenttime,
            'message' => 'User lastaccess updated successfully',
        ];
    }

    /**
     * Returns description of update_user_lastaccess return value
     */
    public static function update_user_lastaccess_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'lastaccess' => new external_value(PARAM_INT, 'Updated lastaccess timestamp'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    // ==================== STUDY SESSION (FOCUS BOOTH) FUNCTIONS ====================

    /**
     * Parameters for start_study_session
     */
    public static function start_study_session_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'sessionid' => new external_value(PARAM_INT, 'webcoach_study_activity row id (issued by api-server)'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (0 if not tied to a specific course)', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Log that a user started a focus-booth study session.
     *
     * 実測時間・一時停止等の実データはapi-server側のwebcoach_study_activityテーブルが
     * 正とする。ここではmdl_logstore_standard_logに「開始した」という監査ログを1件残すのみ
     * （mod_quizが自前のattemptテーブルとattempt_startedイベントの両方を持つのと同じ構成）。
     *
     * @param int $userid
     * @param int $sessionid
     * @param int $courseid
     * @return array
     */
    public static function start_study_session($userid, $sessionid, $courseid = 0) {
        global $DB;

        $params = self::validate_parameters(self::start_study_session_parameters(), [
            'userid' => $userid,
            'sessionid' => $sessionid,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        $context = context_system::instance();
        self::validate_context($context);

        $eventdata = [
            'userid' => $params['userid'],
            'other' => [
                'sessionid' => $params['sessionid'],
                'source' => 'focus_booth',
            ],
        ];
        if (!empty($params['courseid'])) {
            $eventdata['courseid'] = $params['courseid'];
        }

        $event = \local_webcoach_utils\event\study_session_started::create($eventdata);
        $event->trigger();

        return [
            'success' => true,
            'sessionid' => $params['sessionid'],
            'message' => 'Study session started event logged successfully',
        ];
    }

    /**
     * Returns description of start_study_session return value
     */
    public static function start_study_session_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'sessionid' => new external_value(PARAM_INT, 'webcoach_study_activity row id'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    /**
     * Parameters for end_study_session
     */
    public static function end_study_session_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'sessionid' => new external_value(PARAM_INT, 'webcoach_study_activity row id (issued by api-server)'),
            'durationminutes' => new external_value(PARAM_INT, 'Final recorded duration in minutes'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (0 if not tied to a specific course)', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Log that a user ended a focus-booth study session.
     *
     * @param int $userid
     * @param int $sessionid
     * @param int $durationminutes
     * @param int $courseid
     * @return array
     */
    public static function end_study_session($userid, $sessionid, $durationminutes, $courseid = 0) {
        global $DB;

        $params = self::validate_parameters(self::end_study_session_parameters(), [
            'userid' => $userid,
            'sessionid' => $sessionid,
            'durationminutes' => $durationminutes,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        $context = context_system::instance();
        self::validate_context($context);

        $eventdata = [
            'userid' => $params['userid'],
            'other' => [
                'sessionid' => $params['sessionid'],
                'durationminutes' => $params['durationminutes'],
                'source' => 'focus_booth',
            ],
        ];
        if (!empty($params['courseid'])) {
            $eventdata['courseid'] = $params['courseid'];
        }

        $event = \local_webcoach_utils\event\study_session_ended::create($eventdata);
        $event->trigger();

        return [
            'success' => true,
            'sessionid' => $params['sessionid'],
            'message' => 'Study session ended event logged successfully',
        ];
    }

    /**
     * Returns description of end_study_session return value
     */
    public static function end_study_session_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'sessionid' => new external_value(PARAM_INT, 'webcoach_study_activity row id'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    // ==================== COURSE STUDY STARTED FUNCTION ====================

    /**
     * Parameters for log_course_study_started
     */
    public static function log_course_study_started_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
        ]);
    }

    /**
     * Log that a user started studying a course (SPA opened the course content screen).
     *
     * SPAはMoodleのview.phpを経由せずAPI経由で教材を配信するため、mod_page/mod_url/mod_resource
     * が標準で発火するcourse_module_viewed相当のコース単位ログが残らない。その代替として、
     * update_user_lastaccessと同じ間引き方針（1ユーザー×1コース×1日1件のみ）で記録する。
     *
     * @param int $userid
     * @param int $courseid
     * @return array
     */
    public static function log_course_study_started($userid, $courseid) {
        global $DB;

        $params = self::validate_parameters(self::log_course_study_started_parameters(), [
            'userid' => $userid,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);
        $DB->get_record('course', ['id' => $params['courseid']], '*', MUST_EXIST);

        $context = context_course::instance($params['courseid']);
        self::validate_context($context);

        $todaystart = usergetmidnight(time());
        $alreadyloggedtoday = $DB->record_exists_select(
            'logstore_standard_log',
            'userid = :userid AND courseid = :courseid AND eventname = :eventname AND timecreated >= :todaystart',
            [
                'userid' => $params['userid'],
                'courseid' => $params['courseid'],
                'eventname' => '\\local_webcoach_utils\\event\\course_study_started',
                'todaystart' => $todaystart,
            ]
        );

        if (!$alreadyloggedtoday) {
            $event = \local_webcoach_utils\event\course_study_started::create([
                'userid' => $params['userid'],
                'courseid' => $params['courseid'],
                'objectid' => $params['courseid'],
                'context' => $context,
            ]);
            $event->trigger();
        }

        return [
            'success' => true,
            'userid' => $params['userid'],
            'courseid' => $params['courseid'],
            'message' => 'Course study started event logged successfully',
        ];
    }

    /**
     * Returns description of log_course_study_started return value
     */
    public static function log_course_study_started_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }
}
