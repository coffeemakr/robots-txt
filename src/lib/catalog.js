// Shared by the Astro components (build time) and app.js (browser), so both see the bots in the same order.
import data from '../data/bots.json';

export {data};
export const POLICY = data.aiTrainingToken;

// The builder's sections, in display order: the AI purposes, with the regular search engines apart from AI search,
// then kinds from the user-agent table. Each has a title for the generated file's comments and, where the
// builder's rows need one, a shorter label.
export const GEN_CATS = [['train', 'AI training'], ['search', 'AI search'], ['engines', 'Search engines'],
  ['fetch', 'User-requested fetches', 'User-requested'], ['seo', 'SEO tools'], ['intel', 'Media monitoring']];

// Bots from the user-agent table the builder can block: only those with an operator page, to show they're
// documented. An entry's kind picks its section (AI data crawlers count as AI training); `cat` overrides that.
const KIND_CAT = {seo: 'seo', intel: 'intel', aidata: 'train'};
export const tableBots = Object.values(data.userAgentNotes)
  .filter(n => (n.cat || KIND_CAT[n.kind]) && n.url && n.ua)
  .map(n => ({ua: n.ua, cat: n.cat || KIND_CAT[n.kind], fallback: n.fallback}));

// Whether a bot serves a purpose. A bot's `cat` is one purpose, or a list when it serves several (Bytespider).
export const inCat = (b, cat) => Array.isArray(b.cat) ? b.cat.includes(cat) : b.cat === cat;

// The regular search engines (Googlebot, Bingbot, ...). Their crawls feed AI answers too, so they're search bots
// in the tables, but the builder keeps them in a section of their own: blocking them takes a site out of search.
export const isEngine = (b) => b.ua in data.searchEngines;
// Whether a bot is in one of the builder's sections (GEN_CATS)
export const inGenCat = (b, cat) => cat === 'engines' ? inCat(b, 'search') && isEngine(b)
  : cat === 'search' ? inCat(b, 'search') && !isEngine(b) : inCat(b, cat);

export const byName = (x, y) => x.name.localeCompare(y.name, 'en', {sensitivity: 'base'});
// Major players by share of AI referral traffic, then alphabetically; others alphabetically
export const companyOrder = (x, y) => x.major !== y.major ? (x.major ? -1 : 1)
  : x.major && (x.share || y.share) ? (y.share || 0) - (x.share || 0) || byName(x, y)
    : byName(x, y);

// Every bot in company order, each with its company's name as `co`.
export const genBots = [...data.companies].sort(companyOrder).flatMap(c => c.bots.map(b => ({...b, co: c.name})));

// Footnote number of each source, as listed in the page's Sources section.
export const sourceNumber = Object.fromEntries(data.sources.map((s, i) => [s.id, i + 1]));
