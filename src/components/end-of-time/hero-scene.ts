import * as THREE from 'three';
import { createCelestial } from './celestial';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** 星际仪：真实透视场景，独立交互区域让搜索与页面滚动保持可用。 */
export function mountHeroScene(host: HTMLElement) {
  const root = host.closest<HTMLElement>('.cosmic-hero')!;
  const button = root.querySelector<HTMLButtonElement>('[data-cosmic-pause]')!;
  const stage = root.querySelector<HTMLElement>('[data-cosmic-stage]')!;
  const pulseButton = root.querySelector<HTMLButtonElement>('[data-cosmic-pulse]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-cosmic-reset]')!;
  const status = root.querySelector<HTMLElement>('[data-cosmic-status]')!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
  catch { host.dataset.ready = 'fallback'; status.textContent = '静态星空 · 当前设备未开启 3D'; return () => {}; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030914');
  scene.fog = new THREE.FogExp2('#030914', .017);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 150);
  const controls = new OrbitControls(camera, stage);
  controls.enableDamping = true; controls.dampingFactor = .065;
  controls.enablePan = false; controls.minDistance = 7; controls.maxDistance = 17;
  controls.autoRotateSpeed = .32; controls.rotateSpeed = .65;
  const reset = () => { camera.position.set(0, 2.3, 12); controls.target.set(0, 0, 0); controls.update(); };
  reset();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .65, .45, .8);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const abort = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches, visible = true, last = 0, frame = 0, time = 0, pulseAge = 10, lost = false;
  const { coreMaterial, particleMat, core, grid, ringGroups, debris, wave, nebulaTexture } = createCelestial(scene);
  const draw=()=>{if(!lost)composer.render();};
  const sync=()=>{button.textContent=paused?'播放星空':'暂停星空';button.setAttribute('aria-pressed',String(paused));host.dataset.paused=String(paused);controls.autoRotate=!paused;};
  const tick=(now:number)=>{
    frame=0;if(!visible||document.hidden||lost)return;
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(!paused){time+=dt;pulseAge+=dt;}
    const pulse=Math.max(0,1-pulseAge/2.5);
    coreMaterial.uniforms.uTime.value=time;coreMaterial.uniforms.uPulse.value=pulse;
    particleMat.uniforms.uTime.value=time;particleMat.uniforms.uPulse.value=pulse;
    core.rotation.y=time*.06;grid.rotation.y=-time*.035;
    ringGroups.forEach((ring,i)=>{ring.rotation.z=[-.35,.55,-.5][i]+Math.sin(time*.12+i)*.12;});
    debris.rotation.y=time*.025;wave.scale.setScalar(1+pulseAge*2.5);wave.material.opacity=pulse*.7;bloom.strength=.65+pulse*.45;
    controls.update(dt);draw();
    if(!paused||dragging)frame=requestAnimationFrame(tick);
  };
  let dragging=false;
  const schedule=()=>{cancelAnimationFrame(frame);frame=0;if(visible&&!document.hidden&&!lost){last=performance.now();frame=requestAnimationFrame(tick);}};
  const resize=()=>{
    const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;
    // 投影中心跟随实际交互区域，避免响应式断点后画面与鼠标区域错位。
    const area=stage.getBoundingClientRect(),box=host.getBoundingClientRect();
    camera.zoom=area.height/h*1.5;
    camera.setViewOffset(w,h,w/2-(area.left-box.left+area.width/2),h/2-(area.top-box.top+area.height/2),w,h);
    camera.updateProjectionMatrix();draw();
  };
  const ro=new ResizeObserver(resize);ro.observe(host);
  const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();});io.observe(root);
  controls.addEventListener('start',()=>{dragging=true;schedule();});
  controls.addEventListener('end',()=>{dragging=false;if(paused){controls.update();draw();}});
  controls.addEventListener('change',()=>{if(paused)draw();});
  button.addEventListener('click',()=>{paused=!paused;sync();schedule();},{signal:abort.signal});
  pulseButton.addEventListener('click',()=>{pulseAge=0;paused=false;sync();status.textContent='共振已释放 · 星尘正在扩散';host.dataset.pulse=String(Number(host.dataset.pulse||0)+1);schedule();},{signal:abort.signal});
  resetButton.addEventListener('click',()=>{reset();status.textContent='拖拽旋转 · 滚轮缩放 · 双击共振';schedule();},{signal:abort.signal});
  stage.addEventListener('dblclick',()=>pulseButton.click(),{signal:abort.signal});
  stage.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();pulseButton.click();}
    if(event.key.toLowerCase()==='r')resetButton.click();
    if(event.key.startsWith('Arrow')){event.preventDefault();const spherical=new THREE.Spherical().setFromVector3(camera.position);spherical.theta+=(event.key==='ArrowLeft'?.12:event.key==='ArrowRight'?-.12:0);spherical.phi+=(event.key==='ArrowUp'?-.12:event.key==='ArrowDown'?.12:0);spherical.makeSafe();camera.position.setFromSpherical(spherical);controls.update();draw();}
  },{signal:abort.signal});
  motion.addEventListener('change',()=>{paused=motion.matches;sync();schedule();},{signal:abort.signal});
  document.addEventListener('visibilitychange',schedule,{signal:abort.signal});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);button.hidden=true;pulseButton.disabled=true;resetButton.disabled=true;host.dataset.ready='fallback';renderer.domElement.style.display='none';status.textContent='观测中断 · 刷新页面重新连接';},{signal:abort.signal});
  resize();sync();schedule();button.hidden=false;pulseButton.disabled=false;resetButton.disabled=false;host.dataset.ready='true';
  return ()=>{abort.abort();cancelAnimationFrame(frame);ro.disconnect();io.disconnect();controls.dispose();scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Points||obj instanceof THREE.Sprite){if('geometry' in obj)obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>m.dispose());}});nebulaTexture.dispose();bloom.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();};
}
