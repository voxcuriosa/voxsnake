<?php
// fix_anon.php
// Rename "ANON" to "Anonymous" in score files

$files = ['scores_mobile.json', 'scores_pc.json'];

foreach ($files as $file) {
    if (file_exists($file)) {
        $json = file_get_contents($file);
        $data = json_decode($json, true);

        if ($data) {
            $changed = false;
            foreach ($data as &$entry) {
                if (strtoupper($entry['name']) === 'ANON') {
                    $entry['name'] = 'Anonymous';
                    $changed = true;
                }
            }
            unset($entry); // Break reference

            if ($changed) {
                file_put_contents($file, json_encode($data));
                echo "Updated $file<br>";
            } else {
                echo "No changes needed in $file<br>";
            }
        } else {
            echo "Could not decode $file<br>";
        }
    } else {
        echo "File not found: $file<br>";
    }
}
?>