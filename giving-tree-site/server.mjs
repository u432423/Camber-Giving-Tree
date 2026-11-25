import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataFile = path.join(root, 'data.json');
const PORT = Number(process.env.PORT || 3000);
// Change this after deployment: ADMIN_PASSWORD=your-new-password npm start
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ilovechristmas123';
const sessions = new Set();

async function readData() {
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  catch { return { selections: [] }; }
}
async function writeData(data) { await fs.writeFile(dataFile, JSON.stringify(data, null, 2)); }
function json(res, status, payload) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => v.trim().split('='))); }
function authorized(req) { return sessions.has(cookies(req).giving_tree_session); }
async function body(req) { let raw=''; for await (const c of req) raw += c; return raw ? JSON.parse(raw) : {}; }
function safeCodes(codes) { return Array.isArray(codes) && codes.length && codes.length <= 20 && codes.every(c => /^[0-9]+\.[0-9]+$/.test(c)); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'POST' && url.pathname === '/api/selections') {
      const { email, codes } = await body(req);
      if (!/^\S+@\S+\.\S+$/.test(email || '') || !safeCodes(codes)) return json(res, 400, { error: 'Please provide a valid email and at least one child code.' });
      const data = await readData();
      data.selections.unshift({ id: crypto.randomUUID(), email, codes, submittedAt: new Date().toISOString() });
      await writeData(data); return json(res, 201, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      const { password } = await body(req);
      if (password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Incorrect password.' });
      const token = crypto.randomBytes(32).toString('hex'); sessions.add(token);
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': `giving_tree_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname.startsWith('/api/admin') && !authorized(req)) return json(res, 401, { error: 'Please sign in.' });
    if (req.method === 'GET' && url.pathname === '/api/admin/selections') return json(res, 200, (await readData()).selections);
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/selections/')) {
      const id = url.pathname.split('/').pop(), data = await readData();
      data.selections = data.selections.filter(x => x.id !== id); await writeData(data); return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/export') {
      const rows = (await readData()).selections;
      const csv = ['Donor email,Child codes,Submitted', ...rows.map(x => `"${x.email.replaceAll('"','""')}","${x.codes.join('; ')}","${x.submittedAt}"`)].join('\n');
      res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="giving-tree-donor-tracker.csv"' }); return res.end(csv);
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/email') {
      const { to, subject, text } = await body(req);
      if (!/^\S+@\S+\.\S+$/.test(to || '') || !subject || !text) return json(res, 400, { error: 'Complete the recipient, subject, and message.' });
      if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return json(res, 400, { error: 'Email sending is not configured yet. Add RESEND_API_KEY and FROM_EMAIL in your host settings.' });
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [to], subject, text }) });
      if (!r.ok) return json(res, 502, { error: 'The email provider could not send this message.' }); return json(res, 200, { ok: true });
    }
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(publicDir, requested));
    if (!file.startsWith(publicDir)) return json(res, 403, { error: 'Forbidden' });
    const ext = path.extname(file); const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
    const content = await fs.readFile(file); res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') { res.writeHead(404); return res.end('Not found'); }
    console.error(error); json(res, 500, { error: 'Something went wrong.' });
  }
});
server.listen(PORT, () => console.log(`Giving Tree ready on http://localhost:${PORT}`));
