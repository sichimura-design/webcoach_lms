<?php
/**
 * WebCoach Utils Plugin
 * Study session ended event (集中ブース学習終了/一時停止)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user pauses or finishes a focus-booth study session.
 *
 * 実測時間はこのイベントと直前のstudy_session_startedのtimecreated差分から算出する。
 * 区間ごとの差分を合算したものが実質学習時間(一時停止中は含まれない)。
 */
class study_session_ended extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'u';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = null;
        $this->context = \context_system::instance();
    }

    public function get_description() {
        return "The user with id '$this->userid' paused/ended a study session.";
    }

    public static function get_name() {
        return get_string('eventstudysessionended', 'local_webcoach_utils');
    }

    public function get_url() {
        return null;
    }

    public static function get_objectid_mapping() {
        return false;
    }

    public static function get_other_mapping() {
        return false;
    }
}
