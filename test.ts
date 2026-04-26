import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
async function run() {
  const db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, clock_in TEXT, clock_out TEXT, status TEXT)`);
  await db.run('INSERT INTO sessions (date, clock_in, status) VALUES (?, ?, ?)', ['2023-10-10', '10:00', 'working']);
  const s = await db.get('SELECT * FROM sessions');
  console.log('Inserted:', s);
  await db.run('UPDATE sessions SET clock_out = ?, status = ? WHERE id = ?', ['11:00', 'idle', s.id]);
  const u = await db.get('SELECT * FROM sessions');
  console.log('Updated:', u);
}
run();
