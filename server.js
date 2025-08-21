// server.js (ESM, Node 22+)
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { promises as fs } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = process.cwd();
const DATA_DIR = path.join(__dirname, 'data');
const CSV_PATH = path.join(DATA_DIR, 'submissions.csv');

// Seguridad y utilidades
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.disable('x-powered-by');
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 20 }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

const ensureCsv = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(CSV_PATH); }
  catch { await fs.writeFile(CSV_PATH, 'name,phone,timestamp\n', 'utf8'); }
};

const sanitize = (s) =>
  String(s || '').trim().replace(/[\n\r]/g, ' ').replace(/[<>]/g, '');

const phoneOk = (p) => /^[+]?[\d\s-]{7,20}$/.test(p);

// Cache de teléfonos
let phones = new Set();
const loadPhones = async () => {
  try {
    const txt = await fs.readFile(CSV_PATH, 'utf8');
    txt.split('\n').slice(1).forEach((line) => {
      const parts = line.split(',');
      if (parts[1]) phones.add(parts[1]);
    });
  } catch {}
};

// --- endpoints de diagnóstico ---
app.get('/api/ping', (req, res) => res.json({ ok: true, now: new Date().toISOString() }));
app.get('/api/csv-info', async (req, res) => {
  try {
    await ensureCsv();
    const stat = await fs.stat(CSV_PATH);
    res.json({ path: CSV_PATH, bytes: stat.size, entries_cached: phones.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- submit ---
app.post('/api/subscribe', async (req, res) => {
  try {
    await ensureCsv();
    if (phones.size === 0) await loadPhones();

    // Log que nos ayuda a ver qué llega
    console.log('POST /api/subscribe body:', req.body);

    // Honeypot
    if (req.body.company) {
      console.log('Honeypot activado, ignorando.');
      return res.status(200).json({ status: 'ok' });
    }

    const name = sanitize(req.body.name);
    const phone = sanitize(req.body.phone);

    if (!name || !phoneOk(phone)) {
      console.log('Validación falló:', { name, phone });
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    if (phones.has(phone)) {
      console.log('Duplicado:', phone);
      return res.status(200).json({ message: 'Ya te tenemos registrado.' });
    }

    const ts = new Date().toISOString();
    const row = `"${name.replace(/"/g, '""')}",${phone},${ts}\n`;
    await fs.appendFile(CSV_PATH, row, { encoding: 'utf8', flag: 'a' });
    phones.add(phone);

    console.log('Guardado OK:', row.trim());
    res.json({ message: '¡Gracias por unirte a Computer Society UNAL!' });
  } catch (e) {
    console.error('Error en /api/subscribe:', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.listen(PORT, async () => {
  await ensureCsv();
  await loadPhones();
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`CSV: ${CSV_PATH}`);
});
