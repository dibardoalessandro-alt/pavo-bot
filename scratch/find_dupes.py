import re

with open(r'c:\Users\dilar\Desktop\tweak\src\Lang.cs', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for the dictionary content of _translationMap
map_match = re.search(r'_translationMap\s*=\s*new\s*Dictionary<string,\s*string>\([^)]*\)\s*\{([^}]+)\};', content, re.DOTALL)
if map_match:
    map_content = map_match.group(1)
    # Find all keys
    keys = re.findall(r'\{\s*"([^"]+)"\s*,', map_content)
    
    seen = {}
    duplicates = []
    for k in keys:
        k_lower = k.lower().strip()
        seen[k_lower] = seen.get(k_lower, 0) + 1
        if seen[k_lower] == 2:
            duplicates.append(k)
            
    print("Duplicates in _translationMap:")
    for d in duplicates:
        print(f"  - {d} (count: {seen[d.lower().strip()]})")
else:
    print("_translationMap not found")
