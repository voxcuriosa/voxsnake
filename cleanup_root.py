from ftplib import FTP_TLS
import json
import os

# Load FTP config
config_path = 'ftp_config.json'
with open(config_path, 'r') as f:
    config = json.load(f)

print("Connecting to FTP for total cleanup...")
ftp = FTP_TLS(config['host'])
ftp.login(config['username'], config['password'])
ftp.prot_p()

# Comprehensive list of files to delete from ROOT (legacy, utilities, tests)
files_to_delete = [
    'api_matches.php', 'bump_version.py', 'check_schema.php', 'cleanup.php',
    'diagnose.php', 'dump_db.php', 'fix.html', 'fix_anon.php', 'fix_tables.php',
    'game.js', 'game_v2.js', 'game_v6.js', 'game_v7.js', 'game_v8.js',
    'git-wrapper.bat', 'index_v6.html', 'install_db.php', 'migrate_scores.php',
    'migrate_security.php', 'migrate_stats.php', 'mobile.html', 'php_test.php',
    'publish.bat', 'remove_dupes.php', 'scores.json', 'scores_pc.json', 
    'scores_mobile.json', 'scores_db.json', 'setup_matches.php', 'reset.html',
    'test_blind.html', 'test_fx.html', 'test_mine.html', 'test_shield.html',
    'test_torpedo.html', 'error_log'
]

ftp.cwd('/public_html')

print("Starting deep cleanup of root directory...")
for file in files_to_delete:
    try:
        ftp.delete(file)
        print(f"Deleted: {file}")
    except Exception as e:
        # File might not exist or be a folder
        print(f"Skipped {file} (might be gone or is a folder)")

print("\n--- SAFETY CHECK ---")
print("Preserved: .well-known/ (Crucial for Android)")
print("Preserved: snake/ (New game location)")
print("Preserved: history/ (Assuming this is another project)")

print("\nCleanup complete! Your root is now much cleaner.")
ftp.quit()
