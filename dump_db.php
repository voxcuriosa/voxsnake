<?php
require_once 'db_config.php';
$conn = getDB();

echo "<h1>Database Contents Default Check</h1>";

// 1. Check Users
echo "<h3>Users (Limit 5)</h3>";
$res = $conn->query("SELECT * FROM users LIMIT 5");
if ($res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "ID: " . $row['id'] . " | Name: " . $row['username'] . " | XP: " . $row['total_xp'] . "<br>";
    }
} else {
    echo "NO USERS FOUND.<br>";
}

// 2. Check Scores
echo "<h3>Scores (Limit 10)</h3>";
$res = $conn->query("SELECT * FROM scores LIMIT 10");
if ($res->num_rows > 0) {
    echo "<table border='1'><tr><th>ID</th><th>User ID</th><th>Score</th><th>Platform</th></tr>";
    while ($row = $res->fetch_assoc()) {
        echo "<tr>";
        echo "<td>" . $row['id'] . "</td>";
        echo "<td>" . $row['user_id'] . "</td>";
        echo "<td>" . $row['score'] . "</td>";
        echo "<td>" . $row['platform'] . "</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "NO SCORES FOUND.<br>";
}

echo "<hr><h3>API Test</h3>";
echo "Try <a href='api.php?type=mobile&sort=best'>api.php?type=mobile</a><br>";
echo "Try <a href='api.php?type=pc&sort=best'>api.php?type=pc</a><br>";
?>