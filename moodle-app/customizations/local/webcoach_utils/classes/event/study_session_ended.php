<?php
/**
 * WebCoach Utils Plugin
 * Study session ended event (集中ブース学習終了)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user finishes/stops a focus-booth study session.
 *
 * @property-read array $other {
 *      Extra information about event.
 *
 *      - int sessionid: id of webcoach_study_activity row (source of truth for duration)
 *      - int durationminutes: final recorded duration in minutes
 *      - string source: always 'focus_booth'
 * }
 */
class study_session_ended extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'u';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = null;
        $this->context = \context_system::instance();
    }

    public function get_description() {
        return "The user with id '$this->userid' ended a study session (webcoach_study_activity id "
            . "'{$this->other['sessionid']}', duration '{$this->other['durationminutes']}' minutes).";
    }

    public static function get_name() {
        return get_string('eventstudysessionended', 'local_webcoach_utils');
    }

    public function get_url() {
        return null;
    }

    protected function validate_data() {
        parent::validate_data();

        if (!isset($this->other['sessionid'])) {
            throw new \coding_exception('The \'sessionid\' value must be set in other.');
        }
        if (!isset($this->other['durationminutes'])) {
            throw new \coding_exception('The \'durationminutes\' value must be set in other.');
        }
    }

    public static function get_objectid_mapping() {
        return false;
    }

    public static function get_other_mapping() {
        return false;
    }
}
