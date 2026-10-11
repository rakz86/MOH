/* ==========================================================================
   Cloudflare Worker — the instrument register API.

   D1 cannot be reached from a browser; only a Worker can query it. This is
   that Worker. The website still runs from your machine and calls in here.

   It speaks exactly the interface of website/store.js, and hands back the
   same shapes the browser-storage adapter does, so no page has to know a
   database was involved.

   ENDPOINTS
     GET  /api/health                  is it alive, and is the schema current
     GET  /api/all                     loadAll(): standards, allocations,
                                       requests, ledger
     POST /api/requests                submitRequest(request)
     POST /api/requests/:id/decide     decideRequest(id, decision)
     POST /api/allocation              setAllocation(centreId, k, qty, ...)

   A REQUEST IS NOT A MOVEMENT. Submitting writes the request and nothing
   else. Only /decide writes the ledger, and it does so in the same batch as
   the decision, so a request can never read 'confirmed' without the stock
   movements that confirmation stands for, or the other way round.

   THE LEDGER IS APPEND-ONLY. There is no UPDATE and no DELETE on it in this
   file, and schema.sql has triggers that refuse one. A correction is a new
   row.
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

/* -- validation ------------------------------------------------------------
   The page validates too, but the page is not the last line: anything with
   the token can call this directly. A refusal says what was wrong. */

class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const RE_CENTRE = /^[a-z0-9-]{1,40}$/;
const RE_ITEM = /^[a-z0-9-]{1,40}:\d{1,4}$/;
const RE_REQUEST = /^REQ-\d{8}-\d{4}$/;

function text(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

function count(v, what) {
  const n = Number(v || 0);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new Refusal(400, what + ' must be a whole number from 0 to 9999');
  }
  return n;
}

function need(ok, message) { if (!ok) throw new Refusal(400, message); }

async function body(request) {
  try { return await request.json(); }
  catch (e) { throw new Refusal(400, 'Request body is not valid JSON'); }
}

/* -- read ------------------------------------------------------------------
   The whole dataset is 78 items across 9 centres, so it loads in one call
   and the page derives everything from that snapshot. */

function ledgerEntry(r) {
  const e = {
    t: r.ts,
    k: r.item_key,
    type: r.type,
    note: r.note || '',
    by: r.recorded_by || '',
    centreId: r.centre_id
  };
  if (r.type === 'standard') { e.from = r.from_qty; e.to = r.to_qty; }
  else { e.qty = r.qty; e.requestId = r.request_id; }
  return e;
}

async function loadAll(env) {
  const [stdRows, allocRows, reqRows, lineRows, accRows, ledgerRows] =
    (await env.DB.batch([
      env.DB.prepare('SELECT item_key, qty FROM standards'),
      env.DB.prepare('SELECT centre_id, item_key, qty FROM allocations'),
      env.DB.prepare(
        'SELECT r.*, d.status, d.decided_at, d.decided_by, d.note AS decision_note ' +
        'FROM requests r LEFT JOIN decisions d ON d.request_id = r.id ' +
        'ORDER BY r.created_at ASC'),
      env.DB.prepare('SELECT * FROM request_lines ORDER BY rowid ASC'),
      env.DB.prepare('SELECT * FROM decision_lines'),
      env.DB.prepare('SELECT * FROM ledger ORDER BY id ASC')
    ])).map(r => r.results);

  const standards = {};
  for (const r of stdRows) standards[r.item_key] = r.qty;

  const allocations = {};
  for (const r of allocRows) {
    (allocations[r.centre_id] = allocations[r.centre_id] || {})[r.item_key] = r.qty;
  }

  const byId = new Map();
  const requests = reqRows.map(r => {
    const req = {
      id: r.id,
      centreId: r.centre_id,
      centreName: r.centre_name,
      createdAt: r.created_at,
      createdBy: r.created_by,
      status: r.status || 'submitted',
      lines: []
    };
    if (r.status) {
      req.decidedAt = r.decided_at;
      req.decidedBy = r.decided_by;
      req.decisionNote = r.decision_note || '';
      req.accepted = {};
    }
    byId.set(r.id, req);
    return req;
  });

  for (const l of lineRows) {
    const req = byId.get(l.request_id);
    if (req) req.lines.push({ k: l.item_key, ret: l.ret, iss: l.iss, note: l.note || '' });
  }
  for (const a of accRows) {
    const req = byId.get(a.request_id);
    if (req && req.accepted) req.accepted[a.item_key] = { ret: a.ret, iss: a.iss };
  }

  return { standards, allocations, requests, ledger: ledgerRows.map(ledgerEntry) };
}

/* -- submit ----------------------------------------------------------------
   Writes the request and its lines. Touches nothing else. */

async function submitRequest(request, env) {
  const p = await body(request);

  const id = text(p.id, 40);
  const centreId = text(p.centreId, 40);
  const createdBy = text(p.createdBy, 120);
  need(RE_REQUEST.test(id), 'Request id must look like REQ-YYYYMMDD-NNNN');
  need(RE_CENTRE.test(centreId), 'Unknown centre id');
  need(createdBy, 'A request must say who raised it');
  need(Array.isArray(p.lines) && p.lines.length, 'A request needs at least one line');
  need(p.lines.length <= 200, 'Too many lines in one request');

  const seen = new Set();
  const lines = p.lines.map(l => {
    const k = text(l && l.k, 50);
    need(RE_ITEM.test(k), 'Unknown item key: ' + k);
    need(!seen.has(k), 'Item ' + k + ' appears twice in one request');
    seen.add(k);
    const ret = count(l.ret, 'Return quantity');
    const iss = count(l.iss, 'Issue quantity');
    need(ret > 0 || iss > 0, 'Line ' + k + ' asks for nothing');
    return { k, ret, iss, note: text(l.note, 500) };
  });

  // Submission time is the server's, so the queue orders by when requests
  // actually arrived rather than by each browser's clock.
  const now = new Date().toISOString();

  const exists = await env.DB.prepare('SELECT 1 FROM requests WHERE id = ?').bind(id).first();
  if (exists) throw new Refusal(409, 'Request ' + id + ' already exists');

  const insertLine = env.DB.prepare(
    'INSERT INTO request_lines (request_id, item_key, ret, iss, note) VALUES (?, ?, ?, ?, ?)');

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO requests (id, centre_id, centre_name, created_at, created_by) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, centreId, text(p.centreName, 120) || centreId, now, createdBy),
    ...lines.map(l => insertLine.bind(id, l.k, l.ret, l.iss, l.note))
  ]);

  return { ok: true, id };
}

/* -- decide ----------------------------------------------------------------
   The only thing that moves stock. One batch holds the decision, what was
   accepted per line, and one ledger row per accepted quantity tagged with
   the request that authorised it. The decision's primary key means a second
   attempt fails the whole batch, ledger rows included. */

async function decideRequest(id, request, env) {
  const p = await body(request);
  const by = text(p.by, 120);
  need(by, 'A decision must say who made it. The ledger records it against that name.');
  need(['confirmed', 'partial', 'rejected'].includes(p.status), 'Status must be confirmed, partial or rejected');

  const req = await env.DB.prepare(
    'SELECT r.id, r.centre_id, d.request_id AS decided FROM requests r ' +
    'LEFT JOIN decisions d ON d.request_id = r.id WHERE r.id = ?').bind(id).first();
  if (!req) throw new Refusal(404, 'Request ' + id + ' not found');
  if (req.decided) throw new Refusal(409, 'Request ' + id + ' has already been decided');

  const lines = (await env.DB.prepare(
    'SELECT item_key, ret, iss, note FROM request_lines WHERE request_id = ? ORDER BY rowid ASC'
  ).bind(id).all()).results;

  const rejected = p.status === 'rejected';
  const given = (p.accepted && typeof p.accepted === 'object') ? p.accepted : {};
  const asked = new Set(lines.map(l => l.item_key));
  for (const k of Object.keys(given)) {
    need(asked.has(k), 'Item ' + k + ' is not part of request ' + id);
  }

  // The request is what authorises a movement, so nothing beyond what it
  // asked for can be accepted against it. More is a new request.
  const accepted = lines.map(l => {
    const a = rejected ? {} : (given[l.item_key] || {});
    const ret = count(a.ret, 'Accepted return');
    const iss = count(a.iss, 'Issued quantity');
    need(ret <= l.ret, 'Cannot accept ' + ret + ' returned for ' + l.item_key + '; ' + l.ret + ' were asked');
    need(iss <= l.iss, 'Cannot issue ' + iss + ' for ' + l.item_key + '; ' + l.iss + ' were asked');
    return { line: l, ret, iss };
  });

  // Status follows from the figures rather than from what the page claims.
  let status = 'rejected';
  if (!rejected) {
    need(accepted.some(a => a.ret || a.iss),
         'Nothing is being accepted. Reject the request instead, or enter a quantity.');
    status = accepted.every(a => a.ret === a.line.ret && a.iss === a.line.iss)
      ? 'confirmed' : 'partial';
  }

  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      'INSERT INTO decisions (request_id, status, decided_at, decided_by, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, status, now, by, text(p.note, 500))
  ];

  if (!rejected) {
    const insertAccepted = env.DB.prepare(
      'INSERT INTO decision_lines (request_id, item_key, ret, iss) VALUES (?, ?, ?, ?)');
    const insertMove = env.DB.prepare(
      'INSERT INTO ledger (ts, item_key, type, centre_id, qty, note, recorded_by, request_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    for (const a of accepted) {
      const k = a.line.item_key, note = a.line.note || '';
      statements.push(insertAccepted.bind(id, k, a.ret, a.iss));
      if (a.ret > 0) statements.push(insertMove.bind(now, k, 'return', req.centre_id, a.ret, note, by, id));
      if (a.iss > 0) statements.push(insertMove.bind(now, k, 'issue', req.centre_id, a.iss, note, by, id));
    }
  }

  try {
    await env.DB.batch(statements);
  } catch (e) {
    // Lost a race with another admin deciding the same request.
    if (/UNIQUE|PRIMARY KEY/i.test(e.message)) {
      throw new Refusal(409, 'Request ' + id + ' has already been decided');
    }
    throw e;
  }
  return { ok: true, status };
}

/* -- allocation ------------------------------------------------------------
   Changing what a centre is entitled to is itself a logged event: the
   current figure and the ledger row that explains it go in one batch. */

async function setAllocation(request, env) {
  const p = await body(request);
  const centreId = text(p.centreId, 40);
  const k = text(p.k, 50);
  need(RE_CENTRE.test(centreId), 'Unknown centre id');
  need(RE_ITEM.test(k), 'Unknown item key: ' + k);
  const qty = count(p.qty, 'Allocation');
  const from = p.from == null ? null : count(p.from, 'Previous allocation');
  const by = text(p.by, 120);
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO allocations (centre_id, item_key, qty, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(centre_id, item_key) DO UPDATE SET qty = excluded.qty, ' +
      'updated_at = excluded.updated_at, updated_by = excluded.updated_by'
    ).bind(centreId, k, qty, now, by),
    env.DB.prepare(
      'INSERT INTO ledger (ts, item_key, type, centre_id, from_qty, to_qty, note, recorded_by) ' +
      "VALUES (?, ?, 'standard', ?, ?, ?, ?, ?)"
    ).bind(now, k, centreId, from, qty, text(p.note, 500), by)
  ]);
  return { ok: true };
}

/* -- router ---------------------------------------------------------------- */

async function health(env) {
  try {
    // Names columns only the current schema has, so a database created from
    // the old per-clinic schema reports itself rather than failing later.
    await env.DB.prepare(
      'SELECT l.centre_id, l.request_id, d.status FROM ledger l, decisions d LIMIT 1').all();
    return 'ready';
  } catch (e) {
    return /no such column/i.test(e.message)
      ? 'outdated — this database has the old per-clinic schema. Create a new one; see server/README.md'
      : 'missing — run the schema.sql step in server/README.md';
  }
}

export default {
  async fetch(request, env) {
    const headers = cors(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/api/health') {
      return json({ ok: true, schema: await health(env), tokenConfigured: Boolean(env.API_TOKEN) },
                  null, headers);
    }

    if (!authorised(request, env)) {
      return json({
        ok: false,
        error: env.API_TOKEN
          ? 'Unauthorised. The Authorization header does not match API_TOKEN.'
          : 'API_TOKEN is not set on this Worker, so every request is refused. ' +
            'Set it with: wrangler secret put API_TOKEN'
      }, { status: 401 }, headers);
    }

    try {
      const get = request.method === 'GET', post = request.method === 'POST';
      const decide = path.match(/^\/api\/requests\/([^/]+)\/decide$/);

      if (get && path === '/api/all') return json(await loadAll(env), null, headers);
      if (post && path === '/api/requests') return json(await submitRequest(request, env), null, headers);
      if (post && decide) {
        return json(await decideRequest(decodeURIComponent(decide[1]), request, env), null, headers);
      }
      if (post && path === '/api/allocation') return json(await setAllocation(request, env), null, headers);

      return json({ ok: false, error: 'Not found: ' + request.method + ' ' + path },
                  { status: 404 }, headers);
    } catch (e) {
      const status = e instanceof Refusal ? e.status : 500;
      return json({ ok: false, error: e.message }, { status }, headers);
    }
  }
};
