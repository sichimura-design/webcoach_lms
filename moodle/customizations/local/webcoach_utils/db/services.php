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
];

$services = [
    'WebCoach Utilities Service' => [
        'functions' => [
            'local_webcoach_utils_set_course_tags',
            'local_webcoach_utils_get_course_tags',
            'local_webcoach_utils_update_user_lastaccess',
        ],
        'restrictedusers' => 0,
        'enabled' => 1,
    ],
];
