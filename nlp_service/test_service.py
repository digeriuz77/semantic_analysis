"""Full-service smoke test: boots the FastAPI app via TestClient and
exercises /health, /process (txt), /reliability, /embed, /evidence."""
import sys, io, time

sys.path.insert(0, "nlp_service")

t0 = time.time()
import main  # noqa: E402  (imports trigger NLTK downloads on first run)

print(f"import main OK ({time.time()-t0:.1f}s) — B1 fixed, service boots")

from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)
PASS = FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


# -- /health ---------------------------------------------------------------
r = client.get("/health")
check("GET /health 200", r.status_code == 200, r.text)
check("health reports hashed-lexical backend",
      r.json().get("embedding_backend") == "hashed-lexical", r.text)

# -- /process (txt) --------------------------------------------------------
doc = (
    "Dr. Chen said: \"The rollout failed because nurses were never consulted. "
    "Trust takes years to build and one memo to destroy.\" "
    "Later she added that staffing shortages drove the crisis; several "
    "participants echoed concerns about workload, training, and trust in management. "
) * 3
r = client.post(
    "/process",
    files={"file": ("interview.txt", io.BytesIO(doc.encode()), "text/plain")},
)
check("POST /process(txt) 200", r.status_code == 200, r.text[:300])
body = r.json()
check("process returns extracted_text with punctuation",
      isinstance(body.get("extracted_text"), str) and '"' in body["extracted_text"])
check("process returns cleaned_text + stats + keywords",
      bool(body.get("cleaned_text")) and "totalWords" in body.get("stats", {})
      and len(body.get("top_keywords", [])) > 0)

# -- /process rejects bad magic bytes ---------------------------------------
r = client.post(
    "/process",
    files={"file": ("fake.pdf", io.BytesIO(b"not a pdf at all"), "application/pdf")},
)
check("POST /process(fake.pdf) 400 magic-byte rejection", r.status_code == 400)

r = client.post(
    "/process",
    files={"file": ("evil.txt", io.BytesIO(b"x" * (11 * 1024 * 1024)), "text/plain")},
)
check("POST /process(11MB) 413 size cap", r.status_code == 413)

# -- /reliability -----------------------------------------------------------
runs = [
    {"seed": 1, "themes": [
        {"name": "Trust in leadership", "description": "Trust in leadership salient pattern", "keywords": ["trust"]},
        {"name": "Staffing workload", "description": "Staffing workload salient pattern", "keywords": ["workload"]},
    ]},
    {"seed": 2, "themes": [
        {"name": "Trust in leadership", "description": "Trust in leadership salient pattern", "keywords": ["trust"]},
        {"name": "Staffing workload", "description": "Staffing workload salient pattern", "keywords": ["workload"]},
        {"name": "Training gaps", "description": "Training gaps salient pattern", "keywords": ["training"]},
    ]},
    {"seed": 3, "themes": [
        {"name": "Trust in leadership", "description": "Trust in leadership salient pattern", "keywords": ["trust"]},
    ]},
]
r = client.post("/reliability", json={"runs": runs, "cosine_threshold": 0.7, "min_occurrence_ratio": 0.5})
check("POST /reliability 200", r.status_code == 200, r.text[:300])
rel = r.json()
check("alpha reported", rel.get("alpha", {}).get("value") is not None, str(rel.get("alpha")))
check("kappa reported with ci95 field",
      rel.get("kappa") is not None and "ci95" in rel["kappa"], str(rel.get("kappa")))
check("consensus excludes 1-of-3 theme (Training gaps)",
      all(t["label"] != "Training gaps" for t in rel["consensus"]["themes"]),
      str([t["label"] for t in rel["consensus"]["themes"]]))
check("saturation curve present", len(rel.get("saturation", [])) == 3)

r = client.post("/reliability", json={"runs": "not-a-list"})
check("POST /reliability invalid payload 400", r.status_code == 400)

r = client.post("/reliability", json={"runs": [{"themes": [{"name": f"T{i}"}]} for i in range(30)]})
check("POST /reliability run-count cap 400", r.status_code == 400)

# -- /evidence (B2 + punctuation fix) ----------------------------------------
r = client.post("/evidence", json={
    "text": doc,
    "themes": [{"name": "Trust", "description": "Trust in leadership and management."}],
    "top_k": 3,
})
check("POST /evidence 200", r.status_code == 200, r.text[:300])
ev = r.json().get("evidence", [])
check("evidence returns real sentence spans (B2 fixed)",
      len(ev) == 1 and len(ev[0]) >= 1 and "trust" in ev[0][0]["text"].lower(),
      str(ev)[:200])

# -- /embed ------------------------------------------------------------------
r = client.post("/embed", json={"texts": ["hello world", "another text"]})
check("POST /embed 200 with normalized vectors",
      r.status_code == 200 and len(r.json()["vectors"]) == 2)

print()
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
