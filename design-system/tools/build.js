/* Build standalone preview pages from src/ fragments.
   Each output inlines the foundation CSS so a card renders on its own in
   the Design System pane, while the fragments stay small and reviewable.
   Run: node tools/build.js                                                */
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(f, 'utf8');
const CSS = ['fonts', 'tokens', 'base', 'components']
  .map(n => read(`foundations/${n}.css`)).join('\n');
const BEHAVIOURS = read('foundations/behaviours.js');

const manifest = JSON.parse(read('src/manifest.json'));

// Inline the emblem as a data URI so each preview card renders standalone,
// including once uploaded to Claude Design where /assets does not resolve.
// With no asset present the path 404s and the dashed placeholder shows.
function emblemSrc() {
  // Preview cards render the emblem at 56px, so the 112px raster is already
  // 2x. Inlining the 774px source would add ~213 KB of base64 to every card
  // that uses it, for no visible gain.
  const tries = [['assets/emblem-colour.svg', 'image/svg+xml'],
                 ['assets/emblem-colour-112.png', 'image/png'],
                 ['assets/emblem-colour.png', 'image/png']];
  for (const [f, mime] of tries) {
    if (fs.existsSync(f)) {
      const kb = (fs.statSync(f).size / 1024).toFixed(0);
      console.log(`emblem: inlining ${f} (${kb} KB)`);
      return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
    }
  }
  console.log('emblem: no asset in assets/ — previews will show the placeholder');
  return '/assets/emblem-colour.svg';
}
const EMBLEM = emblemSrc();

const CHROME = `
/* --- preview chrome (not part of the design system) --- */
.pv-bar{position:sticky;top:0;z-index:900;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3);
  padding:var(--space-3) var(--space-5);background:var(--color-surface);
  border-bottom:1px solid var(--color-border);font-size:var(--text-xs)}
.pv-bar h1{font-size:var(--text-sm);font-weight:var(--weight-semibold);margin-inline-end:auto}
.pv-bar .sub{color:var(--color-text-muted);font-weight:var(--weight-regular);margin-inline-start:var(--space-3)}
.pv-seg{display:flex;border:1px solid var(--color-border-control);border-radius:var(--radius-md);overflow:hidden}
.pv-seg button{padding:var(--space-2) var(--space-4);border:0;background:var(--color-surface);
  color:var(--color-text-secondary);font-size:var(--text-2xs);font-weight:var(--weight-semibold);cursor:pointer}
.pv-seg button[aria-pressed="true"]{background:var(--color-primary);color:var(--color-text-on-solid)}
.pv-main{padding:var(--space-8) var(--space-7);max-width:var(--container-xl);margin-inline:auto}
.pv-group{margin-block-end:var(--space-11)}
.pv-group>h2{font-size:var(--text-lg);font-weight:var(--weight-semibold);margin-block-end:var(--space-2)}
.pv-group>.note{font-size:var(--text-sm);color:var(--color-text-secondary);max-width:var(--measure-prose);
  margin-block-end:var(--space-6)}
.pv-demo{display:flex;flex-wrap:wrap;gap:var(--space-5);align-items:flex-start;
  padding:var(--space-6);background:var(--color-surface);border:1px solid var(--color-border);
  border-radius:var(--radius-xl)}
.pv-demo--col{flex-direction:column;align-items:stretch}
.pv-label{font-size:var(--text-3xs);letter-spacing:var(--tracking-caps);text-transform:uppercase;
  color:var(--color-text-muted);font-weight:var(--weight-semibold);margin-block-end:var(--space-3)}
.pv-rule{font-size:var(--text-sm);border-inline-start:3px solid var(--color-primary);
  padding-inline-start:var(--space-4);margin-block:var(--space-5);color:var(--color-text-secondary);
  max-width:var(--measure-prose)}
.pv-rule b{color:var(--color-text)}
.pv-do-dont{display:grid;gap:var(--space-5);grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.pv-do,.pv-dont{padding:var(--space-5);border-radius:var(--radius-lg);border:1px solid}
.pv-do{background:var(--color-success-wash);border-color:var(--color-success)}
.pv-dont{background:var(--color-danger-wash);border-color:var(--color-danger)}
.pv-do .pv-label{color:var(--color-success-text)}
.pv-dont .pv-label{color:var(--color-danger-text)}
`;

const SCRIPT = `
(function(){
  var r=document.documentElement;
  function seg(name, apply){
    document.querySelectorAll('[data-seg="'+name+'"] button').forEach(function(b){
      b.addEventListener('click',function(){
        b.parentNode.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed','false')});
        b.setAttribute('aria-pressed','true');
        apply(b.dataset.val);
      });
    });
  }
  seg('theme',  function(v){ r.setAttribute('data-theme', v); });
  seg('density',function(v){ document.body.setAttribute('data-density', v); });
  seg('dir',    function(v){
    if (typeof window.__setLang === 'function') { window.__setLang(v==='rtl'?'ar':'en'); return; }
    r.setAttribute('dir', v); r.setAttribute('lang', v==='rtl'?'ar':'en');
  });
})();
`;

function page(m, body, extra) {
  return `<!-- @dsCard group="${m.group}" name="${m.name}" subtitle="${m.subtitle}" width="${m.width}" -->
<meta charset="utf-8">
<title>${m.name} — MOH Kuwait Design System</title>
<meta name="description" content="${m.subtitle}">
<link rel="icon" href="/design-system/assets/favicon/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/design-system/assets/favicon/icon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/design-system/assets/favicon/icon-16.png">
<link rel="apple-touch-icon" href="/design-system/assets/favicon/apple-touch-icon.png">
<style>
${CSS}
${extra || ''}
${CHROME}
</style>
<div class="pv-bar">
  <h1>${m.name}<span class="sub">${m.subtitle}</span></h1>
  <div class="pv-seg" data-seg="theme">
    <button data-val="light" aria-pressed="true">Light</button>
    <button data-val="dark" aria-pressed="false">Dark</button>
  </div>
  <div class="pv-seg" data-seg="density">
    <button data-val="comfortable" aria-pressed="true">Comfortable</button>
    <button data-val="compact" aria-pressed="false">Compact</button>
  </div>
  <div class="pv-seg" data-seg="dir">
    <button data-val="ltr" aria-pressed="true">LTR</button>
    <button data-val="rtl" aria-pressed="false">RTL — عربي</button>
  </div>
</div>
<main class="pv-main">
${body}
</main>
<script>${BEHAVIOURS}</script>
<script>${SCRIPT}</script>
`;
}

fs.mkdirSync('previews', { recursive: true });
let n = 0;
for (const m of manifest) {
  // `from` builds a card out of a complete page (the homepage), by lifting its
  // body, folding in its own CSS, and dropping its dev toolbar — the preview
  // shell supplies one already.
  let src, body, extra = '';
  if (m.from) {
    src = m.from;
    if (!fs.existsSync(src)) { console.log('SKIP (missing) ' + src); continue; }
    const doc = read(src);
    body = doc.slice(doc.indexOf('<body>') + 6, doc.lastIndexOf('</body>'));
    body = body.replace(/<div class="dev-bar"[\s\S]*?<\/div>\s*(?=<script)/, '');
    extra = (m.css || []).map(f => read(f)).join('\n');
  } else {
    src = path.join('src', m.file);
    if (!fs.existsSync(src)) { console.log('SKIP (missing) ' + m.file); continue; }
    body = read(src);
  }
  const out = path.join('previews', m.file);
  fs.writeFileSync(out, page(m, body, extra).split('__EMBLEM__').join(EMBLEM), 'utf8');
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`${out.padEnd(34)} ${String(kb).padStart(4)} KB   ${m.group} / ${m.name}`);
  n++;
}
console.log(`\n${n} preview(s) built`);
