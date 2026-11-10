import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createObservatory } from './observatory';

export function mountEndOfTime() {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const host = element('cosmos'), status = element('status');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
  catch { status.textContent = '当前设备无法开启 3D 观测，请使用支持 WebGL 2 的浏览器。'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.65));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#030914'); scene.fog = new THREE.FogExp2('#030914', .012);
  const camera = new THREE.PerspectiveCamera(44, 1, .1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.enablePan = false;
  controls.minDistance = 8; controls.maxDistance = 24; controls.rotateSpeed = .22; controls.zoomSpeed = .4; controls.minPolarAngle = .08; controls.maxPolarAngle = Math.PI-.08;
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .35, 1.05);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const model = createObservatory(scene);
  const ac = new AbortController();
  const listen = (target: EventTarget, name: string, callback: EventListener) => target.addEventListener(name, callback, { signal: ac.signal });
  const pause = element<HTMLButtonElement>('pause'), slider = element<HTMLInputElement>('time');
  const collapse = element<HTMLButtonElement>('collapse'), ignite = element<HTMLButtonElement>('ignite');
  const restart = element<HTMLButtonElement>('restart'), beacon = element<HTMLButtonElement>('beacon');
  const realmButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-realm]')];
  const names = ['起源', '潮汐', '余烬'];
  const titles = ['星际仪', '引力潮汐', '最后余烬'];
  const clues = ['让时间正向流动，拾取起源碎片。', '将时间滑杆调为负值，在倒流中拾取潮汐碎片。', '暂停时间或将流速归零，让余烬碎片凝结。'];
  const colors = ['#85eaff', '#d6a0ff', '#ffcc80'];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = true, speed = .25, time = 0, pulseAge = 20, finaleAge = 20;
  let mode = 0, completed = false, disposed = false, lost = false;
  let dirty = true, phaseAge = 6;
  controls.addEventListener('change',()=>{dirty=true;});
  const collected = new Set<number>();
  let audio: AudioContext | undefined, audioOn = false;
  const canCollect = () => mode === 0 ? !paused && speed > 0 : mode === 1 ? !paused && speed < 0 : paused || speed === 0;
  const sync = () => {
    dirty=true;
    pause.textContent = paused ? '▶ 慢速播放' : 'Ⅱ 暂停'; host.dataset.paused=String(paused); pause.setAttribute('aria-pressed', String(paused));
    element('phase').textContent = paused || speed === 0 ? '万物静止于此刻' : speed < 0 ? '正在回溯消逝的星光' : '时间仍在流动';
    element('rate').textContent = `${speed.toFixed(2)}×`;
  };
  const viewButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const viewPositions=[new THREE.Vector3(0,2.3,14),new THREE.Vector3(1.5,1.2,8.2),new THREE.Vector3(.1,13,.1)];
  let cameraMove: {from:THREE.Vector3;to:THREE.Vector3;age:number}|undefined;
  const selectView=(index:number)=>{
    dirty=true;
    viewButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    host.dataset.view=String(index);
    if(motion.matches){camera.position.copy(viewPositions[index]);controls.update();cameraMove=undefined;}
    else cameraMove={from:camera.position.clone(),to:viewPositions[index].clone(),age:0};
  };
  viewButtons.forEach((button,i)=>listen(button,'click',()=>selectView(i)));
  controls.addEventListener('start',()=>{cameraMove=undefined;viewButtons.forEach(button=>button.setAttribute('aria-pressed','false'));host.dataset.view='free';});
  const reset = () => {
    camera.position.set(0, 2.3, 14); controls.target.set(0, 0, 0); controls.update();
    cameraMove=undefined;viewButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===0)));host.dataset.view='0';
    speed = .25; slider.value = '.25'; paused = true; pulseAge=20; finaleAge=20; sync();
  };
  reset();
  const beaconWorld = new THREE.Vector3(3.4, 1.2, 1.8);
  const gemMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[0]).multiplyScalar(.65) });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.16), gemMaterial); scene.add(gem);
  const wake = new THREE.Mesh(new THREE.TorusGeometry(.32, .008, 6, 64), new THREE.MeshBasicMaterial({ color: '#aceaff' })); scene.add(wake);
  // 新纪元使用均匀球面发射的星尘；平时完全隐藏，避免持续额外开销。
  const burstCount = innerWidth < 700 ? 500 : 1000;
  const burstPositions = new Float32Array(burstCount * 3);
  for (let i=0;i<burstCount;i++) {
    const phi = Math.acos(1-2*(i+.5)/burstCount), theta = i*2.399963;
    const radius = 1 + THREE.MathUtils.seededRandom()*.4;
    burstPositions.set([Math.sin(phi)*Math.cos(theta)*radius,Math.cos(phi)*radius,Math.sin(phi)*Math.sin(theta)*radius],i*3);
  }
  const burstGeometry = new THREE.BufferGeometry(); burstGeometry.setAttribute('position',new THREE.BufferAttribute(burstPositions,3));
  const burstMaterial = new THREE.PointsMaterial({ color:'#81a7be',size:.025,transparent:true,opacity:0,blending:THREE.NormalBlending,depthWrite:false });
  const burst = new THREE.Points(burstGeometry,burstMaterial);scene.add(burst);
  const pulse = () => { if(pulseAge<8||finaleAge<12)return; pulseAge=0; host.dataset.pulses=String(Number(host.dataset.pulses||0)+1); element('echo-note').textContent='回声已释放 · 涟漪将缓慢消散'; };
  const selectRealm = (next: number) => {
    if(mode!==next)phaseAge=0;
    dirty=true;mode = next; host.dataset.realm = String(mode);

    realmButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === mode)));
    element('chapter-name').textContent = `0${mode+1} / ${titles[mode]}`;
    beacon.setAttribute('aria-label', `收集${names[mode]}碎片`);
    element('beacon-label').textContent = `拾取 · ${names[mode]}`;
    gemMaterial.color.set(colors[mode]).multiplyScalar(.65);
    status.textContent = element<HTMLDetailsElement>('mission-panel').open ? (collected.has(mode) ? `${names[mode]}碎片已归档 · 可切换其它阶段` : clues[mode]) : `${titles[mode]} · 拖拽观察；播放与涟漪均由你主动触发`;
    // 进入或切换星域不触发光效；共振仅由用户主动操作触发。
    updateMission();
  };
  const updateMission = () => {
    dirty=true;
    element('progress').textContent = `${collected.size} / 3`; host.dataset.fragments = String(collected.size);
    document.querySelectorAll('[data-slot]').forEach((slot,i)=>slot.classList.toggle('collected',collected.has(i)));
    ignite.disabled = collected.size !== 3 || completed;
    ignite.innerHTML = completed ? '新纪元已点燃 <span>✧</span>' : collected.size === 3 ? '点燃新纪元 <span>↗</span>' : '集齐碎片，点燃新纪元 <span>↗</span>';
    element('mission-note').textContent = completed ? '你将最后的星光，变成了新的开始。' : collected.size === 3 ? '三枚碎片已共鸣。现在，由你开启新纪元。' : clues[mode];
    restart.hidden = !completed;
  };
  listen(element('mission-panel'),'toggle',()=>{dirty=true;});
  listen(beacon,'click',()=>{
    if(collected.has(mode)||!canCollect())return;
    collected.add(mode);updateMission();
    status.textContent = collected.size === 3 ? '所有时间碎片已归位 · 可以点燃新纪元' : `${names[mode]}碎片已收集 · 切换星域继续寻找`;
  });
  listen(ignite,'click',()=>{
    if(collected.size!==3||completed)return;
    completed=true;finaleAge=0;updateMission();
    host.dataset.epoch='reborn';status.textContent='新纪元已点燃 · 宇宙记得，是你让时间重新开始';
  });
  listen(restart,'click',()=>{collected.clear();completed=false;finaleAge=20;host.dataset.epoch='exploring';updateMission();reset();selectRealm(0);});
  realmButtons.forEach((button,i)=>listen(button,'click',()=>selectRealm(i)));
  listen(pause,'click',()=>{paused=!paused;sync();});
  listen(slider,'input',()=>{speed=Number(slider.value);sync();});
  listen(element('reset'),'click',reset);listen(collapse,'click',pulse);
  listen(renderer.domElement,'dblclick',pulse);
  listen(window,'keydown',((event:KeyboardEvent)=>{
    const target=event.target as HTMLElement;
    if(target.closest('input,button,a,summary,select,textarea')||target.isContentEditable)return;
    if(event.code==='Space'){event.preventDefault();paused=!paused;sync();}
    if(event.key.toLowerCase()==='r')reset();
    if(['1','2','3'].includes(event.key))selectRealm(Number(event.key)-1);
    if(event.key.startsWith('Arrow')){event.preventDefault();cameraMove=undefined;viewButtons.forEach(button=>button.setAttribute('aria-pressed','false'));host.dataset.view='free';const s=new THREE.Spherical().setFromVector3(camera.position);s.theta+=event.key==='ArrowLeft'?.12:event.key==='ArrowRight'?-.12:0;s.phi+=event.key==='ArrowUp'?-.12:event.key==='ArrowDown'?.12:0;s.makeSafe();camera.position.setFromSpherical(s);controls.update();}
  }) as EventListener);
  listen(motion,'change',()=>{if(motion.matches){paused=true;cameraMove=undefined;}sync();});
  const sound=element<HTMLButtonElement>('sound');
  listen(sound,'click',()=>{
    if(!audio){audio=new AudioContext();const gain=audio.createGain();gain.gain.value=.04;gain.connect(audio.destination);[55,82.41,110.15].forEach(f=>{const osc=audio!.createOscillator();osc.frequency.value=f;osc.connect(gain);osc.start();});}
    audioOn=!audioOn;void(audioOn?audio.resume():audio.suspend());sound.setAttribute('aria-pressed',String(audioOn));sound.querySelector('span')!.textContent=audioOn?'开启':'关闭';
  });
  listen(document,'visibilitychange',()=>{last=performance.now();if(audio)void(document.hidden||!audioOn?audio.suspend():audio.resume());});
  listen(renderer.domElement,'webglcontextlost',event=>{
    event.preventDefault();lost=true;renderer.setAnimationLoop(null);beacon.hidden=true;
    [pause,slider,collapse,ignite,...realmButtons,...viewButtons,element<HTMLButtonElement>('reset')].forEach(el=>el.disabled=true);
    status.textContent='观测连接中断，请刷新页面重新进入。';
  });
  function resize(){
    dirty=true;
    const w=host.clientWidth,h=host.clientHeight;beaconWorld.x=w<700?2.1:3.4;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;
    camera.zoom=w<700?.55:.93;
    camera.setViewOffset(w,h,w<700?0:-w*.06,w<700?-h*.08:0,w,h);camera.updateProjectionMatrix();
  }
  listen(window,'resize',resize);resize();
  const projected = new THREE.Vector3();
  let last=performance.now();
  renderer.setAnimationLoop(now=>{
    const elapsed=Math.max(0,(now-last)/1000);const dt=Math.min(elapsed,.05);last=now;if(disposed||lost||document.hidden)return;
    // 默认静止时按需绘制；视角、阶段、任务或单次效果变化才继续占用 GPU。
    const effectWasActive=pulseAge<8||finaleAge<12||phaseAge<6;
    if(!paused)time+=dt*speed;
    phaseAge+=dt;
    // 主动触发的单次效果独立计时，不会因暂停或倒流而卡住或反复触发。
    pulseAge+=elapsed;finaleAge+=elapsed;
    if((paused||speed===0)&&!cameraMove&&!effectWasActive&&!dirty)return;
    collapse.disabled=pulseAge<8||finaleAge<12;
    collapse.textContent=collapse.disabled?'涟漪扩散中…':'触发涟漪';
    const energy=pulseAge<8?Math.sin(Math.PI*pulseAge/8)**2:0;
    const nova=finaleAge<12?Math.sin(Math.PI*finaleAge/12)**2:0;
    model.update(time,mode,motion.matches?0:energy,dt,Math.min(pulseAge/8,1));
    bloom.strength=.28;
    burst.visible=nova>0&&!motion.matches;burst.scale.setScalar(1+finaleAge*.35);burstMaterial.opacity=nova*.12;
    gem.position.copy(beaconWorld);wake.position.copy(gem.position);wake.quaternion.copy(camera.quaternion);
    const missionOpen=element<HTMLDetailsElement>('mission-panel').open;
    gem.visible=wake.visible=missionOpen&&!collected.has(mode);
    if(cameraMove){cameraMove.age+=elapsed;const p=Math.min(cameraMove.age/1.8,1);const eased=p*p*(3-2*p);camera.position.lerpVectors(cameraMove.from,cameraMove.to,eased);if(p===1)cameraMove=undefined;}
    controls.update();
    // 信标实体可以漂浮，拾取目标保持稳定，避免鼠标与触屏追逐移动按钮。
    projected.copy(beaconWorld).project(camera);
    const x=(projected.x*.5+.5)*host.clientWidth,y=(-projected.y*.5+.5)*host.clientHeight;
    beacon.disabled=!canCollect();
    element('beacon-label').textContent=canCollect()?`拾取 · ${names[mode]}`:['正向流动以拾取','倒流时间以拾取','暂停时间以拾取'][mode];
    beacon.hidden=!missionOpen||collected.has(mode)||projected.z>1||projected.z<-1||x<35||x>host.clientWidth-35||y<90||y>host.clientHeight-130;
    beacon.style.left=`${x}px`;beacon.style.top=`${y}px`;
    composer.render();dirty=false;
  });
  host.dataset.ready='true';host.dataset.epoch='exploring';updateMission();selectRealm(0);
  [pause,slider,collapse,...realmButtons,...viewButtons,element<HTMLButtonElement>('reset')].forEach(el=>el.disabled=false);
  function dispose(){
    if(disposed)return;disposed=true;ac.abort();renderer.setAnimationLoop(null);controls.dispose();
    scene.traverse(obj=>{if(obj instanceof THREE.Mesh||obj instanceof THREE.Points||obj instanceof THREE.Sprite){if('geometry' in obj)obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
    model.textures.forEach(texture=>texture.dispose());bloom.dispose();composer.dispose();renderer.dispose();void audio?.close();
  }
  listen(window,'pagehide',((event:PageTransitionEvent)=>{if(!event.persisted)dispose();else void audio?.suspend();}) as EventListener);
  if(import.meta.hot)import.meta.hot.dispose(dispose);
}
