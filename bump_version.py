import re
import sys

FILE_PATH = 'index.html'

def bump_version():
    try:
        with open(FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find version "v3.4" or similar
        # We look for the specific pattern in the "HOW TO PLAY" section or the script tag
        # Pattern: v(\d+\.\d+)
        
        # We want to find the current version first. 
        # Let's search for the one in the span first to be safe: <span ...>v3.4</span>
        # Or generally vX.Y
        
        # Heuristic: Find first occurrence of vX.Y that looks like a version
        # Actually, let's look for the one in the script tag '?v=3.4' as the source of truth if possible, or just all of them.
        
        # User request: "endre versjonsnummer med 0.1" (change version number by 0.1)
        
        # Let's find all occurrences of v(\d+\.\d+) and update them IF they are the same version.
        
        # 1. Extract current version
        match = re.search(r'v(\d+\.\d+)', content)
        if not match:
            print("No version found in index.html (looking for vX.Y)")
            return

        current_ver_str = match.group(1)
        current_ver = float(current_ver_str)
        # Force Reset to 1.00 if we are in the 8.x chaos, or just increment by 0.01
        if current_ver >= 8.0:
            new_ver = 1.00
        else:
            new_ver = round(current_ver + 0.01, 2)
        new_ver_str = str(new_ver)
        
        print(f"Bumping version from {current_ver_str} to {new_ver_str}")
        
        # 2. Replace all occurrences of the old version string with the new one
        # BE CAREFUL: "1.5" (style) vs "3.4" (game).
        # Should we update ALL numbers? 
        # The user said "endre versjonsnummer" (singular/general). 
        # Usually style.css version is separate, but maybe they want everything updated?
        # Let's stick to the high number (3.4) found in the Game Title/Instructions.
        # "style.css?v=1.5" might be old.
        # "game_v2.js?v=3.4" matches the text "v3.4".
        
        # Let's targeting specifically the value 3.4 (or whatever the main one is).
        # We will look for the highest version number found ? Or just specific strings.
        
        # Strategy: Update 'v3.4' -> 'v3.5' and '?v=3.4' -> '?v=3.5'.
        
        # Let's update explicitly the `v{current_ver_str}` pattern to `v{new_ver_str}`
        # AND `?v={current_ver_str}` to `?v={new_ver_str}`
        
        # Actually simpler: just replace logic.
        
        # Safety: We assume the user wants the MAIN version updated.
        # If I see v1.5 and v3.4, I should probably update 3.4.
        # Let's find the specific one in the "HOW TO PLAY" section as a reference anchor if needed, 
        # but regex replacing specific values is safer.
        
        # Let's find the max version in the file to be safe?
        matches = re.findall(r'[vV=](\d+\.\d+)', content)
        if not matches:
             print("No versions found.")
             return
             
        # Filter to likely versions (not css 1.0 if there is a 3.4)
        # matches might be ['1.5', '3.4', '3.4']
        # We want to bump 3.4.
        
        max_ver = 0.0
        for m in matches:
            try:
                val = float(m)
                if val > max_ver:
                    max_ver = val
            except:
                pass
                
        if max_ver == 0.0:
             print("Could not determine version.")
             return
             
        old_ver_str = str(max_ver)
        new_ver_2 = round(max_ver + 0.01, 2)
        new_ver_str_2 = str(new_ver_2)
        
        print(f"Detected main version: {old_ver_str}. Bumping to {new_ver_str_2}...")
        
        # Replace
        new_content = content.replace(f"v{old_ver_str}", f"v{new_ver_str_2}")
        new_content = new_content.replace(f"v={old_ver_str}", f"v={new_ver_str_2}")
        
        with open(FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print("Version bumped successfully.")

    except Exception as e:
        print(f"Error bumping version: {e}")
        sys.exit(1)

if __name__ == '__main__':
    bump_version()
