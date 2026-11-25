// Shared by the Astro components (build time) and app.js (browser), so both see the bots in the same order.
import data from '../data/bots.json';

export {data};
export const POLICY = data.aiTrainingToken;

// The builder's sections, in display order: the three AI purposes, then kinds from the user-agent table.
export const GEN_CATS = [['train', 'AI training'], ['search', 'AI search'], ['fetch', 'User-requested fetches'],
  ['seo', 'SEO tools'], ['intel', 'Media monitoring']];

// Bots from the user-agent table the builder can block, by kind (its section): only those with an operator page,
// to show they're documented.
export const tableBots = Object.values(data.userAgentNotes)
  .filter(n => GEN_CATS.some(([c]) => c === n.kind) && n.url && n.ua)
  .map(n => ({ua: n.ua, cat: n.kind, fallback: n.fallback}));

// Whether a bot serves a purpose. A bot's `cat` is one purpose, or a list when it serves several (Bytespider).
export const inCat = (b, cat) => Array.isArray(b.cat) ? b.cat.includes(cat) : b.cat === cat;

export const byName = (x, y) => x.name.localeCompare(y.name, 'en', {sensitivity: 'base'});
// Major players by share of AI referral traffic, then alphabetically; others alphabetically
export const companyOrder = (x, y) => x.major !== y.major ? (x.major ? -1 : 1)
  : x.major && (x.share || y.share) ? (y.share || 0) - (x.share || 0) || byName(x, y)
    : byName(x, y);

// Every bot in company order, each with its company's name as `co`.
export const genBots = [...data.companies].sort(companyOrder).flatMap(c => c.bots.map(b => ({...b, co: c.name})));

// Footnote number of each source, as listed in the page's Sources section.
export const sourceNumber = Object.fromEntries(data.sources.map((s, i) => [s.id, i + 1]));
