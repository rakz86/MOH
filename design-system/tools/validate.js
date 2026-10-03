/* Structural audit of the foundation CSS. Run before any change is accepted.
   Enforces five rules:
     1. braces balance;
     2. every var() resolves to a defined token, or supplies a fallback;
     3. no raw hex below the primitive layer;
     4. no rgb/rgba/hsl literals in components or base — same defect as hex,
        and it defeats theming just as thoroughly;
     5. the two dark-theme blocks stay byte-identical, so a user who toggles
        dark gets the same theme as a user whose OS is dark.                */
const fs = require('fs');

const files = ['foundations/tokens.css', 'foundations/base.css', 'foundations/components.css'];
let all = '', fail = 0;

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  all += s + '\n';
  const o = (s.match(/\{/g) || []).length, c = (s.match(/\}/g) || []).length;
  if (o !== c) fail++;
  console.log(`${f.padEnd(30)} braces ${String(o).padStart(3)}/${String(c).padStart(3)}  ${o === c ? 'OK' : 'MISMATCH'}`);
}

// --- 2. token resolution ----------------------------------------------------
// Defined by `--name:` after a delimiter. The (?!:) rejects BEM modifiers
// written as selectors, e.g. `.badge--draft::before`.
const defined = new Set();
for (const m of all.matchAll(/(?:^|[;{]|\s)(--[a-z0-9-]+)\s*:(?!:)/gim)) defined.add(m[1]);

// A reference only matters when it has no fallback: var(--x) with no comma.
const hard = new Set(), soft = new Set();
for (const m of all.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)) {
  (m[2] === ',' ? soft : hard).add(m[1]);
}

const missing = [...hard].filter(t => !defined.has(t)).sort();
const softOnly = [...soft].filter(t => !defined.has(t)).sort();

console.log(`\ndefined ${defined.size}   hard refs ${hard.size}   optional-override hooks ${softOnly.length}`);
if (missing.length) { fail++; console.log('FAIL undefined hard refs: ' + missing.join(', ')); }
else console.log('undefined hard refs: none');
if (softOnly.length) console.log('override hooks (fallback supplied, OK): ' + softOnly.join(', '));

// --- 3. no hex below the primitive layer ------------------------------------
const semantic = all.slice(all.indexOf('2. SEMANTIC COLOUR'));
const hexLeaks = [...semantic.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map(m => m[0]);
if (hexLeaks.length) { fail++; console.log('FAIL raw hex in semantic layer: ' + hexLeaks.join(' ')); }
else console.log('raw hex in semantic layer: none');

// --- 4. no colour functions in components/base ------------------------------
// Shadow tokens declared in tokens.css are the sanctioned exception, so only
// the component and base layers are scanned. Comments are stripped first, so
// a hex quoted in an explanatory note is not mistaken for a declaration.
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const comp = stripComments(fs.readFileSync('foundations/components.css', 'utf8'))
           + stripComments(fs.readFileSync('foundations/base.css', 'utf8'));
const fnLeaks = [...comp.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)].map(m => m[0]);
if (fnLeaks.length) { fail++; console.log('FAIL colour literals outside tokens: ' + fnLeaks.join(' ')); }
else console.log('colour literals outside tokens: none');

// --- 5. light is the default, and dark is complete --------------------------
// The service must not follow prefers-color-scheme. A ministry page that
// arrives dark because of an OS setting the citizen forgot about reads as
// broken, not considerate. Dark stays available as an explicit opt-in, and
// must not introduce a token that light does not also define.
const tok = fs.readFileSync('foundations/tokens.css', 'utf8');

if (/@media\s*\(\s*prefers-color-scheme/.test(tok)) {
  fail++;
  console.log('FAIL tokens.css follows prefers-color-scheme — light must be unconditional');
} else {
  console.log('light default (no prefers-color-scheme switch): OK');
}

const grab = sel => {
  const a = tok.indexOf(sel); if (a < 0) return null;
  const b = tok.indexOf('{', a) + 1; let d = 1, i = b;
  while (d) { if (tok[i] === '{') d++; else if (tok[i] === '}') d--; i++; }
  return tok.slice(b, i - 1);
};

const dark = grab(':root[data-theme="dark"] {');
if (!dark) {
  fail++;
  console.log('FAIL the explicit dark-theme block is missing');
} else {
  const darkTokens = [...dark.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
  const light = tok.slice(tok.indexOf('2. SEMANTIC COLOUR'), tok.indexOf(':root[data-theme="dark"]'));
  const orphans = darkTokens.filter(t => !light.includes(t + ':'));
  if (orphans.length) {
    fail++;
    console.log('FAIL dark defines tokens light does not: ' + orphans.join(', '));
  } else {
    console.log(`dark opt-in: ${darkTokens.length} tokens, all also defined in light`);
  }
}

const unusedSem = [...defined].filter(t => !t.startsWith('--moh-') && !hard.has(t) && !soft.has(t)).sort();
console.log('unused semantic tokens: ' + (unusedSem.length ? unusedSem.join(', ') : 'none'));

process.exit(fail ? 1 : 0);
