<?php
require_once 'db_config.php';

$conn = getDB();

echo "Starting cleanup of anonymous scores...\n";

// 1. Find the User IDs for common anonymous names
$anonNames = ['ANON', 'ANONYMOUS'];
$placeholders = implode(',', array_fill(0, count($anonNames), '?'));
$sqlFetchIds = "SELECT id FROM users WHERE username IN ($placeholders)";

$stmt = $conn->prepare($sqlFetchIds);
$stmt->bind_param(str_repeat('s', count($anonNames)), ...$anonNames);
$stmt->execute();
$result = $stmt->get_result();

$userIds = [];
while ($row = $result->fetch_assoc()) {
    $userIds[] = $row['id'];
}

if (empty($userIds)) {
    echo "No anonymous users found in the database.\n";
    exit;
}

$idList = implode(',', $userIds);
echo "Found anonymous User IDs: $idList\n";

// 2. Delete scores associated with these User IDs
$sqlDeleteScores = "DELETE FROM scores WHERE user_id IN ($idList)";
$stmtDelete = $conn->prepare($sqlDeleteScores);

if ($stmtDelete->execute()) {
    $deletedCount = $stmtDelete->affected_rows;
    echo "Successfully deleted $deletedCount anonymous scores.\n";
} else {
    echo "Error deleting scores: " . $conn->error . "\n";
}

// 3. Optional: Cleanup users table? 
// For now, let's keep the users to avoid potential FK issues if other tables reference them,
// but usually, it's safe to delete them if they only existed for these scores.
// $conn->query("DELETE FROM users WHERE id IN ($idList)");

$conn->close();
echo "Cleanup complete.\n";
?>