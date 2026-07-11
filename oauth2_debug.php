<?php
/**
 * OAuth2 Debug Script
 * Place this in /bitnami/moodle/ and access via https://15.152.220.38/oauth2_debug.php
 */

echo "<h1>OAuth2 Callback Debug</h1>";
echo "<h2>GET Parameters:</h2>";
echo "<pre>";
print_r($_GET);
echo "</pre>";

echo "<h2>POST Parameters:</h2>";
echo "<pre>";
print_r($_POST);
echo "</pre>";

echo "<h2>Server Variables:</h2>";
echo "<pre>";
echo "REQUEST_URI: " . ($_SERVER['REQUEST_URI'] ?? 'not set') . "\n";
echo "HTTP_HOST: " . ($_SERVER['HTTP_HOST'] ?? 'not set') . "\n";
echo "REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'not set') . "\n";
echo "</pre>";
