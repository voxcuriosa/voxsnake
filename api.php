<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$file_pc = 'scores_pc.json';
$file_mobile = 'scores_mobile.json';
$file_legacy = 'scores_db.json';

// --- MIGRATION LOGIC (Run Once) ---
if (file_exists($file_legacy) && (!file_exists($file_pc) || !file_exists($file_mobile))) {
    $legacy_data = json_decode(file_get_contents($file_legacy), true);
    if (!$legacy_data)
        $legacy_data = [];

    $pc_scores = [];
    $mobile_scores = [];

    foreach ($legacy_data as $entry) {
        // "Flytt bare de over 100 poeng til PC listen"
        if ($entry['score'] > 100) {
            $pc_scores[] = $entry;
        } else {
            $mobile_scores[] = $entry;
        }
    }

    file_put_contents($file_pc, json_encode($pc_scores));
    file_put_contents($file_mobile, json_encode($mobile_scores));
    // Optional: unlink($file_legacy); // Keep for safety for now
}
// ----------------------------------

// Determine which file to use
$type = isset($_GET['type']) ? $_GET['type'] : (isset($_POST['type']) ? $_POST['type'] : 'mobile');
$target_file = ($type === 'pc') ? $file_pc : $file_mobile;

// Initialize if missing
if (!file_exists($target_file)) {
    file_put_contents($target_file, '[]');
}

// Handle GET request (Read Scores)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $scores = json_decode(file_get_contents($target_file), true);
    if (!$scores)
        $scores = [];

    // Sort by score descending
    usort($scores, function ($a, $b) {
        return $b['score'] - $a['score'];
    });

    echo json_encode(array_slice($scores, 0, 50));
    exit;
}

// Handle POST request (Save Score)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);

    if (isset($input['name']) && isset($input['score'])) {
        $name = strip_tags(substr($input['name'], 0, 10)); // Sanitize
        $score = intval($input['score']);

        $scores = json_decode(file_get_contents($target_file), true);
        if (!$scores)
            $scores = [];

        $scores[] = ["name" => $name, "score" => $score];

        // Sort and Keep Top 50
        usort($scores, function ($a, $b) {
            return $b['score'] - $a['score'];
        });

        $scores = array_slice($scores, 0, 50);

        if (file_put_contents($target_file, json_encode($scores))) {
            echo json_encode(["message" => "Score saved to " . $type, "success" => true]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "Failed to write to file"]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Invalid input"]);
    }
    exit;
}
?>