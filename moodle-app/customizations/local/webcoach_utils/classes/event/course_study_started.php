<?php
/**
 * WebCoach Utils Plugin
 * Course study started event (コース学習開始。mod_lesson等の標準的な「開始」ログに相当)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user begins studying a course's content (SPA側の教材画面を開いたタイミング)。
 * SPAはMoodleのview.phpを経由しないため、mod_page/mod_url/mod_resourceが標準で
 * 発火するcourse_module_viewed相当のログがコース単位では残らない。その代替として
 * 1ユーザー×1コース×1日につき1件だけ記録する（update_user_lastaccessと同じ間引き方針）。
 */
class course_study_started extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = 'course';
    }

    public function get_description() {
        return "The user with id '$this->userid' started studying course with id '$this->courseid'.";
    }

    public static function get_name() {
        return get_string('eventcoursestudystarted', 'local_webcoach_utils');
    }

    public function get_url() {
        return new \moodle_url('/course/view.php', array('id' => $this->courseid));
    }

    protected function validate_data() {
        parent::validate_data();

        if (empty($this->courseid)) {
            throw new \coding_exception('The \'courseid\' value must be set.');
        }
    }

    public static function get_objectid_mapping() {
        return array('db' => 'course', 'restore' => 'course');
    }

    public static function get_other_mapping() {
        return false;
    }
}
