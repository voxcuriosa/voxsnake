<?php
require_once 'db_config.php';
$conn = getDB();

echo "<h1>Migrating Security Columns...</h1>";

// 1. Add Columns if not exist
$columns = [
    "security_question" => "VARCHAR(255) NULL",
    "security_answer" => "VARCHAR(255) NULL", // Will store HASH of answer
    "is_admin" => "TINYINT(1) DEFAULT 0"
];

foreach ($columns as $col => $type) {
    try {
        $conn->query("ALTER TABLE users ADD COLUMN $col $type");
        echo "Added column: $col<br>";
    } catch (Exception $e) {
        // Ignore if exists (or check error code)
        echo "Column $col might already exist (" . $conn->error . ")<br>";
    }
}

// 2. Set Admin for Christian
$adminName = "CHRISTIAN";
$conn->query("UPDATE users SET is_admin = 1 WHERE username = '$adminName'");
if ($conn->affected_rows > 0) {
    echo "<h3>Promoted $adminName to ADMIN! 👑</h3>";
} else {
    echo "<h3>Could not find user $adminName (or already admin).</h3>";
}

$conn->close();
echo "<h2>Migration Complete!</h2>";
?>