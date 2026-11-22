import * as THREE from './vendor/three.module.min.js';

/** A transparent veil over the original DOM; no screenshot or replacement chart.
 * Rendering runs only during an explicit node change, never on ordinary scroll. */
export function createDissolve(container) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const veil=document.createElement('div');veil.className='pre-dissolve';veil.setAttribute('aria-hidden','true');container.append(veil);
  let renderer=null,material=null,geometry=null,scene,camera,uniforms,dead=false,raf=null,busy=false,resolveFrame=null;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);veil.append(renderer.domElement);
    uniforms={progress:{value:0},resolution:{value:new THREE.Vector2()}};
    material=new THREE.ShaderMaterial({transparent:true,depthTest:false,uniforms,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;varying vec2 vUv;uniform float progress;uniform vec2 resolution;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      void main(){vec2 cell=floor(vUv*resolution/2.);float grain=hash(cell);float cloud=hash(floor(cell/12.));
      float wave=.72*vUv.y+.16*sin(vUv.x*5.+.7)+.12*cloud;float threshold=mix(wave,grain,.57);
      float alpha=step(threshold,mix(-.3,1.3,progress));vec3 ink=mix(vec3(.77,.79,.73),vec3(.96,.97,.93),grain);gl_FragColor=vec4(ink,alpha);}`});
    geometry=new THREE.PlaneGeometry(2,2);scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));camera=new THREE.Camera();
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;veil.replaceChildren();});
  }catch{renderer=null;}
  function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);uniforms.resolution.value.set(innerWidth,innerHeight);}
  function draw(p){if(dead)return;if(renderer){uniforms.progress.value=p;renderer.render(scene,camera);}else{veil.style.background='#e0e2d6';veil.style.opacity=String(p);}}
  function animate(from,to,ms){return new Promise(resolve=>{resolveFrame=resolve;const start=performance.now();const frame=now=>{if(dead){resolve();return;}const t=Math.min(1,(now-start)/ms);draw(from+(to-from)*(t*t*(3-2*t)));if(t<1)raf=requestAnimationFrame(frame);else{resolveFrame=null;resolve();}};raf=requestAnimationFrame(frame);});}
  return {
    get engine(){return renderer?'Three.js / WebGL':'CSS fallback';},
    async play(change){if(dead||busy)return;busy=true;try{if(reduced.matches){await change();return;}resize();veil.style.display='block';veil.style.opacity='1';draw(0);await animate(0,1,420);if(dead)return;await change();if(dead)return;await animate(1,0,540);}finally{veil.style.display='none';busy=false;}},
    dispose(){dead=true;cancelAnimationFrame(raf);resolveFrame?.();resolveFrame=null;geometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();veil.remove();renderer=null;}
  };
}
