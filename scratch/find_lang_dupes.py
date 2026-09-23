import re

with open(r'c:\Users\dilar\Desktop\tweak\src\Lang.cs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

it_keys = set()
en_keys = set()
is_it = True

for line_no, line in enumerate(lines, 1):
    if 'private static Dictionary<string, string> _en' in line:
        is_it = False
    match = re.search(r'\{\s*"([^"]+)"\s*,', line)
    if match:
        key = match.group(1)
        keys_set = it_keys if is_it else en_keys
        section = "IT" if is_it else "EN"
        if key in keys_set:
            print(f"DUPLICATE KEY in {section} at line {line_no}: '{key}'")
        else:
            keys_set.add(key)
