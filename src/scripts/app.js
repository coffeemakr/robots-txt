// The page: renders the analysis of the robots.txt in the text box, and runs the generator's buttons.
import {data, genBots, tableBots, sourceNumber, inCat} from '../lib/catalog.js';
import {GEN_HEAD, analyze, evaluate, rulesFor, generate, hasBlock, mergeBlock, readBlock} from '../lib/robots.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const STORE = 'robots-ai-check';
const src = $('src'), status = $('srcstatus'), genstatus = $('genstatus');

// Labels table cells with their column heading, for the stacked mobile layout.
new MutationObserver(() => {
  for (const c of document.querySelectorAll('.stack td:not([data-l])')) {
    let i = 0, p = c;
    while ((p = p.previousElementSibling)) i += p.colSpan;
    c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || '';
  }
}).observe(document, {childList: true, subtree: true});

// ---- Rendering ----

const CATS = [['train', 'Training'], ['search', 'AI search'], ['fetch', 'User-requested fetch']];
const OPEN = data.openness;
const NAME = {blocked: 'Blocked', partial: 'Partial', allowed: 'Allowed'};
const ICON = {blocked: '✕', partial: '◐', allowed: '✓'};
const WARN_KINDS = ['ignores', 'legacy', 'unconfirmed', 'noeffect', 'unknown'];
const CAUT = {ign: ['ign', 'Ignores robots.txt'], ret: ['ret', 'Retired name'], caut: ['', 'Caution']};

// Not named in the file, so the bot gets the default (the * group, or nothing)
const isDef = (x) => x.named === false && (x.via === '*' || x.via === null);
const mostly = (x) => x.status === 'partial' && x.mostly;
const lab = (x) => (mostly(x) ? 'Mostly blocked' : NAME[x.status]) + (isDef(x) ? ' by default' : x.named === false && x.via ? ` via ${x.via}` : '');
const ico = (x) => mostly(x) ? '◕' : ICON[x.status];
const list = (a) => a.slice(0, 4).map(p => `<code>${esc(p)}</code>`).join(', ') + (a.length > 4 ? ` +${a.length - 4} more` : '');
const link = (l) => `<div class="meta"><a href="${esc(l[1])}" target="_blank" rel="noopener noreferrer">${esc(l[0])}</a></div>`;
const box = (label, text) => `<div class="warnbox" role="note"><b>${esc(label)}</b>${esc(text)}</div>`;
const fn = (key) => key && sourceNumber[key] ? `<sup class="fn"><a href="#src-${sourceNumber[key]}" aria-label="Source ${sourceNumber[key]}">${sourceNumber[key]}</a></sup>` : '';
// kind: true for bots that ignore robots.txt, 'ret' for retired names, otherwise a plain caution
const caut = (text, kind, src) => {
  const [cls, label] = CAUT[kind === true ? 'ign' : kind || 'caut'];
  return `<div class="caut${cls ? ' ' + cls : ''}" role="note"><span class="ex" aria-hidden="true">!</span><span><span class="sr">${label}: </span>${esc(text)}${fn(src)}</span></div>`;
};

// Rules of the * group, to spot named bots that just repeat them
const rulesSig = (x) => x.blocked.slice().sort().join('\n') + '|' + x.open.slice().sort().join('\n');
let starSig = null;

function why(b) {
  if (b.via === null) return 'Not named; no rules apply (default)';
  if (b.via === '*') return 'Not named; uses the <code>*</code> group (default)';
  if (b.named && starSig !== null && rulesSig(b) === starSig) return 'Named, but with the same rules as the <code>*</code> group';
  const parts = [];
  if (!b.named) parts.push(`Not named; uses the <code>${esc(b.via)}</code> group`);
  if (b.status === 'partial') {
    if (b.blocked.length) parts.push('Disallow ' + list(b.blocked));
    if (b.open.length) parts.push('Allow ' + list(b.open));
  }
  return parts.join(' · ');
}

// What the generated block does with each bot, set by render() before drawing the table
let picked = {block: new Set(), allow: new Set()};
const pickOf = (ua) => picked.block.has(ua) ? 'block' : picked.allow.has(ua) ? 'allow' : 'unset';
// A chip cycles through these: the block leaves the bot to the rest of the file, blocks it, or lets it in.
const NEXT = {unset: 'block', block: 'allow', allow: 'unset'};
const PICK = {
  unset: ['Not in the generated block', 'block it there'],
  block: ['Blocked by the generated block', 'allow it there'],
  allow: ['Allowed by the generated block', 'leave it to the rest of the file'],
};

// cat: the column the chip is in, for bots with a note per purpose (catNotes). The chip is a three-way button for
// what the generated block does with the bot (see the Generator section).
function chip(b, cat) {
  const w = why(b);
  const note = b.catNotes && b.catNotes[cat] ? b.catNotes[cat] : b.note && {text: b.note};
  const pick = pickOf(b.ua), [now, then] = PICK[pick];
  return `<div><button type="button" class="chip tog s-${b.status}${isDef(b) ? ' def' : ''}" data-ua="${esc(b.ua)}" data-pick="${pick}" title="${esc(lab(b))}. ${now}: click to ${then}"><span class="st" aria-hidden="true">${ico(b)}</span><span class="sr">${lab(b)}, ${now.toLowerCase()}: </span><code>${esc(b.label || b.ua)}</code></button>`
    + (w ? `<div class="meta why">${w}</div>` : '')
    + (b.ignores ? caut(b.ignores, true, b.src) : b.caution ? caut(b.caution, false, b.src) : '')
    + (note && !b.ignores ? `<div class="meta">${esc(note.text)}${fn(note.src)}</div>` : '')
    + (b.link ? link(b.link) : '')
    + `</div>`;
}

function cell(c, cat) {
  const bots = c.bots.filter(b => inCat(b, cat));
  if (bots.length) return `<td><div class="cell">${bots.map(b => chip(b, cat)).join('')}</div></td>`;
  const n = (c.notes && c.notes[cat]) || (cat === 'train' && c.trainNote) || '';
  return `<td><span class="chip ic s-na" title="None"><span class="st" aria-hidden="true">—</span><span class="sr">None</span></span>${n ? `<div class="meta">${esc(n)}</div>` : ''}${cat === 'train' && c.link ? link(c.link) : ''}</td>`;
}

function tile(all, [k, name]) {
  const bs = all.filter(b => inCat(b, k));
  // Restricting a bot may not stick: segments fade a little for "!" caution bots (disputed or undocumented) and
  // more for bots that say they may ignore robots.txt.
  const tier = (b) => b.ignores ? 'ign' : b.caution ? 'caut' : '';
  const n = (s, t) => bs.filter(b => b.status === s && (t === undefined || tier(b) === t)).length;
  const seg = (cls, count) => count ? `<i class="${cls}" style="width:${(count / bs.length * 100).toFixed(1)}%"></i>` : '';
  const segs = (s) => seg(`b-${s}`, n(s, '')) + seg(`b-${s} b-caut`, n(s, 'caut')) + seg(`b-${s} b-ign`, n(s, 'ign'));
  const ign = n('blocked') + n('partial') - n('blocked', '') - n('partial', '');
  const dA = bs.filter(b => b.status === 'allowed' && isDef(b)).length, dB = bs.filter(b => b.status === 'blocked' && isDef(b)).length;
  return `<div class="tile"><div class="k">${name}</div>
  <div class="big">${n('blocked')}<small> of ${bs.length} blocked</small></div>
  <div class="bar" role="img" aria-label="${n('blocked')} blocked, ${n('partial')} partial, ${n('allowed')} allowed${ign ? `; ${ign} of the restricted bots may not respect robots.txt` : ''}">${segs('blocked')}${segs('partial')}${seg('b-allowed', n('allowed'))}</div>
  <div class="sub">${n('partial')} partial · ${n('allowed')} allowed${dA ? ` (${dA} by default)` : ''}${dB ? ` · ${dB} blocked by default` : ''}${ign ? ` · ${ign} may not respect robots.txt` : ''}</div></div>`;
}

function companyRows(companies, major) {
  return companies.filter(c => c.major === major).map(c => {
    const o = c.open && OPEN[c.open.kind];
    const open = o ? `<span class="open" title="${esc(o.label)}: ${esc(c.open.why)}">${esc(o.label)}<span class="sr">: ${esc(c.open.why)}</span>${fn(c.open.src)}</span>` : '';
    return `<tr><th scope="row" class="co">${esc(c.name)}${open}</th>${CATS.map(([k]) => cell(c, k)).join('')}</tr>`;
  }).join('');
}

function namedNote(x) {
  const flag = data.flags[x.kind];
  if (x.kind === 'caution') return caut(x.note, false, x.src);
  if (x.kind === 'ignores') return caut(x.note, true, x.src);
  if (x.kind === 'legacy') return caut(x.note, 'ret');
  if (WARN_KINDS.includes(x.kind)) return box(flag[0].toUpperCase() + flag.slice(1), x.note);
  return `<span class="flag">${flag}</span><div class="meta" style="margin-top:4px">${esc(x.note)}</div>`;
}

const namedRow = (x) => `<tr class="k-${x.kind}">
  <td><code>${esc(x.ua)}</code></td>
  <td><span class="chip ic s-${x.status}" title="${lab(x)}"><span class="st" aria-hidden="true">${ico(x)}</span><span class="sr">${lab(x)}</span></span></td>
  <td>${namedNote(x)}${x.url ? `<div class="meta"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Operator’s page</a></div>` : ''}</td></tr>`;

function signals(a) {
  const p = (html) => `<p style="margin:0 0 8px">${html}</p>`;
  const sig = a.parsed.signals.map(s => p(`<code>${esc(s.key)}: ${esc(s.val)}</code><br><span class="meta">Line ${s.line}${s.agents.length ? ', for ' + s.agents.map(esc).join(', ') : ''}. ${/signal/i.test(s.key) ? 'Cloudflare Content Signals' : 'IETF AIPREF draft'}: a usage preference, not a block.</span>`));
  const ap = a.named.find(x => x.ua.toLowerCase() === '__usage_ai-training');
  if (ap) sig.push(p(`<code>User-agent: __usage_ai-training</code> → ${lab(ap)}<br><span class="meta">Shared AI-training preference from an individual IETF draft. Anthropic applies it when ClaudeBot isn’t named; Google (when Google-Extended isn’t named) and Microsoft plan to from early 2027. The Training column already takes it into account for those three.</span>`));
  return sig.length ? sig.join('') : '<p class="empty" style="margin:0">None found. You can add <code>Content-Signal: search=yes, ai-train=no</code> under <code>User-agent: *</code> to state usage preferences.</p>';
}

function warnings(w) {
  return w.length ? `<ul class="warn">${w.map(x => `<li><b>Line ${x.line}:</b> ${esc(x.msg)}<br><code class="meta">${esc(x.text)}</code></li>`).join('')}</ul>`
    : '<p class="empty" style="margin:0">No problems found.</p>';
}

// Redraws everything from the text box and returns every catalog bot with its result.
function render() {
  const text = src.value;
  try {localStorage.setItem(STORE, text);} catch (e) { }
  const a = analyze(text);
  picked = readBlock(text);
  const all = a.companies.flatMap(c => c.bots);
  const star = a.parsed.groups.filter(g => g.agents.includes('*'));
  starSig = star.length ? rulesSig(evaluate(star.flatMap(g => g.rules))) : null;

  $('tiles').innerHTML = CATS.map(c => tile(all, c)).join('');
  $('matrix').tBodies[0].innerHTML = `<tr class="sec"><td colspan="4">Major players</td></tr>${companyRows(a.companies, true)}<tr class="sec"><td colspan="4">Others</td></tr>${companyRows(a.companies, false)}`;
  $('named').tBodies[0].innerHTML = a.named.length ? a.named.map(namedRow).join('') : `<tr><td colspan="3" class="empty">No User-agent lines yet.</td></tr>`;
  $('signals').innerHTML = signals(a);
  $('warnings').innerHTML = warnings(a.parsed.warnings);
  syncGen(picked);
  // The generator also covers bots from the user-agent table, which the tiles and tables don't
  return [...all, ...tableBots.map(b => ({...b, ...evaluate(rulesFor(b.ua, a.parsed, b.fallback).rules)}))];
}

$('sortnote').insertAdjacentHTML('beforeend', fn('seranking'));
$('openleg').innerHTML = 'Under each name, how open the company’s models are (hover for details): ' + Object.values(OPEN).map(o => `<b>${o.label}</b>: ${o.description.charAt(0).toLowerCase() + o.description.slice(1)}`).join(' · ') + '.';
$('sources').innerHTML = data.sources.map((s, i) => `<li id="src-${i + 1}">${esc(s.title)}. <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url.replace(/^https:\/\//, ''))}</a></li>`).join('');

// ---- Text box ----

let t;
src.addEventListener('input', () => {
  if (src.value !== lastGen) genstatus.textContent = '';
  clearTimeout(t); t = setTimeout(render, 150);
});
$('clr').addEventListener('click', () => {src.value = ''; render(); src.focus();});
src.addEventListener('dragover', (e) => {if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();});
src.addEventListener('drop', (e) => {
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if (!f) return;
  e.preventDefault();
  f.text().then(s => {src.value = s; render();}, () => {status.textContent = 'That file couldn’t be read.';});
});

// ---- Generator ----

// Each category row has three buttons for what the generated block does with every AI bot of one purpose
// (including documented AI data crawlers from the user-agent table), or every documented SEO tool or media monitor:
// leave them to the rest of the file, block them, or allow them. render() presses the buttons to match the block in
// the text box; when the category's bots are set one by one in different ways, none is pressed.
// AI search deliberately overblocks: it includes the regular search engines (Googlebot, Bingbot, ...), because their
// crawls also feed AI Overviews and Copilot. Only names the companies document: community-list names are left out.
const genCat = (cat) => (b) => inCat(b, cat) && b.documented !== false;
const genAll = [...genBots, ...tableBots];
const catBots = (cat) => genAll.filter(genCat(cat)).map(b => b.ua);
const genRows = () => [...$('gen').querySelectorAll('[data-cat]')];
// unset, block, allow, or mixed. p: readBlock's result
function catState(cat, p) {
  const us = catBots(cat);
  if (us.length && us.every(u => p.block.has(u))) return 'block';
  if (us.length && us.every(u => p.allow.has(u))) return 'allow';
  return us.some(u => p.block.has(u) || p.allow.has(u)) ? 'mixed' : 'unset';
}
function syncGen(p) {
  for (const row of genRows()) {
    const s = catState(row.dataset.cat, p);
    row.classList.toggle('mixed', s === 'mixed');
    for (const b of row.querySelectorAll('button[data-set]')) b.setAttribute('aria-pressed', String(b.dataset.set === s));
  }
}
let lastGen = null, undoText = null;

// The text with the generated part blocking the bots in sel and letting in those in allow (Sets of user-agents).
// The user's own file gets a marked block added; an empty box or a generated file is replaced.
function build(sel, allow, cats) {
  const prev = src.value, date = new Date().toISOString().slice(0, 10);
  const merge = hasBlock(prev) || (!!prev.trim() && !prev.trimStart().startsWith(GEN_HEAD));
  if (merge) return {merge, text: mergeBlock(prev, sel, {date, allow})};
  const yesNo = (block) => block ? 'no' : 'yes';
  const signal = ['train', 'search', 'fetch'].some(c => cats.has(c)) ? `search=${yesNo(cats.has('search'))}, ai-input=${yesNo(cats.has('search') || cats.has('fetch'))}, ai-train=${yesNo(cats.has('train'))}` : '';
  return {merge, text: generate(sel, {signal, date, allow})};
}

// The categories whose bots sel blocks in full
const fullCats = (sel) => new Set(genRows().map(r => r.dataset.cat).filter(c => {
  const us = catBots(c);
  return us.length > 0 && us.every(u => sel.has(u));
}));

// Puts the generated part in the text box and says what changed. cleared: the row whose bots were just left to
// the rest of the file, if any.
function regen(sel, allow, cleared = null) {
  const prev = src.value, cats = fullCats(sel);
  const {merge, text} = build(sel, allow, cats);
  // Offer to undo only when the text being changed is the user's own, not an earlier generated file
  if (prev !== lastGen && prev !== undoText) undoText = prev.trim() ? prev : null;
  lastGen = src.value = text;
  const all = render();

  // Rules in the user's file can outweigh the block (Allow: / beats Disallow: /), or block what's no longer in it
  const st = (u) => all.find(b => b.ua === u)?.status;
  const open = merge ? [...sel].filter(u => st(u) !== 'blocked') : [];
  const shut = merge ? [...allow].filter(u => st(u) !== 'allowed') : [];
  const still = merge && cleared && catBots(cleared.dataset.cat).some(u => st(u) !== 'allowed') ? [cleared.querySelector('.gcname').textContent] : [];
  let did = '';
  if (!merge) did = undoText !== null ? 'Replaced your text.' : '';
  else if (hasBlock(lastGen)) did = hasBlock(prev) ? 'Updated the block in your file.' : 'Added a block to your file.';
  else if (hasBlock(prev)) did = 'Removed the block from your file.';
  const notes = [
    open.length && `Your file’s own rules still let ${open.join(', ')} in; edit their groups to block ${open.length > 1 ? 'them' : 'it'} fully.`,
    shut.length && `Your file’s own rules still block ${shut.join(', ')} from some paths.`,
    still.length && `Your file’s own rules still block ${still.join(' and ')}, fully or in part.`,
    cats.has('search') && 'This also removes the site from Google, Bing and other regular search results.',
    cats.has('fetch') && 'Several user-requested fetchers say they may ignore robots.txt.',
    cats.has('seo') && 'SEO tools include audit crawlers you may run on your own site, such as Screaming Frog and Sitebulb.',
  ].filter(Boolean);
  genstatus.innerHTML = (did ? esc(did) + ' ' : '') + (undoText !== null ? '<button type="button" id="genundo">Undo</button> ' : '') + esc(notes.join(' '));
}

// A category's button sets all its bots in the generated block. Not set takes them out, except bots another
// category (Bytespider is in two) still blocks or allows in full. Other bots stay as they are.
$('gen').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-set]');
  if (!btn) return;
  const row = btn.closest('[data-cat]'), to = btn.dataset.set, p = readBlock(src.value);
  const others = genRows().filter(r => r !== row).map(r => [r.dataset.cat, catState(r.dataset.cat, p)]);
  const keep = (s) => new Set(others.filter(([, x]) => x === s).flatMap(([c]) => catBots(c)));
  const keepBlock = keep('block'), keepAllow = keep('allow');
  for (const u of catBots(row.dataset.cat)) {
    if (to !== 'unset' || !keepBlock.has(u)) p.block.delete(u);
    if (to !== 'unset' || !keepAllow.has(u)) p.allow.delete(u);
    if (to === 'block') p.block.add(u);
    if (to === 'allow') p.allow.add(u);
  }
  regen(p.block, p.allow, to === 'unset' ? row : null);
});

// A bot in the company table moves on to the next of its three states in the generated block: not in it, blocked
// (Disallow: /), allowed (Allow: /).
$('matrix').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-ua]');
  if (!btn) return;
  const ua = btn.dataset.ua, next = NEXT[btn.dataset.pick] || 'block';
  const btns = () => [...$('matrix').querySelectorAll('button[data-ua]')];
  const at = btns().indexOf(btn);
  const {block, allow} = readBlock(src.value);
  block.delete(ua); allow.delete(ua);
  if (next === 'block') block.add(ua);
  if (next === 'allow') allow.add(ua);
  regen(block, allow);
  // The table was redrawn: keep focus on the same chip
  const again = btns()[at];
  if (again) again.focus();
});
genstatus.addEventListener('click', (e) => {
  if (e.target.id !== 'genundo' || undoText === null) return;
  src.value = undoText; undoText = lastGen = null;
  genstatus.textContent = '';
  render(); src.focus();
});

// ---- Download ----

// Plain browser download; replaced by the Claude runtime's downloads capability when one is available.
let dl = {
  save: async ({filename, data}) => {
    const url = URL.createObjectURL(new Blob([data], {type: 'text/plain'}));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
try {if (window.claude && window.claude.use) window.claude.use('downloads').then(d => {if (d) dl = d;}, () => { });} catch (e) { }
$('dl').addEventListener('click', async () => {
  try {
    await dl.save({filename: 'robots.txt', data: src.value});
    status.textContent = 'Saved robots.txt.';
  } catch (e) {status.textContent = 'The file wasn’t saved. Copy the text from the box instead.';}
});

let saved = null;
try {saved = localStorage.getItem(STORE);} catch (e) { }
src.value = saved || '';
render();
