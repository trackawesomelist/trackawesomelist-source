import { getSqlitePath } from "./util.ts";
import { DB } from "./deps.ts";
export default function initDb(db: DB) {
  db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      sha1 TEXT NOT NULL,
      markdown TEXT NOT NULL,
      category TEXT ,
      updated_at INT NOT NULL,
      updated_day INT NOT NULL,
      updated_week INT NOT NULL,
      file TEXT NOT NULL,
      source_identifier TEXT NOT NULL,
      source_category TEXT NOT NULL,
      checked_at INT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_item
    ON items (sha1, file, source_identifier);
    CREATE INDEX IF NOT EXISTS idx_items_file
    ON items (source_identifier, file);
    CREATE INDEX IF NOT EXISTS idx_items_days
    ON items (updated_day);
    CREATE INDEX IF NOT EXISTS idx_items_weeks
    ON items (updated_week);
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      sha1 TEXT NOT NULL,
      markdown TEXT NOT NULL,
      file TEXT NOT NULL,
      updated_at INT NOT NULL,
      source_identifier TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_file
    ON files (file, source_identifier);
  `);
}

if (import.meta.main) {
  const db = new DB(getSqlitePath());
  initDb(db);
  db.close();
}
