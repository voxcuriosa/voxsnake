<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'cpjvfkip_neonsnake');
define('DB_USER', 'cpjvfkip_neon');
define('DB_PASS', 'G8cN12%C^a31');

function getDB()
{
    // Enable Error Reporting for Debugging
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        die("<h1>DATABASE CONNECTION FAILED</h1><br>Error: " . $conn->connect_error);
    }
    $conn->set_charset("utf8mb4");
    return $conn;
}
?>