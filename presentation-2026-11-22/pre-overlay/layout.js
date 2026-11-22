/** A reversible presentation rail. It reserves space instead of covering any
 * original content. The page's own ResizeObservers redraw its existing SVGs.
 * Only this temporary style/attribute pair reaches the original document. */
export function createPreLayout({host,shadow,panel}) {
  const root=document.documentElement;
  const attribute='data-coffee-pre-layout';
  const previousAttribute=root.getAttribute(attribute);
  const pageStyle=document.createElement('style');pageStyle.id='pre-overlay-reserved-layout';
  document.head.append(pageStyle);
  const railStyle=document.createElement('style');railStyle.dataset.preRailStyle='';shadow.append(railStyle);
  const tooltip=document.getElementById('tooltip'),previousTooltipStyle=tooltip?.getAttribute('style');
  let hidden=false,dead=false,key='',mode='wide',rail=390,contentWidth=innerWidth-390,resizeFrame;

  function clampTooltip(){
    if(dead||!tooltip||tooltip.hidden)return;
    const rect=tooltip.getBoundingClientRect();
    const left=Math.max(6,Math.min(contentWidth-rect.width-8,rect.left));
    if(Math.abs(left-rect.left)>.5)tooltip.style.left=`${left}px`;
  }
  const tipObserver=tooltip?new MutationObserver(clampTooltip):null;
  tipObserver?.observe(tooltip,{attributes:true,attributeFilter:['style','hidden']});

  function refresh(force=false){
    if(dead)return false;
    const nextMode=innerWidth>=1000?'wide':'narrow';
    const nextRail=nextMode==='wide'?(hidden?70:Math.min(390,Math.max(340,Math.round(innerWidth*.24)))):64;
    const nextKey=`${nextMode}/${nextRail}/${innerWidth}/${innerHeight}/${hidden}`;
    if(!force&&nextKey===key)return false;
    key=nextKey;mode=nextMode;rail=nextRail;contentWidth=innerWidth-rail;
    root.setAttribute(attribute,mode);host.dataset.preLayout=mode;host.dataset.preCollapsed=String(hidden);
    // Narrow displays put the notes in normal flow above the untouched story.
    // They never squeeze it into a near-zero column or cover it with a modal.
    if(mode==='narrow')document.body.insertBefore(host,document.body.firstChild);
    else if(document.body.lastElementChild!==host)document.body.append(host);
    pageStyle.textContent=`
      html[${attribute}] body { width:calc(100% - ${rail}px)!important; margin-right:${rail}px!important; }
      html[${attribute}] #tooltip { max-width:min(16rem,calc(100vw - ${rail+20}px)); }
      ${mode==='wide'?`
      html[${attribute}="wide"] .scrolly { grid-template-columns:minmax(250px,.4fr) minmax(0,.6fr); }
      html[${attribute}="wide"] .scrolly__figure { min-width:0; padding-right:clamp(16px,2.5vw,40px); }
      html[${attribute}="wide"] .scrolly__steps { min-width:0; }
      html[${attribute}="wide"] .production-map__key,html[${attribute}="wide"] .trade-map__key { flex-wrap:wrap; }
      ${contentWidth<1120?`html[${attribute}="wide"] .taste { grid-template-columns:minmax(180px,.8fr) minmax(220px,1fr); }
      html[${attribute}="wide"] .taste__matches { grid-column:1 / -1; }
      html[${attribute}="wide"] .taste__radar { max-width:28rem; }`:''}
      `:''}
    `;
    railStyle.textContent=`
      :host { --pre-reserved-rail:${rail}px; }
      .pre-drag-handle { cursor:default!important; touch-action:auto!important; }
      .pre-grip,.pre-place { display:none!important; }
      .pre-panel { right:12px!important; left:auto!important; top:16px!important; width:${Math.max(40,rail-24)}px!important; max-height:calc(100svh - 32px)!important; }
      ${mode==='narrow'?`
      :host { position:relative!important; display:block!important; inset:auto!important; width:100%!important; height:auto!important; }
      :host([data-pre-collapsed="true"]) { height:0!important; }
      .pre-root { position:relative; }
      .pre-panel { position:relative!important; top:auto!important; right:auto!important; left:auto!important; width:calc(100% - 20px)!important; max-height:none!important; margin:10px!important; }
      .pre-panel-scroll { overflow:visible!important; }
      .pre-restore { right:4px!important; width:56px; }
      `:''}
    `;
    // The only painted surface is the glass panel. Reserved width remains an
    // invisible layout allowance so the original charts cannot sit underneath.
    panel.style.removeProperty('left');panel.style.removeProperty('right');panel.style.removeProperty('top');
    panel.style.removeProperty('max-height');
    clampTooltip();cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(clampTooltip);
    // Native chart modules use ResizeObserver; this also notifies any other
    // original resize listeners without replacing their data or SVG elements.
    window.dispatchEvent(new Event('resize'));
    return true;
  }
  function captureView(){
    const x=Math.min(Math.max(contentWidth*.48,80),innerWidth-rail-12),y=Math.min(innerHeight*.35,260);
    let element=document.elementFromPoint(x,y);
    if(element===host)return null;
    element=element?.closest('p,h1,h2,h3,figure,.step,section,footer')??element;
    return element?{element,top:element.getBoundingClientRect().top}:null;
  }
  async function restoreView(view){
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    if(dead||!view?.element?.isConnected)return;
    const delta=view.element.getBoundingClientRect().top-view.top;
    if(Math.abs(delta)>.5)scrollBy({top:delta,left:0,behavior:'instant'});
  }
  refresh(true);
  return {
    refresh,captureView,restoreView,
    get mode(){return mode;},get railWidth(){return rail;},get contentWidth(){return contentWidth;},
    setHidden(value){hidden=value;refresh(true);},
    dispose(){
      dead=true;cancelAnimationFrame(resizeFrame);tipObserver?.disconnect();pageStyle.remove();railStyle.remove();
      if(previousAttribute===null)root.removeAttribute(attribute);else root.setAttribute(attribute,previousAttribute);
      if(tooltip){if(previousTooltipStyle===null)tooltip.removeAttribute('style');else tooltip.setAttribute('style',previousTooltipStyle);}
      window.dispatchEvent(new Event('resize'));
    }
  };
}
