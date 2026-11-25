// Small pieces shared by the page's sections.
import {sourceNumber} from '../lib/catalog.js';

export const ExternalLink = ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

// Footnote to a source in the Sources list, by the source's id
export function Fn({src}) {
  const n = src && sourceNumber[src];
  if (!n) return null;
  return <sup className="fn"><a href={`#src-${n}`} aria-label={`Source ${n}`}>{n}</a></sup>;
}

// l: [label, url]
export const MetaLink = ({l}) => <div className="meta"><ExternalLink href={l[1]}>{l[0]}</ExternalLink></div>;

export const WarnBox = ({label, children}) => <div className="warnbox" role="note"><b>{label}</b>{children}</div>;

// Up to four paths, then how many more
export const Paths = ({list}) => <>
  {list.slice(0, 4).map((p, i) => <span key={i}>{i > 0 && ', '}<code>{p}</code></span>)}
  {list.length > 4 && ` +${list.length - 4} more`}
</>;

const CAUT = {ign: ['ign', 'Ignores robots.txt'], ret: ['ret', 'Retired name'], caut: ['', 'Caution']};

// A "!" note. kind: ign for bots that ignore robots.txt, ret for retired names, otherwise a plain caution.
export function Caution({kind = 'caut', src, children}) {
  const [cls, label] = CAUT[kind];
  return <div className={'caut' + (cls ? ' ' + cls : '')} role="note">
    <span className="ex" aria-hidden="true">!</span>
    <span><span className="sr">{label}: </span>{children}<Fn src={src} /></span>
  </div>;
}

// A status chip that isn't a button: in the legend, the named table and the signals panel
export function StatusIcon({status, symbol, title, label, dashed = false}) {
  return <span className={`chip ic s-${status}${dashed ? ' def' : ''}`} title={title} aria-hidden={label ? undefined : true}>
    <span className="st" aria-hidden="true">{symbol}</span>
    {label && <span className="sr">{label}</span>}
  </span>;
}

// A full-width band with a centred content column, optionally headed by an <h2>
export function Section({as: Tag = 'section', title, style = {paddingTop: 0}, wrapClass, children}) {
  return <Tag className="band" style={style}>
    <div className={wrapClass ? 'wrap ' + wrapClass : 'wrap'}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  </Tag>;
}

// A status line: what was done, an Undo button when there's something to undo, then notes. status: {lead, undo,
// tail}, or null for an empty line.
export function StatusLine({id, status, onUndo, style}) {
  return <p className="hint" id={id} role="status" style={style}>
    {status && <>
      {status.lead && status.lead + ' '}
      {status.undo && <><button type="button" className="undo" onClick={onUndo}>Undo</button>{' '}</>}
      {status.tail}
    </>}
  </p>;
}
