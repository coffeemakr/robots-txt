// Where the robots.txt to check comes from: the generator's buttons, the text box or a dropped file. The buttons
// show what the generated block in the text box does with each category.
import {GEN_CATS} from '../lib/catalog.js';
import {catState} from '../lib/page.js';
import {StatusLine} from './Bits.jsx';

const SETS = [['unset', 'Not set'], ['block', 'Block'], ['allow', 'Allow']];

function Generator({picked, onSet, status, onUndo}) {
  return <fieldset className="gen" aria-describedby="gennote">
    <legend className="sr">Generate a robots.txt</legend>
    <div className="gencats">
      {GEN_CATS.map(([cat, title, label = title]) => {
        const state = catState(cat, picked);
        return <div key={cat} className={'gencat' + (state === 'mixed' ? ' mixed' : '')} role="group" aria-labelledby={`gc-${cat}`}>
          <span className="gcname" id={`gc-${cat}`}>{label}</span>
          <span className="seg">
            {SETS.map(([set, text]) => <button key={set} type="button" data-set={set} aria-pressed={state === set}
              onClick={() => state !== set && onSet(cat, set)}>{text}</button>)}
          </span>
        </div>;
      })}
    </div>
    <p className="hint" id="gennote" style={{marginTop: 2}}>Edits a marked block in your robots.txt below, or writes a
      new one. For single bots, click them in the table.</p>
    <StatusLine id="genstatus" status={status} onUndo={onUndo} />
  </fieldset>;
}

export default function InputPanel({text, onText, onDropFile, onClear, onDownload, srcRef, srcStatus, ...gen}) {
  const onDragOver = (e) => {if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();};
  const onDrop = (e) => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    onDropFile(f);
  };
  return <div className="panel">
    <Generator {...gen} />
    <label htmlFor="src" style={{fontWeight: 600}}>Your robots.txt</label>
    <textarea id="src" ref={srcRef} spellCheck={false} placeholder={'User-agent: *\nDisallow:'} aria-describedby="srchint"
      value={text} onChange={(e) => onText(e.target.value)} onDragOver={onDragOver} onDrop={onDrop} />
    <div className="tools">
      <button type="button" onClick={onClear}>Clear</button>
      <button type="button" onClick={onDownload}>Download robots.txt</button>
    </div>
    <p className="hint" id="srchint">Updates as you type. You can also drop a file onto the box.</p>
    <p className="hint" role="status">{srcStatus}</p>
  </div>;
}
