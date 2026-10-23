import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronLeft, Download, Heart, Leaf, LoaderCircle, Maximize2, MousePointer2, Paintbrush, Rotate3D, Plus, Redo2, RotateCcw, RotateCw, Sparkles, Trash2, Undo2, X, CakeSlice } from 'lucide-react';
import { bases, frostings, steps, toppings } from './catalog.js';
import { findPlacement, isValidPosition, MAX_TOPPINGS, updateTopping } from './design.js';
import { exportCake } from './export.js';

const CakeScene = lazy(() => import('./CakeScene.jsx'));

function starterDesign() {
  const items = [];
  for (const type of ['strawberry', 'rosette', 'strawberry', 'rosette', 'strawberry', 'rosette', 'strawberry', 'rosette', 'strawberry', 'rosette', 'strawberry', 'rosette', 'blueberry', 'blueberry', 'blueberry']) {
    const position = findPlacement(type, items);
    if (position) items.push({ ...position, id: `starter-${items.length}`, rotation: items.length * 0.7 });
  }
  return { base: 'vanilla', cream: 'cream', items, strokes: [] };
}

function IngredientArt({ type, color, frosting = false }) {
  return <span aria-hidden="true" className={`ingredient-art art-${type} ${frosting ? 'art-frosting' : ''}`} style={{ '--ingredient': color }}><i /><i /><i /><i /><i /><i /><i /></span>;
}

function ToolButton({ label, children, ...props }) {
  return <button className="icon-button" aria-label={label} title={label} {...props}>{children}<span className="tooltip">{label}</span></button>;
}

export default function App() {
  const [history, setHistory] = useState(() => [starterDesign()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [tool, setTool] = useState('select');
  const [pendingType, setPendingType] = useState(null);
  const [selected, setSelected] = useState(null);
  const [finished, setFinished] = useState(false);
  const [view, setView] = useState('perspective');
  const [resetView, setResetView] = useState(0);
  const [notice, setNotice] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cakeName, setCakeName] = useState('我的甜蜜时刻');
  const capture = useRef(null);
  const finishHeading = useRef(null);
  const design = history[historyIndex];
  const base = bases.find(item => item.id === design.base);
  const cream = frostings.find(item => item.id === design.cream);
  const mode = finished ? 'orbit' : step === 1 && tool === 'frost' ? 'frost' : step >= 2 && pendingType ? 'place' : 'select';
  const spoonCursor = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><g transform="rotate(-38 20 20)"><rect x="16" y="24" width="7" height="19" rx="3" fill="#967358"/><path d="M17 27V22H12V4Q12 1 15 1H24Q27 1 27 4V22H22V27" fill="#dddcd6" stroke="#827e72" stroke-width="1.2"/><path d="M13 5H26V15Q19 13 13 17Z" fill="${cream.color}"/><path d="M15 5V13" stroke="#fff8ed" stroke-width="1.4"/></g></svg>`)}") 18 12, crosshair`;
  const current = steps[step];
  const chosen = design.items.find(item => item.id === selected);
  const chosenInfo = toppings.find(item => item.id === chosen?.type);
  const onReady = useCallback(fn => { capture.current = fn; setSceneReady(true); }, []);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (finished) finishHeading.current?.focus(); }, [finished]);
  useEffect(() => { setPendingType(null); setTool('select'); }, [step, finished]);

  function commit(next) {
    if (next === design) return;
    const nextHistory = [...history.slice(0, historyIndex + 1), next].slice(-60);
    setHistory(nextHistory); setHistoryIndex(nextHistory.length - 1);
  }

  function selectIngredient(item) {
    if (step < 2) {
      const key = step === 0 ? 'base' : 'cream';
      if (design[key] !== item.id) commit({ ...design, [key]: item.id });
      if (step === 1) { setTool('frost'); setSelected(null); }
      return;
    }
    setPendingType(type => type === item.id ? null : item.id); setSelected(null);
  }

  function placeIngredient(type, point) {
    if (!type) return;
    if (design.items.length >= MAX_TOPPINGS) { setNotice('装饰已达到 32 件，删去一些再继续吧。'); return; }
    const item = { type, x: point.x, z: point.z, scale: 1, id: crypto.randomUUID(), rotation: 0 };
    if (!isValidPosition(item, design.items)) { setNotice('这个位置太靠边或有些拥挤，试试旁边的空位。'); return; }
    commit({ ...design, items: [...design.items, item] }); setSelected(item.id);
  }

  function selectPlaced(id) {
    setSelected(id); if (id) setPendingType(null);
  }

  function dropIngredient(id, patch) {
    const items = updateTopping(design.items, id, patch);
    if (items !== design.items) commit({ ...design, items });
  }

  function editSelected(patch) {
    const items = updateTopping(design.items, selected, patch);
    if (items === design.items) { setNotice('这里有些拥挤，试试更小的尺寸或另一个方向。'); return; }
    commit({ ...design, items });
  }

  function removeSelected() {
    commit({ ...design, items: design.items.filter(item => item.id !== selected) }); setSelected(null);
  }

  function undo() { setHistoryIndex(i => Math.max(0, i - 1)); setSelected(null); setPendingType(null); }
  function redo() { setHistoryIndex(i => Math.min(history.length - 1, i + 1)); setSelected(null); setPendingType(null); }

  async function saveImage() {
    if (!capture.current || saving) return;
    setSaving(true);
    try { await exportCake(capture.current, cakeName, base.name, cream.name); setNotice('你的甜蜜作品已保存为 PNG。'); }
    catch { setNotice('图片保存未完成，请稍后重试。'); }
    finally { setSaving(false); }
  }

  const summary = toppings.map(item => ({ ...item, count: design.items.filter(t => t.type === item.id).length })).filter(item => item.count);

  return <main className={finished ? 'studio is-finished' : 'studio'}>
    <header className="site-header">
      <a className="wordmark" href="./" aria-label="Dream Cake Studio 首页"><CakeSlice size={30} strokeWidth={1.2} /><span>Dream Cake Studio<small>A LITTLE SWEETNESS, MADE BY YOU</small></span></a>
      <div className="header-right"><span className="atelier-tag"><span /> THE DIGITAL ATELIER</span><span className="header-divider" /><span className="header-note">为每一份小小的快乐</span><Heart size={17} strokeWidth={1.3} /></div>
    </header>

    <div className="intro"><div><p className="eyebrow">{finished ? 'A SWEET LITTLE MASTERPIECE' : 'WELCOME TO YOUR SWEET ESCAPE'}</p><h1>{finished ? 'Made by you, with love.' : <>A little cake.<em> A lot of love.</em></>}</h1></div><p className="intro-note">{finished ? '每一份灵感，都值得被珍藏。' : '把喜欢的味道，做成幸福的模样。'}<Leaf size={17} strokeWidth={1.3} /></p></div>

    <section className="workspace" aria-label="蛋糕创作工作台">
      <aside className="ingredient-panel">
        {finished ? <div className="finish-panel"><span className="finish-seal"><Check size={24} strokeWidth={1.4} /></span><p className="eyebrow">YOUR DREAM CAKE</p><h2 ref={finishHeading} tabIndex={-1}>甜蜜，刚刚好。</h2><label className="name-label" htmlFor="cake-name">作品名称</label><input id="cake-name" className="cake-name" maxLength={24} value={cakeName} onChange={e => setCakeName(e.target.value)} /><div className="final-recipe"><span>{base.name}</span><Plus size={12} /><span>{cream.name}</span></div><div className="final-toppings">{summary.length ? summary.map(item => <span key={item.id}>{item.name} <b>× {item.count}</b></span>) : <span>纯粹的原味，也很美好。</span>}</div><p className="finish-signature">One of a kind. Just like you.</p></div> : <>
          <div className="panel-heading"><span className="step-marker">0{step + 1}<span> / 04</span></span><span className="step-en">{current.en}</span></div>
          <h2>{current.title}</h2><p className="panel-subtitle">{current.subtitle}</p>
          <div className={`ingredient-list ${step >= 2 ? 'toppings-list' : ''} ${step === 3 ? 'decoration-list' : ''}`} key={step}>
            {current.items.map(item => {
              const active = step === 0 ? design.base === item.id : step === 1 ? design.cream === item.id : pendingType === item.id || chosen?.type === item.id;
              const count = step >= 2 ? design.items.filter(t => t.type === item.id).length : 0;
              return <button className={`ingredient ${active ? 'is-active' : ''}`} key={item.id} aria-label={`${step >= 2 ? '添加' : '选择'}${item.name}`} aria-pressed={step < 2 ? active : pendingType === item.id} onClick={() => selectIngredient(item)}>
                <IngredientArt type={item.id} color={item.color} frosting={step === 1} /><span className="ingredient-copy"><strong>{item.name}</strong><small>{item.en}</small></span><span className="ingredient-action">{step >= 2 ? <>{count > 0 && <small className="item-count">{count}</small>}<Plus size={15} /></> : active ? <Check size={17} /> : <span className="empty-check" />}</span>
              </button>;
            })}
          </div>
          <div className="ingredient-note"><Leaf size={16} strokeWidth={1.3} /><span>{step === 0 ? base.note : step === 1 ? cream.note : '一点新鲜，一点随心。'}</span></div>
        </>}
      </aside>

      <div className="stage">
        <div className="stage-topline"><span className="stage-label">{finished ? 'THE FINISHED CREATION' : 'YOUR CREATION'}<span className="stage-dot" /></span><div className="view-tools">{!finished && step === 1 && <><ToolButton label="涂抹奶油" aria-pressed={mode === 'frost'} onClick={() => setTool('frost')}><Paintbrush size={16} /></ToolButton><ToolButton label="旋转查看" aria-pressed={mode !== 'frost'} onClick={() => setTool('select')}><Rotate3D size={17} /></ToolButton><span className="tool-divider" /></>}{!finished && step >= 2 && <><ToolButton label="选择与拖动" aria-pressed={mode === 'select'} onClick={() => setPendingType(null)}><MousePointer2 size={16} /></ToolButton><span className="tool-divider" /></>}<ToolButton label="立体视角" aria-pressed={view === 'perspective'} onClick={() => { setView('perspective'); setResetView(i => i + 1); }}><Maximize2 size={16} /></ToolButton><ToolButton label="俯视视角" aria-pressed={view === 'top'} onClick={() => { setView('top'); setResetView(i => i + 1); }}><ArrowDown size={17} /></ToolButton><ToolButton label="恢复视角" onClick={() => { setView('perspective'); setResetView(i => i + 1); }}><RotateCcw size={16} /></ToolButton></div></div>
        <div className={`scene ${mode === 'frost' ? 'is-frosting' : ''} ${mode === 'place' ? 'is-placing' : ''}`} style={{ '--tool-cursor': spoonCursor }} data-interaction={mode} data-frosting-strokes={design.strokes.length} data-topping-count={design.items.length} aria-label="可旋转的三维蛋糕预览">
          {mode === 'frost' && <span className="frost-mode-status" role="status">抹奶油中</span>}
          <Suspense fallback={<div className="scene-loading"><LoaderCircle className="spin" size={25} /><span>甜蜜正在成形…</span></div>}><CakeScene baseColor={base.color} creamColor={cream.color} items={design.items} strokes={design.strokes} onStroke={stroke => commit({ ...design, strokes: [...design.strokes, stroke] })} mode={mode} pendingType={pendingType} onPlace={placeIngredient} onDrop={dropIngredient} onCancelTool={() => { setTool('select'); setPendingType(null); }} onNotice={setNotice} selected={selected} onSelect={selectPlaced} {...{ onReady, view, resetView, finished }} /></Suspense>
        </div>
        <div className="stage-caption"><span className="handwritten">{finished ? cakeName || 'My dream cake' : 'a little piece of happiness'}</span><span className="cake-size">6 INCHES <span>·</span> MADE WITH LOVE</span></div>
        {!finished && <div className="history-tools"><ToolButton label="撤销" disabled={historyIndex === 0} onClick={undo}><Undo2 size={17} /></ToolButton><ToolButton label="重做" disabled={historyIndex === history.length - 1} onClick={redo}><Redo2 size={17} /></ToolButton></div>}
      </div>

      {!finished && <aside className={`details-panel ${chosen ? 'has-selection' : ''}`}>
        <div className="recipe-label"><span className="fine-line" /><span>THE RECIPE</span></div><div className="recipe-item"><small>01 / BASE</small><span>{base.name}</span></div><div className="recipe-item"><small>02 / FROSTING</small><span>{cream.name}</span></div><div className="recipe-item"><small>03 / THE FINISHING TOUCH</small><span>{design.items.length} 份小心意</span></div>
        {chosen && <section className="selection-editor" aria-label="装饰编辑">
          <div className="editor-title"><strong>{chosenInfo.name}</strong><ToolButton label="取消选择" onClick={() => setSelected(null)}><X size={14} /></ToolButton></div>
          <label className="size-label" htmlFor="topping-size">大小 <span>{Math.round(chosen.scale * 100)}%</span></label><input id="topping-size" aria-label="装饰大小" type="range" min="0.65" max="1.5" step="0.05" value={chosen.scale} onChange={e => editSelected({ scale: Number(e.target.value) })} />
          <div className="edit-actions"><ToolButton label="旋转装饰" onClick={() => editSelected({ rotation: (chosen.rotation || 0) + Math.PI / 6 })}><RotateCw size={16} /></ToolButton><button className="delete-button" onClick={removeSelected}><Trash2 size={14} />删除</button></div>
        </section>}
        {design.items.length > 0 && <div className="placed-items" aria-label="已放置装饰"><label htmlFor="placed-select">已放置装饰</label><select id="placed-select" value={chosen?.id || ''} onChange={e => selectPlaced(e.target.value || null)}><option value="">选择一份小心意</option>{design.items.map((item, i) => <option key={item.id} value={item.id}>{toppings.find(t => t.id === item.type).name} · {String(i + 1).padStart(2, '0')}</option>)}</select></div>}
      </aside>}
    </section>

    <footer className="workflow-footer">
      {finished ? <><button className="text-button back-edit" onClick={() => setFinished(false)}><ArrowLeft size={17} />继续创作</button><span className="footer-love"><Heart size={14} /> 一份只属于你的甜蜜。</span><button className="primary-button" disabled={!sceneReady || saving} onClick={saveImage}>{saving ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}保存作品 <span>PNG</span></button></> : <>
        <button className="text-button reset-button" disabled={!design.items.length && !design.strokes.length} onClick={() => { commit({ ...design, items: [], strokes: [] }); setSelected(null); setPendingType(null); setNotice('手工奶油和装饰已清空，口味保留。可以撤销。'); }}><RotateCcw size={15} /><span>Reset</span></button>
        <nav className="steps" aria-label="制作步骤">{steps.map((item, i) => <button className={`step ${step === i ? 'current' : ''} ${i < step ? 'completed' : ''}`} key={item.name} aria-current={step === i ? 'step' : undefined} onClick={() => { setStep(i); setSelected(null); }}><span className="step-number">{i < step ? <Check size={12} /> : `0${i + 1}`}</span><span>{item.name}</span></button>)}</nav>
        <div className="navigation-actions"><ToolButton label="上一步" disabled={step === 0} onClick={() => { setStep(i => i - 1); setSelected(null); }}><ChevronLeft size={18} /></ToolButton>{step < 3 ? <button className="primary-button" onClick={() => { setStep(i => i + 1); setSelected(null); }}>下一步 <ArrowRight size={17} /></button> : <button className="primary-button" disabled={!sceneReady} onClick={() => { setSelected(null); setFinished(true); }}>Finish <Sparkles size={17} /></button>}</div>
      </>}
    </footer>
    <div className="bottom-note"><span>DREAM CAKE STUDIO</span><span>生活的甜，亲手来一点。</span><span>CRAFTED WITH A LITTLE LOVE <Heart size={10} /></span></div>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><Check size={16} /><span>{notice}</span></>}</div>
  </main>;
}
