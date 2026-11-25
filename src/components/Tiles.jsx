// One tile per purpose, and one for SEO tools: how many of its bots are blocked, with a bar of blocked, partial and
// allowed.
import {inCat} from '../lib/catalog.js';
import {CATS, isDef} from '../lib/page.js';

// Restricting a bot may not stick: segments fade a little for "!" caution bots (disputed or undocumented) and
// more for bots that say they may ignore robots.txt.
const tier = (b) => b.ignores ? 'ign' : b.caution ? 'caut' : '';

function Tile({all, k, name}) {
  const bs = all.filter(b => inCat(b, k));
  const n = (s, t) => bs.filter(b => b.status === s && (t === undefined || tier(b) === t)).length;
  const seg = (cls, count) => count ? <i key={cls} className={cls} style={{width: `${(count / bs.length * 100).toFixed(1)}%`}} /> : null;
  const segs = (s) => [seg(`b-${s}`, n(s, '')), seg(`b-${s} b-caut`, n(s, 'caut')), seg(`b-${s} b-ign`, n(s, 'ign'))];
  const ign = n('blocked') + n('partial') - n('blocked', '') - n('partial', '');
  const dA = bs.filter(b => b.status === 'allowed' && isDef(b)).length, dB = bs.filter(b => b.status === 'blocked' && isDef(b)).length;
  return <div className="tile">
    <div className="k">{name}</div>
    <div className="big">{n('blocked')}<small> of {bs.length} blocked</small></div>
    <div className="bar" role="img" aria-label={`${n('blocked')} blocked, ${n('partial')} partial, ${n('allowed')} allowed${ign ? `; ${ign} of the restricted bots may not respect robots.txt` : ''}`}>
      {segs('blocked')}{segs('partial')}{seg('b-allowed', n('allowed'))}
    </div>
    <div className="sub">
      {n('partial')} partial · {n('allowed')} allowed{dA ? ` (${dA} by default)` : ''}{dB ? ` · ${dB} blocked by default` : ''}{ign ? ` · ${ign} may not respect robots.txt` : ''}
    </div>
  </div>;
}

// all: the catalog's bots with their results. gen: those plus the user-agent table's, where the SEO tools are.
export default function Tiles({all, gen}) {
  return <div className="tiles">
    {CATS.map(([k, name]) => <Tile key={k} all={all} k={k} name={name} />)}
    <Tile all={gen} k="seo" name="SEO tools" />
  </div>;
}
