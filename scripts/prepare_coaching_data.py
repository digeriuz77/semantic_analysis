"""
prepare_coaching_data.py

Parses raw data files in .kilocode/data:
  1. Coaching Conversations by teacher.txt
  2. Export Coach Reflection by teacher.txt
  3. Export Teacher Reflections.txt
  4. Materials export by teacher.txt

Generates:
  - .kilocode/data/processed/teachers/<Teacher>_dossier.txt (6 individual dossiers)
  - .kilocode/data/processed/All_Teacher_Reflections_Dated.txt
  - .kilocode/data/processed/All_Coach_Reflections_Dated.txt
  - .kilocode/data/processed/All_Coaching_Interactions_Dated.txt
  - .kilocode/data/processed/All_Instructional_Materials_Dated.txt
  - .kilocode/data/processed/Complete_Coaching_Corpus_Dated.txt
  - .kilocode/data/processed/sarawak_coaching_corpus.csv (Tabular mode compatible)
"""

import os
import re
import csv
from datetime import datetime

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".kilocode", "data"))
OUT_DIR = os.path.join(DATA_DIR, "processed")
TEACHERS_DIR = os.path.join(OUT_DIR, "teachers")

TEACHER_CANONICAL = {
    "habib": "Habib",
    "mohamad habib": "Habib",
    "moham-nga": "Habib",
    "healery": "Healery",
    "healery jumput lo": "Healery",
    "heale-nga": "Healery",
    "anis": "Anis",
    "nur anis": "Anis",
    "nur anis nabihah binti mustapha": "Anis",
    "nuran-stb": "Anis",
    "carolyn": "Carolyne",
    "carolyne": "Carolyne",
    "carolyne anak thunderbirds": "Carolyne",
    "anthony": "Anthony",
    "anthony anak ligok": "Anthony",
    "joshua": "Joshua",
    "joshua arry": "Joshua",
    "joshua arry anak frankie": "Joshua",
    "joshu-stb": "Joshua",
}

TEACHER_METADATA = {
    "Habib": {"school": "SK Nanga Ajau", "coach": "Gary", "subject": "Mathematics (DLP)"},
    "Healery": {"school": "SK Nanga Ajau", "coach": "Shamim", "subject": "Mathematics (DLP)"},
    "Anis": {"school": "St. Bartholomew", "coach": "Shamim", "subject": "Mathematics / English (DLP)"},
    "Carolyne": {"school": "SK Nanga Ajau", "coach": "Eddy", "subject": "Science (DLP)"},
    "Anthony": {"school": "St. Bartholomew", "coach": "Eddy", "subject": "Mathematics (DLP)"},
    "Joshua": {"school": "St. Bartholomew", "coach": "Eddy", "subject": "Science / Mathematics (DLP)"},
}

MONTHS = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
}

def normalize_date(raw_date_str):
    """Normalize date strings like 'May 06, 2026' or 'Jun 18, 2026 (Week 10)' to 'YYYY-MM-DD'."""
    if not raw_date_str:
        return "2026-00-00"
    m = re.search(r"([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})", raw_date_str)
    if m:
        month_name = m.group(1)[:3].lower()
        month_num = MONTHS.get(month_name, "00")
        day = f"{int(m.group(2)):02d}"
        year = m.group(3)
        # Fix 2025 typo for August Week 17
        if year == "2025" and month_num == "08":
            year = "2026"
        return f"{year}-{month_num}-{day}"
    m_my = re.search(r"([A-Za-z]{3,9})\s+(\d{4})", raw_date_str)
    if m_my:
        month_name = m_my.group(1)[:3].lower()
        month_num = MONTHS.get(month_name, "00")
        year = m_my.group(2)
        return f"{year}-{month_num}-01"
    return raw_date_str.strip()


def parse_coaching_conversations(filepath):
    """Parses 'Coaching Conversations by teacher.txt'."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    lines = [l.rstrip() for l in text.splitlines()]
    current_teacher = None
    
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        if line_clean.startswith("Based on your files") or line_clean.startswith("Would you like me") or line_clean == "Sources:":
            continue
        if re.match(r"^(Week \d+|Blank Template|Habib Week|Healery wk|Anis wk)", line_clean):
            continue

        # Check for teacher header
        # e.g., Habib (CfBT Coach: Gary) or Carolyne or Anthony
        teacher_match = None
        for key in ["habib", "healery", "anis", "carolyne", "carolyn", "anthony", "joshua"]:
            if re.match(rf"^{key}\b", line_clean, re.IGNORECASE):
                teacher_match = TEACHER_CANONICAL[key]
                break
        
        # Check if this line is a date entry: "Jun 18, 2026 (Week 10): ..."
        date_match = re.match(r"^([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\([^)]+\))?):\s*(.*)", line_clean)
        
        if teacher_match and not date_match:
            current_teacher = teacher_match
            continue

        if date_match and current_teacher:
            raw_date = date_match.group(1)
            content = date_match.group(2).strip()
            norm_date = normalize_date(raw_date)
            entries.append({
                "teacher": current_teacher,
                "date": norm_date,
                "raw_date": raw_date,
                "role": "Coach & Teacher Dialogue",
                "source": "Coaching Conversations",
                "milestone": "Session Log",
                "content": content,
                "raw_block": f"[{norm_date} | {current_teacher} | Coaching Conversation]\n{content}"
            })
    return entries


def parse_coach_reflections(filepath):
    """Parses 'Export Coach Reflection by teacher.txt'."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # Split by teacher headers
    # e.g., "Anis (School: St. Bartholomew | Coach: Shamim)"
    teacher_pattern = re.compile(r"^([A-Za-z /]+)\s*\(School:[^)]+\)", re.MULTILINE)
    matches = list(teacher_pattern.finditer(text))
    
    for i, m in enumerate(matches):
        raw_name = m.group(1).strip()
        canonical_name = None
        for key, val in TEACHER_CANONICAL.items():
            if key in raw_name.lower():
                canonical_name = val
                break
        if not canonical_name:
            canonical_name = raw_name
            
        start_idx = m.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start_idx:end_idx]

        # Each teacher section has date-separated entries:
        # e.g. "May 06, 2026\nPD Milestone: ..."
        date_pattern = re.compile(r"^([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", re.MULTILINE)
        date_matches = list(date_pattern.finditer(block))
        
        for j, dm in enumerate(date_matches):
            raw_date = dm.group(1).strip()
            norm_date = normalize_date(raw_date)
            d_start = dm.end()
            d_end = date_matches[j + 1].start() if j + 1 < len(date_matches) else len(block)
            entry_body = block[d_start:d_end].strip()

            # Extract fields
            milestone_m = re.search(r"PD Milestone:\s*(.*)", entry_body)
            progress_m = re.search(r"Teacher Progress:\s*(.*)", entry_body)
            action_m = re.search(r"Teacher Action Since Last:\s*(.*?)(?=Goal Agreed:|$)", entry_body, re.DOTALL)
            goal_m = re.search(r"Goal Agreed:\s*(.*?)(?=Goal Status:|$)", entry_body, re.DOTALL)
            practice_m = re.search(r"Practice Used:\s*(.*?)(?=Next Evidence To Look For:|$)", entry_body, re.DOTALL)
            reflection_m = re.search(r"Coach Reflection:\s*(.*?)(?=Flag for Lead:|$)", entry_body, re.DOTALL)
            flag_m = re.search(r"Flag for Lead:\s*(.*)", entry_body)

            milestone = milestone_m.group(1).strip() if milestone_m else "Dialogic Practice"
            coach_refl = reflection_m.group(1).strip() if reflection_m else ""
            goal = goal_m.group(1).strip() if goal_m else ""
            action = action_m.group(1).strip() if action_m else ""
            practice = practice_m.group(1).strip() if practice_m else ""
            progress = progress_m.group(1).strip() if progress_m else ""
            flag = flag_m.group(1).strip() if flag_m else ""

            content_parts = []
            if progress: content_parts.append(f"Teacher Progress: {progress}")
            if action: content_parts.append(f"Teacher Action: {action.replace(chr(10), ' ')}")
            if goal: content_parts.append(f"Goal Agreed: {goal.replace(chr(10), ' ')}")
            if practice: content_parts.append(f"Practice Used: {practice.replace(chr(10), ' ')}")
            if coach_refl: content_parts.append(f"Coach Reflection: {coach_refl.replace(chr(10), ' ')}")
            if flag and "no flag" not in flag.lower(): content_parts.append(f"Flag: {flag}")

            full_content = " | ".join(content_parts)
            
            raw_block = f"### [{norm_date}] Coach Log: {canonical_name}\n" \
                        f"- Date: {raw_date}\n" \
                        f"- PD Milestone: {milestone}\n" \
                        f"- Teacher Progress: {progress}\n" \
                        f"- Teacher Action: {action}\n" \
                        f"- Goal Agreed: {goal}\n" \
                        f"- Practice Used: {practice}\n" \
                        f"- Coach Reflection: {coach_refl}\n"
            if flag and "no flag" not in flag.lower():
                raw_block += f"- Flag for Lead: {flag}\n"

            entries.append({
                "teacher": canonical_name,
                "date": norm_date,
                "raw_date": raw_date,
                "role": "Coach",
                "source": "Coach Log (T-GROW)",
                "milestone": milestone,
                "content": full_content,
                "coach_reflection": coach_refl,
                "goal": goal,
                "raw_block": raw_block
            })
    return entries


def parse_teacher_reflections(filepath):
    """Parses 'Export Teacher Reflections.txt'."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    teacher_pattern = re.compile(r"^([A-Za-z /]+)\s*\(School:[^)]+\)", re.MULTILINE)
    matches = list(teacher_pattern.finditer(text))

    for i, m in enumerate(matches):
        raw_name = m.group(1).strip()
        canonical_name = None
        for key, val in TEACHER_CANONICAL.items():
            if key in raw_name.lower():
                canonical_name = val
                break
        if not canonical_name:
            canonical_name = raw_name

        start_idx = m.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start_idx:end_idx]

        date_pattern = re.compile(r"^([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", re.MULTILINE)
        date_matches = list(date_pattern.finditer(block))

        for j, dm in enumerate(date_matches):
            raw_date = dm.group(1).strip()
            norm_date = normalize_date(raw_date)
            d_start = dm.end()
            d_end = date_matches[j + 1].start() if j + 1 < len(date_matches) else len(block)
            entry_body = block[d_start:d_end].strip()

            conf_m = re.search(r"Confidence\s*(?:\(1-5\))?:\s*(.*)", entry_body)
            strat_m = re.search(r"Strategies:\s*(.*)", entry_body)
            milestone_m = re.search(r"PD Focus\s*/\s*Level:\s*(.*)", entry_body)
            noticed_m = re.search(r"What Was Noticed:\s*(.*?)(?=Commitment Target:|$)", entry_body, re.DOTALL)
            target_m = re.search(r"Commitment Target:\s*(.*?)(?=Internal Shift Observed:|For Coach:|TeacherID|$)", entry_body, re.DOTALL)
            shift_m = re.search(r"Internal Shift Observed:\s*(.*?)(?=For Coach:|TeacherID|$)", entry_body, re.DOTALL)
            for_coach_m = re.search(r"For Coach:\s*(.*?)(?=Internal Shift Observed:|TeacherID|$)", entry_body, re.DOTALL)

            conf = conf_m.group(1).strip() if conf_m else ""
            strat = strat_m.group(1).strip() if strat_m else ""
            milestone = milestone_m.group(1).strip() if milestone_m else "Dialogic Practice"
            noticed = noticed_m.group(1).strip() if noticed_m else ""
            target = target_m.group(1).strip() if target_m else ""
            shift = shift_m.group(1).strip() if shift_m else ""
            for_coach = for_coach_m.group(1).strip() if for_coach_m else ""

            # Extract any verbatim quote highlights
            quotes = []
            if shift: quotes.append(f'"{shift}"')
            if for_coach: quotes.append(f'"{for_coach}"')

            content_parts = []
            if conf and conf != "Blank": content_parts.append(f"Confidence: {conf}/5")
            if strat: content_parts.append(f"Strategies: {strat}")
            if noticed: content_parts.append(f"What Was Noticed: {noticed.replace(chr(10), ' ')}")
            if target: content_parts.append(f"Commitment Target: {target.replace(chr(10), ' ')}")
            if shift: content_parts.append(f"Internal Shift Observed: {shift.replace(chr(10), ' ')}")
            if for_coach: content_parts.append(f"Question for Coach: {for_coach.replace(chr(10), ' ')}")

            full_content = " | ".join(content_parts)

            raw_block = f"### [{norm_date}] Teacher Reflection: {canonical_name}\n" \
                        f"- Date: {raw_date}\n" \
                        f"- Confidence (1-5): {conf}\n" \
                        f"- PD Focus / Level: {milestone}\n" \
                        f"- Strategies: {strat}\n" \
                        f"- What Was Noticed: {noticed}\n" \
                        f"- Commitment Target: {target}\n"
            if shift:
                raw_block += f"- Internal Shift Observed: {shift}\n"
            if for_coach:
                raw_block += f"- Question for Coach: {for_coach}\n"

            entries.append({
                "teacher": canonical_name,
                "date": norm_date,
                "raw_date": raw_date,
                "role": "Teacher",
                "source": "Teacher Reflection",
                "milestone": milestone,
                "content": full_content,
                "shift": shift,
                "noticed": noticed,
                "target": target,
                "quotes": " | ".join(quotes),
                "raw_block": raw_block
            })
    return entries


def parse_materials_export(filepath):
    """Parses 'Materials export by teacher.txt' into distinct dated artifacts."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    teacher_pattern = re.compile(r"^\*\*\*([A-Za-z]+)\*\*\*", re.MULTILINE)
    matches = list(teacher_pattern.finditer(text))

    unique_sections = []
    for i, m in enumerate(matches):
        tname = m.group(1).strip()
        canon = None
        for k, v in TEACHER_CANONICAL.items():
            if k in tname.lower():
                canon = v
                break
        if not canon: canon = tname

        start_idx = m.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start_idx:end_idx].strip()
        if block:
            unique_sections.append((canon, block))

    item_pattern = re.compile(
        r"(?m)^(?:\d+\.\s+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{1,2},?\s+)?\d{4}|\bUndated\b|\bPost-Sep\s+\d{4}\b)|^(?:\d+\.\s+.*?)\(((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{1,2},?\s+)?\d{4}|Undated[^\)]*)\)"
    )

    for canon_name, block in unique_sections:
        item_matches = list(item_pattern.finditer(block))
        if not item_matches:
            entries.append({
                "teacher": canon_name,
                "date": "2026-06-01",
                "raw_date": "Jun 2026",
                "role": "Instructional Artifact / Student Evidence",
                "source": "Materials & Lesson Plans",
                "milestone": "Instructional Material",
                "content": block.strip(),
                "quotes": "",
                "raw_block": f"### [2026-06-01] Artifact Review: {canon_name}\n{block.strip()}\n"
            })
        else:
            for j, im in enumerate(item_matches):
                s_start = im.start()
                s_end = item_matches[j + 1].start() if j + 1 < len(item_matches) else len(block)
                sub = block[s_start:s_end].strip()

                raw_date = im.group(1) or im.group(2) or "Jun 2026"
                if "undated" in raw_date.lower():
                    norm_date = "2026-07-15"
                elif "post-sep" in raw_date.lower():
                    norm_date = "2026-09-15"
                else:
                    norm_date = normalize_date(raw_date)

                q_matches = re.findall(r'>\s*"([^"]+)"|Key Quotation:?\s*"([^"]+)"', sub)
                quotes_list = []
                for qm in q_matches:
                    q = qm[0] or qm[1]
                    if q and q not in quotes_list:
                        quotes_list.append(q)
                quote_str = " | ".join(f'"{q}"' for q in quotes_list)

                entries.append({
                    "teacher": canon_name,
                    "date": norm_date,
                    "raw_date": raw_date,
                    "role": "Instructional Artifact / Student Evidence",
                    "source": "Materials & Lesson Plans",
                    "milestone": "Artifact Review",
                    "content": sub.replace("\n", " "),
                    "quotes": quote_str,
                    "raw_block": f"### [{norm_date}] Artifact Review: {canon_name} ({raw_date})\n{sub}\n"
                })

    return entries


def main():
    os.makedirs(TEACHERS_DIR, exist_ok=True)
    
    file_conv = os.path.join(DATA_DIR, "Coaching Conversations by teacher.txt")
    file_coach = os.path.join(DATA_DIR, "Export Coach Reflection by teacher.txt")
    file_teach = os.path.join(DATA_DIR, "Export Teacher Reflections.txt")
    file_mat = os.path.join(DATA_DIR, "Materials export by teacher.txt")

    print(f"Parsing raw files in {DATA_DIR}...")
    conv_entries = parse_coaching_conversations(file_conv)
    coach_entries = parse_coach_reflections(file_coach)
    teach_entries = parse_teacher_reflections(file_teach)
    mat_entries = parse_materials_export(file_mat)

    all_entries = conv_entries + coach_entries + teach_entries + mat_entries
    print(f"Total entries parsed: {len(all_entries)}")
    print(f"  - Coaching Conversations: {len(conv_entries)}")
    print(f"  - Coach Logs: {len(coach_entries)}")
    print(f"  - Teacher Reflections: {len(teach_entries)}")
    print(f"  - Materials & Artifacts: {len(mat_entries)}")

    teachers = ["Habib", "Healery", "Anis", "Carolyne", "Anthony", "Joshua"]
    teacher_entries = {t: [] for t in teachers}
    for e in all_entries:
        t = e.get("teacher")
        if t in teacher_entries:
            teacher_entries[t].append(e)

    # 1. Output individual Teacher Dossiers
    for t in teachers:
        t_list = sorted(teacher_entries[t], key=lambda x: x["date"])
        dossier_path = os.path.join(TEACHERS_DIR, f"{t}_dossier.txt")
        meta = TEACHER_METADATA.get(t, {})
        with open(dossier_path, "w", encoding="utf-8") as f:
            f.write(f"# Longitudinal Pedagogical Dossier: Teacher {t}\n")
            f.write(f"**School:** {meta.get('school', 'N/A')} | **Coach:** {meta.get('coach', 'N/A')} | **Subject:** {meta.get('subject', 'N/A')}\n\n")
            f.write("## Overview\n")
            f.write(f"Chronological compilation of coaching logs, teacher self-reflections, session minutes, and instructional artifacts ({len(t_list)} records).\n\n")
            f.write("---\n\n")
            for item in t_list:
                f.write(item["raw_block"].strip() + "\n\n---\n\n")
        print(f"Generated {dossier_path} ({len(t_list)} entries)")

    # 2. Output Cross-Teacher Thematic Aggregate Files
    teach_sorted = sorted(teach_entries, key=lambda x: (x["date"], x["teacher"]))
    teach_agg_path = os.path.join(OUT_DIR, "All_Teacher_Reflections_Dated.txt")
    with open(teach_agg_path, "w", encoding="utf-8") as f:
        f.write("# Cross-Teacher Reflections (Teacher Voice)\n")
        f.write(f"Total reflection entries: {len(teach_sorted)}\n\n---\n\n")
        for item in teach_sorted:
            f.write(item["raw_block"].strip() + "\n\n---\n\n")
    print(f"Generated {teach_agg_path}")

    coach_sorted = sorted(coach_entries, key=lambda x: (x["date"], x["teacher"]))
    coach_agg_path = os.path.join(OUT_DIR, "All_Coach_Reflections_Dated.txt")
    with open(coach_agg_path, "w", encoding="utf-8") as f:
        f.write("# Cross-Teacher Coach Reflections (Coach Voice)\n")
        f.write(f"Total coach log entries: {len(coach_sorted)}\n\n---\n\n")
        for item in coach_sorted:
            f.write(item["raw_block"].strip() + "\n\n---\n\n")
    print(f"Generated {coach_agg_path}")

    conv_sorted = sorted(conv_entries, key=lambda x: (x["date"], x["teacher"]))
    conv_agg_path = os.path.join(OUT_DIR, "All_Coaching_Interactions_Dated.txt")
    with open(conv_agg_path, "w", encoding="utf-8") as f:
        f.write("# Coaching Session Dialogue Minutes (Interaction Voice)\n")
        f.write(f"Total session logs: {len(conv_sorted)}\n\n---\n\n")
        for item in conv_sorted:
            f.write(item["raw_block"].strip() + "\n\n---\n\n")
    print(f"Generated {conv_agg_path}")

    mat_sorted = sorted(mat_entries, key=lambda x: (x["date"], x["teacher"]))
    mat_agg_path = os.path.join(OUT_DIR, "All_Instructional_Materials_Dated.txt")
    with open(mat_agg_path, "w", encoding="utf-8") as f:
        f.write("# Instructional Artifacts & Classroom Submissions (Materials Voice)\n")
        f.write(f"Total artifact reviews: {len(mat_sorted)}\n\n---\n\n")
        for item in mat_sorted:
            f.write(item["raw_block"].strip() + "\n\n---\n\n")
    print(f"Generated {mat_agg_path}")

    complete_sorted = sorted(all_entries, key=lambda x: (x["date"], x["teacher"]))
    comp_path = os.path.join(OUT_DIR, "Complete_Coaching_Corpus_Dated.txt")
    with open(comp_path, "w", encoding="utf-8") as f:
        f.write("# Complete Triangulated Sarawak Instructional Coaching Corpus\n")
        f.write(f"Chronological records across 6 teachers and 3 coaches ({len(complete_sorted)} records).\n\n---\n\n")
        for item in complete_sorted:
            f.write(item["raw_block"].strip() + "\n\n---\n\n")
    print(f"Generated {comp_path}")

    # 3. Output Structured CSV for Tabular Analysis & Workspace
    csv_path = os.path.join(OUT_DIR, "sarawak_coaching_corpus.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "teacher", "school", "coach", "date", "role", "source", "milestone", "content", "key_quote"])
        for idx, item in enumerate(complete_sorted, start=1):
            t = item["teacher"]
            meta = TEACHER_METADATA.get(t, {})
            quote = item.get("shift") or item.get("quotes") or item.get("coach_reflection") or ""
            quote_clean = quote.replace("\n", " ").strip()
            writer.writerow([
                f"REC-{idx:03d}",
                t,
                meta.get("school", "N/A"),
                meta.get("coach", "N/A"),
                item["date"],
                item["role"],
                item["source"],
                item["milestone"],
                item["content"],
                quote_clean
            ])
    print(f"Generated {csv_path} ({len(complete_sorted)} rows)")
    print("\nData preparation complete!")

if __name__ == "__main__":
    main()
