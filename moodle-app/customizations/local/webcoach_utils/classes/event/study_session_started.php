<?php
/**
 * WebCoach Utils Plugin
 * Study session started event (集中ブース学習開始/再開)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user starts (or resumes after a pause) a focus-booth study session.
 *
 * 実測時間はこのイベントとstudy_session_endedのtimecreated差分から算出する
 * (mdl_logstore_standard_logそのものが正データ)。一時停止のたびにstudy_session_endedを、
 * 再開のたびにこのイベントを発火する。
 */
class study_session_started extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'c';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = null;
        $this->context = \context_system::instance();
    }

    public function get_description() {
        return "The user with id '$this->userid' started/resumed a study session.";
    }

    public static function get_name() {
        return get_string('eventstudysessionstarted', 'local_webcoach_utils');
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
