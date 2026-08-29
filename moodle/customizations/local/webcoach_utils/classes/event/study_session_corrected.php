<?php
/**
 * WebCoach Utils Plugin
 * Study session corrected event (集中ブース学習時間の後修正)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user manually adjusts the duration of the study session segment
 * they just ended (finish画面で計測値と異なる時間を入力して記録した場合のみ発火)。
 *
 * @property-read array $other {
 *      Extra information about event.
 *
 *      - int deltaminutes: 直前のstudy_session_endedに対する補正値(分、符号付き)
 * }
 *
 * 集計時は直前の(同一ユーザーの)study_session_endedセグメントにこの値を加算する。
 * 発火するのはユーザーが実際に時間を修正した場合のみで頻度は低いため、
 * 集計クエリでこのイベントに限りotherのJSONパースを許容する。
 */
class study_session_corrected extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'u';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = null;
        $this->context = \context_system::instance();
    }

    public function get_description() {
        return "The user with id '$this->userid' corrected a study session duration by "
            . "'{$this->other['deltaminutes']}' minutes.";
    }

    public static function get_name() {
        return get_string('eventstudysessioncorrected', 'local_webcoach_utils');
    }

    public function get_url() {
        return null;
    }

    protected function validate_data() {
        parent::validate_data();

        if (!isset($this->other['deltaminutes'])) {
            throw new \coding_exception('The \'deltaminutes\' value must be set in other.');
        }
    }

    public static function get_objectid_mapping() {
        return false;
    }

    public static function get_other_mapping() {
        return false;
    }
}
