<?php
require_once 'db_config.php';
$conn = getDB();

echo "<h1>Table: users</h1>";
$res = $conn->query("DESCRIBE users");
if ($res) {
    echo "<table border=1><tr><th>Field</th><th>Type</th></tr>";
    while ($row = $res->fetch_assoc()) {
        echo "<tr><td>" . $row['Field'] . "</td><td>" . $row['Type'] . "</td></tr>";
    }
    echo "</table>";
} else {
    echo "Error: " . $conn->error;
}
$conn->close();
?>