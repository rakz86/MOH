/* ==========================================================================
   demo-setup.js — presenter tools. NOT part of the service.

   Seeds a believable state so a demonstration opens on something that looks
   like a service in use rather than 78 rows of zeroes. Deliberately kept on
   its own page and out of the app code: nothing in instruments.js, requests.js
   or item-log.js knows this file exists, so it cannot leak into the real
   product by accident.

   The story it sets up, which is also the order worth demonstrating in:

     Amiri        healthy. Returns came back, replacements went out.
     Jahra        in deficit. Returns accepted, replacements not yet issued.
     Farwaniya    a request sitting in the queue, waiting on an admin.
     Taima        a smaller centre, on a reduced allocation.
   ========================================================================== */
(function () {
  'use strict';

  var K = window.Store.keys;

  function daysAgo(n, hour) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour || 10, (n * 7) % 60, 0, 0);
    return d.toISOString();
  }

  // Taima is a smaller centre, so it holds fewer of the high-count items.
  var ALLOCATIONS = {
    taima: {
      'diagnostic:1': 3,
      'diagnostic:2': 3,
      'surgical:5': 2,
      'extraction:11': 2
    }
  };

  var LEDGER = [
    // Amiri — damaged items returned, replacements issued. Net healthy.
    { t: daysAgo(26, 9),  k: 'diagnostic:1',    type: 'return', qty: 2, centreId: 'amiri',
      by: 'H. Al-Otaibi', requestId: 'REQ-20260905-1184', note: 'Cracked during sterilisation' },
    { t: daysAgo(26, 9),  k: 'diagnostic:1',    type: 'issue',  qty: 2, centreId: 'amiri',
      by: 'H. Al-Otaibi', requestId: 'REQ-20260905-1184', note: 'Cracked during sterilisation' },
    { t: daysAgo(12, 11), k: 'surgical:5',      type: 'return', qty: 1, centreId: 'amiri',
      by: 'M. Al-Fahad',  requestId: 'REQ-20260919-4420', note: 'Hinge seized' },
    { t: daysAgo(12, 11), k: 'surgical:5',      type: 'issue',  qty: 1, centreId: 'amiri',
      by: 'M. Al-Fahad',  requestId: 'REQ-20260919-4420', note: 'Hinge seized' },

    // Jahra — returns accepted, replacements not yet issued. Shows a deficit.
    { t: daysAgo(9, 10),  k: 'extraction:11',   type: 'return', qty: 2, centreId: 'jahra',
      by: 'H. Al-Otaibi', requestId: 'REQ-20260922-7731', note: 'Tips bent beyond repair' },
    { t: daysAgo(9, 10),  k: 'microsurgery:16', type: 'return', qty: 1, centreId: 'jahra',
      by: 'H. Al-Otaibi', requestId: 'REQ-20260922-7731', note: 'Blade no longer meets' },

    // Adan — a straightforward confirmed issue.
    { t: daysAgo(4, 13),  k: 'surgical:20',     type: 'issue',  qty: 1, centreId: 'adan',
      by: 'M. Al-Fahad',  requestId: 'REQ-20260927-2093', note: 'Additional theatre opened' }
  ];

  var REQUESTS = [
    { id: 'REQ-20260905-1184', centreId: 'amiri', centreName: 'Amiri',
      createdAt: daysAgo(29, 8), createdBy: 'Dr. N. Al-Rashid', status: 'confirmed',
      decidedAt: daysAgo(26, 9), decidedBy: 'H. Al-Otaibi',
      decisionNote: 'Both accepted, replacements issued same day',
      lines: [{ k: 'diagnostic:1', ret: 2, iss: 2, note: 'Cracked during sterilisation' }],
      accepted: { 'diagnostic:1': { ret: 2, iss: 2 } } },

    { id: 'REQ-20260919-4420', centreId: 'amiri', centreName: 'Amiri',
      createdAt: daysAgo(14, 9), createdBy: 'Dr. N. Al-Rashid', status: 'confirmed',
      decidedAt: daysAgo(12, 11), decidedBy: 'M. Al-Fahad', decisionNote: '',
      lines: [{ k: 'surgical:5', ret: 1, iss: 1, note: 'Hinge seized' }],
      accepted: { 'surgical:5': { ret: 1, iss: 1 } } },

    { id: 'REQ-20260922-7731', centreId: 'jahra', centreName: 'Jahra',
      createdAt: daysAgo(11, 8), createdBy: 'Dr. S. Al-Mutairi', status: 'partial',
      decidedAt: daysAgo(9, 10), decidedBy: 'H. Al-Otaibi',
      decisionNote: 'Returns accepted. No stock to replace them yet.',
      lines: [
        { k: 'extraction:11', ret: 2, iss: 2, note: 'Tips bent beyond repair' },
        { k: 'microsurgery:16', ret: 1, iss: 1, note: 'Blade no longer meets' }
      ],
      accepted: { 'extraction:11': { ret: 2, iss: 0 }, 'microsurgery:16': { ret: 1, iss: 0 } } },

    { id: 'REQ-20260927-2093', centreId: 'adan', centreName: 'Adan',
      createdAt: daysAgo(6, 12), createdBy: 'Dr. A. Al-Enezi', status: 'confirmed',
      decidedAt: daysAgo(4, 13), decidedBy: 'M. Al-Fahad', decisionNote: '',
      lines: [{ k: 'surgical:20', ret: 0, iss: 1, note: 'Additional theatre opened' }],
      accepted: { 'surgical:20': { ret: 0, iss: 1 } } },

    // The one still waiting. This is what makes the admin queue worth opening.
    { id: 'REQ-20260930-5508', centreId: 'farwaniya', centreName: 'Farwaniya',
      createdAt: daysAgo(2, 9), createdBy: 'Dr. F. Al-Ajmi', status: 'submitted',
      lines: [
        { k: 'diagnostic:2', ret: 1, iss: 1, note: 'Markings worn illegible' },
        { k: 'surgical:5', ret: 2, iss: 2, note: 'Both seized' },
        { k: 'extraction:24', ret: 0, iss: 1, note: 'Second set needed for Saturday list' }
      ] }
  ];

  function put(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function status(msg, tone) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.style.color = tone === 'bad' ? 'var(--color-danger-text)'
                   : tone === 'good' ? 'var(--color-success-text)'
                   : 'var(--color-text-secondary)';
  }

  function counts() {
    function n(key, empty) {
      try { return JSON.parse(localStorage.getItem(key) || empty); }
      catch (e) { return JSON.parse(empty); }
    }
    var reqs = n(K.requests, '[]');
    var led = n(K.ledger, '[]');
    var alloc = n(K.allocations, '{}');
    document.getElementById('c-requests').textContent = reqs.length;
    document.getElementById('c-waiting').textContent =
      reqs.filter(function (r) { return r.status === 'submitted'; }).length;
    document.getElementById('c-ledger').textContent = led.length;
    document.getElementById('c-alloc').textContent = Object.keys(alloc).length;
  }

  function seed() {
    var ok = put(K.allocations, ALLOCATIONS) &&
             put(K.ledger, LEDGER) &&
             put(K.requests, REQUESTS);
    try { localStorage.setItem('moh.v3.lastCentre', 'amiri'); } catch (e) {}
    counts();
    status(ok ? 'Demo data loaded. Open the instrument sets and pick a centre.'
              : 'Could not write to browser storage.', ok ? 'good' : 'bad');
  }

  function wipe() {
    if (!confirm('Remove all requests, movements and allocations from this browser?')) return;
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf('moh.') === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    counts();
    status('Cleared. Every centre is back to a full allocation with no history.', 'good');
  }

  document.getElementById('btn-seed').addEventListener('click', seed);
  document.getElementById('btn-wipe').addEventListener('click', wipe);
  counts();
})();
