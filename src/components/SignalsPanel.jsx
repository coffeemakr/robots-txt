// AI preference signals: those in the file, then suggestions that bring them in line with the file's rules.
import {GEN_CATS, POLICY} from '../lib/catalog.js';
import {NO, YES, ico, lab, sigPairs, sigVal, signalGaps} from '../lib/page.js';
import {StatusLine} from './Bits.jsx';

// One preference as a chip: ✕ for no, ✓ for yes, the same look as the bots
function Pill({k, v}) {
  const st = NO.test(v) ? 'blocked' : YES.test(v) ? 'allowed' : 'na';
  return <span className={`chip s-${st}`} title={`${k}=${v}`}>
    <span className="st" aria-hidden="true">{{blocked: '✕', allowed: '✓', na: '?'}[st]}</span>
    <code>{k}</code><span className="sr">: {v}</span>
  </span>;
}

const Found = ({s}) => {
  const pairs = sigPairs(s.val);
  return <li className="sig">
    <div className="sighead"><code>{s.key}</code><span className="meta">Line {s.line} · {s.agents.length
      ? <>for {s.agents.map((x, i) => <span key={i}>{i > 0 && ', '}<code>{x}</code></span>)}</> : 'outside any group'}</span></div>
    <div className="pills">{pairs.length ? pairs.map(([k, v], i) => <Pill key={i} k={k} v={v} />) : <code>{s.val}</code>}</div>
    <div className="meta">{/signal/i.test(s.key) ? 'Cloudflare Content Signals' : 'IETF AIPREF draft'}: a usage preference, not a block.</div>
  </li>;
};

const Rec = ({line, label, onClick, children}) => <li className="rec">
  <p>{children}</p>
  {line && <pre className="recline">{line}</pre>}
  <button type="button" onClick={onClick}>{label}</button>
</li>;

// Suggestions that bring the file's preference signals in line with its rules. onAct receives
// {act: 'signal', val}, {act: 'block', cats} or {act: 'policy'}.
function recommend(a, all, onAct) {
  const recs = [];
  const {want, cur, have, tighten, loosen} = signalGaps(a.parsed, all);

  // The rules block most of a kind, but the signal doesn't say no
  if (tighten.length) {
    const val = sigVal({...want, ...have, ...Object.fromEntries(tighten.map(([k]) => [k, 'no']))});
    const names = tighten.map(([, n]) => n), kinds = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0];
    recs.push(<Rec key="signal" line={`Content-Signal: ${val}`} label={cur ? `Update line ${cur.line}` : 'Add to file'}
      onClick={() => onAct({act: 'signal', val})}>
      {cur ? <>Your rules block most {kinds} bots, but the <code>Content-Signal</code> on line {cur.line} doesn’t say so.</>
        : <>Your rules block most {kinds} bots. Say the same to crawlers that read Content Signals, under <code>User-agent: *</code>.</>}
    </Rec>);
  }
  // The signal says no, but the rules let most of those bots in
  for (const [k, n, , cats] of loosen) {
    const titles = cats.map(cat => GEN_CATS.find(([c]) => c === cat)[1].replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase()));
    recs.push(<Rec key={`block-${k}`} label={`Block ${titles.join(' and ')}`} onClick={() => onAct({act: 'block', cats})}>
      Your signal says <code>{k}=no</code>, but most {n} bots aren’t blocked. Many crawlers don’t read Content Signals, so block them too.
    </Rec>);
  }
  // The shared training opt-out, when the rules block training
  if (want['ai-train'] === 'no' && !a.named.some(x => x.ua.toLowerCase() === POLICY.toLowerCase()))
    recs.push(<Rec key="policy" line={`User-agent: ${POLICY}\nDisallow: /`} label="Add to the generated block"
      onClick={() => onAct({act: 'policy'})}>
      Also block <code>{POLICY}</code>, a shared training opt-out: Anthropic applies it now, Google and Microsoft from early 2027.
    </Rec>);
  return recs;
}

export default function SignalsPanel({a, gen, onAct, status, onUndo}) {
  const found = a.parsed.signals.map((s, i) => <Found key={i} s={s} />);
  const ap = a.named.find(x => x.ua.toLowerCase() === POLICY.toLowerCase());
  if (ap) found.push(<li key="policy" className="sig">
    <div className="sighead"><code>User-agent: {POLICY}</code></div>
    <div className="pills"><span className={`chip s-${ap.status}`}><span className="st" aria-hidden="true">{ico(ap)}</span>{lab(ap)}</span></div>
    <div className="meta">Shared AI-training opt-out from an individual IETF draft. Anthropic applies it when ClaudeBot isn’t
      named; Google (when Google-Extended isn’t named) and Microsoft plan to from early 2027. The Training column already
      takes it into account.</div>
  </li>);
  const recs = recommend(a, gen, onAct);
  return <div className="panel">
    <h3>AI preference signals</h3>
    <div>
      {found.length ? <><h4 className="sigh">In your file</h4><ul className="sigs">{found}</ul></>
        : <p className="meta">No preference signals in your file.</p>}
      {recs.length ? <><h4 className="sigh">Recommended</h4><ul className="sigs">{recs}</ul></>
        : found.length ? <p className="meta sigok">✓ Your signals match your rules.</p>
          : <p className="meta">Signals such as <code>Content-Signal: ai-train=no</code> state how content may be used. Block
            something and a matching one is suggested here.</p>}
    </div>
    <StatusLine id="sigstatus" status={status} onUndo={onUndo} />
  </div>;
}
