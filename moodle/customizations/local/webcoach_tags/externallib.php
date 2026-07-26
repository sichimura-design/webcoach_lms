<?php
/**
 * WebCoach Tags Plugin
 * External functions implementation
 */
defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');

class local_webcoach_tags_external extends external_api {

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
}
