import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA_SQL } from "./schema";

/**
 * Runtime-adaptive SQLite. We can't ship a native module (network install is
 * unavailable), so we use whichever SQLite builtin the current runtime provides:
 *   - bun  → bun:sqlite   (Database)
 *   - node → node:sqlite  (DatabaseSync, Node 22+)
 *
 * createRequire + a constructed specifier defeats the bundler's static module
 * resolution, so neither runtime's builtin is attempted at build time. Both APIs
 * are synchronous, which is appropriate for a local single-user research tool.
 */

export const DB_PATH =
  process.env.CORPUS_DB_PATH || join(process.cwd(), "data", "corpus.db");

/** A normalized statement interface over both runtimes. */
export interface DbStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
}

export interface DbClient {
  exec(sql: string): void;
  prepare(sql: string): DbStatement;
  close(): void;
}

function safeRequire(moduleName: string): unknown {
  // eval("require") bypasses bundler static analysis (Turbopack/Webpack)
  // allowing native runtime resolution of built-in modules at runtime.
  const req = eval("require");
  return req(moduleName);
}

function openRaw(path: string): DbClient {
  // Try bun first if running under Bun runtime.
  const isBun = typeof (process as unknown as { versions?: { bun?: string } }).versions?.bun === "string";
  if (isBun) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Database } = safeRequire("bun:sqlite") as any;
      const db = new Database(path);
      return {
        exec: (sql: string) => db.exec(sql),
        prepare: (sql: string) => {
          const stmt = db.prepare(sql);
          return {
            get: (...p) => stmt.get(...p),
            all: (...p) => stmt.all(...p),
            run: (...p) => {
              const r = stmt.run(...p);
              return {
                lastInsertRowid: Number(r.lastInsertRowid),
                changes: Number(r.changes),
              };
            },
          };
        },
        close: () => db.close(),
      };
    } catch {
      // Fall through to node:sqlite
    }
  }

  // Fall back to Node's built-in sqlite.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { DatabaseSync } = safeRequire("node:sqlite") as any;
  const db = new DatabaseSync(path);
  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => db.prepare(sql),
    close: () => db.close(),
  };
}

let _db: DbClient | null = null;

/**
 * Open (and lazily migrate) the local SQLite corpus store at data/corpus.db.
 * The file travels with the project so iterative research persists across
 * sessions. Schema is idempotent (all CREATE ... IF NOT EXISTS).
 */
export function getDb(): DbClient {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = openRaw(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // Schema is bundled (src/db/schema.ts) so it works in any build layout.
  db.exec(SCHEMA_SQL);
  _db = db;
  return db;
}

export function _resetDb(): void {
  _db = null;
}
