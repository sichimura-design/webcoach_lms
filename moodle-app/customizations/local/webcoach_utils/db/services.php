<?php
/**
 * WebCoach Utils Plugin
 * External service definitions
 */
defined('MOODLE_INTERNAL') || die();

$functions = [
    // Tag management functions
    'local_webcoach_utils_set_course_tags' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'set_course_tags',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Set tags for a course',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => 'moodle/course:update',
    ],
    'local_webcoach_utils_get_course_tags' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'get_course_tags',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Get tags for a course',
        'type'          => 'read',
        'ajax'          => true,
        'capabilities'  => '',
    ],

    // User management functions
    'local_webcoach_utils_update_user_lastaccess' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'update_user_lastaccess',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Update user lastaccess timestamp',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => '',
    ],

    // Study session (focus booth) functions
    'local_webcoach_utils_start_study_session' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'start_study_session',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Log that a user started a focus-booth study session',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => '',
    ],
    'local_webcoach_utils_end_study_session' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'end_study_session',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Log that a user ended a focus-booth study session',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => '',
    ],
    'local_webcoach_utils_correct_study_session' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'correct_study_session',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Log a manual correction to the duration of the study session segment just ended',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => '',
    ],

    // Course material access functions
    'local_webcoach_utils_log_course_material_viewed' => [
        'classname'     => 'local_webcoach_utils_external',
        'methodname'    => 'log_course_material_viewed',
        'classpath'     => 'local/webcoach_utils/externallib.php',
        'description'   => 'Log that a user opened a course material (page/url/resource)',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => '',
    ],
];

$services = [
    'WebCoach Utilities Service' => [
        'functions' => [
            'local_webcoach_utils_set_course_tags',
            'local_webcoach_utils_get_course_tags',
            'local_webcoach_utils_update_user_lastaccess',
            'local_webcoach_utils_start_study_session',
            'local_webcoach_utils_end_study_session',
            'local_webcoach_utils_correct_study_session',
            'local_webcoach_utils_log_course_material_viewed',
        ],
        'restrictedusers' => 0,
        'enabled' => 1,
    ],
];
