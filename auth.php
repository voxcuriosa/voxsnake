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

    // --- REGISTRATION ---
    if ($action === 'register') {
        // Validation: Min 6 chars
        if (strlen($password) < 6) {
            echo json_encode(["error" => "Password must be at least 6 digits/letters"]);
            exit;
        }

        // Check availability
        $stmt = $conn->prepare("SELECT id, password_hash FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        $claimID = null;
        if ($row = $res->fetch_assoc()) {
            // CHECK IF MIGRATED AUTO-ACCOUNT (Password is 'changeme' or 'auto')
            if (password_verify("changeme", $row['password_hash']) || password_verify("auto", $row['password_hash'])) {
                // Allow Claiming
                $claimID = $row['id'];
            } else {
                echo json_encode(["error" => "Username already taken"]);
                exit;
            }
        }

        // Get Security Q/A
        $secQ = isset($input['security_question']) ? trim($input['security_question']) : null;
        $secA = isset($input['security_answer']) ? trim($input['security_answer']) : null;
        $secAHash = $secA ? password_hash(strtolower($secA), PASSWORD_DEFAULT) : null; // Case-insensitive match

        $new_hash = password_hash($password, PASSWORD_DEFAULT);

        if ($claimID) {
            // CLAIM UPDATE
            $stmt = $conn->prepare("UPDATE users SET password_hash = ?, security_question = ?, security_answer = ? WHERE id = ?");
            $stmt->bind_param("sssi", $new_hash, $secQ, $secAHash, $claimID);
            $success = $stmt->execute();
            $userId = $claimID;
        } else {
            // NEW INSERT
            $stmt = $conn->prepare("INSERT INTO users (username, password_hash, security_question, security_answer, created_at) VALUES (?, ?, ?, ?, NOW())");
            $stmt->bind_param("ssss", $username, $new_hash, $secQ, $secAHash);
            $success = $stmt->execute();
            $userId = $conn->insert_id;
        }

        if ($success) {
            echo json_encode([
                "success" => true,
                "message" => $claimID ? "Account Claimed!" : "Account Created!",
                "user" => ["id" => $userId, "name" => $username, "is_admin" => ($username === 'CHRISTIAN' ? 1 : 0)]
            ]);
        } else {
            echo json_encode(["error" => "Database Error: " . $conn->error]);
        }
    }

    // --- LOGIN ---
    else if ($action === 'login') {
        $stmt = $conn->prepare("SELECT id, username, password_hash, is_admin FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($user = $res->fetch_assoc()) {
            if (password_verify($password, $user['password_hash'])) {
                echo json_encode([
                    "success" => true,
                    "message" => "Welcome Back!",
                    "user" => [
                        "id" => $user['id'],
                        "name" => $user['username'],
                        "is_admin" => (int) $user['is_admin']
                    ]
                ]);
            } else {
                echo json_encode(["error" => "Wrong Password"]);
            }
        } else {
            echo json_encode(["error" => "User not found"]);
        }
    }

    // --- RECOVERY: GET QUESTION ---
    else if ($action === 'get_question') {
        $stmt = $conn->prepare("SELECT security_question FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($row = $res->fetch_assoc()) {
            if ($row['security_question']) {
                echo json_encode(["success" => true, "question" => $row['security_question']]);
            } else {
                echo json_encode(["error" => "No security question set for this user."]);
            }
        } else {
            echo json_encode(["error" => "User not found"]);
        }
    }

    // --- RECOVERY: RESET PASSWORD ---
    else if ($action === 'reset_password') {
        $answer = isset($input['answer']) ? trim($input['answer']) : '';
        $newpass = isset($input['newpass']) ? trim($input['newpass']) : '';

        if (strlen($newpass) < 6) {
            echo json_encode(["error" => "New password too short"]);
            exit;
        }

        $stmt = $conn->prepare("SELECT id, security_answer FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($row = $res->fetch_assoc()) {
            // Verify Answer (Case insensitive check logic handled by hashing lowercase input)
            if (password_verify(strtolower($answer), $row['security_answer'])) {
                $new_hash = password_hash($newpass, PASSWORD_DEFAULT);
                $upd = $conn->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $upd->bind_param("si", $new_hash, $row['id']);
                $upd->execute();
                echo json_encode(["success" => true, "message" => "Password Reset!"]);
            } else {
                echo json_encode(["error" => "Wrong Answer"]);
            }
        } else {
            echo json_encode(["error" => "User not found"]);
        }
    }

    // --- PROFILE STATS ---
    else if ($action === 'get_stats') {
        // Requires Login (or explicit user request) - Currently using username from input
        $stmt = $conn->prepare("SELECT id, total_xp, games_played, created_at FROM users WHERE LOWER(username) = LOWER(?)");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($userRow = $res->fetch_assoc()) {
            $uid = $userRow['id'];

            // Get Best Mobile Score
            $qMob = $conn->query("SELECT MAX(score) as s FROM scores WHERE user_id = $uid AND device_type = 'mobile'");
            $rMob = $qMob->fetch_assoc();
            $userRow['best_mobile'] = $rMob['s'] ?? 0;

            // Get Best PC Score
            $qPC = $conn->query("SELECT MAX(score) as s FROM scores WHERE user_id = $uid AND device_type = 'pc'");
            $rPC = $qPC->fetch_assoc();
            $userRow['best_pc'] = $rPC['s'] ?? 0;

            echo json_encode(["success" => true, "stats" => $userRow]);
        } else {
            echo json_encode(["error" => "User not found"]);
        }
    }

    // --- ADMIN ACTIONS ---
    else if (strpos($action, 'admin_') === 0) {
        // 1. Verify Requestor IS Admin
        // Use input directly, let SQL handle logic via LOWER()
        $adminUser = isset($input['admin_user']) ? trim($input['admin_user']) : '';
        if (!$adminUser) {
            echo json_encode(["error" => "Admin Auth Missing"]);
            exit;
        }

        $chk = $conn->prepare("SELECT is_admin FROM users WHERE LOWER(username) = LOWER(?)");
        $chk->bind_param("s", $adminUser);
        $chk->execute();
        $res = $chk->get_result();
        $adminRow = $res->fetch_assoc();

        if (!$adminRow || $adminRow['is_admin'] != 1) {
            echo json_encode(["error" => "Unauthorized"]);
            exit;
        }

        // 2. Perform Action
        if ($action === 'admin_list_users') {
            $sql = "SELECT id, username, total_xp, games_played, created_at, is_admin FROM users ORDER BY id DESC LIMIT 100";
            $list = $conn->query($sql);
            if (!$list) {
                echo json_encode(["error" => "SQL Error: " . $conn->error]);
                exit;
            }
            $users = [];
            while ($u = $list->fetch_assoc())
                $users[] = $u;
            echo json_encode(["success" => true, "users" => $users]);
        } else if ($action === 'admin_delete_user') {
            $targetId = isset($input['target_id']) ? intval($input['target_id']) : 0;
            if ($targetId > 0) {
                // Delete User
                $conn->query("DELETE FROM users WHERE id = $targetId");
                // Delete Scores
                $conn->query("DELETE FROM scores WHERE user_id = $targetId");
                echo json_encode(["success" => true, "message" => "User Deleted"]);
            }
        } else if ($action === 'admin_reset_user') {
            $targetId = isset($input['target_id']) ? intval($input['target_id']) : 0;
            $newpass = "changeme"; // Default reset
            if ($targetId > 0) {
                $hash = password_hash($newpass, PASSWORD_DEFAULT);
                $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $stmt->bind_param("si", $hash, $targetId);
                $stmt->execute();
                echo json_encode(["success" => true, "message" => "Password reset to 'changeme'"]);
            }
        }
    }
}
$conn->close();
?>