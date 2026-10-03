/* ==========================================================================
   store.js — where the record lives.

   The whole dataset is 78 items across 9 centres, so everything loads in one
   call and the pages derive from a snapshot in memory. Only load and write
   ever await; all the arithmetic in ledger.js stays synchronous.

     loadAll()                    -> { codes, standards, allocations,
                                       requests, ledger }
     submitRequest(request)       -> { ok }
     decideRequest(id, decision)  -> { ok }   writes the ledger on confirm
     saveCodes(changes)           -> { ok }
     setAllocation(...)           -> { ok }   logged, like any other change

   Both adapters keep the same contract: loadAll rejects when the record
   cannot be reached, and every write resolves { ok: false, error } rather
   than rejecting, so a page can keep its draft and say what went wrong.
   The remote adapter talks to server/src/worker.js, which returns the same
   shapes as the local one.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.MOH_CONFIG || { backend: 'local' };

  var K = {
    codes: 'moh.v3.codes',
    standards: 'moh.v3.standards',
    allocations: 'moh.v3.allocations',
    requests: 'moh.v3.requests',
    ledger: 'moh.v3.ledger'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var localStore = {
    name: 'local',
    label: 'this browser',

    loadAll: function () {
      return Promise.resolve({
        codes: read(K.codes, {}),
        standards: read(K.standards, {}),
        allocations: read(K.allocations, {}),
        requests: read(K.requests, []),
        ledger: read(K.ledger, [])
      });
    },

    submitRequest: function (request) {
      var requests = read(K.requests, []);
      requests.push(request);
      return Promise.resolve(write(K.requests, requests)
        ? { ok: true, id: request.id }
        : { ok: false, error: 'Browser storage is unavailable or full' });
    },

    /* A decision is the only thing that moves stock. It does two writes that
       must agree: the request gets its outcome, and the ledger gets one
       append-only row per accepted quantity, tagged with the request that
       authorised it so the movement can always be traced back. */
    decideRequest: function (id, decision) {
      var requests = read(K.requests, []);
      var ledger = read(K.ledger, []);
      var req = null;
      for (var i = 0; i < requests.length; i++) {
        if (requests[i].id === id) { req = requests[i]; break; }
      }
      if (!req) return Promise.resolve({ ok: false, error: 'Request ' + id + ' not found' });
      if (req.status !== 'submitted') {
        return Promise.resolve({ ok: false, error: 'Request ' + id + ' has already been decided' });
      }

      var now = new Date().toISOString();
      req.status = decision.status;
      req.decidedAt = now;
      req.decidedBy = decision.by || '';
      req.decisionNote = decision.note || '';
      req.accepted = decision.accepted || {};

      if (decision.status !== 'rejected') {
        (req.lines || []).forEach(function (l) {
          var a = req.accepted[l.k] || { ret: 0, iss: 0 };
          if (a.ret > 0) {
            ledger.push({ t: now, k: l.k, type: 'return', qty: a.ret,
                          note: l.note || '', by: req.decidedBy,
                          centreId: req.centreId, requestId: req.id });
          }
          if (a.iss > 0) {
            ledger.push({ t: now, k: l.k, type: 'issue', qty: a.iss,
                          note: l.note || '', by: req.decidedBy,
                          centreId: req.centreId, requestId: req.id });
          }
        });
      }

      var ok = write(K.requests, requests) && write(K.ledger, ledger);
      return Promise.resolve(ok ? { ok: true } : { ok: false, error: 'Could not save' });
    },

    saveCodes: function (changes) {
      var codes = read(K.codes, {});
      Object.keys(changes || {}).forEach(function (k) {
        if (changes[k]) codes[k] = changes[k]; else delete codes[k];
      });
      return Promise.resolve(write(K.codes, codes) ? { ok: true } : { ok: false });
    },

    // Changing what a centre is entitled to is itself a logged event.
    setAllocation: function (centreId, k, qty, from, by, note) {
      var allocations = read(K.allocations, {});
      if (!allocations[centreId]) allocations[centreId] = {};
      allocations[centreId][k] = qty;

      var ledger = read(K.ledger, []);
      ledger.push({ t: new Date().toISOString(), k: k, type: 'standard',
                    from: from, to: qty, note: note || '', by: by || '',
                    centreId: centreId });

      var ok = write(K.allocations, allocations) && write(K.ledger, ledger);
      return Promise.resolve(ok ? { ok: true } : { ok: false });
    }
  };

  /* -- remote: the Cloudflare Worker in server/ ---------------------------- */

  function api(path, options) {
    if (!CFG.apiBase) return Promise.reject(new Error('No apiBase configured in config.js'));
    var opts = options || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (CFG.apiToken) opts.headers.Authorization = 'Bearer ' + CFG.apiToken;
    return fetch(CFG.apiBase.replace(/\/$/, '') + path, opts).then(function (r) {
      if (r.status === 401) throw new Error('Rejected by the API — check apiToken in config.js');
      return r.json().catch(function () { return {}; }).then(function (body) {
        // The Worker says why it refused ("already been decided"); pass that
        // on rather than a bare status code.
        if (!r.ok) throw new Error(body.error || ('API ' + r.status + ' on ' + path));
        return body;
      });
    });
  }

  function post(path, payload) {
    return api(path, { method: 'POST', body: JSON.stringify(payload) })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  var remoteStore = {
    name: 'cloudflare',
    label: 'the shared database',
    loadAll: function () { return api('/api/all'); },
    submitRequest: function (r) { return post('/api/requests', r); },
    decideRequest: function (id, d) {
      return post('/api/requests/' + encodeURIComponent(id) + '/decide', d);
    },
    saveCodes: function (c) { return post('/api/codes', c); },
    setAllocation: function (centreId, k, qty, from, by, note) {
      return post('/api/allocation',
        { centreId: centreId, k: k, qty: qty, from: from, by: by, note: note });
    }
  };

  window.Store = CFG.backend === 'cloudflare' ? remoteStore : localStore;
  window.Store.keys = K;
})();
