// The page: the analysis of the robots.txt in the text box, and the generator that edits it.
import {useEffect, useMemo, useRef, useState} from 'react';
import {GEN_CATS, POLICY} from './lib/catalog.js';
import {parseRobots, readBlock} from './lib/robots.js';
import {NEXT, build, catBots, catState, inspect, isStarSignal, pickOf, regenReport, setSignal} from './lib/page.js';
import {Fn, Section} from './components/Bits.jsx';
import InputPanel from './components/InputPanel.jsx';
import Tiles from './components/Tiles.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import CompanyTable, {Legend} from './components/CompanyTable.jsx';
import NamedTable from './components/NamedTable.jsx';
import Notes from './components/Notes.jsx';

const STORE = 'robots-ai-check';
// Typing is analysed once it pauses this long (ms); changes the page makes are analysed at once
const TYPING_DELAY = 150;

// Plain browser download; replaced by the Claude runtime's downloads capability when one is available.
const browserDownload = {
  save: async ({filename, data}) => {
    const url = URL.createObjectURL(new Blob([data], {type: 'text/plain'}));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

function loadSaved() {
  try {return localStorage.getItem(STORE) || '';} catch {return '';}
}

const Warnings = ({w}) => w.length
  ? <ul className="warn">{w.map((x, i) => <li key={i}><b>Line {x.line}:</b> {x.msg}<br /><code className="meta">{x.text}</code></li>)}</ul>
  : <p className="empty" style={{margin: 0}}>No problems found.</p>;

export default function App() {
  // text: what's in the box; shown: the text the page shows results for, which lags behind typing
  const [text, setText] = useState(loadSaved);
  const [shown, setShown] = useState(text);
  // The status lines under the generator and the signals panel: {lead, undo, tail} or null; and the text box's
  const [genStatus, setGenStatus] = useState(null);
  const [sigStatus, setSigStatus] = useState(null);
  const [srcStatus, setSrcStatus] = useState('');
  // lastGen: the text this page last wrote into the box. undoText: the user's own text it replaced, if any.
  const lastGen = useRef(null), undoText = useRef(null);
  const timer = useRef(), srcRef = useRef(null), dl = useRef(browserDownload);

  const view = useMemo(() => inspect(shown), [shown]);
  // What the generated block does with each bot, from the text as it is now: clicks edit this text, so the buttons
  // and chips show its state even while the results above still lag behind typing
  const picked = useMemo(() => readBlock(text), [text]);

  useEffect(() => {try {localStorage.setItem(STORE, text);} catch { }}, [text]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    try {if (window.claude && window.claude.use) window.claude.use('downloads').then(d => {if (d) dl.current = d;}, () => { });} catch { }
  }, []);

  const clearStatuses = () => {setGenStatus(null); setSigStatus(null);};
  // Sets the box's text and shows its results at once
  const setNow = (t) => {clearTimeout(timer.current); setText(t); setShown(t);};
  // Replaces the text with something that isn't the generator's work (cleared, a dropped file, undone): the status
  // lines and their Undo no longer apply to it
  const replaceText = (t) => {
    setNow(t);
    undoText.current = lastGen.current = null;
    clearStatuses();
  };

  // ---- Text box ----

  const onText = (v) => {
    if (v !== lastGen.current) clearStatuses();
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(v), TYPING_DELAY);
  };
  const onClear = () => {replaceText(''); srcRef.current?.focus();};
  const onDropFile = (f) => f.text().then(replaceText, () => setSrcStatus('That file couldn’t be read.'));
  const onDownload = async () => {
    try {
      await dl.current.save({filename: 'robots.txt', data: text});
      setSrcStatus('Saved robots.txt.');
    } catch {setSrcStatus('The file wasn’t saved. Copy the text from the box instead.');}
  };

  // ---- Generator ----

  // Puts next in the box and returns whether to offer Undo. Offers to undo only when the text being changed is the
  // user's own, not something this page wrote earlier.
  const put = (next) => {
    if (text !== lastGen.current && text !== undoText.current) undoText.current = text.trim() ? text : null;
    lastGen.current = next;
    setNow(next);
    clearStatuses();
    return undoText.current !== null;
  };

  // Puts the generated part in the box and says what changed, with out. cleared: the category whose bots were just
  // left to the rest of the file, if any.
  const regen = (sel, allow, {cleared = null, out = setGenStatus} = {}) => {
    const prev = text, {merge, text: next} = build(prev, sel, allow);
    const undo = put(next);
    const {did, notes} = regenReport({prev, next, merge, sel, allow, gen: inspect(next).gen, cleared, replaced: undoText.current !== null});
    out({lead: did, undo, tail: notes});
  };

  // A category's button sets all its bots in the generated block. Not set takes them out, except bots it shares
  // with a category (Bytespider is in two) that has something set: those are the other category's to change.
  const onSet = (cat, to) => {
    const p = readBlock(text);
    const held = new Set(GEN_CATS.filter(([c]) => c !== cat && catState(c, p) !== 'unset').flatMap(([c]) => catBots(c)));
    for (const u of catBots(cat)) {
      if (to === 'unset' && held.has(u)) continue;
      p.block.delete(u); p.allow.delete(u);
      if (to === 'block') p.block.add(u);
      if (to === 'allow') p.allow.add(u);
    }
    regen(p.block, p.allow, {cleared: to === 'unset' ? cat : null});
  };

  // A bot in the company table moves on to the next of its three states in the generated block: not in it, blocked
  // (Disallow: /), allowed (Allow: /).
  const onPick = (ua) => {
    const next = NEXT[pickOf(picked, ua)];
    const {block, allow} = readBlock(text);
    block.delete(ua); allow.delete(ua);
    if (next === 'block') block.add(ua);
    if (next === 'allow') allow.add(ua);
    regen(block, allow);
  };

  // The recommendations in the preference signals panel
  const onAct = ({act, val, cats}) => {
    if (act === 'signal') {
      const had = text.replace(/\r\n?/g, '\n');
      const undo = put(setSignal(had, val));
      setSigStatus({lead: parseRobots(had).signals.some(isStarSignal) ? 'Updated the Content-Signal line.' : 'Added a Content-Signal line.', undo});
      return;
    }
    const p = readBlock(text);
    for (const u of act === 'block' ? cats.flatMap(catBots) : [POLICY]) {p.allow.delete(u); p.block.add(u);}
    regen(p.block, p.allow, {out: setSigStatus});
  };

  const onUndo = () => {
    if (undoText.current === null) return;
    replaceText(undoText.current);
    srcRef.current?.focus();
  };

  return <>
    <Section as="header" style={{paddingBottom: 12}}>
      <h1>robots.txt AI check</h1>
      <p className="lede">Paste a robots.txt to see, for each AI company, whether training, AI search and user-requested
        fetches are blocked, partly blocked or allowed, and which named bots ignore robots.txt anyway. Or choose what to
        block or allow and get a robots.txt that does it.</p>
    </Section>

    <Section style={{paddingTop: 12}} wrapClass="top">
      <InputPanel text={text} onText={onText} onDropFile={onDropFile} onClear={onClear} onDownload={onDownload}
        srcRef={srcRef} srcStatus={srcStatus} picked={picked} onSet={onSet} status={genStatus} onUndo={onUndo} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <Tiles all={view.all} gen={view.gen} />
        <SignalsPanel a={view.a} gen={view.gen} onAct={onAct} status={sigStatus} onUndo={onUndo} />
      </div>
    </Section>

    <Section title="By company">
      <p className="hint" style={{margin: '-4px 0 0'}}>Click a bot to block it, allow it, or leave it to the rest of your
        file. Major players come first, by share of AI referral traffic.<Fn src="seranking" /></p>
      <Legend />
      <CompanyTable companies={view.a.companies} starSig={view.starSig} picked={picked} onPick={onPick} />
    </Section>

    <Section title="User-agents named in your file">
      <NamedTable named={view.a.named} />
    </Section>

    <Section title="Problems found">
      <div className="panel"><Warnings w={view.a.parsed.warnings} /></div>
    </Section>

    <Section as="footer" wrapClass="foot">
      <Notes />
    </Section>
  </>;
}
