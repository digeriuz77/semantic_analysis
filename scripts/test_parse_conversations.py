import re

filepath = ".kilocode/data/Coaching Conversations by teacher.txt"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

TEACHER_CANONICAL = {
    "habib": "Habib", "healery": "Healery", "anis": "Anis",
    "carolyne": "Carolyne", "carolyn": "Carolyne", "anthony": "Anthony", "joshua": "Joshua"
}

lines = text.splitlines()
current_teacher = None
entries = []

for line in lines:
    line_clean = line.strip()
    if not line_clean:
        continue
    
    # Check teacher header
    m_teach = re.match(r"^([A-Za-z]+)(?:\s*\(.*?\))?:?$", line_clean)
    if m_teach:
        raw_t = m_teach.group(1).lower()
        if raw_t in TEACHER_CANONICAL:
            current_teacher = TEACHER_CANONICAL[raw_t]
            continue
    
    # Check date line
    date_m = re.search(r"^([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{4})\s*(?:\([^)]*\))?:?\s*(.*)$", line_clean)
    if date_m and current_teacher:
        date_str = date_m.group(1)
        content = date_m.group(2).strip()
        entries.append({
            "teacher": current_teacher,
            "raw_date": date_str,
            "content": content
        })

print(f"Total coaching conversation sessions parsed: {len(entries)}")
for e in entries:
    print(f"  [{e['raw_date']}] {e['teacher']}: {e['content'][:80]}...")
