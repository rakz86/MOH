/* ==========================================================================
   foundations/behaviours.js — component behaviour. No dependencies.

   Progressive enhancement: the markup is usable without this file (the panel
   is a plain list of links), and this adds the disclosure on top.

   Mount by putting data-nav on the header, data-nav-toggle on the button and
   data-nav-panel on the panel.
   ========================================================================== */
(function () {
  'use strict';

  var DESKTOP = '(min-width: 841px)';

  function initNav(root) {
    var toggle = root.querySelector('[data-nav-toggle]');
    var panel = root.querySelector('[data-nav-panel]');
    if (!toggle || !panel) return;

    var scrim = null;

    function focusables() {
      return panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');
    }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    function open() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');

      scrim = document.createElement('div');
      scrim.className = 'nav-scrim';
      scrim.addEventListener('click', function () { close(); });
      document.body.appendChild(scrim);
      document.body.classList.add('is-locked');

      // Land the keyboard inside the panel, not behind the scrim.
      var f = focusables();
      if (f.length) f[0].focus();
    }

    // returnFocus is suppressed when the panel closes because the viewport
    // changed rather than because the user asked — stealing focus then would
    // be disorienting.
    function close(returnFocus) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (scrim) { scrim.remove(); scrim = null; }
      document.body.classList.remove('is-locked');
      if (returnFocus !== false) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close(); else open();
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;

      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;

      // Trap the tab ring inside the panel while it owns the screen.
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    // Rotating to landscape or widening the window must not strand an open
    // panel above a desktop nav that is also visible.
    var mq = window.matchMedia(DESKTOP);
    function onBreakpoint() { if (mq.matches && isOpen()) close(false); }
    if (mq.addEventListener) mq.addEventListener('change', onBreakpoint);
    else if (mq.addListener) mq.addListener(onBreakpoint);

    // A link inside the panel navigates; close so the panel is not left open
    // behind the new page in a single-page context.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) close(false);
    });
  }

  /* <details data-collapse-below="1080"> — expanded above the breakpoint,
     collapsed below it. Without JS the details keeps whatever `open` state
     the markup shipped with, so the content is never unreachable. */
  function initCollapse(el) {
    var bp = parseInt(el.getAttribute('data-collapse-below'), 10);
    if (!bp) return;
    var mq = window.matchMedia('(min-width: ' + (bp + 1) + 'px)');
    function sync() { el.open = mq.matches; }
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
  }


  /* ------------------------------------------------------------------------
     Modal dialog. Focus moves in on open, is trapped while open, and returns
     to whatever opened it on close. Escape and the scrim both close.

       var close = window.dsDialog.open(nodeToShow);

     Lives here rather than in a page because a dialog is a system component:
     the focus contract is the same wherever one appears.
     ------------------------------------------------------------------------ */
  var dsDialog = {
    open: function (content) {
      var opener = document.activeElement;

      var overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      document.body.classList.add('is-locked');

      function focusables() {
        return content.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
      }

      function close() {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        document.body.classList.remove('is-locked');
        if (opener && opener.focus) opener.focus();
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        var f = focusables();
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }

      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) close();
      });
      document.addEventListener('keydown', onKey, true);

      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
      var f = focusables();
      (f.length ? f[0] : content).focus();

      return close;
    }
  };
  window.dsDialog = dsDialog;

  function init() {
    var roots = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < roots.length; i++) initNav(roots[i]);

    var collapsers = document.querySelectorAll('[data-collapse-below]');
    for (var j = 0; j < collapsers.length; j++) initCollapse(collapsers[j]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
