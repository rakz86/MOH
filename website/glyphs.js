/* ==========================================================================
   glyphs.js — line-art placeholders for the inventory grid.

   These are NOT photographs of the instruments. They are schematic glyphs,
   one per instrument type, there so the grid view has something to show and
   so a row is recognisable at a glance — a forceps reads differently from a
   mirror from across a desk.

   Real product photography should come from the supplier catalogue, where
   the picture is guaranteed to match what actually ships. Add an `image`
   field to an item in periodontic-sets.json and the grid prefers it.

   Deliberately not stock photos pulled off the web: wrong-instrument images
   on a procurement screen are worse than no image, they would break the
   offline guarantee, and their licensing is somebody else's to grant.

   Injected as an inline sprite rather than referenced as an external file so
   <use> resolves when the page is opened directly from disk.
   ========================================================================== */
(function () {
  'use strict';

  // 64x64, stroke-only, currentColor — so they inherit theme and never carry
  // a colour of their own.
  var SHAPES = {
    mirror:
      '<path d="M14 50 L36 28"/><circle cx="44" cy="20" r="10"/><path d="M12 52l-2 2"/>',
    probe:
      '<path d="M12 52 L40 24"/><path d="M40 24 L52 12"/><path d="M44 22l3 3M40 26l3 3M36 30l3 3"/>',
    'needle-holder':
      '<circle cx="16" cy="48" r="6"/><circle cx="28" cy="52" r="6"/>' +
      '<path d="M20 44 L46 18"/><path d="M30 46 L50 24"/><path d="M34 34l6 6"/>',
    scissors:
      '<circle cx="15" cy="49" r="6"/><circle cx="27" cy="53" r="6"/>' +
      '<path d="M19 45 L52 14"/><path d="M29 47 L50 24"/><circle cx="33" cy="37" r="2"/>',
    forceps:
      '<path d="M16 52 C26 40 30 30 28 16"/><path d="M30 54 C36 42 42 32 46 20"/>' +
      '<path d="M28 16 q4 -6 8 0"/><path d="M27 34 l10 3"/>',
    plier:
      '<path d="M16 52 L34 30 L50 16"/><path d="M28 54 L42 34 L52 24"/>' +
      '<path d="M30 36 l8 3"/>',
    curette:
      '<path d="M14 50 L40 26"/><path d="M40 26 q8 -8 12 -2 q2 5 -5 8 q-5 2 -7 -6"/>',
    scaler:
      '<path d="M14 50 L38 28"/><path d="M38 28 q10 -4 12 -14 q-10 4 -14 12"/>',
    stone:
      '<rect x="12" y="24" width="40" height="16" rx="3"/><path d="M12 32h40"/>',
    syringe:
      '<rect x="16" y="26" width="26" height="12" rx="2"/><path d="M42 32h8"/>' +
      '<path d="M50 32h6"/><path d="M12 28v8"/><path d="M22 26v12M28 26v12M34 26v12"/>',
    elevator:
      '<path d="M14 50 L38 26"/><path d="M38 26 l10 -10 q4 4 0 8 l-10 10 z"/>',
    knife:
      '<path d="M14 50 L34 30"/><path d="M34 30 L52 14 L46 32 Z"/>',
    blade:
      '<path d="M16 44 L40 20 L48 28 L24 46 Z"/><path d="M20 42l4 -4"/>',
    handle:
      '<path d="M14 50 L46 18"/><path d="M46 18 q6 -6 8 -2 q2 4 -4 8"/>' +
      '<path d="M22 42l4 4M26 38l4 4M30 34l4 4"/>',
    chisel:
      '<path d="M14 50 L38 26"/><path d="M38 26 l12 -10 l4 6 l-12 10 z"/>',
    file:
      '<path d="M14 50 L36 28"/><rect x="36" y="14" width="16" height="14" rx="2" transform="rotate(45 44 21)"/>' +
      '<path d="M40 18l3 3M44 14l3 3"/>',
    retractor:
      '<path d="M14 50 L34 30"/><path d="M34 30 q10 -10 18 -6 q-2 10 -12 14 z"/>',
    gauge:
      '<rect x="10" y="26" width="44" height="12" rx="2"/>' +
      '<path d="M18 26v6M26 26v8M34 26v6M42 26v8M50 26v6"/>',
    instrument:
      '<path d="M14 50 L44 20"/><circle cx="48" cy="16" r="5"/>'
  };

  function build() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');

    var markup = '';
    Object.keys(SHAPES).forEach(function (kind) {
      markup += '<symbol id="glyph-' + kind + '" viewBox="0 0 64 64">' +
                '<g fill="none" stroke="currentColor" stroke-width="2.4" ' +
                'stroke-linecap="round" stroke-linejoin="round">' +
                SHAPES[kind] + '</g></symbol>';
    });
    svg.innerHTML = markup;
    document.body.insertBefore(svg, document.body.firstChild);
  }

  window.Glyphs = {
    kinds: Object.keys(SHAPES),
    has: function (kind) { return Object.prototype.hasOwnProperty.call(SHAPES, kind); },
    // Returns markup for one glyph, falling back to the generic instrument.
    svg: function (kind, cls) {
      var id = this.has(kind) ? kind : 'instrument';
      return '<svg class="' + (cls || 'glyph') + '" aria-hidden="true">' +
             '<use href="#glyph-' + id + '"></use></svg>';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
