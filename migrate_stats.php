<?php
require_once 'db_config.php';
$conn = getDB();

echo "<h1>Migrating Stats Columns...</h1>";

// Add Columns if not exist
$columns = [
    "total_xp" => "INT DEFAULT 0",
    "games_played" => "INT DEFAULT 0",
    "best_score" => "INT DEFAULT 0"
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

echo "<h2>Migration Complete!</h2>";
$conn->close();
?>