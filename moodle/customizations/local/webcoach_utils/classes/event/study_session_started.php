<?php
/**
 * WebCoach Utils Plugin
 * Study session started event (集中ブース学習開始)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user starts a focus-booth study session.
 *
 * @property-read array $other {
 *      Extra information about event.
 *
 *      - int sessionid: id of webcoach_study_activity row (source of truth for duration)
 *      - string source: always 'focus_booth'
 * }
 */
class study_session_started extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'c';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = null;
        $this->context = \context_system::instance();
    }

    public function get_description() {
        return "The user with id '$this->userid' started a study session (webcoach_study_activity id "
            . "'{$this->other['sessionid']}').";
    }

    public static function get_name() {
        return get_string('eventstudysessionstarted', 'local_webcoach_utils');
    }

    public function get_url() {
        return null;
    }

    protected function validate_data() {
        parent::validate_data();

        if (!isset($this->other['sessionid'])) {
            throw new \coding_exception('The \'sessionid\' value must be set in other.');
        }
    }

    public static function get_objectid_mapping() {
        return false;
    }

    public static function get_other_mapping() {
        return false;
    }
}
