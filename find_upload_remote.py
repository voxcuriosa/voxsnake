from ftplib import FTP_TLS
import json

with open('ftp_config.json', 'r') as f:
    config = json.load(f)

ftp = FTP_TLS(config['host'])
ftp.login(config['username'], config['password'])
ftp.prot_p()

def find_upload(path):
    try:
        ftp.cwd(path)
        items = ftp.nlst()
        for item in items:
            if item in ['.', '..']: continue
            full_path = f"{path.rstrip('/')}/{item}"
            if 'upload' in item.lower():
                print(f"FOUND: {full_path}")
            
            # Try to enter if it's a directory (no dot usually means dir in this env)
            if '.' not in item:
                find_upload(full_path)
                ftp.cwd(path)
    except:
        pass

print("Searching server for files with 'upload'...")
find_upload('/public_html')
ftp.quit()
