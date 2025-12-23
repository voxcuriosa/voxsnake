<?php
require_once 'db_config.php';

$conn = getDB();
echo "<h1>Migrating Scores...</h1>";

function migrateFile($conn, $filename, $platform)
{
    if (!file_exists($filename)) {
        echo "File not found: $filename<br>";
        return;
    }

    $json = file_get_contents($filename);
    $data = json_decode($json, true);

    if (!$data) {
        echo "No data in $filename<br>";
        return;
    }

    echo "<h3>Processing $platform (" . count($data) . " entries)</h3>";

    $count = 0;
    foreach ($data as $entry) {
        $name = $conn->real_escape_string(strtoupper(trim($entry['name'])));
        $score = intval($entry['score']);

        if (empty($name))
            continue;

        // 1. Ensure User Exists
        // Using INSERT IGNORE or ON DUPLICATE KEY UPDATE
        // We set a dummy password hash for migrated users
        $start_pw = password_hash("changeme", PASSWORD_DEFAULT);

        $sql_user = "INSERT INTO users (username, password_hash) VALUES ('$name', '$start_pw') 
                     ON DUPLICATE KEY UPDATE id=id";

        if (!$conn->query($sql_user)) {
            echo "Error user: " . $conn->error . "<br>";
            continue;
        }

        // Get User ID
        $result = $conn->query("SELECT id FROM users WHERE username = '$name'");
        $row = $result->fetch_assoc();
        $user_id = $row['id'];

        // 2. Insert Score
        $sql_score = "INSERT INTO scores (user_id, score, platform) VALUES ($user_id, $score, '$platform')";
        if ($conn->query($sql_score)) {
            $count++;
        } else {
            echo "Error score: " . $conn->error . "<br>";
        }

        // 3. Update Aggregates (Simplified: We just increment games_played and update best_score)
        // Note: For migrated scores, we treat each entry as 1 game.
        $conn->query("UPDATE users SET 
                      games_played = games_played + 1, 
                      total_xp = total_xp + $score,
                      best_score = GREATEST(best_score, $score)
                      WHERE id = $user_id");
    }

    echo "Migrated $count scores from $platform.<br>";
}

migrateFile($conn, 'scores_mobile.json', 'mobile');
migrateFile($conn, 'scores_pc.json', 'pc');

$conn->close();

echo "<h2>Migration Complete!</h2>";
?>