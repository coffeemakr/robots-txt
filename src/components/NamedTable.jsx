// Every user-agent the file names, with its result and what this tool knows about it.
import {data, ico, lab} from '../lib/page.js';
import {Caution, ExternalLink, StatusIcon, WarnBox} from './Bits.jsx';

const WARN_KINDS = ['ignores', 'legacy', 'unconfirmed', 'noeffect', 'unknown'];

function Note({x}) {
  const flag = data.flags[x.kind];
  if (x.kind === 'caution') return <Caution src={x.src}>{x.note}</Caution>;
  if (x.kind === 'ignores') return <Caution kind="ign" src={x.src}>{x.note}</Caution>;
  if (x.kind === 'legacy') return <Caution kind="ret">{x.note}</Caution>;
  if (WARN_KINDS.includes(x.kind)) return <WarnBox label={flag[0].toUpperCase() + flag.slice(1)}>{x.note}</WarnBox>;
  return <>
    {(x.tag || flag) && <span className="flag">{x.tag || flag}</span>}
    {x.note && <div className="meta" style={{marginTop: 4}}>{x.note}</div>}
  </>;
}

export default function NamedTable({named}) {
  return <table className="stack">
    <thead><tr><th style={{width: '24%'}}>User-agent</th><th style={{width: '22%'}}>Result</th><th>Note</th></tr></thead>
    <tbody>
      {named.length ? named.map(x => <tr key={x.ua} className={`k-${x.kind}`}>
        <td data-l="User-agent"><code>{x.ua}</code></td>
        <td data-l="Result"><StatusIcon status={x.status} symbol={ico(x)} title={lab(x)} label={lab(x)} /></td>
        <td data-l="Note"><Note x={x} />{x.url && <div className="meta"><ExternalLink href={x.url}>Operator’s page</ExternalLink></div>}</td>
      </tr>) : <tr><td colSpan={3} className="empty">No User-agent lines yet.</td></tr>}
    </tbody>
  </table>;
}
