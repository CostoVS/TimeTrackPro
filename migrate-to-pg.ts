import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import fs from 'fs';

const isPostgres = true;
const dbUrl = process.env.DATABASE_URL || "postgres://timetrack:password@localhost:5432/timetrack";
const { Pool } = pg;

async function migrate() {
  console.log("Checking for SQLite DB...");
  if (!fs.existsSync('./database.sqlite')) {
    console.error("database.sqlite not found. Make sure you are in the TimeTrackPro directory where the sqlite file is located.");
    process.exit(1);
  }

  const sqliteDb = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  const pgPool = new Pool({
    connectionString: dbUrl,
  });

  try {
    // Check connection to Postgres
    const testRes = await pgPool.query('SELECT NOW()');
    console.log("Successfully connected to Postgres:", testRes.rows[0]);

    // Sessions
    const sessions = await sqliteDb.all('SELECT * FROM sessions');
    console.log(`Found ${sessions.length} sessions in SQLite.`);
    
    for (const session of sessions) {
      await pgPool.query(
        `INSERT INTO sessions (id, date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, total_hours, status, leave_type, is_paid, leave_hours, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          session.id, session.date, session.clock_in, session.tea_out, session.tea_in, 
          session.lunch_out, session.lunch_in, session.clock_out, session.total_hours, 
          session.status, session.leave_type, session.is_paid == 1 ? true : false, 
          session.leave_hours, session.notes
        ]
      );
    }
    
    // Update the sequence for sessions
    const maxSessionIdRes = await pgPool.query('SELECT MAX(id) FROM sessions');
    if (maxSessionIdRes.rows[0].max) {
        await pgPool.query(`SELECT setval('sessions_id_seq', ${maxSessionIdRes.rows[0].max})`);
    }

    // Documents
    const documents = await sqliteDb.all('SELECT * FROM documents');
    console.log(`Found ${documents.length} documents in SQLite.`);
    
    for (const doc of documents) {
      await pgPool.query(
        `INSERT INTO documents (id, type, filename, original_name, mime_type, upload_date, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [doc.id, doc.type, doc.filename, doc.original_name, doc.mime_type, doc.upload_date, doc.description]
      );
    }
    
    // Update the sequence for documents
    const maxDocIdRes = await pgPool.query('SELECT MAX(id) FROM documents');
    if (maxDocIdRes.rows[0].max) {
        await pgPool.query(`SELECT setval('documents_id_seq', ${maxDocIdRes.rows[0].max})`);
    }

    // System Settings
    const settings = await sqliteDb.all('SELECT * FROM system_settings');
    console.log(`Found ${settings.length} system settings in SQLite.`);
    
    for (const setting of settings) {
      await pgPool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [setting.key, setting.value]
      );
    }

    console.log("✅ Migration complete! Your data has been copied from SQLite to PostgreSQL.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pgPool.end();
    await sqliteDb.close();
  }
}

migrate();
