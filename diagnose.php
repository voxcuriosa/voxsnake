<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'db_config.php';
$conn = getDB();

echo "<html><body style='background:#111; color:#0f0; font-family:monospace;'>";
echo "<h1>DEEP DIAGNOSTICS</h1>";

// 1. TEST USER 'Test'
echo "<h2>1. Fetching Stats for 'Test'</h2>";
$username = 'Test';
echo "Running query: <i>SELECT id, total_xp, games_played, created_at FROM users WHERE LOWER(username) = LOWER('Test')</i><br>";

$stmt = $conn->prepare("SELECT id, total_xp, games_played, created_at FROM users WHERE LOWER(username) = LOWER(?)");
if (!$stmt) {
    die("<span style='color:red'>PREPARE FAILED: " . $conn->error . "</span>");
}
$stmt->bind_param("s", $username);
$stmt->execute();
$res = $stmt->get_result();
if ($row = $res->fetch_assoc()) {
    echo "Found User ID: " . $row['id'] . "<br>";
    echo "XP: " . $row['total_xp'] . "<br>";
    echo "Games: " . $row['games_played'] . "<br>";
    echo "Created: " . $row['created_at'] . "<br>";
} else {
    echo "<span style='color:red'>User 'Test' NOT FOUND (via LOWER checking).</span><br>";
}

// 2. TEST ADMIN LIST QUERY
echo "<h2>2. Testing Admin List Query</h2>";
$sql = "SELECT id, username, total_xp, games_played, created_at, is_admin FROM users ORDER BY id DESC LIMIT 100";
echo "Running: <i>$sql</i><br>";
$list = $conn->query($sql);
if (!$list) {
    echo "<span style='color:red'>QUERY FAILED: " . $conn->error . "</span><br>";
} else {
    echo "Query OK. Found " . $list->num_rows . " users.<br>";
    echo "<table border=1 bordercolor='#444'><tr><th>ID</th><th>User</th><th>XP</th><th>Admin</th></tr>";
    while ($u = $list->fetch_assoc()) {
        echo "<tr><td>{$u['id']}</td><td>{$u['username']}</td><td>{$u['total_xp']}</td><td>{$u['is_admin']}</td></tr>";
    }
    echo "</table>";
}

echo "<h2>3. PHP Environment</h2>";
echo "PHP Version: " . phpversion() . "<br>";
echo "JSON Extension: " . (function_exists('json_encode') ? 'OK' : 'MISSING') . "<br>";

echo "<br><hr><h1>DONE.</h1>";
echo "</body></html>";
?>