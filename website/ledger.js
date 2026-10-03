/* ==========================================================================
   ledger.js — derivation only. No storage, no network, no DOM.

   THE MODEL

     allocation  what this centre is entitled to hold. Set centrally, per
                 centre. Falls back to the standard on the instrument set
                 until a centre is given its own figure.

     held        allocation − confirmed returns + confirmed issues.
                 Never stored, always derived.

     pending     quantities sitting in a SUBMITTED request that nobody has
                 confirmed yet. Shown, but deliberately not counted in held.

     deficit     allocation − held, when positive. What the centre is owed.

   WHY A REQUEST IS NOT A MOVEMENT

     A clinic pressing "+" does not change anything. It creates a request.
     Stock only moves when the instrument admin confirms that the damaged
     items came back and the replacements went out. Until then the figure
     on the clinic screen and the figure in the store room agree, which is
     the entire point of keeping a register.

     So the ledger is written at CONFIRMATION, not at submission, and it is
     append-only in both cases.
   ========================================================================== */
(function () {
  'use strict';

  var STATUS = {
    submitted: { label: 'Submitted', badge: 'badge--submitted' },
    confirmed: { label: 'Confirmed', badge: 'badge--approved' },
    rejected:  { label: 'Rejected',  badge: 'badge--rejected' },
    partial:   { label: 'Partly confirmed', badge: 'badge--action' }
  };

  function itemKey(setId, no) { return setId + ':' + no; }

  /* -- allocation --------------------------------------------------------- */

  // Precedence: this centre's own figure, then the ministry standard, then
  // whatever the printed instrument set says.
  function allocationFor(centre, standards, k, baseStd) {
    if (centre && centre.allocation &&
        Object.prototype.hasOwnProperty.call(centre.allocation, k)) {
      return centre.allocation[k];
    }
    if (Object.prototype.hasOwnProperty.call(standards, k)) return standards[k];
    return baseStd;
  }

  /* -- movement ----------------------------------------------------------- */

  function movement(ledger, k) {
    var ret = 0, iss = 0;
    for (var i = 0; i < ledger.length; i++) {
      var e = ledger[i];
      if (e.k !== k) continue;
      if (e.type === 'return') ret += e.qty;
      else if (e.type === 'issue') iss += e.qty;
    }
    return { returned: ret, issued: iss };
  }

  function heldFor(centre, standards, ledger, k, baseStd) {
    var m = movement(ledger, k);
    return allocationFor(centre, standards, k, baseStd) - m.returned + m.issued;
  }

  function deficitFor(centre, standards, ledger, k, baseStd) {
    var d = allocationFor(centre, standards, k, baseStd) -
            heldFor(centre, standards, ledger, k, baseStd);
    return d > 0 ? d : 0;
  }

  /* -- pending ------------------------------------------------------------ */

  // Everything this centre has asked for and not yet had confirmed.
  function pendingFor(requests, k) {
    var ret = 0, iss = 0, refs = [];
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (r.status !== 'submitted') continue;
      for (var j = 0; j < r.lines.length; j++) {
        var l = r.lines[j];
        if (l.k !== k) continue;
        ret += l.ret || 0;
        iss += l.iss || 0;
        if ((l.ret || l.iss) && refs.indexOf(r.id) === -1) refs.push(r.id);
      }
    }
    return { ret: ret, iss: iss, refs: refs, any: ret > 0 || iss > 0 };
  }

  /* -- history ------------------------------------------------------------ */

  function historyFor(globalLog, centreLedger, k) {
    var out = [];
    globalLog.forEach(function (e) { if (e.k === k) out.push(e); });
    centreLedger.forEach(function (e) { if (e.k === k) out.push(e); });
    out.sort(function (a, b) { return String(b.t).localeCompare(String(a.t)); });
    return out;
  }

  /* -- requests ----------------------------------------------------------- */

  // Human-readable and sortable. The date makes it obvious at a glance how
  // old a reference is, which matters when someone reads one over a phone.
  function newRequestId(now) {
    var d = now || new Date();
    var stamp = d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    var rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return 'REQ-' + stamp + '-' + rand;
  }

  function requestTotals(r) {
    var ret = 0, iss = 0, lines = 0;
    (r.lines || []).forEach(function (l) {
      if (l.ret) ret += l.ret;
      if (l.iss) iss += l.iss;
      if (l.ret || l.iss) lines++;
    });
    return { ret: ret, iss: iss, lines: lines };
  }

  function statusOf(key) { return STATUS[key] || { label: key, badge: 'badge--draft' }; }

  /* -- presentation ------------------------------------------------------- */

  function fmtDate(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!withTime) return date;
    return date + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function ageInDays(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  }

  function describe(e) {
    if (e.type === 'standard') return 'Allocation changed from ' + e.from + ' to ' + e.to;
    if (e.type === 'return') return 'Return accepted: ' + e.qty;
    if (e.type === 'issue') return 'New issued: ' + e.qty;
    return e.type;
  }

  window.Ledger = {
    STATUS: STATUS,
    itemKey: itemKey,
    allocationFor: allocationFor,
    movement: movement,
    heldFor: heldFor,
    deficitFor: deficitFor,
    pendingFor: pendingFor,
    historyFor: historyFor,
    newRequestId: newRequestId,
    requestTotals: requestTotals,
    statusOf: statusOf,
    fmtDate: fmtDate,
    ageInDays: ageInDays,
    describe: describe
  };
})();
