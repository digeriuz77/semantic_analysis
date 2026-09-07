import re
import os

filepath = ".kilocode/data/Materials export by teacher.txt"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

# Teacher section blocks
teacher_pattern = re.compile(r"^\*\*\*([A-Za-z]+)\*\*\*", re.MULTILINE)
matches = list(teacher_pattern.finditer(text))

sections = []
for i, m in enumerate(matches):
    tname = m.group(1).strip()
    start_idx = m.end()
    end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
    block = text[start_idx:end_idx].strip()
    if block:
        sections.append((tname, block))

# In each teacher section, identify every single artifact
# Item header pattern:
item_pattern = re.compile(
    r"(?m)^(?:\d+\.\s+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{1,2},?\s+)?\d{4}|\bUndated\b|\bPost-Sep\s+\d{4}\b)|^(?:\d+\.\s+.*?)\(((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{1,2},?\s+)?\d{4}|Undated[^\)]*)\)"
)

total_items = 0
for tname, block in sections:
    item_matches = list(item_pattern.finditer(block))
    print(f"Teacher: {tname} -> {len(item_matches)} artifacts")
    for j, im in enumerate(item_matches):
        s_start = im.start()
        s_end = item_matches[j + 1].start() if j + 1 < len(item_matches) else len(block)
        sub = block[s_start:s_end].strip()
        lines = sub.splitlines()
        header = lines[0] if lines else ""
        date_str = im.group(1)
        # extract quotes
        q_matches = re.findall(r'>\s*"([^"]+)"|Key Quotation:?\s*"([^"]+)"', sub)
        quote = ""
        if q_matches:
            quote = q_matches[0][0] or q_matches[0][1]
        print(f"  [{date_str}] {header[:50]} | Quote len: {len(quote)}")
        total_items += 1

print(f"\nTotal sub-artifacts parsed: {total_items}")
