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
    //
    // mdl_logstore_standard_logそのものが集中ブース学習時間の正データ。started/endedの
    // timecreated差分(区間ごとの合算)が実質学習時間になる。一時停止のたびにend、
    // 再開のたびにstartを呼ぶ。DB側にセッション行を持たないため、sessionidは存在しない。

    /**
     * Parameters for start_study_session
     */
    public static function start_study_session_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (0 if not tied to a specific course)', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Log that a user started (or resumed after a pause) a focus-booth study session.
     *
     * @param int $userid
     * @param int $courseid
     * @return array
     */
    public static function start_study_session($userid, $courseid = 0) {
        global $DB;

        $params = self::validate_parameters(self::start_study_session_parameters(), [
            'userid' => $userid,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        $context = context_system::instance();
        self::validate_context($context);

        $eventdata = [
            'userid' => $params['userid'],
        ];
        if (!empty($params['courseid'])) {
            $eventdata['courseid'] = $params['courseid'];
        }

        $event = \local_webcoach_utils\event\study_session_started::create($eventdata);
        $event->trigger();

        return [
            'success' => true,
            'message' => 'Study session started event logged successfully',
        ];
    }

    /**
     * Returns description of start_study_session return value
     */
    public static function start_study_session_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    /**
     * Parameters for end_study_session
     */
    public static function end_study_session_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (0 if not tied to a specific course)', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Log that a user paused or finished a focus-booth study session.
     *
     * @param int $userid
     * @param int $courseid
     * @return array
     */
    public static function end_study_session($userid, $courseid = 0) {
        global $DB;

        $params = self::validate_parameters(self::end_study_session_parameters(), [
            'userid' => $userid,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        $context = context_system::instance();
        self::validate_context($context);

        $eventdata = [
            'userid' => $params['userid'],
        ];
        if (!empty($params['courseid'])) {
            $eventdata['courseid'] = $params['courseid'];
        }

        $event = \local_webcoach_utils\event\study_session_ended::create($eventdata);
        $event->trigger();

        return [
            'success' => true,
            'message' => 'Study session ended event logged successfully',
        ];
    }

    /**
     * Returns description of end_study_session return value
     */
    public static function end_study_session_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }

    /**
     * Parameters for correct_study_session
     */
    public static function correct_study_session_parameters() {
        return new external_function_parameters([
            'userid' => new external_value(PARAM_INT, 'User ID'),
            'deltaminutes' => new external_value(PARAM_INT, 'Signed correction in minutes, applied to the segment just ended'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (0 if not tied to a specific course)', VALUE_DEFAULT, 0),
        ]);
    }

    /**
     * Log a manual correction to the duration of the study session segment the user just ended.
     *
     * ユーザーが終了画面で計測値と異なる時間を入力して記録した場合のみ呼ばれる(低頻度)。
     *
     * @param int $userid
     * @param int $deltaminutes
     * @param int $courseid
     * @return array
     */
    public static function correct_study_session($userid, $deltaminutes, $courseid = 0) {
        global $DB;

        $params = self::validate_parameters(self::correct_study_session_parameters(), [
            'userid' => $userid,
            'deltaminutes' => $deltaminutes,
            'courseid' => $courseid,
        ]);

        $DB->get_record('user', ['id' => $params['userid']], '*', MUST_EXIST);

        $context = context_system::instance();
        self::validate_context($context);

        $eventdata = [
            'userid' => $params['userid'],
            'other' => [
                'deltaminutes' => $params['deltaminutes'],
            ],
        ];
        if (!empty($params['courseid'])) {
            $eventdata['courseid'] = $params['courseid'];
        }

        $event = \local_webcoach_utils\event\study_session_corrected::create($eventdata);
        $event->trigger();

        return [
            'success' => true,
            'message' => 'Study session corrected event logged successfully',
        ];
    }

    /**
     * Returns description of correct_study_session return value
     */
    public static function correct_study_session_returns() {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
        ]);
    }
}
