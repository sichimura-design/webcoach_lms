<?php
/**
 * WebCoach Utils Plugin
 * Course material viewed event (教材アクセス記録)
 */

namespace local_webcoach_utils\event;

defined('MOODLE_INTERNAL') || die();

/**
 * Fired when a user opens a course material (page/url/resource) in the SPA.
 *
 * SPAはMoodleの実ページコントローラを経由せずAPI経由で教材を配信するため、
 * mod_page/mod_url/mod_resourceが標準で発火するcourse_module_viewedは発生しない。
 * その代替として、courseid/cmidをネイティブ列(courseid列・context経由のcontextinstanceid列)
 * のみで記録する(集計対象の値をother列に入れない。検索・集計にはネイティブ列を使う)。
 *
 * cmidが分かる場合はcontext_moduleを使い、contextlevel=70/contextinstanceid=cmidとして
 * 記録する(標準のcourse_module_viewedと同じ形になるため、既存の教材別集計クエリを流用できる)。
 * cmidが分からない場合はcontext_courseにフォールバックし、コース単位のみ記録する。
 */
class course_material_viewed extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = 'course_modules';
    }

    public function get_description() {
        if (!empty($this->objectid)) {
            return "The user with id '$this->userid' viewed course module id '$this->objectid' "
                . "in course id '$this->courseid'.";
        }
        return "The user with id '$this->userid' viewed course id '$this->courseid'.";
    }

    public static function get_name() {
        return get_string('eventcoursematerialviewed', 'local_webcoach_utils');
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
        return array('db' => 'course_modules', 'restore' => 'course_module');
    }

    public static function get_other_mapping() {
        return false;
    }
}
