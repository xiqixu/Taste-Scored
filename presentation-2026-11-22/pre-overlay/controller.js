import { AnchorGuide, isPainted, resolveTarget } from './anchors.js';
import { createDissolve } from './transition.js';
import { createPreLayout } from './layout.js?controls=inline';

// Each stop points into the existing document. No chart is imported, cloned or
// rebuilt here; scrolling a .step lets the original IntersectionObserver act.
const blackberryMark=()=>[...document.querySelectorAll('#wheel .arc')].find(mark=>isPainted(mark)&&mark.querySelector('title')?.textContent.trim().endsWith('Blackberry'))??resolveTarget('#wheel .arc');
const stops = {
  wheel:{step:'#act-wheel .step[data-state="explore"]',avoid:'#wheel .arc',cues:[['Data structure','#wheel .arc'],['Visual construction',blackberryMark],['Story purpose','#act-wheel .step[data-state="explore"] p']]},
  scores:{step:'#act-dots .step[data-state="swarm:total"]',scrollOffset:.15,avoid:'#dots',cues:[['Reading the marks','#dots circle[data-cherry-source]'],['Avoiding overlap','#dots circle'],['Reading the sample','#act-dots .step[data-state="swarm:total"] p']]},
  production:{step:'#act3-production',avoid:'.production-map__graphic',cues:[['Preparing the data','#production-title'],['Encoding quantity','.production-map__key'],['Understanding geography','#production-map .production-map__producer:not(.is-outside-region) .production-map__symbol']]},
  trade:{step:'#act3-trade',avoid:'.trade-map__graphic',cues:[['Reading the links','#trade-map .trade-map__route[aria-pressed="true"] .trade-map__line'],['Managing complexity','#trade-route-count'],['Interpreting movement','#trade-area']]},
  altitude:{step:'#act3-altitude',avoid:'#dots',cues:[['Comparing variables','#dots .axis'],['Analysing the pattern','#dots .annotation line'],['Drawing a conclusion','#dots .annotation text']]},
  cherry:{step:'#act4-cherry',avoid:'#cherry-scene',cues:[['Starting from evidence','#cherry-scene'],['Building continuity','#cherry-scene'],['Explaining the choice','#cherry-scene .cherry-scene__half']]},
  processing:{step:'#act4-processing',avoid:'.process-panel__comparison',cues:[['Organising information','.process-panel__controls'],['Supporting comparison','.process-panel__comparison'],['Connecting the story','.process-panel__layers']]},
  varieties:{step:'#act4-varieties',scroll:'#act4-varieties .varieties__layout',avoid:'#act4-varieties .varieties__layout',cues:[['Reading relationships','#lineage-caturra'],['Comparing scores','#varieties-chart'],['Checking the evidence','.varieties__row-count']]},
  taste:{step:'#act-yours',scroll:'#taste',avoid:'.taste__radar',cues:[['Seeing the profile','.taste__radar'],['Finding matches','.taste__matches'],['Reading responsibly','.taste__reference']]},
  team:{step:'#credits',scroll:'#credits .credits__cols > div:nth-child(2)',avoid:'#credits .credits__cols > div:nth-child(2)',cues:[['xiqixu','#credits .credits__cols > div:nth-child(2)'],['rongxi','#credits .credits__cols > div:nth-child(2)'],['Delivery','#credits .credits__cols']]},
};
const markup=`
<svg class="pre-lines" aria-hidden="true"><path class="pre-line-shadow"></path><path class="pre-line"></path><circle class="pre-endpoint" r="4"></circle><circle class="pre-startpoint" r="2.5"></circle></svg>
<aside class="pre-panel" aria-labelledby="pre-title">
  <header class="pre-drag-handle"><span class="pre-label">PRESENTATION LAYER</span><button class="pre-hide" title="Hide explanations (H)" aria-label="Hide explanations">Hide</button></header>
  <div class="pre-panel-scroll"><div class="pre-meta"><span class="pre-section"></span></div>
  <h2 id="pre-title"></h2><p class="pre-summary"></p>
  <div class="pre-cues" role="group" aria-label="Guide-line focus"></div><p class="pre-focus" aria-live="polite"></p>
  <dl class="pre-team" hidden><div><dt>xiqixu</dt><dd>Website construction<br>Overall storyline conception<br>Visual style & aesthetic direction</dd></div><div><dt>rongxi</dt><dd>Data collection & scraping<br>Data cleaning & organization<br>Additional content for Act 3</dd></div></dl>
  <div class="pre-sources" aria-label="Sources"></div>
  <details class="pre-notes"><summary>Full speaker notes</summary><div class="pre-note-text"></div></details>
  <p class="pre-free-scroll">Explore freely. <button class="pre-return-inline">Return to focus</button></p>
  </div>
  <nav class="pre-toolbar" aria-label="Presentation controls">
    <select class="pre-stop" aria-label="Presentation stop"></select>
    <button class="pre-prev" aria-label="Previous presentation stop">Previous</button>
    <button class="pre-next" aria-label="Next presentation stop">Next</button>
  </nav>
</aside>
<button class="pre-restore" aria-label="Show explanations" hidden>Show</button>`;

const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const editing = event => event.composedPath().some(el=>el instanceof HTMLElement && (el.matches('input,select,textarea')||el.isContentEditable));

export async function mountPresentation({onExit}={}) {
  const entry={x:scrollX,y:scrollY,url:location.href,focus:document.activeElement};
  const cleanEntry=new URL(entry.url);cleanEntry.searchParams.delete('pre');entry.url=cleanEntry.href;
  const [content,css]=await Promise.all([
    fetch(new URL('./content.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Presentation content unavailable');return r.json();}),
    fetch(new URL('./styles.css?controls=inline',import.meta.url)).then(r=>{if(!r.ok)throw Error('Presentation style unavailable');return r.text();}),
  ]);
  const nodes=content.nodes;
  const host=document.createElement('div');host.id='pre-overlay-host';host.dataset.preOverlay='active';
  const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=css;shadow.append(style);
  const layer=document.createElement('div');layer.className='pre-root';layer.innerHTML=markup;shadow.append(layer);document.body.append(host);
  const $=selector=>shadow.querySelector(selector), panel=$('.pre-panel'),toolbar=$('.pre-toolbar');
  const guide=new AnchorGuide($('.pre-lines'),panel), transition=createDissolve(layer);
  const layout=createPreLayout({host,shadow,panel,toolbar});
  const events=new AbortController();const opts={signal:events.signal};
  let current=0,cue=0,hidden=false,dead=false,busy=false,layoutFocusTimer=null;
  let scrollContext=null,syncFrame=null,syncLocks=1;
  // Follow the same center-of-viewport trigger as the original story. Read its
  // active steps; never change their classes or call any chart's setState.
  const storySteps=[...document.querySelectorAll('#act-wheel .step,#act-dots .step')];
  const scrollSections=[...document.querySelectorAll('#act4-varieties,#act-yours,#credits')];
  const indexOf=id=>nodes.findIndex(node=>node.id===id);
  function contextAtViewport() {
    // Notes on narrow screens live above the story. Visiting them must preserve
    // the selected explanation rather than selecting the introduction again.
    const panelRect=panel.getBoundingClientRect();
    if(layout.mode==='narrow'&&!hidden&&panelRect.bottom>0&&panelRect.top<innerHeight)return null;
    const middle=innerHeight/2;
    const hero=document.querySelector('.hero');
    if(hero&&hero.getBoundingClientRect().bottom>middle)return {id:'wheel',element:hero,state:null,selector:'.hero'};
    const candidates=[...storySteps,...scrollSections].map(element=>{
      const rect=element.getBoundingClientRect();
      return {element,rect,distance:Math.max(rect.top-middle,middle-rect.bottom,0)};
    }).filter(item=>item.rect.height>0).sort((a,b)=>a.distance-b.distance);
    const closest=candidates[0];if(!closest)return null;
    const element=closest.element,state=element.dataset.state;
    if(element.classList.contains('step')){
      // IntersectionObserver may run just after the scroll event. Its class
      // mutation schedules another pass, keeping the narration and chart aligned.
      if(!element.classList.contains('is-active'))return null;
      const inWheel=element.closest('#act-wheel');
      const id=inWheel?'wheel'
        :state==='production'?'production':state==='trade'?'trade'
        :state==='scatter:altitude:total'?'altitude'
        :state==='cherry'?'cherry':state==='processing'?'processing':'scores';
      const selector=`${inWheel?'#act-wheel':'#act-dots'} .step[data-state="${CSS.escape(state)}"]`;
      return {id,element,state,selector};
    }
    const id=element.id==='act4-varieties'?'varieties':element.id==='act-yours'?'taste':'team';
    return {id,element,state:null,selector:`#${element.id}`};
  }
  function syncFromScroll(){
    syncFrame=null;if(dead||busy||syncLocks)return;
    const context=contextAtViewport();if(!context)return;
    const index=indexOf(context.id);if(index<0)return;
    const changed=index!==current,stepChanged=context.element!==scrollContext?.element;
    if(!changed&&!stepChanged)return;
    current=index;scrollContext=context;
    if(changed){cue=0;$('.pre-notes').open=false;$('.pre-panel-scroll').scrollTop=0;render();}
    else updateCue();
    // Scrolling updates only the overlay: no scrollTo, dissolve, or focus change.
    guide.draw();
  }
  function scheduleSync(){if(!dead&&syncFrame===null)syncFrame=requestAnimationFrame(syncFromScroll);}
  const stepObserver=new MutationObserver(scheduleSync);
  storySteps.forEach(step=>stepObserver.observe(step,{attributes:true,attributeFilter:['class']}));
  for(const [index,node] of nodes.entries()){const option=document.createElement('option');option.value=index;option.textContent=`${String(index+1).padStart(2,'0')} / ${nodes.length} · ${node.title}`;$('.pre-stop').append(option);}

  function updateCue() {
    const node=nodes[current],config=stops[node.id];
    const context=scrollContext?.id===node.id?scrollContext:null;
    const cues=config.cues.map(item=>[...item]);
    // The wheel and score chapter have several original scroll states. Their
    // guide must use the current state, not only the guided tour's landing step.
    if(context?.state&&['wheel','scores'].includes(node.id))cues[2][1]=()=>context.element.querySelector('p');
    if(context?.selector==='.hero'){
      cues[0][1]='#hero-wheel .arc';cues[1][1]='#hero-wheel .arc-label';cues[2][1]='.hero__lede';
    }
    $('.pre-cues').replaceChildren();
    cues.forEach(([label,selector],index)=>{
      const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(index===cue));
      button.addEventListener('click',()=>{cue=index;updateCue();},opts);$('.pre-cues').append(button);
    });
    $('.pre-focus').textContent=node.bullets?.[cue]??node.summary;
    guide.setTarget(cues[cue][1],context?.selector??config.step);
  }
  function render() {
    const node=nodes[current];
    $('.pre-stop').value=current;
    $('#pre-title').textContent=node.title;$('.pre-summary').textContent=node.summary;
    $('.pre-section').textContent=`${node.section} · ${current+1}/${nodes.length}`;
    $('.pre-note-text').textContent=node.speakerNotes;$('.pre-team').hidden=node.id!=='team';
    $('.pre-sources').replaceChildren();
    for(const source of node.sources??[]){
      const link=document.createElement('a');const url=new URL(source.url,document.baseURI);
      if(!['http:','https:'].includes(url.protocol))continue;
      link.href=url.href;link.textContent=source.label;link.target='_blank';link.rel='noopener';$('.pre-sources').append(link);
    }
    $('.pre-prev').disabled=current===0;$('.pre-next').disabled=current===nodes.length-1;
    updateCue();
  }
  async function focusStop() {
    syncLocks++;
    try{
    const config=stops[nodes[current].id],context=scrollContext?.id===nodes[current].id?scrollContext:null;
    const target=context&&(context.state||context.selector==='.hero')?context.element:document.querySelector(config.scroll??config.step);
    if(!target)return;
    const rect=target.getBoundingClientRect();
    const targetY=scrollY+rect.top+rect.height/2-innerHeight/2+innerHeight*(config.scrollOffset??0);
    window.scrollTo({left:scrollX,top:Math.max(0,targetY),behavior:'instant'});
    // Wait for the original observer and chart layout. We never set their
    // classes, CSS, aria state or internal chart configuration ourselves.
    for(let i=0;i<12&&!dead;i++){
      await sleep(60);const step=document.querySelector(context?.selector??config.step);
      if(!step?.classList.contains('step') || step.classList.contains('is-active'))break;
    }
    if(dead)return;await sleep(80);layout.refresh();guide.draw();
    }finally{syncLocks--;scheduleSync();}
  }
  async function navigate(index) {
    if(dead||busy||index<0||index>=nodes.length||index===current)return;
    busy=true;
    try{await transition.play(async()=>{if(dead)return;current=index;scrollContext=null;cue=0;$('.pre-notes').open=false;$('.pre-panel-scroll').scrollTop=0;render();await focusStop();});}
    finally{busy=false;scheduleSync();}
  }
  async function togglePanel() {
    syncLocks++;
    try{
    const view=layout.captureView();guide.stop();
    hidden=!hidden;panel.hidden=hidden;
    layout.setHidden(hidden);await layout.restoreView(view);
    if(dead)return;
    if(!hidden){if(layout.mode==='narrow')scrollTo({top:0,left:0,behavior:'instant'});guide.start();}
    else if(layout.mode==='narrow'&&!view)await focusStop();
    updateRestoreButton();
    }finally{syncLocks--;scheduleSync();}
  }
  function updateRestoreButton(){
    const outOfView=panel.getBoundingClientRect().bottom<=0;
    const restore=$('.pre-restore');
    restore.hidden=!(hidden||layout.mode==='narrow'&&outOfView);
    restore.textContent=hidden?'Show':'Notes';
    restore.setAttribute('aria-label',hidden?'Show explanations':'Read explanations');
  }
  function restorePanel(){
    if(!hidden&&layout.mode==='narrow'&&panel.getBoundingClientRect().bottom<=0){scrollTo({top:0,left:0,behavior:'instant'});return;}
    togglePanel();
  }
  async function exit() {
    if(dead)return;dead=true;events.abort();stepObserver.disconnect();cancelAnimationFrame(syncFrame);clearTimeout(layoutFocusTimer);guide.dispose();transition.dispose();layout.dispose();host.remove();
    history.replaceState(history.state,'',entry.url);
    await new Promise(requestAnimationFrame);
    window.scrollTo({left:entry.x,top:entry.y,behavior:'instant'});
    if(entry.focus?.isConnected && entry.focus!==document.body)entry.focus.focus({preventScroll:true});
    onExit?.();
  }
  $('.pre-prev').addEventListener('click',()=>navigate(current-1),opts);$('.pre-next').addEventListener('click',()=>navigate(current+1),opts);
  $('.pre-stop').addEventListener('change',e=>navigate(+e.target.value),opts);
  $('.pre-hide').addEventListener('click',togglePanel,opts);$('.pre-restore').addEventListener('click',restorePanel,opts);
  $('.pre-return-inline').addEventListener('click',()=>{if(!busy)focusStop();},opts);
  addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();exit();return;}
    if(editing(event)||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key.toLowerCase()==='h'){event.preventDefault();togglePanel();}
    if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();navigate(current+1);}
    if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();navigate(current-1);}
  },opts);
  addEventListener('resize',()=>{
    const changed=layout.refresh();updateRestoreButton();guide.draw();
    if(changed){clearTimeout(layoutFocusTimer);layoutFocusTimer=setTimeout(()=>{if(!dead&&!busy)focusStop();},150);}
  },opts);
  addEventListener('scroll',()=>{updateRestoreButton();scheduleSync();},{...opts,passive:true});
  render();guide.start();
  // The base page may still be loading its datasets after this lazy module.
  for(let i=0;i<100&&!dead;i++){if(document.querySelector('#wheel svg')&&document.querySelector('#trade-map svg'))break;await sleep(100);}
  if(!dead){await focusStop();if(layout.mode==='narrow')scrollTo({top:0,left:0,behavior:'instant'});}
  syncLocks--;scheduleSync();
  return {exit,get status(){return {enabled:!dead,node:nodes[current].id,hidden,engine:transition.engine,layout:layout.mode,railWidth:layout.railWidth};}};
}
