import re
import os

def bump_version():
    # 1. READ CURRENT VERSION FROM game_v9.js
    game_js_path = 'game_v9.js'
    index_html_path = 'index.html'
    sw_js_path = 'sw.js'

    if not os.path.exists(game_js_path):
        print(f"Error: {game_js_path} not found")
        return

    with open(game_js_path, 'r', encoding='utf-8') as f:
        game_js_content = f.read()

    # Find ANY current version to start from
    # We prefer the one in CURRENT_VER
    ver_match = re.search(r'const CURRENT_VER = "v(\d+\.\d+)";', game_js_content)
    if not ver_match:
        print("Error: Could not find CURRENT_VER in game_v9.js")
        return

    current_ver_str = ver_match.group(1)
    current_ver = float(current_ver_str)
    new_ver = round(current_ver + 0.01, 2)
    new_ver_str = f"{new_ver:.2f}"
    
    print(f"Bumping Game Version: {current_ver_str} -> {new_ver_str}")

    # UPDATE game_v9.js (Global Regex Replace)
    # 1. Update const CURRENT_VER = "v..."
    new_game_js = re.sub(r'const CURRENT_VER = "v\d+\.\d+";', f'const CURRENT_VER = "v{new_ver_str}";', game_js_content)
    
    # 2. Update bodyVer check: if (bodyVer !== "3.32")
    # We look for pattern: if (bodyVer !== "\d+\.\d+")
    # Be careful not to replace other stuff.
    new_game_js = re.sub(r'if \(bodyVer !== "\d+\.\d+"\)', f'if (bodyVer !== "{new_ver_str}")', new_game_js)

    with open(game_js_path, 'w', encoding='utf-8') as f:
        f.write(new_game_js)
    print(f"Updated {game_js_path}")

    # UPDATE index.html
    # 1. data-version="3.33"
    # 2. game_v9.js?v=3.33
    if os.path.exists(index_html_path):
        with open(index_html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Replace data-version
        new_html = re.sub(r'data-version="\d+\.\d+"', f'data-version="{new_ver_str}"', html_content)
        # Replace script src version (?v=...)
        new_html = re.sub(r'game_v9\.js\?v=\d+\.\d+', f'game_v9.js?v={new_ver_str}', new_html)
        # Replace style.css version (?v=...)
        new_html = re.sub(r'style\.css\?v=\d+\.\d+', f'style.css?v={new_ver_str}', new_html)
        
        with open(index_html_path, 'w', encoding='utf-8') as f:
            f.write(new_html)
        print(f"Updated {index_html_path}")

    # UPDATE sw.js CACHE VERSION
    # const CACHE_NAME = 'neon-snake-v54-network-first';
    if os.path.exists(sw_js_path):
        with open(sw_js_path, 'r', encoding='utf-8') as f:
            sw_content = f.read()
        
        # Find vXX
        sw_match = re.search(r'neon-snake-v(\d+)-network-first', sw_content)
        if sw_match:
            current_sw_ver = int(sw_match.group(1))
            new_sw_ver = current_sw_ver + 1
            print(f"Bumping SW Cache: v{current_sw_ver} -> v{new_sw_ver}")
            
            new_sw = sw_content.replace(f'neon-snake-v{current_sw_ver}-network-first', f'neon-snake-v{new_sw_ver}-network-first')
            with open(sw_js_path, 'w', encoding='utf-8') as f:
                f.write(new_sw)
            print(f"Updated {sw_js_path}")
        else:
            print("Warning: Could not find CACHE_NAME pattern in sw.js")

if __name__ == "__main__":
    bump_version()
