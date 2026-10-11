/* ==========================================================================
   instruments.js — a centre's instrument set, and the request it is building.

   The + and − buttons do not move stock. They build a REQUEST. Allocation
   and Held do not change until an instrument admin confirms that the damaged
   items came back and the replacements went out — which happens on the
   review page, not here.

   That is the whole discipline: the number on this screen and the number in
   the store room never disagree, because nothing here can change the latter.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;

  var data = null;          // instrument sets
  var centres = [];
  var standards = {}, allocations = {}, requests = [], ledger = [];
  var centreId = '';

  // Uncommitted request lines, in memory only. { "set:no": {ret, iss, note} }
  var draft = {};

  /* -- context ------------------------------------------------------------ */

  function recordedBy() {
    var el = document.getElementById('f-by');
    return el ? el.value.trim() : '';
  }

  function centreObj() {
    var base = null;
    for (var i = 0; i < centres.length; i++) {
      if (centres[i].id === centreId) { base = centres[i]; break; }
    }
    if (!base) return { id: centreId, name: centreId, allocation: {} };
    // A centre's own figure from the data file, then anything an admin has
    // since changed. The admin override wins.
    return {
      id: base.id,
      name: base.name,
      nameAr: base.nameAr,
      allocation: Object.assign({}, base.allocation || {}, allocations[centreId] || {})
    };
  }

  function centreLedger() {
    return ledger.filter(function (e) { return e.centreId === centreId; });
  }

  function centreRequests() {
    return requests.filter(function (r) { return r.centreId === centreId; });
  }

  /* -- draft -------------------------------------------------------------- */

  function line(k) {
    if (!draft[k]) draft[k] = { ret: 0, iss: 0, note: '' };
    return draft[k];
  }

  function draftLines() {
    return Object.keys(draft)
      .filter(function (k) { return draft[k].ret > 0 || draft[k].iss > 0; })
      .map(function (k) {
        return { k: k, ret: draft[k].ret, iss: draft[k].iss, note: (draft[k].note || '').trim() };
      });
  }

  function flash(msg, tone) {
    var el = document.getElementById('saveState');
    if (!el) return;
    el.textContent = msg;
    el.style.color = tone === 'bad' ? 'var(--color-danger-text)' : 'var(--color-success-text)';
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { el.textContent = ''; }, 4000);
  }

  /* -- rendering ---------------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // − [n] + . A stepper rather than a text field because the quantities are
  // small and the hands using this are often gloved.
  function stepper(kind, value, label, onChange) {
    var wrap = el('div', 'stepper-ctl stepper-ctl--' + kind);

    var minus = el('button', 'stepper-ctl__btn', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'Decrease ' + label);

    var out = el('span', 'stepper-ctl__value numeric', String(value));
    out.setAttribute('aria-live', 'polite');
    out.setAttribute('aria-label', label);

    var plus = el('button', 'stepper-ctl__btn', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'Increase ' + label);

    function step(by) {
      var next = Math.max(0, (parseInt(out.textContent, 10) || 0) + by);
      out.textContent = String(next);
      wrap.classList.toggle('is-set', next > 0);
      minus.disabled = next === 0;
      onChange(next);
    }

    minus.disabled = value === 0;
    wrap.classList.toggle('is-set', value > 0);
    minus.addEventListener('click', function () { step(-1); });
    plus.addEventListener('click', function () { step(1); });

    wrap.appendChild(minus);
    wrap.appendChild(out);
    wrap.appendChild(plus);
    return wrap;
  }

  function renderRow(set, item) {
    var k = L.itemKey(set.id, item.no);
    var c = centreObj();
    var cl = centreLedger();
    var d = line(k);

    var alloc = L.allocationFor(c, standards, k, item.std);
    var held = L.heldFor(c, standards, cl, k, item.std);
    var deficit = L.deficitFor(c, standards, cl, k, item.std);
    var pending = L.pendingFor(centreRequests(), k);

    var tr = document.createElement('tr');
    tr.dataset.k = k;

    tr.appendChild(el('td', 'col-no numeric', String(item.no)));

    // Code — the set's two-letter prefix and the item number, fixed in the
    // instrument set data so every centre and every printout uses the same one.
    tr.appendChild(el('td', 'col-code mono', item.code));

    var tdName = el('td', 'col-name', item.name);
    tr.appendChild(tdName);

    tr.appendChild(el('td', 'num numeric col-qty col-alloc', String(alloc)));

    var tdHeld = el('td', 'num numeric col-qty col-held');
    tdHeld.appendChild(el('span', '', String(held)));
    if (deficit > 0) tdHeld.appendChild(el('span', 'flag flag--short', '-' + deficit));
    tr.appendChild(tdHeld);

    // Awaiting confirmation. Shown so a clinic does not ask twice for the
    // same thing, but deliberately not counted into Held.
    var tdPending = el('td', 'num col-qty col-pending');
    if (pending.any) {
      var bits = [];
      if (pending.ret) bits.push('−' + pending.ret);
      if (pending.iss) bits.push('+' + pending.iss);
      var p = el('span', 'pending-chip', bits.join(' '));
      p.title = 'Awaiting confirmation on ' + pending.refs.join(', ');
      tdPending.appendChild(p);
    } else {
      tdPending.appendChild(el('span', 'text-muted', '—'));
    }
    tr.appendChild(tdPending);

    var tdRet = el('td', 'num col-step');
    tdRet.appendChild(stepper('return', d.ret, 'return damaged, ' + item.name, function (v) {
      d.ret = v; refreshRow(tr, set, item); updateSummary();
    }));
    tr.appendChild(tdRet);

    var tdIss = el('td', 'num col-step');
    tdIss.appendChild(stepper('issue', d.iss, 'issue new, ' + item.name, function (v) {
      d.iss = v; refreshRow(tr, set, item); updateSummary();
    }));
    tr.appendChild(tdIss);

    var tdLog = el('td', 'col-log');
    var history = L.historyFor([], cl, k);
    var lb = el('button', 'log-btn');
    lb.type = 'button';
    lb.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M8 4v4l2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.6"/></svg>' +
      '<span>' + history.length + '</span>';
    lb.setAttribute('aria-label', 'History for ' + item.name + ', ' + history.length + ' entries');
    if (!history.length) lb.classList.add('is-empty');
    lb.addEventListener('click', function () { openLog(set, item, k, history); });
    tdLog.appendChild(lb);
    tr.appendChild(tdLog);

    var tdNote = el('td', 'col-comment');
    var ni = el('input', 'input cell-input');
    ni.type = 'text';
    ni.value = d.note || '';
    ni.placeholder = 'Reason, condition…';
    ni.setAttribute('aria-label', 'Note, ' + item.name);
    ni.addEventListener('input', function () { d.note = ni.value; });
    tdNote.appendChild(ni);
    tr.appendChild(tdNote);

    refreshRow(tr, set, item);
    return tr;
  }

  function refreshRow(tr, set, item) {
    var k = L.itemKey(set.id, item.no);
    var d = line(k);
    tr.classList.toggle('is-pending', d.ret > 0 || d.iss > 0);
  }

  function renderSet(set) {
    var section = el('section', 'set');
    section.id = 'set-' + set.id;

    var head = el('div', 'set__head');
    head.innerHTML =
      '<h2 class="set__name">' + set.name + '</h2>' +
      '<span class="set__ar" lang="ar" dir="rtl">' + set.nameAr + '</span>' +
      '<span class="set__count caption">' + set.items.length + ' items</span>';
    section.appendChild(head);

    var wrap = el('div', 'table-wrap');
    var table = el('table', 'table register');
    table.innerHTML =
      '<thead><tr>' +
        '<th class="col-no">No.</th>' +
        '<th class="col-code">Code</th>' +
        '<th>Item description</th>' +
        '<th class="num col-qty">Allocation</th>' +
        '<th class="num col-qty">Held<span class="th-sub">now</span></th>' +
        '<th class="num col-qty">Pending</th>' +
        '<th class="num col-step">Return<span class="th-sub">damaged</span></th>' +
        '<th class="num col-step">Issue<span class="th-sub">new</span></th>' +
        '<th class="col-log">Log</th>' +
        '<th class="col-comment">Note</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    set.items.forEach(function (item) { tbody.appendChild(renderRow(set, item)); });
    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  /* -- item log ----------------------------------------------------------- */

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function openLog(set, item, k, history) {
    var box = el('div', 'dialog log-dialog');
    box.tabIndex = -1;
    var code = '<span class="mono caption">' + escapeHtml(item.code) + '</span> · ';
    var html =
      '<div class="dialog__title">' + escapeHtml(item.name) + '</div>' +
      '<p class="caption" style="margin-block-end:var(--space-5)">' + code +
        escapeHtml(set.name) + ' · item ' + item.no + ' · ' + escapeHtml(centreObj().name) + '</p>';

    if (!history.length) {
      html += '<p class="body-sm text-secondary">No confirmed movement for this item at this centre yet. ' +
              'Entries appear once an instrument admin confirms a request.</p>';
    } else {
      html += '<ol class="log-list">';
      history.forEach(function (e) {
        html += '<li class="log-entry log-entry--' + e.type + '">' +
          '<div class="log-entry__head">' +
            '<span class="log-entry__what">' + escapeHtml(L.describe(e)) + '</span>' +
            '<span class="log-entry__when caption">' + L.fmtDate(e.t, true) + '</span>' +
          '</div>' +
          '<div class="caption">' +
            (e.requestId ? 'Request ' + escapeHtml(e.requestId) + ' · ' : '') +
            'confirmed by ' + escapeHtml(e.by || 'unknown') +
          '</div>' +
          (e.note ? '<div class="log-entry__note">' + escapeHtml(e.note) + '</div>' : '') +
        '</li>';
      });
      html += '</ol>';
    }
    html += '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Close</button></div>';
    box.innerHTML = html;

    var close = window.dsDialog.open(box);
    box.querySelector('[data-close]').addEventListener('click', close);
  }

  /* -- submit ------------------------------------------------------------- */

  function submit() {
    var lines = draftLines();
    if (!lines.length) return;
    if (!centreId) { flash('Choose a centre first', 'bad'); return; }

    var by = recordedBy();
    if (!by) {
      flash('Enter who is raising this request', 'bad');
      var byEl = document.getElementById('f-by');
      if (byEl) byEl.focus();
      return;
    }

    var req = {
      id: L.newRequestId(),
      centreId: centreId,
      centreName: centreObj().name,
      createdAt: new Date().toISOString(),
      createdBy: by,
      status: 'submitted',
      lines: lines
    };

    var btn = document.getElementById('btn-submit');
    btn.disabled = true;
    flash('Submitting…');

    window.Store.submitRequest(req).then(function (res) {
      if (!res || !res.ok) {
        // The draft is kept on failure. Losing a damage report because the
        // save failed would be worse than the failure itself.
        flash((res && res.error) || 'Could not submit', 'bad');
        updateSummary();
        return;
      }
      draft = {};
      return reload().then(function () {
        flash('Request ' + req.id + ' submitted — awaiting confirmation');
        var banner = document.getElementById('submittedBanner');
        if (banner) {
          banner.hidden = false;
          banner.querySelector('[data-ref]').textContent = req.id;
        }
      });
    });
  }

  function discard() {
    if (!draftLines().length) return;
    if (!confirm('Clear the quantities you have not submitted yet?')) return;
    draft = {};
    renderAll();
  }

  /* -- summary ------------------------------------------------------------ */

  function updateSummary() {
    if (!data) return;
    var c = centreObj(), cl = centreLedger(), creq = centreRequests();
    var items = 0, alloc = 0, held = 0, deficit = 0, pendingLines = 0;

    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        var k = L.itemKey(set.id, item.no);
        items++;
        alloc += L.allocationFor(c, standards, k, item.std);
        held += L.heldFor(c, standards, cl, k, item.std);
        deficit += L.deficitFor(c, standards, cl, k, item.std);
        if (L.pendingFor(creq, k).any) pendingLines++;
      });
    });

    txt('s-items', items);
    txt('s-alloc', alloc);
    txt('s-held', held);
    txt('s-deficit', deficit);
    txt('s-pending', pendingLines);

    var dcard = document.getElementById('s-deficit-card');
    if (dcard) dcard.classList.toggle('is-alert', deficit > 0);

    var lines = draftLines();
    var totalRet = 0, totalIss = 0;
    lines.forEach(function (l) { totalRet += l.ret; totalIss += l.iss; });

    var btn = document.getElementById('btn-submit');
    var cnt = document.getElementById('draftCount');
    if (btn) btn.disabled = lines.length === 0;
    var dbtn = document.getElementById('btn-discard');
    if (dbtn) dbtn.disabled = lines.length === 0;
    if (cnt) {
      cnt.textContent = lines.length
        ? lines.length + ' item' + (lines.length > 1 ? 's' : '') +
          ' · ' + totalRet + ' to return, ' + totalIss + ' to issue'
        : 'Nothing requested yet';
    }

    function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  }

  /* -- export ------------------------------------------------------------- */

  function exportCsv() {
    var c = centreObj(), cl = centreLedger(), creq = centreRequests();
    var rows = [['Set', 'No', 'Code', 'Item description', 'Allocation', 'Held', 'Deficit', 'Pending return', 'Pending issue']];
    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        var k = L.itemKey(set.id, item.no);
        var p = L.pendingFor(creq, k);
        rows.push([set.name, item.no, item.code, item.name,
          L.allocationFor(c, standards, k, item.std),
          L.heldFor(c, standards, cl, k, item.std),
          L.deficitFor(c, standards, cl, k, item.std),
          p.ret, p.iss]);
      });
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
    a.download = 'instruments-' + (c.id || 'centre') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* -- boot --------------------------------------------------------------- */

  function renderAll() {
    var host = document.getElementById('sets');
    host.innerHTML = '';
    if (!centreId) {
      host.innerHTML = '<div class="card log-empty"><b>Choose a centre to begin.</b>' +
        '<p class="body-sm" style="margin-block-start:var(--space-3)">' +
        'Each centre has its own allocation and its own history.</p></div>';
      updateSummary();
      return;
    }
    data.sets.forEach(function (s) { host.appendChild(renderSet(s)); });
    updateSummary();
  }

  function reload() {
    return window.Store.loadAll().then(function (all) {
      standards = all.standards || {};
      allocations = all.allocations || {};
      requests = all.requests || [];
      ledger = all.ledger || [];
      renderAll();
    }).catch(function (e) {
      document.getElementById('sets').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not reach the record</div>' +
        '<div class="alert__body">' + escapeHtml(e.message) + '</div></div></div>';
    });
  }

  function switchCentre() {
    if (draftLines().length &&
        !confirm('You have quantities that have not been submitted. Switching centre will clear them.')) {
      document.getElementById('f-centre').value = centreId;
      return;
    }
    draft = {};
    centreId = document.getElementById('f-centre').value;
    try { localStorage.setItem('moh.v3.lastCentre', centreId); } catch (e) {}
    var banner = document.getElementById('submittedBanner');
    if (banner) banner.hidden = true;
    renderAll();
  }

  function init(sets, centreList) {
    data = sets;
    centres = centreList.centres || [];

    document.getElementById('f-version').textContent = data.form.version;

    var badge = document.getElementById('backendLabel');
    if (badge) {
      badge.textContent = window.Store.label;
      badge.className = 'badge ' +
        (window.Store.name === 'cloudflare' ? 'badge--approved' : 'badge--draft');
    }

    var sel = document.getElementById('f-centre');
    centres.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    try {
      var last = localStorage.getItem('moh.v3.lastCentre');
      if (last && centres.some(function (c) { return c.id === last; })) {
        sel.value = last;
        centreId = last;
      }
    } catch (e) {}
    sel.addEventListener('change', switchCentre);

    var by = document.getElementById('f-by');
    if (by) {
      try { by.value = localStorage.getItem('moh.v3.recordedBy') || ''; } catch (e) {}
      by.addEventListener('change', function () {
        try { localStorage.setItem('moh.v3.recordedBy', by.value.trim()); } catch (e) {}
      });
    }

    document.getElementById('btn-submit').addEventListener('click', submit);
    document.getElementById('btn-discard').addEventListener('click', discard);
    document.getElementById('btn-csv').addEventListener('click', exportCsv);
    document.getElementById('btn-print').addEventListener('click', function () { window.print(); });

    window.addEventListener('beforeunload', function (e) {
      if (!draftLines().length) return;
      e.preventDefault();
      e.returnValue = '';
    });

    return reload();
  }

  // Data comes from data/bundle.js, not fetch(), so the site also runs by
  // double-clicking the HTML with no server at all.
  Promise.resolve()
    .then(function () { return init(window.MOH_DATA.sets, window.MOH_DATA.centres); })
    .catch(function (e) {
      document.getElementById('sets').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not load the data</div>' +
        '<div class="alert__body">' + e.message + ' — this page must be served over HTTP.</div></div></div>';
    });
})();
