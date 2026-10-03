// WCAG 2.1 contrast audit for every foreground/background pair the system
// actually ships. Run this before any palette change is accepted.
const hex = h => { h = h.replace('#',''); if (h.length===3) h = [...h].map(c=>c+c).join(''); 
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const lum = rgb => { const a = rgb.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]; };
const ratio = (f,b) => { const L1=lum(hex(f)), L2=lum(hex(b));
  return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); };

const P = {
  white:'#FFFFFF', slate50:'#F7F9FB', slate100:'#EDF1F5', slate500:'#6B7887',
  slate600:'#4E5A68', slate900:'#161C23', slate950:'#0C1116', slate800:'#262E38',
  blue300:'#7FB8E4', blue450:'#2E9BD6', blue500:'#1F79BE', blue600:'#0B5FA5',
  blue700:'#094B84', blue900:'#062E4D',
  green600:'#0F7B54', green700:'#0B6042', amber600:'#B26A00', amber700:'#8A5200',
  red600:'#B3261E', red700:'#8C1D17', violet600:'#5B4BB5', violet700:'#473A92',
  dGreenT:'#5FC79B', dAmberT:'#E8B05C', dRedT:'#F08B83', dVioletT:'#A79AE6',
};

const cases = [
  ['LIGHT','body text',           P.slate900, P.white,   4.5],
  ['LIGHT','body text on canvas', P.slate900, P.slate50, 4.5],
  ['LIGHT','secondary text',      P.slate600, P.white,   4.5],
  ['LIGHT','muted text',          P.slate500, P.white,   4.5],
  ['LIGHT','link / primary text', P.blue600,  P.white,   4.5],
  ['LIGHT','link on canvas',      P.blue600,  P.slate50, 4.5],
  ['LIGHT','white on primary btn',P.white,    P.blue600, 4.5],
  ['LIGHT','white on deep',       P.white,    P.blue900, 4.5],
  ['LIGHT','inverse band text',   P.white,    P.blue900, 4.5],
  ['LIGHT','inverse band LINK',   P.white,    P.blue900, 4.5],
  ['LIGHT','link blue on inverse',P.blue600,  P.blue900, 4.5],
  ['DARK', 'inverse band text',   P.slate100, P.slate800,4.5],
  ['DARK', 'inverse band vs page',P.slate800, P.slate950,1.2],
  ['LIGHT','success badge text',  P.green700, '#E8F5EF', 4.5],
  ['LIGHT','warning badge text',  P.amber700, '#FDF3E3', 4.5],
  ['LIGHT','danger badge text',   P.red700,   '#FCEEED', 4.5],
  ['LIGHT','review badge text',   P.violet700,'#F1EEFA', 4.5],
  ['LIGHT','info badge text',     P.blue700,  '#EFF6FC', 4.5],
  ['LIGHT','focus ring vs white', P.blue600,  P.white,   3.0],
  ['LIGHT','control border/white',  '#7C8A99',  P.white,   3.0],
  ['LIGHT','control border/canvas', '#7C8A99',  P.slate50, 3.0],
  ['LIGHT','control border/sunken', '#7C8A99',  P.slate100,3.0],
  ['DARK', 'control border',        '#7E8B99',  P.slate900,3.0],
  ['LIGHT','ACCENT as body text', P.blue450,  P.white,   4.5],
  ['LIGHT','accent as LARGE text',P.blue450,  P.white,   3.0],
  ['DARK', 'body text',           P.slate100, P.slate900, 4.5],
  ['DARK', 'body on canvas',      P.slate100, P.slate950, 4.5],
  ['DARK', 'secondary text',      '#C4CDD7',  P.slate900, 4.5],
  ['DARK', 'muted text',          '#98A4B2',  P.slate900, 4.5],
  ['DARK', 'link',                P.blue300,  P.slate950, 4.5],
  ['DARK', 'link on surface',     P.blue300,  P.slate900, 4.5],
  ['DARK', 'white on primary btn',P.white,    P.blue500,  4.5],
  ['DARK', 'success text',        P.dGreenT,  P.slate900, 4.5],
  ['DARK', 'warning text',        P.dAmberT,  P.slate900, 4.5],
  ['DARK', 'danger text',         P.dRedT,    P.slate900, 4.5],
  ['DARK', 'review text',         P.dVioletT, P.slate900, 4.5],
  ['DARK', 'accent',              '#4FB4E8',  P.slate900, 4.5],
];

let fails = 0, warns = 0;
console.log('mode   pair                        ratio   need   result');
console.log('-'.repeat(62));
for (const [mode, name, fg, bg, need] of cases) {
  const r = ratio(fg, bg);
  const pass = r >= need;
  const expectedFail = name.includes('ACCENT as body') || name.includes('link blue on inverse');
  if (!pass && !expectedFail) fails++;
  if (!pass && expectedFail) warns++;
  const tag = pass ? 'PASS' : (expectedFail ? 'FAIL (documented, gated)' : 'FAIL');
  console.log(`${mode.padEnd(6)} ${name.padEnd(27)} ${r.toFixed(2).padStart(5)}  ${need.toFixed(1)}   ${tag}`);
}
console.log('-'.repeat(62));
console.log(fails ? `${fails} UNEXPECTED FAILURE(S)` : 'all required pairs pass');
console.log(warns ? `${warns} banned pairing(s) confirmed unusable by test` : '');
process.exit(fails ? 1 : 0);
