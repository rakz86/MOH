/* ==========================================================================
   inventory.js — what a centre actually holds, against what it should.

   A read-only view. Requesting lives on the instrument sets page; this one
   answers a different question: where does this centre stand right now, and
   what is it short of.

   Two presentations of the same rows, because two different jobs:
     table   scanning and comparing numbers down a column. The default.
     grid    recognising an instrument by shape when you do not know its
             name — which is most people, most of the time.

   The view choice is remembered per browser, because it is a preference
   about how someone reads, not a property of the data.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;
  var VIEW_KEY = 'moh.v3.inventoryView';

  var data = null, centres = [], all = null;
  var centreId = '';
  var view = 'table';

  /* -- context ------------------------------------------------------------ */

  function centreObj() {
    var base = null;
    for (var i = 0; i < centres.length; i++) {
      if (centres[i].id === centreId) { base = centres[i]; break; }
    }
    if (!base) return { id: centreId, name: centreId, allocation: {} };
    return {
      id: base.id, name: base.name, nameAr: base.nameAr,
      allocation: Object.assign({}, base.allocation || {}, (all.allocations || {})[centreId] || {})
    };
  }

  function centreLedger() {
    return (all.ledger || []).filter(function (e) { return e.centreId === centreId; });
  }

  function centreRequests() {
    return (all.requests || []).filter(function (r) { return r.centreId === centreId; });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* -- rows --------------------------------------------------------------- */

  // One flat list, derived once, then filtered. Both views render from this.
  function rows() {
    var c = centreObj(), cl = centreLedger(), creq = centreRequests();
    var out = [];
    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        var k = L.itemKey(set.id, item.no);
        var required = L.allocationFor(c, all.standards || {}, k, item.std);
        var held = L.heldFor(c, all.standards || {}, cl, k, item.std);
        out.push({
          k: k,
          code: (all.codes || {})[k] || item.code || '',
          name: item.name,
          kind: item.kind || 'instrument',
          image: item.image || '',
          setId: set.id,
          setName: set.name,
          required: required,
          held: held,
          variance: held - required,
          pending: L.pendingFor(creq, k)
        });
      });
    });
    return out;
  }

  function filtered(list) {
    var q = document.getElementById('q').value.trim().toLowerCase();
    var fset = document.getElementById('f-set').value;
    var shortOnly = document.getElementById('f-short').checked;

    return list.filter(function (r) {
      if (fset && r.setId !== fset) return false;
      if (shortOnly && r.variance >= 0) return false;
      if (q && (r.name + ' ' + r.code + ' ' + r.setName).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function varianceHtml(r) {
    if (r.variance < 0) return '<span class="flag flag--short">short ' + (-r.variance) + '</span>';
    if (r.variance > 0) return '<span class="flag flag--over">over ' + r.variance + '</span>';
    return '<span class="inv-ok">complete</span>';
  }

  function thumb(r, cls) {
    if (r.image) {
      return '<img class="' + cls + '" src="' + escapeHtml(r.image) + '" alt="" loading="lazy">';
    }
    return window.Glyphs.svg(r.kind, cls);
  }

  /* -- render ------------------------------------------------------------- */

  function render() {
    var list = filtered(rows());
    var host = document.getElementById('inv');

    document.getElementById('resultCount').textContent =
      list.length + (list.length === 1 ? ' item' : ' items');

    if (!centreId) {
      host.innerHTML = '<div class="card log-empty"><b>Choose a centre.</b>' +
        '<p class="body-sm" style="margin-block-start:var(--space-3)">' +
        'Each centre is measured against its own allocation.</p></div>';
      return;
    }
    if (!list.length) {
      host.innerHTML = '<div class="card log-empty"><b>Nothing matches these filters.</b>' +
        '<p class="body-sm" style="margin-block-start:var(--space-3)">' +
        'Try clearing the set filter, or untick the shortfall-only box.</p></div>';
      return;
    }

    host.innerHTML = view === 'grid' ? renderGrid(list) : renderTable(list);
  }

  function renderTable(list) {
    var html = '<div class="table-wrap"><table class="table register"><thead><tr>' +
      '<th class="col-code">Code</th>' +
      '<th style="inline-size:52px"><span class="sr-only">Image</span></th>' +
      '<th>Item</th>' +
      '<th style="inline-size:170px">Set</th>' +
      '<th class="num col-qty">Required</th>' +
      '<th class="num col-qty">Held</th>' +
      '<th style="inline-size:120px">Variance</th>' +
      '</tr></thead><tbody>';

    list.forEach(function (r) {
      html += '<tr class="' + (r.variance < 0 ? 'is-short' : r.variance > 0 ? 'is-over' : '') + '">' +
        '<td class="ref mono">' + escapeHtml(r.code) + '</td>' +
        '<td>' + thumb(r, 'glyph glyph--sm') + '</td>' +
        '<td>' + escapeHtml(r.name) +
          (r.pending.any ? ' <span class="pending-chip">pending</span>' : '') + '</td>' +
        '<td class="caption">' + escapeHtml(r.setName) + '</td>' +
        '<td class="num numeric">' + r.required + '</td>' +
        '<td class="num numeric"><b>' + r.held + '</b></td>' +
        '<td>' + varianceHtml(r) + '</td>' +
        '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function renderGrid(list) {
    var html = '<div class="inv-grid">';
    list.forEach(function (r) {
      html += '<article class="inv-card' +
          (r.variance < 0 ? ' is-short' : r.variance > 0 ? ' is-over' : '') + '">' +
        '<div class="inv-card__art">' + thumb(r, 'glyph glyph--lg') + '</div>' +
        '<div class="inv-card__body">' +
          '<div class="inv-card__code mono">' + escapeHtml(r.code) + '</div>' +
          '<div class="inv-card__name">' + escapeHtml(r.name) + '</div>' +
          '<div class="inv-card__set caption">' + escapeHtml(r.setName) + '</div>' +
        '</div>' +
        '<div class="inv-card__foot">' +
          '<span class="inv-card__count numeric"><b>' + r.held + '</b>' +
            '<span class="text-muted"> / ' + r.required + '</span></span>' +
          varianceHtml(r) +
        '</div>' +
      '</article>';
    });
    return html + '</div>';
  }

  function updateSummary() {
    if (!centreId) {
      ['s-items', 's-required', 's-held', 's-short', 's-complete'].forEach(function (id) {
        var e = document.getElementById(id); if (e) e.textContent = '--';
      });
      return;
    }
    var list = rows();
    var required = 0, held = 0, shortLines = 0, complete = 0;
    list.forEach(function (r) {
      required += r.required;
      held += r.held;
      if (r.variance < 0) shortLines++;
      if (r.variance === 0) complete++;
    });
    txt('s-items', list.length);
    txt('s-required', required);
    txt('s-held', held);
    txt('s-short', shortLines);
    txt('s-complete', Math.round(complete / list.length * 100) + '%');

    var card = document.getElementById('s-short-card');
    if (card) card.classList.toggle('is-alert', shortLines > 0);

    var bar = document.getElementById('s-fill-bar');
    if (bar) bar.style.inlineSize = (required ? Math.min(100, Math.round(held / required * 100)) : 0) + '%';

    function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  }

  function exportCsv() {
    var list = filtered(rows());
    var head = [['Code', 'Item', 'Set', 'Centre', 'Required', 'Held', 'Variance']];
    var name = centreObj().name;
    list.forEach(function (r) {
      head.push([r.code, r.name, r.setName, name, r.required, r.held, r.variance]);
    });
    var csv = head.map(function (row) {
      return row.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inventory-' + (centreObj().id || 'centre') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* -- boot --------------------------------------------------------------- */

  function setView(next) {
    view = next;
    try { localStorage.setItem(VIEW_KEY, next); } catch (e) {}
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.view === next));
    });
    render();
  }

  function init(sets, centreList, snapshot) {
    data = sets;
    centres = centreList.centres || [];
    all = snapshot;

    var badge = document.getElementById('backendLabel');
    if (badge) {
      badge.textContent = window.Store.label;
      badge.className = 'badge ' +
        (window.Store.name === 'cloudflare' ? 'badge--approved' : 'badge--draft');
    }

    var sel = document.getElementById('f-centre');
    centres.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    try {
      var last = localStorage.getItem('moh.v3.lastCentre');
      if (last && centres.some(function (c) { return c.id === last; })) {
        sel.value = last; centreId = last;
      }
    } catch (e) {}
    sel.addEventListener('change', function () {
      centreId = sel.value;
      try { localStorage.setItem('moh.v3.lastCentre', centreId); } catch (e) {}
      updateSummary(); render();
    });

    var fset = document.getElementById('f-set');
    data.sets.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id; o.textContent = s.name;
      fset.appendChild(o);
    });

    ['q', 'f-set', 'f-short'].forEach(function (id) {
      var e = document.getElementById(id);
      e.addEventListener('input', render);
      e.addEventListener('change', render);
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      document.getElementById('q').value = '';
      document.getElementById('f-set').value = '';
      document.getElementById('f-short').checked = false;
      render();
    });
    document.getElementById('btn-csv').addEventListener('click', exportCsv);
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); });
    });

    try { view = localStorage.getItem(VIEW_KEY) || 'table'; } catch (e) {}
    setView(view);
    updateSummary();
  }

  window.Store.loadAll()
    .then(function (snapshot) { init(window.MOH_DATA.sets, window.MOH_DATA.centres, snapshot); })
    .catch(function (e) {
      document.getElementById('inv').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not load the inventory</div>' +
        '<div class="alert__body">' + escapeHtml(e.message) + '</div></div></div>';
    });
})();
