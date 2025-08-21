// server.js (ESM, Node 22+)
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'submissions.csv');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

async function ensureCsv() {
  await fs.mkdir(DATA_DIR, { recursive: true });          // crea /data si no existe
  try { await fs.access(CSV_PATH); }
  catch { await fs.writeFile(CSV_PATH, 'name,phone,timestamp\n', 'utf8'); }
}

const clean = (s) => String(s ?? '').replace(/[\r\n]/g, ' ').replace(/[<>]/g, '').trim();
const phoneOk = (p) => /^[+]?[\d\s-]{7,20}$/.test(p);

// Diagnóstico rápido
app.get('/api/ping', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));
app.get('/api/csv', async (_req, res) => { await ensureCsv(); res.type('text/plain').send(await fs.readFile(CSV_PATH, 'utf8')); });

app.post('/api/subscribe', async (req, res) => {
  await ensureCsv();
  const name = clean(req.body.name);
  const phone = clean(req.body.phone);

  if (!name || !phoneOk(phone)) return res.status(400).json({ error: 'Datos inválidos' });

  // deduplicado simple por teléfono
  const txt = await fs.readFile(CSV_PATH, 'utf8');
  if (txt.includes(`,${phone},`)) return res.json({ message: 'Ya te tenemos registrado.' });

  const ts = new Date().toISOString();
  await fs.appendFile(CSV_PATH, `"${name.replace(/"/g, '""')}",${phone},${ts}\n`);
  return res.json({ message: '¡Gracias por unirte a Computer Society UNAL!' });
});

app.listen(PORT, () => console.log(`Servidor: http://localhost:${PORT}`));
