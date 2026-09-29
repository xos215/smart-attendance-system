// API / CONTROLLER LAYER
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), crypto = require('crypto'), path = require('path');
const db = require('./db'), L = require('./services/logic');
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const INVITE = process.env.TEACHER_INVITE || 'svc2026'; // institution code for teacher signup
const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: {
  upgradeInsecureRequests: null, defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'] } } }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many attempts, try later' } });

const auth = (role) => (req, res, next) => {
  try {
    const u = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    if (role && u.role !== role) return res.status(403).json({ error: 'Forbidden' });
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
const genKey = (role) => (role === 'teacher' ? 'TCH-' : 'STU-') + crypto.randomBytes(3).toString('hex').toUpperCase();

app.post('/api/register', authLimiter, (req, res) => {
  const { name, role, password, invite } = req.body || {};
  if (!name || name.trim().length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter a valid name' });
  if (!['teacher', 'student'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!L.strongPassword(password)) return res.status(400).json({ error: 'Password: 8+ chars with letters and numbers' });
  if (role === 'teacher' && invite !== INVITE) return res.status(403).json({ error: 'Invalid institution invite code' });
  const hash = bcrypt.hashSync(password, 10);
  for (let i = 0; i < 5; i++) {
    try {
      const key = genKey(role);
      db.prepare('INSERT INTO users(name,role,ukey,pass_hash) VALUES(?,?,?,?)').run(name.trim(), role, key, hash);
      return res.json({ key });
    } catch (e) { if (!String(e.message).includes('UNIQUE')) break; }
  }
  res.status(500).json({ error: 'Could not register' });
});

app.post('/api/login', authLimiter, (req, res) => {
  const { key, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE ukey=?').get(String(key || '').trim().toUpperCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.pass_hash)) return res.status(401).json({ error: 'Invalid key or password' });
  const token = jwt.sign({ id: u.id, role: u.role, name: u.name, key: u.ukey }, SECRET, { expiresIn: '4h' });
  res.json({ token, role: u.role, name: u.name, key: u.ukey });
});

app.get('/api/subjects', auth(), (_q, res) => res.json(L.SUBJECTS));
app.get('/api/students', auth('teacher'), (_q, res) =>
  res.json(db.prepare("SELECT id,name,ukey FROM users WHERE role='student' ORDER BY name").all()));

app.get('/api/attendance', auth('teacher'), (req, res) => {
  const { subject, date } = req.query;
  res.json(db.prepare('SELECT student_id,status FROM attendance WHERE subject=? AND date=?').all(subject, date));
});

app.post('/api/attendance', auth('teacher'), (req, res) => {
  const { subject, date, records } = req.body || {};
  if (!L.SUBJECTS.includes(subject)) return res.status(400).json({ error: 'Invalid subject' });
  if (!L.isWeekday(date)) return res.status(400).json({ error: 'Classes run Monday to Friday only' });
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'No records' });
  const up = db.prepare(`INSERT INTO attendance(student_id,subject,date,status,marked_by) VALUES(?,?,?,?,?)
    ON CONFLICT(student_id,subject,date) DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by`);
  db.transaction(() => records.forEach(r => {
    if (['P', 'A'].includes(r.status) && Number.isInteger(r.student_id)) up.run(r.student_id, subject, date, r.status, req.user.id);
  }))();
  res.json({ saved: records.length });
});

const reportRows = (studentId) => db.prepare(`
  SELECT u.id,u.name,u.ukey,a.subject,COUNT(a.id) total,COALESCE(SUM(a.status='P'),0) present
  FROM users u LEFT JOIN attendance a ON a.student_id=u.id
  WHERE u.role='student' ${studentId ? 'AND u.id=?' : ''} GROUP BY u.id,a.subject`).all(...(studentId ? [studentId] : []));
const thr = (q) => Math.min(100, Math.max(1, Number(q.threshold) || 75));

app.get('/api/report', auth('teacher'), (req, res) => res.json(L.buildReport(reportRows(), thr(req.query))));
app.get('/api/defaulters', auth('teacher'), (req, res) =>
  res.json(L.defaulters(L.buildReport(reportRows(), thr(req.query)))));
app.get('/api/me/report', auth('student'), (req, res) =>
  res.json(L.buildReport(reportRows(req.user.id), thr(req.query))[0]));

if (!process.env.TEACHER_INVITE) console.warn('WARNING: using default teacher invite code. Set TEACHER_INVITE.');
app.listen(process.env.PORT || 3000, () => console.log('Running on port', process.env.PORT || 3000));
