import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import pg from 'pg';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { stringify } from 'csv-stringify/sync';

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Login route - MOVED TO TOP LEVEL for maximum reliability
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Request received - Body: ${JSON.stringify(req.body)}`);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedPassword = password.trim();

    if (normalizedUsername === 'admin' && normalizedPassword === 'Nic6604211989!') {
      console.log('[LOGIN] Success for user: admin');
      return res.json({ token: 'secret-token-nic-2026' });
    } else {
      console.log(`[LOGIN] Failed - Invalid credentials for: ${normalizedUsername}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // Database setup
  let db: any;
  const isPostgres = !!process.env.DATABASE_URL;

  async function initializeDatabase(database: any, postgres: boolean) {
    if (postgres) {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          date TEXT NOT NULL,
          clock_in TEXT,
          tea_out TEXT,
          tea_in TEXT,
          lunch_out TEXT,
          lunch_in TEXT,
          clock_out TEXT,
          total_hours REAL DEFAULT 0,
          status TEXT DEFAULT 'idle',
          leave_type TEXT,
          is_paid BOOLEAN DEFAULT TRUE,
          leave_hours REAL DEFAULT 0,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
      `);
    } else {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          clock_in TEXT,
          tea_out TEXT,
          tea_in TEXT,
          lunch_out TEXT,
          lunch_in TEXT,
          clock_out TEXT,
          total_hours REAL DEFAULT 0,
          status TEXT DEFAULT 'idle',
          leave_type TEXT,
          is_paid INTEGER DEFAULT 1,
          leave_hours REAL DEFAULT 0,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
      `);

      // SQLite Migration: Add missing columns if table already existed
      const columns = await database.all("PRAGMA table_info(sessions)");
      const columnNames = columns.map((c: any) => c.name);
      
      const migrations = [
        { name: 'leave_type', type: 'TEXT' },
        { name: 'is_paid', type: 'INTEGER DEFAULT 1' },
        { name: 'leave_hours', type: 'REAL DEFAULT 0' },
        { name: 'notes', type: 'TEXT' }
      ];

      for (const m of migrations) {
        if (!columnNames.includes(m.name)) {
          console.log(`Migrating SQLite: Adding column ${m.name}`);
          await database.exec(`ALTER TABLE sessions ADD COLUMN ${m.name} ${m.type}`);
        }
      }
    }
  }

  try {
    if (isPostgres) {
      console.log('Attempting to connect to Postgres...');
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000 
      });
      db = {
        exec: async (sql: string) => await pool.query(sql),
        all: async (sql: string, params: any[] = []) => (await pool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params)).rows,
        get: async (sql: string, params: any[] = []) => (await pool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params)).rows[0],
        run: async (sql: string, params: any[] = []) => await pool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params),
      };
      // Test connection
      await pool.query('SELECT 1');
      console.log('Postgres connected successfully');
    } else {
      console.log('Using SQLite database');
      db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
      });
    }

    await initializeDatabase(db, isPostgres);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database initialization failed:', err);
    // Fallback to SQLite if Postgres fails to prevent boot hang
    if (isPostgres) {
      console.log('Falling back to SQLite due to Postgres error');
      db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
      });
      await initializeDatabase(db, false);
      console.log('Fallback SQLite tables initialized');
    }
  }

  // API Routes
  const router = express.Router();

  router.get('/login-test', (req, res) => {
    res.json({ message: 'Login endpoint is reachable' });
  });

  // Authentication middleware
  const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer secret-token-nic-2026') {
      next();
    } else {
      console.log(`[AUTH] Unauthorized access attempt to ${req.path}`);
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  router.use(authenticate);

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  router.get('/sessions', async (req, res) => {
    const sessions = await db.all('SELECT * FROM sessions ORDER BY date DESC, id DESC');
    res.json(sessions);
  });

  router.get('/sessions/current', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const session = await db.get('SELECT * FROM sessions WHERE date = ? AND clock_out IS NULL AND leave_type IS NULL LIMIT 1', [today]);
    res.json(session || null);
  });

  router.post('/sessions/action', async (req, res) => {
    const { action, timestamp } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const ts = timestamp || new Date().toISOString();

    let session = await db.get('SELECT * FROM sessions WHERE date = ? AND clock_out IS NULL AND leave_type IS NULL LIMIT 1', [today]);

    if (action === 'clock_in') {
      if (session) {
        await db.run('UPDATE sessions SET clock_in = ?, status = ? WHERE id = ?', [ts, 'working', session.id]);
      } else {
        await db.run('INSERT INTO sessions (date, clock_in, status) VALUES (?, ?, ?)', [today, ts, 'working']);
      }
    } else {
      if (!session) {
        await db.run(`INSERT INTO sessions (date, ${action}, status) VALUES (?, ?, ?)`, [today, ts, getStatusForAction(action)]);
      } else {
        await db.run(`UPDATE sessions SET ${action} = ?, status = ? WHERE id = ?`, [ts, getStatusForAction(action), session.id]);
      }
    }

    const currentSession = await db.get('SELECT * FROM sessions WHERE date = ? AND clock_out IS NULL AND leave_type IS NULL LIMIT 1', [today]);
    if (currentSession) {
      const total = calculateHours(currentSession);
      await db.run('UPDATE sessions SET total_hours = ? WHERE id = ?', [total, currentSession.id]);
    }

    const updated = await db.get('SELECT * FROM sessions WHERE date = ? AND clock_out IS NULL AND leave_type IS NULL LIMIT 1', [today]);
    res.json(updated || { status: 'idle' });
  });

  router.post('/sessions', async (req, res) => {
    const { date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, status, leave_type, is_paid, leave_hours, notes } = req.body;
    const result = await db.run(
      `INSERT INTO sessions (date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, status, leave_type, is_paid, leave_hours, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, status || 'done', leave_type, is_paid ? 1 : 0, leave_hours || 0, notes]
    );
    const id = isPostgres ? result.rows[0].id : result.lastID;
    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
    const total = calculateHours(session);
    await db.run('UPDATE sessions SET total_hours = ? WHERE id = ?', [total, id]);
    res.json({ success: true, id });
  });

  router.put('/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const { date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, status, leave_type, is_paid, leave_hours, notes } = req.body;
    await db.run(
      `UPDATE sessions SET 
        date = ?, clock_in = ?, tea_out = ?, tea_in = ?, 
        lunch_out = ?, lunch_in = ?, clock_out = ?, status = ?,
        leave_type = ?, is_paid = ?, leave_hours = ?, notes = ?
      WHERE id = ?`,
      [date, clock_in, tea_out, tea_in, lunch_out, lunch_in, clock_out, status, leave_type, is_paid ? 1 : 0, leave_hours || 0, notes, id]
    );
    const updatedSession = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
    const total = calculateHours(updatedSession);
    await db.run('UPDATE sessions SET total_hours = ? WHERE id = ?', [total, id]);
    res.json({ success: true });
  });

  router.delete('/sessions/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  router.get('/export', async (req, res) => {
    const sessions = await db.all('SELECT * FROM sessions ORDER BY date DESC');
    const csv = stringify(sessions, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheet.csv');
    res.send(csv);
  });

  app.use('/api', router);

  function getStatusForAction(action: string) {
    const statuses: Record<string, string> = {
      'clock_in': 'working',
      'tea_out': 'on_tea',
      'tea_in': 'working',
      'lunch_out': 'on_lunch',
      'lunch_in': 'working',
      'clock_out': 'done'
    };
    return statuses[action] || 'working';
  }

  function calculateHours(s: any) {
    if (s.leave_type) return s.leave_hours || 0;
    if (!s.clock_in || !s.clock_out) return 0;
    const start = new Date(s.clock_in).getTime();
    const end = new Date(s.clock_out).getTime();
    let duration = end - start;

    // Deduct lunch
    if (s.lunch_out && s.lunch_in) {
      const lStart = new Date(s.lunch_out).getTime();
      const lEnd = new Date(s.lunch_in).getTime();
      duration -= (lEnd - lStart);
    }

    // Tea breaks are NOT deducted as per user request
    return Math.max(0, duration / (1000 * 60 * 60)); // Convert to hours
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
