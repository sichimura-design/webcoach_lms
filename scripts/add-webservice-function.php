<?php
/**
 * Add new function to existing Moodle Web Service
 * Usage: php add-webservice-function.php [service_name] [function_name]
 */

define('CLI_SCRIPT', true);

require('/bitnami/moodle/config.php');
require_once($CFG->libdir.'/clilib.php');

$servicename = $argv[1] ?? 'moodle-api-service';
$functionname = $argv[2] ?? 'local_webcoach_utils_update_user_lastaccess';

echo "Adding function '$functionname' to service '$servicename'...\n";

// Get the service
$service = $DB->get_record('external_services', array('name' => $servicename));
if (!$service) {
    echo "ERROR: Service '$servicename' not found!\n";
    exit(1);
}

// Get the function
$function = $DB->get_record('external_functions', array('name' => $functionname));
if (!$function) {
    echo "ERROR: Function '$functionname' not found!\n";
    echo "Make sure the plugin is installed and upgraded.\n";
    exit(1);
}

// Check if already added
$existing = $DB->get_record('external_services_functions', array(
    'externalserviceid' => $service->id,
    'functionname' => $functionname
));

if ($existing) {
    echo "Function already exists in service.\n";
    exit(0);
}

// Add function to service
$servicefunction = new stdClass();
$servicefunction->externalserviceid = $service->id;
$servicefunction->functionname = $functionname;

$DB->insert_record('external_services_functions', $servicefunction);

echo "SUCCESS: Function '$functionname' added to service '$servicename'.\n";
exit(0);
