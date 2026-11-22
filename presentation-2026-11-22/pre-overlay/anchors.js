/** aria-hidden is an accessibility hint, not a visibility flag. The original
 * charts intentionally put visible decorative SVG groups behind aria-hidden. */
export function isPainted(element) {
  if(!element?.isConnected || !element.getClientRects().length || element.closest('[hidden],[inert]'))return false;
  for(let node=element;node instanceof Element;node=node.parentElement){
    const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;
  }
  if(element.matches('.arc,.arc-label') && Number(getComputedStyle(element).fillOpacity)<.04)return false;
  const rect=element.getBoundingClientRect();
  return rect.width>1 && rect.height>1;
}

/** Select a painted mark, rather than a collapsed or transparent first match.
 * Functions support semantic marks such as the currently displayed Blackberry. */
export function resolveTarget(selector) {
  if(typeof selector==='function')return selector();
  if(selector instanceof Element)return selector;
  const matches=[...document.querySelectorAll(selector)].filter(isPainted);
  return matches.find(element=>{const r=element.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;})??matches[0]??null;
}

export function paintedBounds(selector) {
  const elements=(typeof selector==='string'?[...document.querySelectorAll(selector)]:[resolveTarget(selector)]).filter(isPainted);
  const bounds=elements.map(element=>element.getBoundingClientRect());
  if(!bounds.length)return null;
  const left=Math.min(...bounds.map(r=>r.left)),top=Math.min(...bounds.map(r=>r.top));
  const right=Math.max(...bounds.map(r=>r.right)),bottom=Math.max(...bounds.map(r=>r.bottom));
  return {left,top,right,bottom,width:right-left,height:bottom-top};
}

/** The only continuously tracked overlay element. It stops completely when the
 * panel is hidden and never changes the original visualization DOM. */
export class AnchorGuide {
  constructor(svg, panel) {
    this.svg = svg; this.panel = panel; this.active = false; this.target = null;
    this.paths = [...svg.querySelectorAll('path')]; this.dots = [...svg.querySelectorAll('circle')];
    this.last = ''; this.raf = null;
  }
  setTarget(selector, activeSelector = null) { this.target = selector; this.activeSelector = activeSelector; this.last = ''; this.draw(); }
  start() {
    if(this.active)return; this.active = true;
    let previous = 0;
    const frame = time => { if(!this.active)return; if(time-previous>30){this.draw();previous=time;} this.raf=requestAnimationFrame(frame); };
    this.raf=requestAnimationFrame(frame);
  }
  stop() { this.active=false; cancelAnimationFrame(this.raf); this.raf=null; this.svg.style.visibility='hidden'; }
  draw() {
    if(!this.active)return;
    const target=resolveTarget(this.target);
    const shown=isPainted(target);
    const step=this.activeSelector && document.querySelector(this.activeSelector);
    const current=!step || !step.classList.contains('step') || step.classList.contains('is-active');
    if(!shown || !current){this.svg.style.visibility='hidden';return;}
    const rect=target.getBoundingClientRect(), panel=this.panel.getBoundingClientRect();
    if(panel.bottom<4||panel.top>innerHeight-4){this.svg.style.visibility='hidden';return;}
    let x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    if(typeof SVGGeometryElement!=='undefined' && target instanceof SVGGeometryElement && target.tagName.toLowerCase()==='path'){
      try{const point=target.getPointAtLength(target.getTotalLength()*.5), matrix=target.getScreenCTM();if(matrix){const screen=new DOMPoint(point.x,point.y).matrixTransform(matrix);x=screen.x;y=screen.y;}}catch{}
    }
    // Controls live in their own right rail, so the original page retains the
    // full viewport height; score axes near its bottom remain valid anchors.
    if(x<4 || x>innerWidth-4 || y<4 || y>innerHeight-4 || rect.width+rect.height<1){this.svg.style.visibility='hidden';return;}
    // Avoid drawing a line through the glass when a user drags it over its target.
    if(x>=panel.left && x<=panel.right && y>=panel.top && y<=panel.bottom){this.svg.style.visibility='hidden';return;}
    this.svg.style.visibility='visible';
    const fromX=x<panel.left+panel.width/2?panel.left:panel.right;
    const fromY=Math.max(panel.top+45,Math.min(panel.bottom-25,y));
    const elbow=fromX+(x<fromX?-24:24),d=`M${fromX},${fromY} L${elbow},${fromY} L${x},${y}`;
    if(d===this.last)return; this.last=d;
    this.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
    this.paths.forEach(path=>path.setAttribute('d',d));
    this.dots[0].setAttribute('cx',x);this.dots[0].setAttribute('cy',y);
    this.dots[1].setAttribute('cx',fromX);this.dots[1].setAttribute('cy',fromY);
  }
  dispose(){this.stop();this.svg.remove();}
}
