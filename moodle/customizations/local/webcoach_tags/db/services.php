<?php
/**
 * WebCoach Tags Plugin
 * External service definitions
 */
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_webcoach_tags_set_course_tags' => [
        'classname'     => 'local_webcoach_tags_external',
        'methodname'    => 'set_course_tags',
        'classpath'     => 'local/webcoach_tags/externallib.php',
        'description'   => 'Set tags for a course',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => 'moodle/course:update',
    ],
    'local_webcoach_tags_get_course_tags' => [
        'classname'     => 'local_webcoach_tags_external',
        'methodname'    => 'get_course_tags',
        'classpath'     => 'local/webcoach_tags/externallib.php',
        'description'   => 'Get tags for a course',
        'type'          => 'read',
        'ajax'          => true,
        'capabilities'  => '',
    ],
];

$services = [
    'WebCoach Tag Service' => [
        'functions' => [
            'local_webcoach_tags_set_course_tags',
            'local_webcoach_tags_get_course_tags',
        ],
        'restrictedusers' => 0,
        'enabled' => 1,
    ],
];
