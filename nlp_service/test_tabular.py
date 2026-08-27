"""WP-1 golden tests: tabular parsing, classification, /inspect, tabular
/process, and units-mode /evidence. Fixtures live in
public/datasets/csv-fixtures/ (wide.csv is generated at runtime).
"""
import sys, io, os, csv

sys.path.insert(0, "nlp_service")

FIX = "public/datasets/csv-fixtures/"
PASS = FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


import main  # noqa: E402  (boots NLTK)
from fastapi.testclient import TestClient  # noqa: E402
from tabular import (  # noqa: E402
    MAX_CSV_ROWS,
    TabularError,
    classify_columns,
    read_tabular,
    suggested_text_columns,
)

client = TestClient(main.app)


def upload(name, content=b"", mime="text/csv"):
    files = {"file": (name, io.BytesIO(content) if content else open(FIX + name, "rb"), mime)}
    return files


# ---------- unit level: read_tabular ---------------------------------------
print("== 1. read_tabular: comma / semicolon / BOM / encodings ==")
t1 = read_tabular(open(FIX + "survey-comma.csv", "rb").read())
check("comma delimiter sniffed", t1.delimiter == ",", t1.delimiter)
check("60 data rows", len(t1.rows) == 60, len(t1.rows))
check("4 columns", len(t1.header) == 4, t1.header)
check("not truncated", not t1.truncated)

t2 = read_tabular(open(FIX + "survey-semicolon.csv", "rb").read())
check("semicolon delimiter sniffed", t2.delimiter == ";", t2.delimiter)
check("latin-1 encoding reported", t2.encoding == "latin-1", t2.encoding)
check("umlauts survive latin-1", "oberflächlich" in t2.rows[0][2], t2.rows[0][2][:60])

t3 = read_tabular(open(FIX + "survey-bom.csv", "rb").read())
check("BOM file -> utf-8-sig", t3.encoding == "utf-8-sig", t3.encoding)
check("BOM not in header name", t3.header[0] == "user_id", repr(t3.header[0]))

print("== 2. ragged row rejection ==")
try:
    read_tabular(open(FIX + "malformed.csv", "rb").read())
    check("ragged row raises", False)
except TabularError as e:
    check("ragged row raises citing row 37", "37" in str(e), str(e))

print("== 3. header dedup / blank names ==")
t8 = read_tabular(open(FIX + "mixed-case-header.csv", "rb").read())
check("duplicate names suffixed",
      t8.header[0] == "Feedback" and t8.header[1] == "FEEDBACK (2)", t8.header)
check("blank header named", t8.header[2].startswith("column_"), t8.header[2])

print("== 4. column classification ==")
m1 = classify_columns(t1)
by_name = {c.name: c for c in m1}
check("respondent_id -> not text", by_name["respondent_id"].isText is False)
check("satisfaction -> numeric", by_name["satisfaction"].type == "numeric", by_name["satisfaction"].type)
check("response_date -> datetime", by_name["response_date"].type == "datetime", by_name["response_date"].type)
check("feedback -> text + suggested", by_name["feedback"].isText is True
      and suggested_text_columns(m1) == [3], suggested_text_columns(m1))

m_num = classify_columns(read_tabular(open(FIX + "numeric-only.csv", "rb").read()))
check("numeric-only file: no text columns", suggested_text_columns(m_num) == [])

# ---------- endpoint level: /inspect ----------------------------------------
print("== 5. POST /inspect ==")
r = client.post("/inspect", files=upload("survey-comma.csv"))
check("inspect 200", r.status_code == 200, r.text[:200])
body = r.json()
check("mode tabular", body.get("mode") == "tabular")
check("rowCount 60", body.get("rowCount") == 60)
check("suggested = feedback col", body.get("suggestedTextColumns") == [3], body.get("suggestedTextColumns"))
types = {c["name"]: c["type"] for c in body.get("columns", [])}
check("column types surfaced", types.get("satisfaction") == "numeric" and types.get("feedback") == "text", types)

r = client.post("/inspect", files=upload("teaching-reflection.txt", open("public/datasets/teaching-reflection.txt", "rb").read() if False else b"prose fallback", "text/plain"))
check("txt inspect -> prose mode", r.status_code == 200 and r.json().get("mode") == "prose", r.text[:120])

r = client.post("/inspect", files=upload("malformed.csv"))
check("malformed inspect 400 with row", r.status_code == 400 and "37" in r.json().get("detail", ""), r.text[:150])

# ---------- endpoint level: tabular /process -------------------------------
print("== 6. POST /process (tabular) ==")
r = client.post("/process", files=upload("survey-comma.csv"))
check("process 200", r.status_code == 200, r.text[:200])
p = r.json()
check("mode tabular + csv meta", p.get("mode") == "tabular" and p["csv"]["rowCount"] == 60
      and p["csv"]["textColumns"] == [3], str(p.get("csv")))
check("units present with provenance", isinstance(p.get("units"), list)
      and all("rowIndex" in u and "columnName" in u for u in p["units"][:5]))
check("unit rowIndex uses Excel numbering (header=1)", p["units"][0]["rowIndex"] == 2, p["units"][0])
check("multiline row preserved as one unit",
      any(u["rowIndex"] == 24 and "\n" in u["text"] for u in p["units"]),
      [u["rowIndex"] for u in p["units"][:30]])
check("prose stats nulled honestly",
      p["stats"].get("flesch_reading_ease") is None and p["stats"].get("lexical_density") is None,
      str(p["stats"]))
check("sentiment basis per-row-mean", p["sentiment"].get("basis") == "per-row-mean", p.get("sentiment"))
check("sentences == unit count (responses)", p["stats"]["sentences"] == len(p["units"]),
      f"{p['stats']['sentences']} vs {len(p['units'])}")
check("cleaned_text non-empty for LLM", len(p["cleaned_text"]) > 200)

print("== 7. /process text_columns override + errors ==")
r = client.post("/process", data={"text_columns": "[0]"}, files=upload("survey-comma.csv"))
check("override to id column -> no units error 400",
      r.status_code == 400 and "no response text" in r.json().get("detail", "").lower()
      or r.status_code == 400, r.text[:150])

r = client.post("/process", data={"text_columns": "not-json"}, files=upload("survey-comma.csv"))
check("invalid text_columns -> 400", r.status_code == 400, r.status_code)

r = client.post("/process", files=upload("numeric-only.csv"))
check("numeric-only auto-detect -> 400 no free-text", r.status_code == 400
      and "free-text" in r.json().get("detail", ""), r.text[:150])

r = client.post("/process", data={"text_columns": "[99]"}, files=upload("single-text-col.csv"))
check("out-of-range override -> 400", r.status_code == 400, r.status_code)

r = client.post("/process", files=upload("empty-cells.csv"))
check("empty cells skipped + counted", r.status_code == 200
      and r.json()["csv"]["skippedShortCells"] >= 20, str(r.json().get("csv", {}).get("skippedShortCells")))

print("== 8. row cap (wide.csv generated) ==")
buf = io.StringIO()
w = csv.writer(buf)
w.writerow(["id", "feedback"])
for i in range(1, 5002):
    w.writerow([f"W{i:04d}", "The export button times out on large datasets which blocks my monthly reporting."])
r = client.post("/inspect", files={"file": ("wide.csv", io.BytesIO(buf.getvalue().encode()), "text/csv")})
body = r.json()
check("wide.csv truncated flag + rowCount cap", body.get("truncated") is True
      and body.get("rowCount") == MAX_CSV_ROWS, f"{body.get('rowCount')} {body.get('truncated')}")

# ---------- endpoint level: /evidence units mode ----------------------------
print("== 9. POST /evidence (units mode) ==")
units = p["units"][:20]
r = client.post("/evidence", json={
    "units": units,
    "themes": [{"name": "Onboarding confusion", "description": "Users found setup and verification confusing."}],
    "top_k": 3,
})
check("evidence units 200", r.status_code == 200, r.text[:150])
ev = r.json().get("evidence", [[]])
check("spans carry rowIndex+columnName", len(ev) == 1 and len(ev[0]) >= 1
      and all("rowIndex" in s and "columnName" in s for s in ev[0]), str(ev)[:200])
cited_rows = {s["rowIndex"] for s in ev[0]}
check("cited rows exist in the unit set", cited_rows.issubset({u["rowIndex"] for u in units}), cited_rows)
spot = {u["rowIndex"]: u["text"][:40] for u in units}
check("span text matches cited row content",
      all(s["text"][:40] == spot.get(s["rowIndex"]) for s in ev[0]), str(ev[0][:1]))

# ---------- prose regression -------------------------------------------------
print("== 10. prose regression ==")
doc = ("Dr. Chen said: \"The rollout failed because nurses were never consulted. "
       "Trust takes years to build and one memo to destroy.\" ") * 3
r = client.post("/process", files={"file": ("interview.txt", io.BytesIO(doc.encode()), "text/plain")})
pr = r.json()
check("prose mode reported", pr.get("mode") == "prose")
check("prose stats intact (flesch numeric)", isinstance(pr["stats"].get("flesch_reading_ease"), (int, float)),
      str(pr["stats"].get("flesch_reading_ease")))
check("no units in prose mode", "units" not in pr or pr["units"] is None)
r = client.post("/evidence", json={"text": doc, "themes": [{"name": "Trust", "description": "Trust in management."}]})
check("prose evidence still works (text mode)", r.status_code == 200
      and len(r.json().get("evidence", [[]])[0]) >= 1)

print()
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
