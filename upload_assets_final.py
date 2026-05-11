from ftplib import FTP_TLS
import os
import json

# FTP Config
config_path = 'ftp_config.json'
if not os.path.exists(config_path):
    print("Error: ftp_config.json not found")
    exit()

with open(config_path, 'r') as f:
    config = json.load(f)

ftp = FTP_TLS(config['host'])
ftp.login(config['username'], config['password'])
ftp.prot_p()

# 1. Upload Assets to /public_html/snake
print("Uploading Assets to /snake...")
try:
    ftp.cwd('/public_html/snake')
except:
    ftp.cwd('/public_html')
    ftp.mkd('snake')
    ftp.cwd('snake')

files_to_upload = ['icon_192.png', 'icon_512.png', 'game_v9.js', 'index.html', 'style.css', 'sw.js', 'manifest.json', 'api.php', 'api_sql.php', 'auth.php', 'db_config.php', 'api_matches.php', 'setup_matches.php', 'robots.txt', 'sitemap.xml']

for file in files_to_upload:
    if os.path.exists(file):
        with open(file, 'rb') as f:
            ftp.storbinary(f"STOR {file}", f)
        print(f"Uploaded {file}")
    else:
        print(f"Skipped {file} (Not found)")

# 2. Upload assetlinks.json to .well-known at ROOT
print("Uploading AssetLinks to root...")
try:
    ftp.cwd('/public_html/.well-known')
except:
    ftp.cwd('/public_html')
    ftp.mkd('.well-known')
    ftp.cwd('.well-known')

if os.path.exists('assetlinks.json'):
    with open('assetlinks.json', 'rb') as f:
        ftp.storbinary("STOR assetlinks.json", f)
    print("Uploaded assetlinks.json")

print("Done!")
ftp.quit()
