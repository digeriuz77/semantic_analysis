import csv

with open(".kilocode/data/processed/sarawak_coaching_corpus.csv", "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    print("Entries from June to November 2026:")
    for r in reader:
        if r["date"] >= "2026-06":
            q = r["key_quote"] if r["key_quote"] else r["content"][:100]
            print(f"- [{r['date']}] {r['teacher']} | {r['role']} | Quote/Content: {q[:120]}")
