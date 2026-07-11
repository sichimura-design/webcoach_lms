<?php
// Test script to check wwwroot configuration
define('CLI_SCRIPT', true);

$_SERVER['HTTP_HOST'] = 'moodle-app:8080';
$_SERVER['SERVER_PORT'] = '8080';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once('/bitnami/moodle/config.php');

echo "HTTP_HOST: " . $_SERVER['HTTP_HOST'] . "\n";
echo "wwwroot: " . $CFG->wwwroot . "\n";
echo "sslproxy: " . ($CFG->sslproxy ? 'true' : 'false') . "\n";
echo "dataroot: " . $CFG->dataroot . "\n";
echo "dataroot writable: " . (is_writable($CFG->dataroot) ? 'yes' : 'no') . "\n";
