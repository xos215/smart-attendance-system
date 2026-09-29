// DATA LAYER: SQLite tables + sample data
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_PATH || 'attendance.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('teacher','student')),
  ukey TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attendance(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('P','A')),
  marked_by INTEGER REFERENCES users(id),
  UNIQUE(student_id, subject, date));
`);

// Seed demo data once (REMOVE for production)
if (process.env.SEED_DEMO !== 'false' && !db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const add = db.prepare('INSERT INTO users(name,role,ukey,pass_hash) VALUES(?,?,?,?)');
  const tp = bcrypt.hashSync('Teacher@123', 10), sp = bcrypt.hashSync('Student@123', 10);
  const t = add.run('Demo Teacher', 'teacher', 'TCH-DEMO01', tp).lastInsertRowid;
  const names = ['Aarav', 'Diya', 'Kiran', 'Meera', 'Rohan', 'Sneha'];
  const subs = ['English', 'Kannada', 'C#', 'C++', 'Java'];
  const ins = db.prepare('INSERT OR IGNORE INTO attendance(student_id,subject,date,status,marked_by) VALUES(?,?,?,?,?)');
  db.transaction(() => {
    names.forEach((n, i) => {
      const sid = add.run(n, 'student', 'STU-DEMO0' + (i + 1), sp).lastInsertRowid;
      const d = new Date('2026-09-01T00:00:00Z');
      for (let k = 0; k < 10; k++) {
        while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
        const date = d.toISOString().slice(0, 10);
        subs.forEach((s, j) => ins.run(sid, s, date, ((k * 7 + i * 3 + j) % (i + 3)) === 0 ? 'A' : 'P', t));
        d.setUTCDate(d.getUTCDate() + 1);
      }
    });
  })();
}
module.exports = db;
