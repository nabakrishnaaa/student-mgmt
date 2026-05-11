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
// import path from "path";
// import { open, Database } from "sqlite";
// import sqlite3 from "sqlite3";

// let db: Database | null = null;

// // In production (Render), SQLite lives on the persistent disk at /data
// // In development, it lives at the project root
// const getDbPath = () =>
//   process.env.NODE_ENV === "production"
//     ? "/tmp/database.sqlite"   // ← use /tmp on free tier "/data/database.sqlite"
//     : path.join(process.cwd(), "database.sqlite");

// export async function getDb(): Promise<Database> {
//   if (db) return db;

//   db = await open({
//     filename: getDbPath(),
//     driver: sqlite3.Database,
//   });

//   await db.run("PRAGMA foreign_keys = ON");

//   return db;
// }



//new code render ------------------------------------------------------------
//---------------------------------------------------------------------------
import path from "path";
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";

let db: Database | null = null;

const getDbPath = () =>
  process.env.NODE_ENV === "production"
    ? "/tmp/database.sqlite"
    : path.join(process.cwd(), "database.sqlite");

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: getDbPath(),
    driver: sqlite3.Database,
  });

  await db.run("PRAGMA foreign_keys = ON");

  // Auto-initialize tables and seed on first run
  await initializeDb(db);

  return db;
}

async function initializeDb(db: Database) {
  // Create tables
  await db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_no          TEXT    NOT NULL UNIQUE,
      name            TEXT    NOT NULL,
      class           TEXT    NOT NULL,
      section         TEXT    NOT NULL,
      address         TEXT,
      dob             TEXT,
      phone           TEXT,
      email           TEXT,
      created_at      TEXT    DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT    NOT NULL UNIQUE,
      password_hash   TEXT    NOT NULL,
      role            TEXT    NOT NULL CHECK(role IN ('student','admin')),
      student_id      INTEGER REFERENCES students(id) ON DELETE SET NULL,
      created_at      TEXT    DEFAULT (datetime('now'))
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS grades (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject         TEXT    NOT NULL,
      marks           REAL    NOT NULL CHECK(marks >= 0 AND marks <= 100),
      grade           TEXT    NOT NULL,
      exam_type       TEXT    DEFAULT 'Final',
      created_at      TEXT    DEFAULT (datetime('now')),
      UNIQUE(student_id, subject, exam_type)
    )
  `);

  // Seed only if admin doesn't exist yet
  const existing = await db.get("SELECT id FROM users WHERE username = 'admin'");
  if (existing) return;

  // Seed sample students
  await db.run(`
    INSERT INTO students (reg_no, name, class, section, address, dob, phone, email)
    VALUES ('2024-CS-001', 'Ananya Sharma', '12', 'A',
            '42 MG Road, Guwahati, Assam', '2006-04-15', '9876543210', 'ananya@example.com')
  `);
  await db.run(`
    INSERT INTO students (reg_no, name, class, section, address, dob, phone, email)
    VALUES ('2024-CS-002', 'Rohan Das', '12', 'B',
            '7 Zoo Road, Guwahati, Assam', '2006-08-22', '9123456780', 'rohan@example.com')
  `);

  // Seed admin account
  const adminHash = await bcrypt.hash("admin123", 10);
  await db.run(`
    INSERT INTO users (username, password_hash, role, student_id)
    VALUES ('admin', ?, 'admin', NULL)
  `, [adminHash]);

  // Seed grades
  const ananya = await db.get("SELECT id FROM students WHERE reg_no = '2024-CS-001'");
  const rohan  = await db.get("SELECT id FROM students WHERE reg_no = '2024-CS-002'");

  const ananyaGrades = [
    { subject: "Mathematics",  marks: 92, grade: "A+" },
    { subject: "Physics",      marks: 85, grade: "A"  },
    { subject: "Chemistry",    marks: 78, grade: "B+" },
    { subject: "English",      marks: 88, grade: "A"  },
    { subject: "Computer Sci", marks: 95, grade: "A+" },
  ];
  for (const g of ananyaGrades) {
    await db.run(
      "INSERT INTO grades (student_id, subject, marks, grade) VALUES (?, ?, ?, ?)",
      [ananya.id, g.subject, g.marks, g.grade]
    );
  }

  const rohanGrades = [
    { subject: "Mathematics",  marks: 74, grade: "B"  },
    { subject: "Physics",      marks: 68, grade: "B-" },
    { subject: "Chemistry",    marks: 81, grade: "A-" },
    { subject: "English",      marks: 79, grade: "B+" },
    { subject: "Computer Sci", marks: 88, grade: "A"  },
  ];
  for (const g of rohanGrades) {
    await db.run(
      "INSERT INTO grades (student_id, subject, marks, grade) VALUES (?, ?, ?, ?)",
      [rohan.id, g.subject, g.marks, g.grade]
    );
  }

  console.log("✅ Database initialized and seeded successfully!");
}