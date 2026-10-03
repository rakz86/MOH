/* ==========================================================================
   request-detail.js — review one request and decide it.

   THIS IS THE ONLY PLACE STOCK MOVES. Confirming here is what writes the
   ledger and changes what a centre holds. A clinic can ask; only an admin
   can make it true.

   Each line is confirmed individually, because the realistic case is partial:
   three were sent back, two were accepted, one was deemed repairable. The
   accepted figure defaults to what was asked, so the common case is one
   click, and the exception is still possible.
   ========================================================================== */
(function () {
  'use strict';

  var L = window.Ledger;
  var data = null, centres = [], all = null, req = null, itemIndex = {};
  var accepted = {};     // { itemKey: { ret, iss } }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function centreObj(id) {
    var base = null;
    for (var i = 0; i < centres.length; i++) if (centres[i].id === id) { base = centres[i]; break; }
    if (!base) return { id: id, name: id, allocation: {} };
    return {
      id: base.id, name: base.name, nameAr: base.nameAr,
      allocation: Object.assign({}, base.allocation || {}, (all.allocations || {})[id] || {})
    };
  }

  function centreLedger(id) {
    return (all.ledger || []).filter(function (e) { return e.centreId === id; });
  }

  function num(v) { return Math.max(0, parseInt(v, 10) || 0); }

  /* -- render ------------------------------------------------------------- */

  function render() {
    var host = document.getElementById('detail');
    var st = L.statusOf(req.status);
    var c = centreObj(req.centreId);
    var cl = centreLedger(req.centreId);
    var decided = req.status !== 'submitted';

    var head =
      '<div class="panel__header">' +
        '<div>' +
          '<div class="cluster" style="--cluster-gap:var(--space-3);margin-block-end:var(--space-2)">' +
            '<span class="ref mono" style="font-size:var(--text-sm)">' + escapeHtml(req.id) + '</span>' +
            '<span class="badge ' + st.badge + '">' + escapeHtml(st.label) + '</span>' +
          '</div>' +
          '<h1 class="heading-4">' + escapeHtml(c.name) + '</h1>' +
          '<div class="caption" style="margin-block-start:var(--space-2)">Raised ' +
            L.fmtDate(req.createdAt, true) + ' by ' + escapeHtml(req.createdBy || 'unknown') +
            (decided ? ' · decided ' + L.fmtDate(req.decidedAt, true) +
                       ' by ' + escapeHtml(req.decidedBy || 'unknown') : '') +
          '</div>' +
        '</div>' +
      '</div>';

    // Seed every line with what was asked BEFORE any input handler runs.
    // Otherwise typing in one field creates the line at zero and silently
    // discards the quantity in the other.
    (req.lines || []).forEach(function (l) {
      if (!accepted[l.k]) accepted[l.k] = { ret: l.ret || 0, iss: l.iss || 0 };
    });

    var lines = '<div class="panel__body" style="padding:0">';
    (req.lines || []).forEach(function (l) {
      var meta = itemIndex[l.k];
      if (!meta) return;
      var alloc = L.allocationFor(c, all.standards || {}, l.k, meta.item.std);
      var held = L.heldFor(c, all.standards || {}, cl, l.k, meta.item.std);
      var a = accepted[l.k] || { ret: l.ret || 0, iss: l.iss || 0 };

      var asked = [];
      if (l.ret) asked.push('return ' + l.ret);
      if (l.iss) asked.push('issue ' + l.iss);

      lines += '<div class="req-line" data-k="' + escapeHtml(l.k) + '">' +
        '<div>' +
          '<div class="req-line__name">' + escapeHtml(meta.item.name) + '</div>' +
          '<div class="req-line__meta">' + escapeHtml(meta.setName) +
            ' · allocation ' + alloc + ' · held ' + held +
            (l.note ? ' · ' + escapeHtml(l.note) : '') + '</div>' +
        '</div>' +
        '<div class="req-line__asked">asked: ' + escapeHtml(asked.join(', ')) + '</div>';

      if (decided) {
        var da = (req.accepted || {})[l.k] || { ret: 0, iss: 0 };
        var got = [];
        if (da.ret) got.push('returned ' + da.ret);
        if (da.iss) got.push('issued ' + da.iss);
        lines += '<div class="req-line__asked"><b>' +
          escapeHtml(got.length ? got.join(', ') : 'nothing accepted') + '</b></div>';
      } else {
        lines += '<div class="req-line__accept">';
        if (l.ret) {
          lines += '<label for="ret-' + escapeHtml(l.k) + '">accept return</label>' +
            '<input class="input result__qty numeric" id="ret-' + escapeHtml(l.k) + '" ' +
            'data-acc="ret" value="' + a.ret + '" inputmode="numeric" ' +
            'style="min-block-size:var(--control-height-sm);inline-size:60px" ' +
            'aria-label="Accept return quantity for ' + escapeHtml(meta.item.name) + '">';
        }
        if (l.iss) {
          lines += '<label for="iss-' + escapeHtml(l.k) + '">issue</label>' +
            '<input class="input result__qty numeric" id="iss-' + escapeHtml(l.k) + '" ' +
            'data-acc="iss" value="' + a.iss + '" inputmode="numeric" ' +
            'style="min-block-size:var(--control-height-sm);inline-size:60px" ' +
            'aria-label="Issue quantity for ' + escapeHtml(meta.item.name) + '">';
        }
        lines += '</div>';
      }
      lines += '</div>';
    });
    lines += '</div>';

    var footer = '';
    if (decided) {
      footer = '<div class="panel__footer">' +
        '<span class="caption">' +
          (req.decisionNote ? escapeHtml(req.decisionNote) : 'No note recorded') +
        '</span></div>';
    } else {
      footer = '<div class="panel__footer" style="flex-wrap:wrap;gap:var(--space-4)">' +
        '<div class="field" style="flex:1;min-width:220px;margin:0">' +
          '<label class="field__label" for="d-by">Confirmed by</label>' +
          '<input class="input" id="d-by" placeholder="Your name" autocomplete="off" ' +
            'style="min-block-size:var(--control-height-sm)">' +
        '</div>' +
        '<div class="field" style="flex:2;min-width:240px;margin:0">' +
          '<label class="field__label" for="d-note">Note</label>' +
          '<input class="input" id="d-note" placeholder="Optional" ' +
            'style="min-block-size:var(--control-height-sm)">' +
        '</div>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn--danger" id="btn-reject" type="button">Reject</button>' +
        '<button class="btn btn--primary" id="btn-confirm" type="button">Confirm &amp; update stock</button>' +
      '</div>';
    }

    host.innerHTML = '<div class="panel">' + head + lines + footer + '</div>' +
      (decided ? '' :
        '<p class="caption" style="margin-block-start:var(--space-4);max-width:var(--measure-prose)">' +
        'Confirming writes to the ledger and changes what this centre holds. ' +
        'It cannot be undone &mdash; a correction is a new request.</p>');

    if (decided) return;

    host.querySelectorAll('[data-acc]').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/[^0-9]/g, '');
        var k = input.closest('.req-line').dataset.k;
        accepted[k][input.dataset.acc] = num(input.value);
      });
    });
    document.getElementById('btn-confirm').addEventListener('click', function () { decide('confirmed'); });
    document.getElementById('btn-reject').addEventListener('click', function () { decide('rejected'); });
  }

  /* -- decide ------------------------------------------------------------- */

  function decide(status) {
    var by = document.getElementById('d-by').value.trim();
    if (!by) {
      alert('Enter who is confirming this. The ledger records it against your name.');
      document.getElementById('d-by').focus();
      return;
    }

    var note = document.getElementById('d-note').value.trim();

    if (status === 'rejected') {
      if (!confirm('Reject ' + req.id + '? No stock will move.')) return;
    } else {
      // Guard: render() seeds these, but a line it skipped must not commit
      // as an unintended zero.
      (req.lines || []).forEach(function (l) {
        if (!accepted[l.k]) accepted[l.k] = { ret: l.ret || 0, iss: l.iss || 0 };
      });
      var totalRet = 0, totalIss = 0;
      Object.keys(accepted).forEach(function (k) {
        totalRet += accepted[k].ret; totalIss += accepted[k].iss;
      });
      if (!totalRet && !totalIss) {
        alert('Nothing is being accepted. Reject the request instead, or enter a quantity.');
        return;
      }
      if (!confirm('Confirm ' + req.id + '?\n\n' +
                   totalRet + ' returned, ' + totalIss + ' issued.\n\n' +
                   'This writes the ledger and changes what ' +
                   centreObj(req.centreId).name + ' holds. It cannot be undone.')) return;
      // A partial confirmation is recorded as such, so the queue shows at a
      // glance that something was not fully met.
      var full = (req.lines || []).every(function (l) {
        var a = accepted[l.k];
        return a.ret === (l.ret || 0) && a.iss === (l.iss || 0);
      });
      status = full ? 'confirmed' : 'partial';
    }

    var btns = document.querySelectorAll('#btn-confirm, #btn-reject');
    btns.forEach(function (b) { b.disabled = true; });

    window.Store.decideRequest(req.id, {
      status: status, by: by, note: note,
      accepted: status === 'rejected' ? {} : accepted
    }).then(function (res) {
      if (!res || !res.ok) {
        alert((res && res.error) || 'Could not save the decision');
        btns.forEach(function (b) { b.disabled = false; });
        return;
      }
      window.location.reload();
    });
  }

  /* -- boot --------------------------------------------------------------- */

  function init(sets, centreList, snapshot) {
    data = sets;
    centres = centreList.centres || [];
    all = snapshot;

    data.sets.forEach(function (set) {
      set.items.forEach(function (item) {
        itemIndex[L.itemKey(set.id, item.no)] = { setName: set.name, item: item };
      });
    });

    var id = qs('id');
    var list = all.requests || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { req = list[i]; break; }

    if (!req) {
      document.getElementById('detail').innerHTML =
        '<div class="card log-empty"><b>' +
        (id ? 'Request ' + escapeHtml(id) + ' was not found.' : 'No request chosen.') +
        '</b><p class="body-sm" style="margin-block-start:var(--space-3)">' +
        'Pick one from the <a href="requests.html">request queue</a>.</p></div>';
      return;
    }

    document.getElementById('crumbRef').textContent = req.id;
    document.title = req.id + ' — Medical Requisitions, Ministry of Health Kuwait';
    render();
  }

  // Data comes from data/bundle.js, not fetch(), so the site also runs by
  // double-clicking the HTML with no server at all.
  window.Store.loadAll()
    .then(function (all) { init(window.MOH_DATA.sets, window.MOH_DATA.centres, all); })
    .catch(function (e) {
      document.getElementById('detail').innerHTML =
        '<div class="alert alert--danger"><div><div class="alert__title">Could not load the request</div>' +
        '<div class="alert__body">' + escapeHtml(e.message) + '</div></div></div>';
    });
})();
