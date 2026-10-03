/* ==========================================================================
   requests.js — the instrument admin queue.

   Every request a centre has raised. Submitted ones are the work; decided
   ones are the record. Age is shown rather than the submission date,
   because the number an admin acts on is how long a clinic has been waiting.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;
  var data = null, centres = [], requests = [], itemIndex = {};

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildIndex() {
    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        itemIndex[L.itemKey(set.id, item.no)] = { setName: set.name, item: item };
      });
    });
  }

  function summary(r) {
    var t = L.requestTotals(r);
    var bits = [];
    if (t.ret) bits.push(t.ret + ' to return');
    if (t.iss) bits.push(t.iss + ' to issue');
    return t.lines + ' item' + (t.lines === 1 ? '' : 's') +
           (bits.length ? ' · ' + bits.join(', ') : '');
  }

  function filtered() {
    var fc = document.getElementById('f-centre').value;
    var fs = document.getElementById('f-status').value;
    var q = document.getElementById('q').value.trim().toLowerCase();

    return requests.filter(function (r) {
      if (fc && r.centreId !== fc) return false;
      if (fs && r.status !== fs) return false;
      if (q) {
        var hay = (r.id + ' ' + r.centreName + ' ' + (r.createdBy || '')).toLowerCase();
        // Also search the item names inside the request, so "retractor"
        // finds the request that contains one.
        (r.lines || []).forEach(function (l) {
          var m = itemIndex[l.k];
          if (m) hay += ' ' + m.item.name.toLowerCase();
        });
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      // Waiting work first, then newest.
      if (a.status !== b.status) {
        if (a.status === 'submitted') return -1;
        if (b.status === 'submitted') return 1;
      }
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function render() {
    var rows = filtered();
    var host = document.getElementById('queue');

    var waiting = requests.filter(function (r) { return r.status === 'submitted'; }).length;
    txt('s-waiting', waiting);
    txt('s-total', requests.length);
    txt('s-centres', new Set(requests.map(function (r) { return r.centreId; })).size);
    var oldest = requests.filter(function (r) { return r.status === 'submitted'; })
      .map(function (r) { return L.ageInDays(r.createdAt); });
    txt('s-oldest', oldest.length ? Math.max.apply(null, oldest) + 'd' : '--');
    var card = document.getElementById('s-waiting-card');
    if (card) card.classList.toggle('is-alert', waiting > 0);

    if (!rows.length) {
      host.innerHTML = '<div class="card log-empty">' +
        (requests.length
          ? '<b>No requests match these filters.</b>'
          : '<b>No requests yet.</b><p class="body-sm" style="margin-block-start:var(--space-3)">' +
            'A centre raises one from its <a href="instruments.html">instrument set</a>.</p>') +
        '</div>';
      return;
    }

    var html = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th style="inline-size:170px">Reference</th>' +
      '<th style="inline-size:150px">Centre</th>' +
      '<th>Request</th>' +
      '<th style="inline-size:160px">Raised by</th>' +
      '<th style="inline-size:150px">Status</th>' +
      '<th class="num" style="inline-size:70px">Age</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var st = L.statusOf(r.status);
      html += '<tr>' +
        '<td class="ref mono"><a href="request-detail.html?id=' + encodeURIComponent(r.id) + '">' +
          escapeHtml(r.id) + '</a></td>' +
        '<td>' + escapeHtml(r.centreName || r.centreId) + '</td>' +
        '<td>' + escapeHtml(summary(r)) + '</td>' +
        '<td class="caption">' + escapeHtml(r.createdBy || '--') + '</td>' +
        '<td><span class="badge ' + st.badge + '">' + escapeHtml(st.label) + '</span></td>' +
        '<td class="num numeric">' + L.ageInDays(r.createdAt) + 'd</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    host.innerHTML = html;

    function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  }
  function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  function init(sets, centreList, all) {
    data = sets;
    centres = centreList.centres || [];
    requests = all.requests || [];
    buildIndex();

    var badge = document.getElementById('backendLabel');
    if (badge) {
      badge.textContent = window.Store.label;
      badge.className = 'badge ' +
        (window.Store.name === 'cloudflare' ? 'badge--approved' : 'badge--draft');
    }

    var fc = document.getElementById('f-centre');
    centres.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      fc.appendChild(o);
    });

    ['q', 'f-centre', 'f-status'].forEach(function (id) {
      var e = document.getElementById(id);
      e.addEventListener('input', render);
      e.addEventListener('change', render);
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      ['q', 'f-centre', 'f-status'].forEach(function (id) { document.getElementById(id).value = ''; });
      render();
    });

    render();
  }

  // Data comes from data/bundle.js, not fetch(), so the site also runs by
  // double-clicking the HTML with no server at all.
  window.Store.loadAll()
    .then(function (all) { init(window.MOH_DATA.sets, window.MOH_DATA.centres, all); })
    .catch(function (e) {
      document.getElementById('queue').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not load requests</div>' +
        '<div class="alert__body">' + escapeHtml(e.message) + '</div></div></div>';
    });
})();
