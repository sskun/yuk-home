import * as THREE from 'three';
import { createCelestial } from './celestial';

/** 直接复用首页星际仪，再扩展外围轨道、观测卫星与纵深星流。 */
export function createObservatory(scene: THREE.Scene) {
  const model = createCelestial(scene);
  // 全屏核心占比更大，略收敛发光；首页实例不受影响。
  model.coreMaterial.uniforms.uGentle.value = .22;
  model.particleMat.uniforms.uGentle.value = .48;
  model.coreMaterial.fragmentShader = model.coreMaterial.fragmentShader.replace(
    'if(uMode>1.5)col=col.bgr*vec3(1.4,.9,.5);else if(uMode>.5)col=col.brg*vec3(1.,.6,1.3);',
    'vec3 base=col;col=mix(base,base.brg*vec3(.8,.65,1.1),smoothstep(0.,1.,uMode));col=mix(col,base.bgr*vec3(1.1,.8,.55),smoothstep(1.,2.,uMode));'
  );
  const outer = new THREE.Group(); outer.rotation.set(.65,-.3,-.35); scene.add(outer);
  const darkMetal = new THREE.MeshStandardMaterial({ color:'#285164',metalness:.72,roughness:.45 });
  const gold = new THREE.MeshStandardMaterial({ color:'#b29462',metalness:.65,roughness:.42 });
  const filament = new THREE.MeshBasicMaterial({ color:'#86b9cc',transparent:true,opacity:.25 });
  for(let i=0;i<3;i++) {
    const arc=new THREE.Mesh(new THREE.TorusGeometry(4.1+i*.16,.025,8,180,Math.PI*.54),i%2?gold:darkMetal);
    arc.rotation.z=i*Math.PI*.67;outer.add(arc);
    const line=new THREE.Mesh(new THREE.TorusGeometry(4.2+i*.16,.007,4,180,Math.PI*.6),filament);
    line.rotation.z=i*Math.PI*.67;outer.add(line);
  }
  const ticks=new THREE.InstancedMesh(new THREE.BoxGeometry(.014,.09,.035),gold,96);
  const dummy=new THREE.Object3D();
  for(let i=0;i<96;i++) {
    const a=i/96*Math.PI*2;dummy.position.set(Math.cos(a)*4.65,Math.sin(a)*4.65,0);dummy.rotation.z=a-Math.PI/2;dummy.scale.y=i%8===0?2:1;dummy.updateMatrix();ticks.setMatrixAt(i,dummy.matrix);
  }
  outer.add(ticks);
  const satellites: THREE.Group[]=[];
  for(let i=0;i<2;i++) {
    const satellite=new THREE.Group();
    const body=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),darkMetal);satellite.add(body);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.3,.012,5,60),new THREE.MeshBasicMaterial({color:i?'#c9ac77':'#76b5cf'}));halo.rotation.x=.5; satellite.add(halo);
    satellites.push(satellite);scene.add(satellite);
  }
  // 纵深星流保持稀疏，以透视和远近大小表达空间，不再用满屏强光。
  const trailGeo = new THREE.BufferGeometry();
  const count=innerWidth<700?700:1800, positions=new Float32Array(count*3);
  const random=THREE.MathUtils.seededRandom;
  for(let i=0;i<count;i++) {
    const a=random()*Math.PI*2,r=5+random()*10;
    positions.set([Math.cos(a)*r,(random()-.5)*3,Math.sin(a)*r-4],i*3);
  }
  trailGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const trail=new THREE.Points(trailGeo,new THREE.PointsMaterial({color:'#7799b2',size:.022,transparent:true,opacity:.4,depthWrite:false}));scene.add(trail);
  const dustClouds: THREE.Sprite[]=[];
  for(let i=0;i<2;i++) {
    const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:model.nebulaTexture,color:i?'#6a507e':'#426c8d',opacity:.3,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    cloud.position.set(i?7:-7,i?3:-2,-12);cloud.scale.set(22,12,1);dustClouds.push(cloud);scene.add(cloud);
  }
  let currentPhase=0;
  return {
    textures:[model.nebulaTexture],
    update(time:number, phase:number, energy:number, dt:number, pulseProgress:number) {
      currentPhase=THREE.MathUtils.damp(currentPhase,phase,1,dt);
      model.coreMaterial.uniforms.uMode.value=currentPhase;
      model.coreMaterial.uniforms.uTime.value=time*.35;
      model.coreMaterial.uniforms.uPulse.value=energy*.08;
      model.particleMat.uniforms.uTime.value=time*.4;
      model.particleMat.uniforms.uPulse.value=energy*.45;
      model.core.rotation.y=time*.015;model.grid.rotation.y=-time*.008;
      model.ringGroups.forEach((ring,i)=>{ring.rotation.z=[-.35,.55,-.5][i]+Math.sin(time*.025+i)*.08;});
      model.particles.rotation.z=.15+currentPhase*.08;
      model.debris.rotation.y=time*.006;outer.rotation.z=-.35+time*.004;
      satellites.forEach((satellite,i)=>{
        const a=time*.012+i*Math.PI+.5;const r=4.7+i*.65;
        satellite.position.set(Math.cos(a)*r,Math.sin(a)*1.3,Math.sin(a)*r);
        satellite.rotation.y=time*.035;
      });
      model.wave.visible=energy>0;model.wave.scale.setScalar(1+pulseProgress*3);model.wave.material.opacity=energy*.18;
      trail.rotation.y=-time*.0015;
    }
  };
}
