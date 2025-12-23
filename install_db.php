<?php
require_once 'db_config.php';

$conn = getDB();

echo "<h1>Installing Neon Snake Database...</h1>";

// 1. Users Table
$sql_users = "CREATE TABLE IF NOT EXISTS users (
    id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    total_xp INT(11) DEFAULT 0,
    games_played INT(11) DEFAULT 0,
    best_score INT(11) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";

if ($conn->query($sql_users) === TRUE) {
    echo "Table 'users' created successfully.<br>";
} else {
    echo "Error creating table 'users': " . $conn->error . "<br>";
}

// 2. Scores Table (History)
$sql_scores = "CREATE TABLE IF NOT EXISTS scores (
    id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) UNSIGNED NOT NULL,
    score INT(11) NOT NULL,
    platform VARCHAR(20) DEFAULT 'mobile',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)";

if ($conn->query($sql_scores) === TRUE) {
    echo "Table 'scores' created successfully.<br>";
} else {
    echo "Error creating table 'scores': " . $conn->error . "<br>";
}

$conn->close();

echo "<h3>Installation Complete. Delete this file for security!</h3>";
?>