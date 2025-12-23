<?php
require_once 'db_config.php';
header('Content-Type: application/json');

$conn = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET (Load High Scores)
if ($method === 'GET') {
    $type = isset($_GET['type']) ? $_GET['type'] : 'mobile'; // mobile or pc

    // Query: Top 50 scores for this platform
    // We join with users to get names
    $sql = "SELECT u.username as name, s.score, s.created_at as date 
            FROM scores s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.platform = ? 
            ORDER BY s.score DESC 
            LIMIT 50";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $type);
    $stmt->execute();
    $result = $stmt->get_result();

    $scores = [];
    while ($row = $result->fetch_assoc()) {
        $scores[] = $row;
    }

    echo json_encode($scores);
}

// Handle POST (Submit Score)
else if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400); // Bad Request
        echo json_encode(["error" => "Invalid JSON"]);
        exit;
    }

    $name = isset($input['name']) ? strtoupper(trim($input['name'])) : 'ANON';
    $score = isset($input['score']) ? intval($input['score']) : 0;
    $type = isset($input['type']) ? $input['type'] : 'mobile';

    // 1. Find or Create User
    // For simple high scores, we trust the name provided.
    // In a full login system, we would verify session/token here.
    // For now: Auto-register name if new.

    // Dummy pw hash for auto-created users
    $dummy_pw = password_hash("auto", PASSWORD_DEFAULT);

    // Insert User if not exists
    $sql_user = "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE id=id"; // No-op update to ensure id retrieval works or simple ignore

    $stmt = $conn->prepare($sql_user);
    $stmt->bind_param("ss", $name, $dummy_pw);
    $stmt->execute();

    // Get User ID
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $name);
    $stmt->execute();
    $res = $stmt->get_result();
    $user = $res->fetch_assoc();
    $user_id = $user['id'];

    // 2. Insert Score
    $sql_score = "INSERT INTO scores (user_id, score, platform) VALUES (?, ?, ?)";
    $stmt = $conn->prepare($sql_score);
    $stmt->bind_param("iis", $user_id, $score, $type);

    if ($stmt->execute()) {
        // 3. Update Stats
        $conn->query("UPDATE users SET 
                      games_played = games_played + 1, 
                      total_xp = total_xp + $score, 
                      best_score = GREATEST(best_score, $score) 
                      WHERE id = $user_id");

        echo json_encode(["success" => true, "rank" => "Calculated client-side"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error"]);
    }
}

$conn->close();
?>