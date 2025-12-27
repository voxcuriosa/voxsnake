<?php
require_once 'db_config.php';
header('Content-Type: application/json');

$conn = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    if ($action === 'h2h') {
        // Return Stats between User1 and User2
        $p1 = isset($_GET['p1']) ? $_GET['p1'] : '';
        $p2 = isset($_GET['p2']) ? $_GET['p2'] : '';

        if (!$p1 || !$p2) {
            echo json_encode(["error" => "Missing names"]);
            exit;
        }

        // Find all matches involving both
        $stmt = $conn->prepare("SELECT * FROM matches WHERE (p1_name=? AND p2_name=?) OR (p1_name=? AND p2_name=?)");
        $stmt->bind_param("ssss", $p1, $p2, $p2, $p1);
        $stmt->execute();
        $res = $stmt->get_result();

        $winsP1 = 0;
        $winsP2 = 0;
        $draws = 0;
        $total = 0;

        while ($row = $res->fetch_assoc()) {
            $total++;
            if ($row['winner_name'] === 'DRAW') {
                $draws++;
            } else if (strtoupper($row['winner_name']) === strtoupper($p1)) {
                $winsP1++;
            } else if (strtoupper($row['winner_name']) === strtoupper($p2)) {
                $winsP2++;
            }
        }

        echo json_encode([
            "p1" => $p1,
            "p2" => $p2,
            "wins1" => $winsP1,
            "wins2" => $winsP2,
            "draws" => $draws,
            "total" => $total
        ]);
    } else if ($action === 'history') {
        // Return recent matches for a user
        $p = isset($_GET['player']) ? $_GET['player'] : '';
        $stmt = $conn->prepare("SELECT * FROM matches WHERE p1_name=? OR p2_name=? ORDER BY played_at DESC LIMIT 20");
        $stmt->bind_param("ss", $p, $p);
        $stmt->execute();
        $res = $stmt->get_result();
        $history = [];
        while ($row = $res->fetch_assoc()) {
            $history[] = $row;
        }
        echo json_encode($history);
    }
} else if ($method === 'POST') {
    // Record Match
    $input = json_decode(file_get_contents('php://input'), true);

    $p1 = strtoupper($input['p1']);
    $p2 = strtoupper($input['p2']);
    $winner = strtoupper($input['winner']); // Name or 'DRAW'
    $duration = isset($input['duration']) ? intval($input['duration']) : 0;

    // Validation
    if ($p1 === 'PLAYER 1' || $p2 === 'PLAYER 2' || $p2 === 'JOINING...') {
        // Don't record partial setups
        echo json_encode(["status" => "skipped_generic_names"]);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO matches (p1_name, p2_name, winner_name, duration) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("sssi", $p1, $p2, $winner, $duration);

    if ($stmt->execute()) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["error" => $conn->error]);
    }
}

$conn->close();
?>