/* ==========================================================================
   item-log.js — every confirmed movement, across every centre.

   The register shows one centre. This shows all of them, which is the view
   that answers "is this instrument failing everywhere, or just at Amiri?" —
   the question that turns a maintenance nuisance into a procurement case.

   Only CONFIRMED movements appear here. A request that nobody has decided
   has not moved anything, so it belongs in the request queue, not the log.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;
  var data = null, centres = [], ledger = [], itemIndex = {}, centreName = {};

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildIndex() {
    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        itemIndex[L.itemKey(set.id, item.no)] = { setId: set.id, setName: set.name, item: item };
      });
    });
    centres.forEach(function (c) { centreName[c.id] = c.name; });
  }

  function filtered() {
    var q = document.getElementById('q').value.trim().toLowerCase();
    var fset = document.getElementById('f-set').value;
    var ftype = document.getElementById('f-type').value;
    var fcentre = document.getElementById('f-clinic').value;

    return ledger.filter(function (e) {
      var meta = itemIndex[e.k];
      if (!meta) return false;
      if (fset && meta.setId !== fset) return false;
      if (ftype && e.type !== ftype) return false;
      if (fcentre && e.centreId !== fcentre) return false;
      if (q) {
        var hay = (meta.item.name + ' ' + meta.item.code + ' ' + (e.note || '') + ' ' +
                   meta.setName + ' ' + (e.requestId || '') + ' ' + (e.by || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var rows = filtered();
    var host = document.getElementById('log');

    if (!rows.length) {
      host.innerHTML = '<div class="card log-empty">' +
        (ledger.length
          ? '<b>No entries match these filters.</b>'
          : '<b>Nothing confirmed yet.</b><p class="body-sm" style="margin-block-start:var(--space-3)">' +
            'Movements appear here once an instrument admin confirms a request in the ' +
            '<a href="requests.html">request queue</a>.</p>') +
        '</div>';
      summarise(rows);
      return;
    }

    var html = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th style="inline-size:150px">When</th>' +
      '<th style="inline-size:120px">Code</th>' +
      '<th>Item</th>' +
      '<th style="inline-size:140px">Set</th>' +
      '<th style="inline-size:170px">Event</th>' +
      '<th style="inline-size:120px">Centre</th>' +
      '<th style="inline-size:160px">Request</th>' +
      '<th style="inline-size:130px">Confirmed by</th>' +
      '<th>Note</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (e) {
      var meta = itemIndex[e.k];
      var badge = e.type === 'return' ? 'badge--rejected'
                : e.type === 'issue' ? 'badge--approved'
                : 'badge--review';
      html += '<tr>' +
        '<td class="caption" style="white-space:nowrap">' + L.fmtDate(e.t, true) + '</td>' +
        '<td class="ref mono">' + escapeHtml(meta.item.code) + '</td>' +
        '<td>' + escapeHtml(meta.item.name) + '</td>' +
        '<td class="caption">' + escapeHtml(meta.setName) + '</td>' +
        '<td><span class="badge ' + badge + '">' + escapeHtml(L.describe(e)) + '</span></td>' +
        '<td class="caption">' + escapeHtml(centreName[e.centreId] || e.centreId || '—') + '</td>' +
        '<td class="ref mono">' + (e.requestId
            ? '<a href="request-detail.html?id=' + encodeURIComponent(e.requestId) + '">' +
              escapeHtml(e.requestId) + '</a>'
            : '—') + '</td>' +
        '<td class="caption">' + escapeHtml(e.by || '—') + '</td>' +
        '<td class="caption">' + escapeHtml(e.note || '') + '</td>' +
        '</tr>';
    });

    host.innerHTML = html + '</tbody></table></div>';
    summarise(rows);
  }

  function summarise(rows) {
    var ret = 0, iss = 0, std = 0, seen = {};
    rows.forEach(function (e) {
      if (e.type === 'return') ret += e.qty;
      else if (e.type === 'issue') iss += e.qty;
      else if (e.type === 'standard') std++;
      if (e.centreId) seen[e.centreId] = 1;
    });
    txt('l-total', rows.length);
    txt('l-returns', ret);
    txt('l-issues', iss);
    txt('l-standards', std);
    txt('l-clinics', Object.keys(seen).length);
    function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  }

  function exportCsv() {
    var rows = [['When', 'Code', 'Item', 'Set', 'Event', 'Quantity', 'From', 'To',
                 'Centre', 'Request', 'Confirmed by', 'Note']];
    filtered().forEach(function (e) {
      var meta = itemIndex[e.k];
      rows.push([e.t, meta.item.code, meta.item.name, meta.setName, e.type,
        e.qty || '', e.from === undefined ? '' : e.from, e.to === undefined ? '' : e.to,
        centreName[e.centreId] || e.centreId || '', e.requestId || '', e.by || '', e.note || '']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'instrument-item-log.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function init(sets, centreList, all) {
    data = sets;
    centres = centreList.centres || [];
    ledger = (all.ledger || []).slice().sort(function (a, b) {
      return String(b.t).localeCompare(String(a.t));
    });
    buildIndex();

    var badge = document.getElementById('backendLabel');
    if (badge) {
      badge.textContent = window.Store.label;
      badge.className = 'badge ' +
        (window.Store.name === 'cloudflare' ? 'badge--approved' : 'badge--draft');
    }

    var fset = document.getElementById('f-set');
    data.sets.forEach(function (set) {
      var o = document.createElement('option');
      o.value = set.id; o.textContent = set.name;
      fset.appendChild(o);
    });

    var fc = document.getElementById('f-clinic');
    centres.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      fc.appendChild(o);
    });

    ['q', 'f-set', 'f-type', 'f-clinic'].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      ['q', 'f-set', 'f-type', 'f-clinic'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      render();
    });
    document.getElementById('btn-csv').addEventListener('click', exportCsv);

    render();
  }

  // Data comes from data/bundle.js, not fetch(), so the site also runs by
  // double-clicking the HTML with no server at all.
  window.Store.loadAll()
    .then(function (all) { init(window.MOH_DATA.sets, window.MOH_DATA.centres, all); })
    .catch(function (e) {
      document.getElementById('log').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not load the log</div>' +
        '<div class="alert__body">' + escapeHtml(e.message) + '</div></div></div>';
    });
})();
