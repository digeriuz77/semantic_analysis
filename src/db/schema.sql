-- Corpus store schema: a DNA-inspired (Discourse Network Analyzer) statement model.
--
-- The atom is a STATEMENT: an evidence span attributed to an actor, expressing a
-- stance on a concept, at a point in time, optionally in a location. This is what
-- makes temporal windows, entity comparison, and network analysis possible — a
-- theme is a summary; a statement is traceable, attributable, dated evidence.

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fileName    TEXT NOT NULL,
  sourceType  TEXT,                 -- interview | survey | reflection | transcript | ...
  title       TEXT,
  content     TEXT NOT NULL,        -- raw source text
  cleanedText TEXT,                 -- NLTK-preprocessed text
  createdAt   TEXT NOT NULL,        -- ISO timestamp of ingestion
  docDate     TEXT,                 -- date the document pertains to (ISO or YYYY-MM), nullable
  metadata    TEXT DEFAULT '{}'     -- JSON blob (speaker, session, etc.)
);

CREATE TABLE IF NOT EXISTS actors (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  type      TEXT DEFAULT 'person',  -- person | organization | location
  metadata  TEXT DEFAULT '{}',
  createdAt TEXT NOT NULL,
  UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS concepts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  frameworkId TEXT,                 -- analytical framework that seeded this code
  color       TEXT DEFAULT '#0d9488',
  createdAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  documentId INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,         -- the evidence span
  startOffset INTEGER,
  endOffset   INTEGER,
  actorId    INTEGER REFERENCES actors(id) ON DELETE SET NULL,
  conceptId  INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
  stance     TEXT DEFAULT 'undefined',  -- agree | disagree | neutral | undefined
  stmtDate   TEXT,                  -- when the statement pertains to (ISO/partial)
  location   TEXT,                  -- where (free text)
  notes      TEXT,                  -- researcher note
  source     TEXT DEFAULT 'manual', -- manual | ensemble | imported
  codeRunId  INTEGER,               -- references code_runs (loose; not FK to avoid cycles)
  createdAt  TEXT NOT NULL,
  updatedAt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS code_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  documentId INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  frameworkId TEXT,
  config     TEXT DEFAULT '{}',     -- JSON: seeds, temp, provider, paradigm...
  result     TEXT DEFAULT '{}',     -- JSON: full EnsembleResult snapshot
  status     TEXT DEFAULT 'manual',-- manual | ensemble | imported
  createdAt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statement_annotations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  statementId INTEGER NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,        -- accepted | rejected | flagged
  note        TEXT,
  updatedAt   TEXT NOT NULL,
  UNIQUE(statementId)
);

-- Indexes for the filter-by queries the iterative workflow needs.
CREATE INDEX IF NOT EXISTS idx_stmt_actor  ON statements(actorId);
CREATE INDEX IF NOT EXISTS idx_stmt_concept ON statements(conceptId);
CREATE INDEX IF NOT EXISTS idx_stmt_date   ON statements(stmtDate);
CREATE INDEX IF NOT EXISTS idx_stmt_doc    ON statements(documentId);
CREATE INDEX IF NOT EXISTS idx_doc_date    ON documents(docDate);
CREATE INDEX IF NOT EXISTS idx_actors_type ON actors(type);

-- Phase 6: Embedding store. Vectors stored as JSON arrays (cosine computed in JS).
CREATE TABLE IF NOT EXISTS embeddings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entityType  TEXT NOT NULL,          -- 'statement' | 'document'
  entityId    INTEGER NOT NULL,
  provider    TEXT NOT NULL,          -- 'google'
  model       TEXT NOT NULL,          -- 'text-embedding-004'
  dim         INTEGER NOT NULL,
  vector      TEXT NOT NULL,          -- JSON array of floats
  createdAt   TEXT NOT NULL,
  UNIQUE(entityType, entityId, model)
);
CREATE INDEX IF NOT EXISTS idx_embed_entity ON embeddings(entityType, entityId);
