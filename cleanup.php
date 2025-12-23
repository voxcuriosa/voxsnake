<?php
// cleanup.php - Removes top 2 ANON scores from Mobile list
header('Content-Type: text/plain');

$file = 'scores_mobile.json';
if (!file_exists($file))
    die("File not found");

$data = json_decode(file_get_contents($file), true);
if (!$data)
    die("No data");

// Sort Descending
usort($data, function ($a, $b) {
    return $b['score'] - $a['score'];
});

$clean_data = [];
$removed_count = 0;
$target_remove = 2;

foreach ($data as $entry) {
    // Check if we should remove this entry
    // Only target TOP entries (so check if we have seen non-removed ones?)
    // User said "de to som er øverst".
    // So if we haven't finalized the top 2 yet...

    // Simple logic: Remove the first 2 instances of "ANON" found in the sorted list.
    if ($removed_count < $target_remove && $entry['name'] === 'ANON') {
        $removed_count++;
        echo "Removed: " . $entry['name'] . " - " . $entry['score'] . "\n";
        continue;
    }
    $clean_data[] = $entry;
}

// Re-index
$clean_data = array_values($clean_data);

if ($removed_count > 0) {
    file_put_contents($file, json_encode($clean_data));
    echo "Successfully removed $removed_count entries.\n";
} else {
    echo "No ANON entries found to remove in the top scanning.\n";
}
?>