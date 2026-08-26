/**
 * Corpus store schema: a DNA-inspired (Discourse Network Analyzer) statement
 * model, plus the COREQ checklist store.
 *
 * The atom is a STATEMENT: an evidence span attributed to an actor, expressing
 * a stance on a concept, at a point in time, optionally in a location. This is
 * what makes temporal windows, entity comparison, and network analysis
 * possible — a theme is a summary; a statement is traceable, attributable,
 * dated evidence.
 *
 * Bundled as a TS string (not read from disk) so the schema is guaranteed to
 * travel with the build regardless of the output layout.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fileName    TEXT NOT NULL,
  sourceType  TEXT,
  title       TEXT,
  content     TEXT NOT NULL,
  cleanedText TEXT,
  createdAt   TEXT NOT NULL,
  docDate     TEXT,
  metadata    TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS actors (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  type      TEXT DEFAULT 'person',
  metadata  TEXT DEFAULT '{}',
  createdAt TEXT NOT NULL,
  UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS concepts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  frameworkId TEXT,
  color       TEXT DEFAULT '#0d9488',
  createdAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  documentId INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  startOffset INTEGER,
  endOffset   INTEGER,
  actorId    INTEGER REFERENCES actors(id) ON DELETE SET NULL,
  conceptId  INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
  stance     TEXT DEFAULT 'undefined',
  stmtDate   TEXT,
  location   TEXT,
  notes      TEXT,
  source     TEXT DEFAULT 'manual',
  codeRunId  INTEGER,
  createdAt  TEXT NOT NULL,
  updatedAt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS code_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  documentId INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  frameworkId TEXT,
  config     TEXT DEFAULT '{}',
  result     TEXT DEFAULT '{}',
  status     TEXT DEFAULT 'manual',
  createdAt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statement_annotations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  statementId INTEGER NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  updatedAt   TEXT NOT NULL,
  UNIQUE(statementId)
);

CREATE INDEX IF NOT EXISTS idx_stmt_actor  ON statements(actorId);
CREATE INDEX IF NOT EXISTS idx_stmt_concept ON statements(conceptId);
CREATE INDEX IF NOT EXISTS idx_stmt_date   ON statements(stmtDate);
CREATE INDEX IF NOT EXISTS idx_stmt_doc    ON statements(documentId);
CREATE INDEX IF NOT EXISTS idx_doc_date    ON documents(docDate);
CREATE INDEX IF NOT EXISTS idx_actors_type ON actors(type);

CREATE TABLE IF NOT EXISTS embeddings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entityType  TEXT NOT NULL,
  entityId    INTEGER NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  dim         INTEGER NOT NULL,
  vector      TEXT NOT NULL,
  createdAt   TEXT NOT NULL,
  UNIQUE(entityType, entityId, model)
);
CREATE INDEX IF NOT EXISTS idx_embed_entity ON embeddings(entityType, entityId);

-- COREQ 32-item reporting checklist, persisted per study so the reporting
-- audit trail survives browser-data resets (localStorage is only a cache).
CREATE TABLE IF NOT EXISTS coreq_responses (
  studyKey  TEXT NOT NULL,
  itemId    INTEGER NOT NULL,
  checked   INTEGER NOT NULL DEFAULT 0,
  detail    TEXT DEFAULT '',
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (studyKey, itemId)
);
`;
