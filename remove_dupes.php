<?php
require 'db_config.php';
header('Content-Type: text/plain');

$conn = getDB();
$user = 'oscarv'; // Hardcoded for safety

// 1. Get User ID
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $user);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    die("User '$user' not found.");
}

$uid = $res->fetch_assoc()['id'];
echo "User '$user' found. ID: $uid\n";

// 2. Delete DUPLICATE 95 (Delete most recent 1)
$score1 = 95;
$conn->query("DELETE FROM scores WHERE user_id = $uid AND score = $score1 ORDER BY id DESC LIMIT 1");

if ($conn->affected_rows > 0) {
    echo "Deleted 1 duplicate score of $score1.\n";
} else {
    echo "No duplicate found for $score1.\n";
}

// 3. Delete DUPLICATE 86 (Delete most recent 1)
$score2 = 86;
$conn->query("DELETE FROM scores WHERE user_id = $uid AND score = $score2 ORDER BY id DESC LIMIT 1");

if ($conn->affected_rows > 0) {
    echo "Deleted 1 duplicate score of $score2.\n";
} else {
    echo "No duplicate found for $score2.\n";
}

$conn->close();
?>