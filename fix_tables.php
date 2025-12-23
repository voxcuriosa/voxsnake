<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); // Enable exceptions

require_once 'db_config.php';
$conn = getDB();

echo "<html><body style='background:#111; color:#0f0; font-family:monospace;'>";
echo "<h1>DATABASE DIAGNOSTICS & REPAIR</h1>";

// 1. ADD MISSING COLUMNS
$cols = [
    'total_xp' => "INT DEFAULT 0",
    'games_played' => "INT DEFAULT 0",
    'best_score' => "INT DEFAULT 0",
    'is_admin' => "TINYINT DEFAULT 0",
    'created_at' => "DATETIME DEFAULT CURRENT_TIMESTAMP",
    'security_question' => "VARCHAR(255) NULL",
    'security_answer' => "VARCHAR(255) NULL"
];

echo "<h2>1a. Checking 'users' Schema...</h2>";
foreach ($cols as $name => $def) {
    echo "Checking <b>$name</b>... ";
    try {
        $check = $conn->query("SHOW COLUMNS FROM users LIKE '$name'");
        if ($check->num_rows == 0) {
            echo "<span style='color:orange'>MISSING. Adding...</span> ";
            $conn->query("ALTER TABLE users ADD COLUMN $name $def");
            echo "<span style='color:lime'>ADDED.</span><br>";
        } else {
            echo "<span style='color:gray'>EXISTS.</span><br>";
        }
    } catch (Exception $e) {
        echo "<span style='color:red'>ERROR: " . $e->getMessage() . "</span><br>";
    }
}

echo "<h2>1b. Checking 'scores' Schema...</h2>";
$scoreCols = ['device_type' => "VARCHAR(20) DEFAULT 'mobile'"];
foreach ($scoreCols as $name => $def) {
    echo "Checking <b>$name</b>... ";
    try {
        $check = $conn->query("SHOW COLUMNS FROM scores LIKE '$name'");
        if ($check->num_rows == 0) {
            echo "<span style='color:orange'>MISSING. Adding...</span> ";
            $conn->query("ALTER TABLE scores ADD COLUMN $name $def");
            echo "<span style='color:lime'>ADDED.</span><br>";
        } else {
            echo "<span style='color:gray'>EXISTS.</span><br>";
        }
    } catch (Exception $e) {
        echo "<span style='color:red'>ERROR: " . $e->getMessage() . "</span><br>";
    }
}

// 2. CHECK TABLE CONTENT
echo "<h2>2. Checking User Data</h2>";
try {
    $res = $conn->query("SELECT id, username, is_admin, total_xp FROM users LIMIT 5");
    echo "<table border=1 style='border-collapse:collapse; border:1px solid #444;'>
    <tr style='background:#222'><th>ID</th><th>User</th><th>Admin</th><th>XP</th></tr>";
    while ($row = $res->fetch_assoc()) {
        echo "<tr><td>{$row['id']}</td><td>{$row['username']}</td><td>{$row['is_admin']}</td><td>{$row['total_xp']}</td></tr>";
    }
    echo "</table>";
} catch (Exception $e) {
    echo "<span style='color:red'>QUERY FAILED: " . $e->getMessage() . "</span><br>";
}

// 3. CHECK TEST USER
echo "<h2>3. Checking for user 'Christian'</h2>";
$t = $conn->query("SELECT * FROM users WHERE username = 'Christian' OR username = 'CHRISTIAN'");
if ($t->num_rows > 0) {
    echo "User 'Christian' FOUND.<br>";
    $u = $t->fetch_assoc();
    echo "ID: " . $u['id'] . " | Admin: " . $u['is_admin'] . " | XP: " . $u['total_xp'] . "<br>";
} else {
    echo "User 'Christian' NOT FOUND.<br>";
}

echo "<br><hr><h1>DONE.</h1>";
echo "</body></html>";
?>