// The page's logic without the UI: what the text box's robots.txt does, preference signals, and the generator.
// The components in ../components render it; App.jsx keeps the state.
import {data, genBots, tableBots, inCat, inGenCat, GEN_CATS} from './catalog.js';
import {GEN_HEAD, analyze, evaluate, parseRobots, rulesFor, generate, hasBlock, mergeBlock, readBlock} from './robots.js';

export const CATS = [['train', 'Training'], ['search', 'AI search'], ['fetch', 'User-requested fetch']];
const NAME = {blocked: 'Blocked', partial: 'Partial', allowed: 'Allowed'};
const ICON = {blocked: '✕', partial: '◐', allowed: '✓'};

// ---- Results ----

// Not named in the file, so the bot gets the default (the * group, or nothing)
export const isDef = (x) => x.named === false && (x.via === '*' || x.via === null);
export const mostly = (x) => x.status === 'partial' && x.mostly;
export const lab = (x) => (mostly(x) ? 'Mostly blocked' : NAME[x.status]) + (isDef(x) ? ' by default' : x.named === false && x.via ? ` via ${x.via}` : '');
export const ico = (x) => mostly(x) ? '◕' : ICON[x.status];

// Rules of a result, to spot named bots that just repeat the * group's
export const rulesSig = (x) => x.blocked.slice().sort().join('\n') + '|' + x.open.slice().sort().join('\n');

// Everything the page shows about text. all: every catalog bot with its result. gen: those plus the bots from the
// user-agent table, which the generator also covers but the tiles and tables don't. starSig: rulesSig of the * group.
export function inspect(text) {
  const a = analyze(text);
  const all = a.companies.flatMap(c => c.bots);
  const star = a.parsed.groups.filter(g => g.agents.includes('*'));
  const starSig = star.length ? rulesSig(evaluate(star.flatMap(g => g.rules))) : null;
  const gen = [...all, ...tableBots.map(b => ({...b, ...evaluate(rulesFor(b.ua, a.parsed, b.fallback).rules)}))];
  return {a, all, gen, starSig};
}

// ---- Preference signals ----

export const YES = /^(y|yes)$/i, NO = /^(n|no)$/i;
// "search=yes, ai-train=no" → [['search', 'yes'], ['ai-train', 'no']]
export const sigPairs = (val) => val.split(/[,;]/).map(x => x.split('=').map(y => y.trim())).filter(([k, v]) => k && v);
export const sigVal = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ');

// Content Signals keys, and the groups of bots that show what the file's rules want for each: the key should say
// no when most bots of any of its groups are blocked. Regular search engines for search; AI search bots, or
// user-requested fetchers, for ai-input; training bots for ai-train. Last, the generator's categories to block
// when a signal says no but the rules let those bots in.
export const SIG_KEYS = [
  ['search', 'search engine', [(b) => inGenCat(b, 'engines')], ['engines']],
  ['ai-input', 'AI answer', [(b) => inGenCat(b, 'search'), (b) => inCat(b, 'fetch')], ['search', 'fetch']],
  ['ai-train', 'training', [(b) => inCat(b, 'train')], ['train']],
];
// Blocked from everything, or from all but some exceptions: a Disallow: /private for everyone doesn't count
const isShut = (b) => b.status === 'blocked' || mostly(b);
const mostlyRestricted = (bs) => bs.length > 0 && bs.filter(isShut).length > bs.length / 2;
export const isStarSignal = (s) => /^content-signal$/i.test(s.key) && s.agents.includes('*');

// The Content-Signal values that match the rules, from bots with their results: {search, 'ai-input', 'ai-train'}.
// The one source for both the generated file's signal and the recommendations.
const wantSignal = (bots) => Object.fromEntries(SIG_KEYS.map(([k, , groups]) => [k, groups.some(f => mostlyRestricted(bots.filter(f))) ? 'no' : 'yes']));
// In a generated file, a bot is blocked exactly when the generated part blocks it
const genAll = [...genBots, ...tableBots];
const wantFor = (sel) => wantSignal(genAll.map(b => ({...b, status: sel.has(b.ua) ? 'blocked' : 'allowed'})));

// How the * group's Content-Signal compares with the rules. tighten: keys the rules say no to but the signal
// doesn't; loosen: keys the signal says no to but the rules mostly let in.
export function signalGaps(parsed, all) {
  const want = wantSignal(all);
  const cur = parsed.signals.find(isStarSignal);
  const have = cur ? Object.fromEntries(sigPairs(cur.val).map(([k, v]) => [k.toLowerCase(), v])) : {};
  return {
    want, cur, have,
    tighten: SIG_KEYS.filter(([k]) => want[k] === 'no' && !NO.test(have[k] || '')),
    loosen: SIG_KEYS.filter(([k]) => want[k] !== 'no' && NO.test(have[k] || '')),
  };
}

// The text with the * group's Content-Signal set to val: the line replaced, added under User-agent: *, or added in
// a new * group at the end.
export function setSignal(text, val) {
  text = text.replace(/\r\n?/g, '\n');
  const parsed = parseRobots(text), lines = text.split('\n');
  const cur = parsed.signals.find(isStarSignal);
  if (cur) {
    lines[cur.line - 1] = lines[cur.line - 1].replace(/:.*$/, `: ${val}`);
    return lines.join('\n');
  }
  const g = parsed.groups.find(x => x.agents.includes('*'));
  if (g) {
    let i = g.line;
    while (i < lines.length && /^\s*user[ _-]?agent\s*:/i.test(lines[i])) i++;
    lines.splice(i, 0, `Content-Signal: ${val}`);
    return lines.join('\n');
  }
  return (text.trim() ? text.replace(/\s*$/, '\n\n') : '') + `User-agent: *\nContent-Signal: ${val}\n`;
}

// ---- Generator ----

// Each category row has three buttons for what the generated block does with every AI bot of one purpose
// (including documented AI data crawlers from the user-agent table), or every documented SEO tool or media monitor:
// leave them to the rest of the file, block them, or allow them. The buttons show the block in the text box; when
// the category's bots are set one by one in different ways, none is pressed.
// The regular search engines (Googlebot, Bingbot, ...) have a row of their own, apart from AI search, since
// blocking them takes the site out of search. Only names the companies document: community-list names are left out.
const genCat = (cat) => (b) => inGenCat(b, cat) && b.documented !== false;
export const catBots = (cat) => genAll.filter(genCat(cat)).map(b => b.ua);
// A category's own bots: those in no other category. Bytespider is in AI training and AI search, so blocking either
// blocks it; it doesn't make the other look mixed. A category with no bots of its own uses all of them.
const ownBots = (cat) => {
  const us = catBots(cat), others = new Set(GEN_CATS.filter(([c]) => c !== cat).flatMap(([c]) => catBots(c)));
  const own = us.filter(u => !others.has(u));
  return own.length ? own : us;
};
// unset, block, allow, or mixed, from the category's own bots. p: readBlock's result
export function catState(cat, p) {
  const us = ownBots(cat);
  if (us.length && us.every(u => p.block.has(u))) return 'block';
  if (us.length && us.every(u => p.allow.has(u))) return 'allow';
  return us.some(u => p.block.has(u) || p.allow.has(u)) ? 'mixed' : 'unset';
}

// What the generated block does with a bot. p: readBlock's result
export const pickOf = (p, ua) => p.block.has(ua) ? 'block' : p.allow.has(ua) ? 'allow' : 'unset';
// A chip cycles through these: the block leaves the bot to the rest of the file, blocks it, or lets it in.
export const NEXT = {unset: 'block', block: 'allow', allow: 'unset'};

// The categories whose bots sel blocks in full
export const fullCats = (sel) => new Set(GEN_CATS.map(([c]) => c).filter(c => {
  const us = catBots(c);
  return us.length > 0 && us.every(u => sel.has(u));
}));

// prev with the generated part blocking the bots in sel and letting in those in allow (Sets of user-agents).
// The user's own file gets a marked block added; an empty box or a generated file is replaced.
// A generated file's Content-Signal says what its rules do (wantFor). Values someone changed by hand, those that
// differ from what the earlier file's rules called for, are kept.
export function build(prev, sel, allow) {
  const date = new Date().toISOString().slice(0, 10);
  const merge = hasBlock(prev) || (!!prev.trim() && !prev.trimStart().startsWith(GEN_HEAD));
  if (merge) return {merge, text: mergeBlock(prev, sel, {date, allow})};
  const cur = parseRobots(prev).signals.find(isStarSignal), old = wantFor(readBlock(prev).block);
  const kept = cur ? Object.fromEntries(sigPairs(cur.val).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]).filter(([k, v]) => old[k] !== v)) : {};
  const sig = {...wantFor(sel), ...kept};
  const signal = Object.keys(kept).length || Object.values(sig).some(v => NO.test(v)) ? sigVal(sig) : '';
  return {merge, text: generate(sel, {signal, date, allow})};
}

// In the user's own file the generator leaves the Content-Signal line alone (it's outside the marked block), so it
// says when that line no longer matches the rules
function sigNote(merge, text, all) {
  if (!merge) return '';
  const {cur, tighten, loosen} = signalGaps(parseRobots(text), all);
  if (!cur || !(tighten.length || loosen.length)) return '';
  const keys = [...tighten, ...loosen].map(([k]) => k).join(', ');
  return `Your Content-Signal on line ${cur.line} no longer matches the rules for ${keys}; see AI preference signals.`;
}

// What regenerating did, for the status line: did (what happened to the text) and notes (what to look out for).
// prev and next: the text before and after; gen: inspect(next).gen; cleared: the category whose bots were just
// left to the rest of the file, if any; replaced: whether the user's own text was replaced.
export function regenReport({prev, next, merge, sel, allow, gen, cleared, replaced}) {
  const cats = fullCats(sel);
  // Rules in the user's file can outweigh the block (Allow: / beats Disallow: /), or block what's no longer in it
  const st = (u) => gen.find(b => b.ua === u)?.status;
  const open = merge ? [...sel].filter(u => st(u) !== 'blocked') : [];
  const shut = merge ? [...allow].filter(u => st(u) !== 'allowed') : [];
  const still = merge && cleared && catBots(cleared).some(u => st(u) !== 'allowed') ? [GEN_CATS.find(([c]) => c === cleared).at(-1)] : [];
  let did = '';
  if (!merge) did = replaced ? 'Replaced your text.' : '';
  else if (hasBlock(next)) did = hasBlock(prev) ? 'Updated the block in your file.' : 'Added a block to your file.';
  else if (hasBlock(prev)) did = 'Removed the block from your file.';
  const notes = [
    open.length && `Your file’s own rules still let ${open.join(', ')} in; edit their groups to block ${open.length > 1 ? 'them' : 'it'} fully.`,
    shut.length && `Your file’s own rules still block ${shut.join(', ')} from some paths.`,
    still.length && `Your file’s own rules still block ${still.join(' and ')}, fully or in part.`,
    sigNote(merge, next, gen),
    cats.has('engines') && 'This removes the site from Google, Bing and other regular search results.',
    cats.has('fetch') && 'Several user-requested fetchers say they may ignore robots.txt.',
    cats.has('seo') && 'SEO tools include audit crawlers you may run on your own site, such as Screaming Frog and Sitebulb.',
  ].filter(Boolean);
  return {did, notes: notes.join(' ')};
}

export {data};
