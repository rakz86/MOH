/* Generates src/color.html directly from foundations/tokens.css so the
   swatches can never drift from the shipped values. Run before build.js. */
const fs = require('fs');

const css = fs.readFileSync('foundations/tokens.css', 'utf8');

const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = r => { const a = r.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
const ratio = (f, b) => { const L1 = lum(hex(f)), L2 = lum(hex(b)); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

// Pull every primitive: --moh-<family>-<step>: #HEX;
const prim = {};
for (const m of css.matchAll(/--moh-([a-z-]+?)-(\d{2,3}|[a-z-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
  (prim[m[1]] ||= []).push({ step: m[2], hex: m[3], name: `--moh-${m[1]}-${m[2]}` });
}

const order = ['blue', 'slate', 'green', 'amber', 'red', 'violet'];
const label = { blue: 'Primary — MOH blue', slate: 'Neutral — blue-tinted slate', green: 'Success', amber: 'Warning', red: 'Danger', violet: 'In review' };

function swatch(s) {
  const onWhite = ratio(s.hex, '#FFFFFF');
  const best = onWhite >= 4.5 ? '#FFFFFF' : '#161C23';
  const txt = onWhite >= 4.5 ? s.hex : '#161C23';
  const fg = lum(hex(s.hex)) > 0.4 ? '#161C23' : '#FFFFFF';
  return `      <div style="flex:1;min-width:92px">
        <div style="height:60px;border-radius:var(--radius-md);background:${s.hex};border:1px solid var(--color-border);display:grid;place-items:center;color:${fg};font-size:var(--text-3xs);font-weight:600">${s.step}</div>
        <div class="mono" style="font-size:var(--text-3xs);margin-block-start:var(--space-2);color:var(--color-text-secondary)">${s.hex}</div>
        <div style="font-size:var(--text-3xs);color:var(--color-text-muted)">${onWhite.toFixed(2)}:1 on white</div>
      </div>`;
}

let out = `<div class="pv-group">
  <h2>Primitive ramps</h2>
  <p class="note">Raw values. Components never reference these directly — they go through a semantic role below, so themes can swap without touching a component. Contrast figures are measured against white and regenerated on every build.</p>
`;

for (const fam of order) {
  const steps = (prim[fam] || []).filter(s => /^\d+$/.test(s.step)).sort((a, b) => +a.step - +b.step);
  if (!steps.length) continue;
  out += `
  <div style="margin-block-end:var(--space-8)">
    <div class="pv-label">${label[fam]}</div>
    <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
${steps.map(swatch).join('\n')}
    </div>
  </div>`;
}
out += `\n</div>\n`;

// --- semantic roles ---------------------------------------------------------
const roles = [
  ['Surfaces', [
    ['--color-canvas', 'The page ground. Never white — white is for raised content.'],
    ['--color-surface', 'Cards, tables, inputs. Sits above the canvas.'],
    ['--color-surface-sunken', 'Table headers, addons, footers of panels.'],
    ['--color-surface-inverse', 'Government bar and site footer.'],
  ]],
  ['Text', [
    ['--color-text', 'Body and headings. 17.15:1 on surface.'],
    ['--color-text-secondary', 'Supporting copy, table headers, hints.'],
    ['--color-text-muted', 'Placeholders and timestamps. 4.50:1 — do not go lighter.'],
    ['--color-text-link', 'Links and primary text actions.'],
  ]],
  ['Borders', [
    ['--color-border', 'Decorative dividers and card edges. No contrast floor.'],
    ['--color-border-strong', 'Emphasis dividers. Still decorative.'],
    ['--color-border-control', 'Interactive control boundaries. Must hold 3:1 — WCAG 1.4.11.'],
  ]],
  ['Action', [
    ['--color-primary', 'The single action that advances the task.'],
    ['--color-primary-wash', 'Hover ground, selected rows, quiet emphasis.'],
    ['--color-accent', 'RESTRICTED — 3.10:1 on white. Large text, graphics and dark surfaces only. Never body copy.'],
    ['--color-focus', 'The focus ring. One treatment system-wide, never removed.'],
  ]],
];

out += `<div class="pv-group">
  <h2>Semantic roles</h2>
  <p class="note">This is the layer components actually consume. A role says what a colour is <em>for</em>, which is why the same component works unchanged in light and dark.</p>
  <div class="grid grid--2">`;
for (const [group, items] of roles) {
  out += `
    <div class="card">
      <div class="pv-label">${group}</div>
      ${items.map(([t, d]) => `<div class="def-row">
        <div class="def-row__key"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(${t});border:1px solid var(--color-border);vertical-align:-2px;margin-inline-end:6px"></span><span class="mono" style="font-size:var(--text-3xs)">${t.replace('--color-', '')}</span></div>
        <div class="def-row__val" style="font-weight:400;color:var(--color-text-secondary);font-size:var(--text-xs)">${d}</div>
      </div>`).join('\n      ')}
    </div>`;
}
out += `
  </div>
</div>
`;

// --- status colours ---------------------------------------------------------
out += `<div class="pv-group">
  <h2>Request lifecycle colour</h2>
  <p class="note">Seven states, each with a reserved hue, a distinct shape, and a word. Switch this page to dark and the same seven stay legible — the dark theme uses its own ramp rather than an inverted light one.</p>
  <div class="pv-demo">
    <span class="badge badge--draft">Draft</span>
    <span class="badge badge--submitted">Submitted</span>
    <span class="badge badge--review">In review</span>
    <span class="badge badge--action">Action required</span>
    <span class="badge badge--approved">Approved</span>
    <span class="badge badge--rejected">Rejected</span>
    <span class="badge badge--fulfilled">Fulfilled</span>
  </div>
  <p class="pv-rule"><b>Never reassign these hues.</b> Green means approved and only approved. If a new state is needed, it takes a new shape and a new word before it takes a new colour — and it must survive the greyscale test: print the page in black and white and every state must still be distinguishable.</p>

  <div class="pv-do-dont" style="margin-block-start:var(--space-6)">
    <div class="pv-do">
      <div class="pv-label">Do</div>
      <div class="cluster"><span class="badge badge--rejected">Rejected</span><span class="body-sm">shape + word + colour</span></div>
    </div>
    <div class="pv-dont">
      <div class="pv-label">Do not</div>
      <div class="cluster"><span style="display:inline-block;width:10px;height:10px;border-radius:99px;background:var(--color-danger)"></span><span class="body-sm">a bare colour dot carrying the meaning alone</span></div>
    </div>
  </div>
</div>
`;

fs.writeFileSync('src/color.html', out, 'utf8');
const n = Object.values(prim).reduce((a, b) => a + b.length, 0);
console.log(`src/color.html generated from ${n} primitives across ${Object.keys(prim).length} families`);
