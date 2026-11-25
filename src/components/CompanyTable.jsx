// The company table: one row per company, one column per purpose, a chip per bot. Each bot chip is a three-way
// button for what the generated block does with the bot.
import {inCat} from '../lib/catalog.js';
import {CATS, data, ico, isDef, lab, pickOf, rulesSig} from '../lib/page.js';
import {Caution, Fn, MetaLink, Paths, StatusIcon} from './Bits.jsx';

const COLUMNS = ['Company', ...CATS.map(([, name]) => name)];
const PICK = {
  unset: ['Not in the generated block', 'block it there'],
  block: ['Blocked by the generated block', 'allow it there'],
  allow: ['Allowed by the generated block', 'leave it to the rest of the file'],
};

// Why a bot gets its result, or null. starSig: rulesSig of the * group, to spot named bots that just repeat it.
function why(b, starSig) {
  if (b.via === null) return 'Not named; no rules apply (default)';
  if (b.via === '*') return <>Not named; uses the <code>*</code> group (default)</>;
  if (b.named && starSig !== null && rulesSig(b) === starSig) return <>Named, but with the same rules as the <code>*</code> group</>;
  const parts = [];
  if (!b.named) parts.push(<>Not named; uses the <code>{b.via}</code> group</>);
  if (b.status === 'partial') {
    if (b.blocked.length) parts.push(<>Disallow <Paths list={b.blocked} /></>);
    if (b.open.length) parts.push(<>Allow <Paths list={b.open} /></>);
  }
  return parts.length ? parts.map((p, i) => <span key={i}>{i > 0 && ' · '}{p}</span>) : null;
}

// cat: the column the chip is in, for bots with a note per purpose (catNotes).
function Chip({b, cat, starSig, picked, onPick}) {
  const note = b.catNotes && b.catNotes[cat] ? b.catNotes[cat] : b.note && {text: b.note};
  const pick = pickOf(picked, b.ua), [now, then] = PICK[pick], w = why(b, starSig);
  return <div>
    <button type="button" className={`chip tog s-${b.status}${isDef(b) ? ' def' : ''}`} data-pick={pick}
      title={`${lab(b)}. ${now}: click to ${then}`} onClick={() => onPick(b.ua)}>
      <span className="st" aria-hidden="true">{ico(b)}</span>
      <span className="sr">{lab(b)}, {now.toLowerCase()}: </span>
      <code>{b.label || b.ua}</code>
    </button>
    {w && <div className="meta why">{w}</div>}
    {b.ignores ? <Caution kind="ign" src={b.src}>{b.ignores}</Caution> : b.caution ? <Caution src={b.src}>{b.caution}</Caution> : null}
    {note && !b.ignores && <div className="meta">{note.text}<Fn src={note.src} /></div>}
    {b.link && <MetaLink l={b.link} />}
  </div>;
}

function Cell({c, cat, label, ...chip}) {
  const bots = c.bots.filter(b => inCat(b, cat));
  if (bots.length) return <td data-l={label}><div className="cell">
    {bots.map(b => <Chip key={b.ua + (b.label || '')} b={b} cat={cat} {...chip} />)}
  </div></td>;
  const n = (c.notes && c.notes[cat]) || (cat === 'train' && c.trainNote) || '';
  return <td data-l={label}>
    <StatusIcon status="na" symbol="—" title="None" label="None" />
    {n && <div className="meta">{n}</div>}
    {cat === 'train' && c.link && <MetaLink l={c.link} />}
  </td>;
}

// How open the company's models are; what the label means is in the tooltip
function Openness({open}) {
  const o = open && data.openness[open.kind];
  if (!o) return null;
  const tip = `${o.description}. ${open.why}`;
  return <span className="open" title={`${o.label}: ${tip}`}>{o.label}<span className="sr">: {tip}</span><Fn src={open.src} /></span>;
}

function Rows({companies, ...chip}) {
  return companies.map(c => <tr key={c.name}>
    <th scope="row" className="co">{c.name}<Openness open={c.open} /></th>
    {CATS.map(([k], i) => <Cell key={k} c={c} cat={k} label={COLUMNS[i + 1]} {...chip} />)}
  </tr>);
}

export function Legend() {
  return <div className="legend">
    <span><StatusIcon status="blocked" symbol="✕" /> Blocked</span>
    <span><StatusIcon status="partial" symbol="◐" /> Partly blocked</span>
    <span><StatusIcon status="partial" symbol="◕" /> Mostly blocked</span>
    <span><StatusIcon status="allowed" symbol="✓" /> Allowed</span>
    <span><StatusIcon status="allowed" symbol="✓" dashed /> Not named: default applies</span>
    <span><StatusIcon status="na" symbol="—" /> No bot</span>
    <CautionMark kind="ign">May ignore robots.txt</CautionMark>
    <CautionMark>Disputed</CautionMark>
    <CautionMark kind="ret">Retired name</CautionMark>
  </div>;
}

// Legend entry for the "!" markers. kind: ign, ret, or a plain caution.
const CautionMark = ({kind, children}) => <span className={kind ? `caut ${kind}` : 'caut'} style={{margin: 0, display: 'inline-flex'}}>
  <span className="ex" aria-hidden="true">!</span>{children}
</span>;

export default function CompanyTable({companies, ...chip}) {
  // Fixed layout: the purpose columns share what the company column leaves equally, whatever their chips
  return <table className="stack co-table">
    <colgroup><col className="co" />{CATS.map(([k]) => <col key={k} />)}</colgroup>
    <thead><tr>{COLUMNS.map(c => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>
      <tr className="sec"><td colSpan={4}>Major players</td></tr>
      <Rows companies={companies.filter(c => c.major)} {...chip} />
      <tr className="sec"><td colSpan={4}>Others</td></tr>
      <Rows companies={companies.filter(c => !c.major)} {...chip} />
    </tbody>
  </table>;
}
