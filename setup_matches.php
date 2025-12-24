<?php
require_once 'db_config.php';
$conn = getDB();

$sql = "CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    p1_name VARCHAR(50) NOT NULL,
    p2_name VARCHAR(50) NOT NULL,
    winner_name VARCHAR(50),
    duration INT DEFAULT 0,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";

if ($conn->query($sql) === TRUE) {
    echo "Table 'matches' created successfully";
} else {
    echo "Error creating table: " . $conn->error;
}

$conn->close();
?>