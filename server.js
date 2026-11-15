const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, 'novaforge.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, html TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id, updated_at DESC);
`);
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

const cookieName = 'novaforge_session';
const cookieSecure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const tokenDigest = token => crypto.createHash('sha256').update(token).digest('hex');
const makeId = () => crypto.randomUUID();
const cookieValue = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenDigest(token), userId, Date.now() + 1000 * 60 * 60 * 24 * 14);
  res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600${cookieSecure}`);
}
function requireAuth(req, res, next) {
  const token = cookieValue(req);
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  const session = db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(tokenDigest(decodeURIComponent(token)), Date.now());
  if (!session) return res.status(401).json({ error: 'Your session expired. Please log in again.' });
  req.user = session;
  next();
}
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`)));
}
async function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const actual = await passwordHash(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actual.split(':')[1], 'hex'), Buffer.from(key, 'hex'));
}
const starterHtml = name => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>*{box-sizing:border-box}body{margin:0;font:16px/1.6 Inter,ui-sans-serif,system-ui,sans-serif;color:#14231d;background:#f7f8f3}nav{height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 8%;border-bottom:1px solid #e6e9e1}nav strong{font-size:20px}nav a{color:inherit;text-decoration:none;margin-left:24px}.hero{max-width:1000px;margin:12vh auto;padding:0 28px}.eyebrow{color:#527c5d;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.hero h1{max-width:760px;font-size:clamp(42px,8vw,82px);line-height:1.04;letter-spacing:-.06em;margin:20px 0}.hero p{max-width:560px;color:#627068;font-size:19px}.button{display:inline-block;margin-top:22px;background:#1f4934;color:white;padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:700}.card{margin-top:54px;padding:24px;border:1px solid #e5e9e1;border-radius:18px;background:white;max-width:570px}</style></head>
<body><nav><strong>${name}</strong><div><a href="#about">About</a><a href="#contact">Contact</a></div></nav><main class="hero"><div class="eyebrow">A fresh start</div><h1>Your next great idea starts here.</h1><p>A clean, flexible starting point. Tell NovaForge what you want to make and ask AI to shape this page into something distinctly yours.</p><a class="button" href="#contact">Explore what’s possible →</a><section id="about" class="card"><h2>Made for your next chapter</h2><p>Thoughtful design, clear messaging, and room to grow. Customize this page in the editor or describe a change in the project chat.</p></section></main></body></html>`;

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Enter a valid email and a password of at least 8 characters.' });
  try {
    const id = makeId();
    const hash = await passwordHash(password);
    db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id, email, hash, new Date().toISOString());
    setSession(res, id);
    res.json({ user: { id, email } });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with that email already exists.' });
    res.status(500).json({ error: 'Could not create account.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !(await verifyPassword(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  setSession(res, user.id);
  res.json({ user: { id: user.id, email: user.email } });
});
app.post('/api/auth/logout', (req, res) => {
  const token = cookieValue(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenDigest(decodeURIComponent(token)));
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${cookieSecure}`);
  res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
app.get('/api/projects', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT id,name,created_at,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC').all(req.user.id));
});
app.post('/api/projects', requireAuth, (req, res) => {
  const name = String(req.body.name || 'Untitled project').trim().slice(0, 100) || 'Untitled project';
  const id = makeId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO projects(id,user_id,name,html,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, req.user.id, name, starterHtml(name), now, now);
  res.status(201).json({ id, name, html: starterHtml(name), created_at: now, updated_at: now });
});
app.get('/api/projects/:id', requireAuth, (req, res) => {
  const project = db.prepare('SELECT id,name,html,created_at,updated_at FROM projects WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(project);
});
app.put('/api/projects/:id', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const html = String(req.body.html || '');
  if (!name || html.length > 1500000) return res.status(400).json({ error: 'Project name is required and HTML must be under 1.5 MB.' });
  const result = db.prepare('UPDATE projects SET name=?,html=?,updated_at=? WHERE id=? AND user_id=?').run(name, html, new Date().toISOString(), req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Project not found.' });
  res.json({ ok: true });
});
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Project not found.' });
  res.json({ ok: true });
});
app.post('/api/ai/generate', requireAuth, async (req, res) => {
  const { prompt, currentHtml = '', referenceUrl = '', imageData = '' } = req.body || {};
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'AI generation is not configured yet. Add AI_API_KEY to the server .env file; other builder features work without it.' });
  if (!String(prompt || '').trim()) return res.status(400).json({ error: 'Write an instruction for the AI first.' });
  if (String(prompt).length > 12000 || String(currentHtml).length > 1500000) return res.status(413).json({ error: 'Prompt or project is too large.' });
  const userParts = [`Instruction: ${prompt}`, referenceUrl ? `Reference URL (context only; not fetched): ${String(referenceUrl).slice(0, 2000)}` : '', currentHtml ? `Existing project HTML to update:\n${currentHtml}` : 'Create a polished responsive website as a complete HTML document.'].filter(Boolean).join('\n\n');
  const content = [{ type: 'text', text: userParts }];
  if (imageData && /^data:image\/(png|jpeg|webp);base64,/.test(imageData) && imageData.length < 6000000) content.push({ type: 'image_url', image_url: { url: imageData } });
  try {
    const response = await fetch(`${(process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', temperature: 0.4, messages: [
        { role: 'system', content: 'You are NovaForge, a senior web product designer and engineer. Produce a complete, polished, responsive, accessible single-file HTML website with inline CSS and only necessary vanilla JavaScript. Return ONLY valid JSON with keys name (short project name) and html (complete HTML document). No markdown fences. When changing existing code, preserve working details and implement the requested edits. Use original branding and assets; do not reproduce a reference site exactly.' },
        { role: 'user', content }
      ] })
    });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: payload.error?.message || `AI provider returned HTTP ${response.status}.` });
    let output = payload.choices?.[0]?.message?.content || '';
    output = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(output);
    if (typeof parsed.html !== 'string' || !parsed.html.toLowerCase().includes('<html')) throw new Error('AI did not return a complete HTML document. Try again.');
    res.json({ name: String(parsed.name || 'Untitled project').slice(0, 100), html: parsed.html });
  } catch (error) {
    res.status(502).json({ error: error.message || 'AI generation failed. Check your provider settings.' });
  }
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`NovaForge is running at http://localhost:${port}`));
