/* ==========================================================================
   Cloudflare Worker — the instrument register API.

   D1 cannot be reached from a browser; only a Worker can query it. This is
   that Worker. The website still runs from your machine and calls in here.

   ENDPOINTS
     GET  /api/health              is it alive, and is the schema present
     GET  /api/catalogue           codes, standards, global ledger
     GET  /api/clinic/:key         one clinic ledger
     GET  /api/everything          the above plus every clinic (item log)
     POST /api/commit              append a batch of events

   THE LEDGER IS APPEND-ONLY. There is no UPDATE and no DELETE in this file.
   Do not add one. A correction is a new row.
   ========================================================================== */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function cors(env, request) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  const origin = request.headers.get('Origin') || '';
  const allow = allowed.includes('*') ? (origin || '*')
              : allowed.includes(origin) ? origin
              : '';
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, init, extra) {
  return new Response(JSON.stringify(body), {
    status: (init && init.status) || 200,
    headers: { ...JSON_HEADERS, ...(extra || {}) }
  });
}

function authorised(request, env) {
  // An unset token would silently publish ministry data to the open
  // internet, so a missing secret fails closed rather than open.
  if (!env.API_TOKEN) return false;
  const header = request.headers.get('Authorization') || '';
  return header === 'Bearer ' + env.API_TOKEN;
}

/* -- shaping ---------------------------------------------------------------
   Rows come back in the shape ledger.js already understands, so nothing on
   the page has to know a database was involved. */

function rowToEntry(r) {
  const e = {
    t: r.ts,
    k: r.item_key,
    type: r.type,
    note: r.note || '',
    by: r.recorded_by || '',
    scope: r.scope
  };
  if (r.type === 'standard') { e.from = r.from_qty; e.to = r.to_qty; }
  else { e.qty = r.qty; }
  if (r.scope === 'clinic') {
    e.clinic = r.clinic_key;
    e.centreName = r.centre_name || '';
    e.clinicNo = r.clinic_no || '';
  }
  return e;
}

async function catalogue(env) {
  const [codeRows, stdRows, globalRows] = await Promise.all([
    env.DB.prepare('SELECT item_key, code FROM codes').all(),
    env.DB.prepare('SELECT item_key, qty FROM standards').all(),
    env.DB.prepare("SELECT * FROM ledger WHERE scope = 'global' ORDER BY ts DESC").all()
  ]);

  const codes = {};
  for (const r of codeRows.results) codes[r.item_key] = r.code;

  const standards = {};
  for (const r of stdRows.results) standards[r.item_key] = r.qty;

  return { codes, standards, globalLog: globalRows.results.map(rowToEntry) };
}

/* -- commit ----------------------------------------------------------------
   One batch, so a half-written transaction cannot leave the register
   claiming a return happened without the issue that paid for it. */

async function commit(request, env) {
  const p = await request.json();
  const now = new Date().toISOString();
  const by = (p.by || '').slice(0, 120);
  const statements = [];

  for (const [k, code] of Object.entries(p.codes || {})) {
    statements.push(code
      ? env.DB.prepare(
          'INSERT INTO codes (item_key, code, updated_at, updated_by) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(item_key) DO UPDATE SET code = excluded.code, ' +
          'updated_at = excluded.updated_at, updated_by = excluded.updated_by'
        ).bind(k, String(code).slice(0, 24), now, by)
      : env.DB.prepare('DELETE FROM codes WHERE item_key = ?').bind(k));
  }

  for (const [k, qty] of Object.entries(p.standards || {})) {
    statements.push(env.DB.prepare(
      'INSERT INTO standards (item_key, qty, updated_at, updated_by) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(item_key) DO UPDATE SET qty = excluded.qty, ' +
      'updated_at = excluded.updated_at, updated_by = excluded.updated_by'
    ).bind(k, Number(qty) | 0, now, by));
  }

  const insert = env.DB.prepare(
    'INSERT INTO ledger (ts, item_key, type, qty, from_qty, to_qty, note, recorded_by, ' +
    'scope, clinic_key, centre_name, clinic_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  );

  for (const e of (p.globalEntries || [])) {
    statements.push(insert.bind(
      e.t || now, e.k, 'standard', null, e.from | 0, e.to | 0,
      (e.note || '').slice(0, 500), by, 'global', null, null, null));
  }

  for (const e of (p.clinicEntries || [])) {
    if (e.type !== 'return' && e.type !== 'issue') continue;
    statements.push(insert.bind(
      e.t || now, e.k, e.type, Number(e.qty) | 0, null, null,
      (e.note || '').slice(0, 500), by, 'clinic',
      p.clinicKey, p.centreName || '', p.clinicNo || ''));
  }

  if (!statements.length) return { ok: true, written: 0 };

  await env.DB.batch(statements);
  return { ok: true, written: statements.length };
}

/* -- router ---------------------------------------------------------------- */

export default {
  async fetch(request, env) {
    const headers = cors(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/api/health') {
      let schema = 'unknown';
      try {
        await env.DB.prepare('SELECT 1 FROM ledger LIMIT 1').all();
        schema = 'ready';
      } catch (e) {
        schema = 'missing — run the schema.sql step in server/README.md';
      }
      return json({ ok: true, schema, tokenConfigured: Boolean(env.API_TOKEN) },
                  null, headers);
    }

    if (!authorised(request, env)) {
      return json({
        error: env.API_TOKEN
          ? 'Unauthorised. The Authorization header does not match API_TOKEN.'
          : 'API_TOKEN is not set on this Worker, so every request is refused. ' +
            'Set it with: wrangler secret put API_TOKEN'
      }, { status: 401 }, headers);
    }

    try {
      if (request.method === 'GET' && path === '/api/catalogue') {
        return json(await catalogue(env), null, headers);
      }

      if (request.method === 'GET' && path.startsWith('/api/clinic/')) {
        const key = decodeURIComponent(path.slice('/api/clinic/'.length));
        const rows = await env.DB
          .prepare("SELECT * FROM ledger WHERE scope = 'clinic' AND clinic_key = ? ORDER BY ts ASC")
          .bind(key).all();
        return json({ entries: rows.results.map(rowToEntry) }, null, headers);
      }

      if (request.method === 'GET' && path === '/api/everything') {
        const cat = await catalogue(env);
        const rows = await env.DB
          .prepare("SELECT * FROM ledger WHERE scope = 'clinic' ORDER BY ts ASC").all();

        const byClinic = new Map();
        for (const r of rows.results) {
          if (!byClinic.has(r.clinic_key)) byClinic.set(r.clinic_key, []);
          byClinic.get(r.clinic_key).push(rowToEntry(r));
        }

        cat.clinics = [...byClinic.entries()].map(([key, entries]) => {
          // Newest entry wins the display name, so renaming a centre updates
          // its label without orphaning the history under the old spelling.
          let label = key;
          for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i].centreName || entries[i].clinicNo) {
              const c = entries[i].centreName, n = entries[i].clinicNo;
              label = [c, n && ('clinic ' + n)].filter(Boolean).join(' · ') || key;
              break;
            }
          }
          return { key, label, entries };
        }).sort((a, b) => a.label.localeCompare(b.label));

        return json(cat, null, headers);
      }

      if (request.method === 'POST' && path === '/api/commit') {
        return json(await commit(request, env), null, headers);
      }

      return json({ error: 'Not found: ' + path }, { status: 404 }, headers);
    } catch (e) {
      return json({ error: e.message }, { status: 500 }, headers);
    }
  }
};
