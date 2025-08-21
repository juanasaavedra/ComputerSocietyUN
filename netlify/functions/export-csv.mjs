// Genera un CSV con las respuestas del formulario "join" (Netlify Forms)
export const handler = async (event) => {
  try {
    // Variables de entorno (ponlas en Netlify → Site settings → Environment variables)
    const TOKEN = process.env.NETLIFY_AUTH_TOKEN; // tu PAT
    const SITE_ID = process.env.NETLIFY_SITE_ID;  // id del sitio
    const SECRET = process.env.EXPORT_SECRET;     // opcional

    if (!TOKEN || !SITE_ID) {
      return { statusCode: 500, body: 'Faltan NETLIFY_AUTH_TOKEN o NETLIFY_SITE_ID' };
    }

    // Protección opcional con ?key=
    const key = event.queryStringParameters?.key || '';
    if (SECRET && key !== SECRET) {
      return { statusCode: 401, body: 'No autorizado' };
    }

    const headers = { Authorization: `Bearer ${TOKEN}` };

    // 1) Listar formularios y ubicar "join"
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, { headers });
    if (!formsRes.ok) return { statusCode: 502, body: `No pude listar forms: ${await formsRes.text()}` };
    const forms = await formsRes.json();
    const form = forms.find(f => (f.name || '').toLowerCase() === 'join');
    if (!form) return { statusCode: 404, body: 'Formulario "join" no encontrado' };

    // 2) Obtener submissions
    const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, { headers });
    if (!subsRes.ok) return { statusCode: 502, body: `No pude leer submissions: ${await subsRes.text()}` };
    const subs = await subsRes.json();

    // 3) Componer CSV
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = subs.map(s => {
      const name = s.data?.name ?? '';
      const phone = s.data?.phone ?? '';
      const ts = s.created_at ?? '';
      return [esc(name), esc(phone), esc(ts)].join(',');
    });
    const csv = ['name,phone,timestamp', ...rows].join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="submissions.csv"',
        'Cache-Control': 'no-store'
      },
      body: csv
    };
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
