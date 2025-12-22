<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$file = 'scores_db.json';

// Initialize file if not exists
if (!file_exists($file)) {
    file_put_contents($file, '[]');
}

// Handle GET request (Read Scores)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $scores = json_decode(file_get_contents($file), true);
    if (!$scores) $scores = [];
    
    // Sort by score descending just in case
    usort($scores, function($a, $b) {
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
        
        $scores = json_decode(file_get_contents($file), true);
        if (!$scores) $scores = [];
        
        $scores[] = ["name" => $name, "score" => $score];
        
        // Sort and Keep Top 50
        usort($scores, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        $scores = array_slice($scores, 0, 50);
        
        if (file_put_contents($file, json_encode($scores))) {
            echo json_encode(["message" => "Score saved", "success" => true]);
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
