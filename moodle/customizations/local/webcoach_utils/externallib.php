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
}
