// import path from "path";
// import { open, Database } from "sqlite";
// import sqlite3 from "sqlite3";

// // Module-level cache so we reuse the same connection
// // across hot-reloads in dev (Next.js caches modules in dev mode)
// let db: Database | null = null;

// export async function getDb(): Promise<Database> {
//   if (db) return db;

//   db = await open({
//     // Resolves to <project-root>/database.sqlite
//     filename: path.join(process.cwd(), "database.sqlite"),
//     driver: sqlite3.Database,
//   });

//   // Enable foreign-key enforcement (SQLite disables it by default)
//   await db.run("PRAGMA foreign_keys = ON");

//   return db;
// }


//new code for render--------------------------------------------------
import path from "path";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

let db: Database | null = null;

// In production (Render), SQLite lives on the persistent disk at /data
// In development, it lives at the project root
const getDbPath = () =>
  process.env.NODE_ENV === "production"
    ? "/tmp/database.sqlite"   // ← use /tmp on free tier "/data/database.sqlite"
    : path.join(process.cwd(), "database.sqlite");

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: getDbPath(),
    driver: sqlite3.Database,
  });

  await db.run("PRAGMA foreign_keys = ON");

  return db;
}