import * as THREE from 'three';

/** 首页与完整观测站共用的星际仪，保持材质和视觉语言一致。 */
export function createCelestial(scene: THREE.Scene, dense = false, subdued = false) {
  const instrument = new THREE.Group(); scene.add(instrument);
  // 核心的菲涅耳边缘、流动电离纹理和透明外壳形成体积感。
  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uMode: { value: 0 }, uGentle: { value: subdued ? 1 : 0 } },
    vertexShader: `varying vec3 p; varying vec3 n; varying vec3 eye; void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 p; varying vec3 n; varying vec3 eye; uniform float uTime; uniform float uPulse; uniform float uMode; uniform float uGentle;
      void main(){float f=pow(1.-abs(dot(normalize(n),normalize(eye))),2.8);
      float bands=sin(p.y*24.+sin(p.x*11.+uTime*.4)*2.+sin(p.z*15.-uTime*.5)*2.);
      float veins=pow(.5+.5*bands,12.);float cloud=sin(p.x*8.+p.z*12.+uTime*.2)*.5+.5;
      vec3 col=vec3(.008,.025,.055)+vec3(.015,.13,.2)*cloud;
      col+=vec3(.08,1.1,1.6)*(f*1.7+veins*.35)*(1.+uPulse);
      if(uMode>1.5)col=col.bgr*vec3(1.4,.9,.5);else if(uMode>.5)col=col.brg*vec3(1.,.6,1.3);col=mix(col, min(col*vec3(.65,.3,.24),vec3(.22,.42,.5)),uGentle);gl_FragColor=vec4(col,1.);}`
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 48), coreMaterial); instrument.add(core);
  const grid = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 2), new THREE.MeshBasicMaterial({ color: '#73c6db', wireframe: true, transparent: true, opacity: subdued ? .035 : .10 })); instrument.add(grid);
  const gold = new THREE.MeshStandardMaterial({ color: '#aa7950', metalness: subdued ? .45 : .92, roughness: subdued ? .65 : .26 });
  const teal = new THREE.MeshStandardMaterial({ color: '#336477', metalness: subdued ? .45 : .88, roughness: subdued ? .65 : .3 });
  const ringGroups: THREE.Group[] = [];
  for (let j = 0; j < 3; j++) {
    const ring = new THREE.Group(); const angles = [[.7,-.4,-.35],[1.15,.8,.55],[.45,-.5,-.5]][j];
    ring.rotation.set(angles[0], angles[1], angles[2]);
    const radius = 1.75+j*.58;
    ring.add(new THREE.Mesh(new THREE.TorusGeometry(radius, .065, 10, 180), j === 1 ? teal : gold));
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, .012, 6, 180, Math.PI*1.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(j === 1 ? '#80e7ff' : '#ffca7e').multiplyScalar(subdued ? .55 : 2) }));
    ring.add(arc);
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(.04, .12, .08), gold, 72);
    const matrix = new THREE.Object3D();
    for (let i=0;i<72;i++) { const a=i/72*Math.PI*2;matrix.position.set(Math.cos(a)*radius,Math.sin(a)*radius,0);matrix.rotation.z=a-Math.PI/2;matrix.scale.y=i%6===0?2:1;matrix.updateMatrix();ticks.setMatrixAt(i,matrix.matrix); }
    ring.add(ticks); instrument.add(ring); ringGroups.push(ring);
  }
  scene.add(new THREE.HemisphereLight('#8bbcdf','#211626',subdued ? 1.6 : 2));
  const warm = new THREE.PointLight('#ffba70',subdued ? 25 : 65,30);warm.position.set(-3,4,3);scene.add(warm);
  const cold = new THREE.PointLight('#47dfff',subdued ? 28 : 80,25);cold.position.set(2,-2,2);scene.add(cold);
  const random = THREE.MathUtils.seededRandom;
  // 螺旋粒子流具有不同半径与高度，旋转镜头可看见纵深和遮挡。
  const count = subdued ? (innerWidth < 700 ? 1400 : 3200) : innerWidth < 700 ? 4500 : dense ? 16000 : 10000;
  const positions = new Float32Array(count*3), colors = new Float32Array(count*3), sizes = new Float32Array(count);
  for(let i=0;i<count;i++) {
    const a=random()*Math.PI*2, r=2.4+Math.pow(random(),1.6)*4;
    const spiral=a+r*.8, y=(random()-.5)*(.12+r*.06);
    positions.set([Math.cos(spiral)*r,y,Math.sin(spiral)*r],i*3);
    const c=new THREE.Color().setHSL(random()>.55?.54:.09,.6,.45+random()*.3);colors.set(c.toArray(),i*3);sizes[i]=subdued ? .3+random()*.7 : .4+random()*1.5;
  }
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));particleGeo.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  const particleMat=new THREE.ShaderMaterial({ transparent:true,depthWrite:false,vertexColors:true,blending:subdued ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uPulse:{value:0},uGentle:{value:subdued ? 1 : 0}},
    vertexShader:`attribute float size; varying vec3 c; uniform float uTime;uniform float uPulse;void main(){c=color;vec3 p=position;float r=length(p.xz);float a=uTime*.12/max(r,.1);p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;p*=1.+uPulse*.16;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(8.,size*22./max(-mv.z,1.));}`,
    fragmentShader:`varying vec3 c;uniform float uGentle;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(c,exp(-d*d*22.)*mix(.65,.22,uGentle));}` });
  const particles = new THREE.Points(particleGeo, particleMat);particles.rotation.z=.15;scene.add(particles);
  const starsGeo=new THREE.BufferGeometry();const starPositions=new Float32Array(2500*3);
  for(let i=0;i<2500;i++){const v=new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(25+random()*60);starPositions.set(v.toArray(),i*3);}
  starsGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:'#95b8d6',size:subdued ? .035 : .055,transparent:true,opacity:subdued ? .3 : .65})));
  const debris=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.1),gold,90);const dummy=new THREE.Object3D();
  for(let i=0;i<90;i++){const a=random()*6.28,r=3.6+random()*2.5;dummy.position.set(Math.cos(a)*r,(random()-.5)*1.1,Math.sin(a)*r);dummy.rotation.set(random()*6,random()*6,random()*6);dummy.scale.setScalar(.4+random());dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);}scene.add(debris);
  const wave=new THREE.Mesh(new THREE.TorusGeometry(1.4,.018,8,180),new THREE.MeshBasicMaterial({color:new THREE.Color('#91edff').multiplyScalar(subdued ? .55 : 2),transparent:true,opacity:0}));wave.rotation.x=Math.PI/2;scene.add(wave);
  // 柔和星云位于实体后方，颜色只烘焙在本地 Canvas 纹理中。
  const nebulaCanvas=document.createElement('canvas');nebulaCanvas.width=256;nebulaCanvas.height=256;
  const ctx=nebulaCanvas.getContext('2d')!;const gradient=ctx.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,'rgba(55,120,180,.26)');gradient.addColorStop(.4,'rgba(35,60,110,.12)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const nebulaTexture=new THREE.CanvasTexture(nebulaCanvas);const nebula=new THREE.Sprite(new THREE.SpriteMaterial({map:nebulaTexture,opacity:subdued ? .35 : 1,blending:THREE.AdditiveBlending,depthWrite:false}));nebula.scale.set(24,13,1);nebula.position.set(0,0,-8);scene.add(nebula);
  return { coreMaterial, particleMat, core, grid, ringGroups, debris, wave, nebulaTexture, particles, instrument };
}
