<?php
require_once 'db_config.php';
header('Content-Type: application/json');

$conn = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['action'])) {
        echo json_encode(["error" => "Invalid Request"]);
        exit;
    }

    $action = $input['action'];
    $username = strtoupper(trim($input['username']));
    $password = isset($input['password']) ? trim($input['password']) : '';

    if (empty($username)) {
        echo json_encode(["error" => "Username Required"]);
        exit;
    }

    if ($action === 'register') {
        // Validation: Min 6 chars
        if (strlen($password) < 6) {
            echo json_encode(["error" => "Password must be at least 6 digits/letters"]);
            exit;
        }

        // Check availability
        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            echo json_encode(["error" => "Username already taken"]);
            exit;
        }

        // Create User
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())");
        $stmt->bind_param("ss", $username, $hash);

        if ($stmt->execute()) {
            echo json_encode([
                "success" => true,
                "message" => "Account Created!",
                "user" => ["id" => $conn->insert_id, "name" => $username]
            ]);
        } else {
            echo json_encode(["error" => "Database Error"]);
        }
    } else if ($action === 'login') {
        $stmt = $conn->prepare("SELECT id, username, password_hash FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($user = $res->fetch_assoc()) {
            if (password_verify($password, $user['password_hash'])) {
                echo json_encode([
                    "success" => true,
                    "message" => "Welcome Back!",
                    "user" => ["id" => $user['id'], "name" => $user['username']]
                ]);
            } else {
                echo json_encode(["error" => "Wrong Password"]);
            }
        } else {
            echo json_encode(["error" => "User not found"]);
        }
    }
}
$conn->close();
?>