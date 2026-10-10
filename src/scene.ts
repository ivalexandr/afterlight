import * as THREE from 'three';
import type { Era } from './timeline';
import { createBlackHole } from './blackHole';
import { createStellarSurface, createStellarHalo } from './stellar';
import { createEarth } from './earth';

export class CosmicScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, .1, 1200);
  private stars: THREE.Points;
  private subject: THREE.Group = new THREE.Group();
  private outgoing: {group:THREE.Group; elapsed:number}[] = [];
  private incomingElapsed = 1.1;
  private readonly duration = 1.1;
  private clock = new THREE.Clock();
  private frame = 0;
  private targetColor = new THREE.Color('#77b9ff');
  private currentColor = new THREE.Color('#77b9ff');
  private active: Era['scene'] = 'earth';
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0,0,14);
    const positions = new Float32Array(3200*3);
    for(let i=0;i<3200;i++){
      const r=50+Math.random()*400, theta=Math.random()*Math.PI*2, phi=Math.acos(2*Math.random()-1);
      positions[i*3]=r*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=r*Math.sin(phi)*Math.sin(theta);
      positions[i*3+2]=r*Math.cos(phi);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.stars=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#b9d5ff',size:.58,sizeAttenuation:false,transparent:true,opacity:.75,depthWrite:false}));
    this.scene.add(this.stars);
    this.scene.add(new THREE.AmbientLight('#8aa4d8',1.3));
    const light=new THREE.PointLight('#ffdfb2',140,70);light.position.set(-5,5,8);this.scene.add(light);
    this.scene.add(this.subject);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;this.camera.aspect=w/Math.max(h,1);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);};
    new ResizeObserver(resize).observe(host);resize();
    this.animate();
  }
  private sphere(radius:number,color:string,emissive:string='#000000',intensity=0):THREE.Mesh {
    return new THREE.Mesh(new THREE.SphereGeometry(radius,64,48),new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.06,emissive,emissiveIntensity:intensity}));
  }
  private glow(radius:number,color:string,opacity=.14) {
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.BackSide,depthWrite:false}));
    this.subject.add(mesh);return mesh;
  }
  setEra(era:Era){
    this.active=era.scene;this.targetColor.set(era.accent);
    for(const old of this.outgoing)this.disposeGroup(old.group);
    this.outgoing=[];
    if(this.reduceMotion)this.disposeGroup(this.subject);
    else if(this.subject.children.length)this.outgoing.push({group:this.subject,elapsed:0});
    this.subject=new THREE.Group();
    this.scene.add(this.subject);
    this.subject.rotation.set(0,0,0);
    this.incomingElapsed=this.reduceMotion?this.duration:0;
    this.subject.scale.setScalar(this.reduceMotion?1:.82);
    if(era.scene==='dark')return;
    if(era.scene==='earth'||era.id==='oceans'){
      this.subject.add(createEarth(era.id==='oceans'?'dry':era.id==='continents'?'future':'present'));
    }else if(era.scene==='sun'||era.scene==='giant'||era.scene==='dwarf'){
      const radius=era.scene==='giant'?4.4:era.scene==='dwarf'?1.5:2.65;
      const color=era.scene==='giant'?'#ef673e':era.scene==='dwarf'?'#ba4c35':'#ffbd65';
      const star=createStellarSurface(radius,era.scene);
      this.subject.add(createStellarHalo(radius,color));
      this.subject.add(star);
    }else if(era.scene==='blackhole'){
      const hole=createBlackHole();
      // At the end of the black-hole era, the disk should be much dimmer.
      hole.material.uniforms.uDisk.value=era.id==='evaporation'?.22:.9;
      this.subject.add(hole);
    }else if(era.scene==='galaxy'||era.scene==='nebula'){
      const count=16000,pos=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),base=new THREE.Color(era.accent);
      for(let i=0;i<count;i++){
        const core=i<count*.3;
        const r=core?Math.pow(Math.random(),1.9)*2.4:Math.pow(Math.random(),.75)*5.7;
        const arm=i%3;
        const angle=arm*Math.PI*2/3+r*.9+(Math.random()-.5)*(core?2.8:.65);
        pos[i*3]=Math.cos(angle)*r;
        pos[i*3+1]=Math.sin(angle)*r*.52;
        pos[i*3+2]=(Math.random()-.5)*(core?.9:.42);
        const c=base.clone().lerp(new THREE.Color(core?'#fff3cf':'#e4f2ff'),core?.68:Math.random()*.65);
        colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
        sizes[i]=core?1.5+Math.random()*1.5:.65+Math.random()*1.2;
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
      const starsMaterial=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        uniforms:{uTime:{value:0},uFade:{value:1}},
        vertexShader:`
          attribute vec3 color;attribute float aSize;varying vec3 vColor;
          uniform float uTime;
          void main(){
            vColor=color;
            vec4 mv=modelViewMatrix*vec4(position,1.);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp(aSize*135.0/max(-mv.z,1.0),3.0,23.0);
          }
        `,
        fragmentShader:`
          precision mediump float;
          varying vec3 vColor;uniform float uFade;
          void main(){
            float r=length(gl_PointCoord-.5)*2.;
            float glow=exp(-r*r*5.0);
            float core=exp(-r*r*32.0);
            float a=(glow*.48+core*.85)*uFade;
            gl_FragColor=vec4(vColor*(glow*.55+core*1.8),a);
          }
        `
      });
      const galacticStars=new THREE.Points(geo,starsMaterial);
      galacticStars.userData.animatedShader=true;
      this.subject.add(galacticStars);
      // Tilt the disk once; rotate its particles around their own disk normal.
      this.subject.rotation.x=.6;
      this.subject.userData.diskGalaxy=true;
    }else{
      // The degenerate-matter era: faint stellar corpses, drifting apart.
      // At the hypothetical proton-decay milestone the particles are fewer
      // and more diffuse. No large planet-like sphere remains.
      const protonDecay=era.id==='protons';
      const count=protonDecay?700:2100;
      const positions=new Float32Array(count*3);
      const colors=new Float32Array(count*3);
      const sizes=new Float32Array(count);
      const phases=new Float32Array(count);
      const velocities=new Float32Array(count*3);
      const cold=new THREE.Color('#83a6da');
      const warm=new THREE.Color('#ffd1a2');
      const purple=new THREE.Color('#b6a6f4');
      for(let i=0;i<count;i++){
        const t=Math.random()*Math.PI*2;
        const radial=Math.pow(Math.random(),.65)*(protonDecay?8.5:6.8);
        const thickness=(Math.random()-.5)*(protonDecay?6:2.7);
        positions[i*3]=Math.cos(t)*radial;
        positions[i*3+1]=Math.sin(t)*radial*.53;
        positions[i*3+2]=thickness;
        const color=protonDecay?cold.clone().lerp(purple,Math.random()):cold.clone().lerp(warm,Math.pow(Math.random(),3));
        colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
        sizes[i]=protonDecay?.35+Math.random()*.7:.55+Math.random()*1.6;
        phases[i]=Math.random()*Math.PI*2;
        const speed=protonDecay?.15:.07;
        velocities[i*3]=Math.cos(t)*speed;
        velocities[i*3+1]=Math.sin(t)*speed;
        velocities[i*3+2]=(Math.random()-.5)*speed;
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
      geometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
      geometry.setAttribute('aVelocity',new THREE.BufferAttribute(velocities,3));
      const material=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        uniforms:{uTime:{value:0},uFade:{value:1}},
        vertexShader:`
          attribute vec3 color;
          attribute float aSize,aPhase;
          attribute vec3 aVelocity;
          varying vec3 vColor;
          varying float vPulse;
          uniform float uTime;
          void main(){
            vColor=color;
            float drift=mod(uTime,120.0);
            vec3 p=position+aVelocity*drift;
            vec4 mv=modelViewMatrix*vec4(p,1.);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp(aSize*105.0/max(-mv.z,1.),1.5,14.);
            vPulse=.76+.24*sin(uTime*.45+aPhase);
          }
        `,
        fragmentShader:`
          precision mediump float;
          varying vec3 vColor;
          varying float vPulse;
          uniform float uFade;
          void main(){
            float r=length(gl_PointCoord-.5)*2.;
            float core=exp(-r*r*22.);
            float halo=exp(-r*r*4.);
            float alpha=(core*.7+halo*.22)*vPulse*uFade;
            gl_FragColor=vec4(vColor*(core*1.7+halo*.35),alpha);
          }
        `
      });
      const debris=new THREE.Points(geometry,material);
      debris.userData.animatedShader=true;
      this.subject.add(debris);
      if(!protonDecay){
        // The final compact stellar remnant: small, cold and barely luminous.
        const core=this.sphere(.36,'#7f9bbf','#4d6a91',.2);
        core.position.set(1.1,-.3,.45);
        this.subject.add(core);
        const halo=new THREE.Sprite(new THREE.SpriteMaterial({
          color:'#779bd2',transparent:true,opacity:.13,
          blending:THREE.AdditiveBlending,depthWrite:false
        }));
        halo.position.copy(core.position);
        halo.scale.set(2.4,2.4,1);
        this.subject.add(halo);
      }

    }
  }
  private fade(group:THREE.Group,opacity:number){
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite))return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials){
        const m=material as THREE.Material & {userData:{baseOpacity?:number}};
        if(m.userData.baseOpacity===undefined)m.userData.baseOpacity=m.opacity;
        m.transparent=true;
        m.depthWrite=false;
        m.opacity=m.userData.baseOpacity*opacity;
        if(m instanceof THREE.ShaderMaterial && m.uniforms.uFade)m.uniforms.uFade.value=opacity;
      }
    });
  }
  private disposeGroup(group:THREE.Group){
    this.scene.remove(group);
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh || object instanceof THREE.Points))return;
      object.geometry.dispose();
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials)material.dispose();
    });
  }
  private ease(t:number){return t*t*(3-2*t);}
  private animate=()=>{
    this.frame=requestAnimationFrame(this.animate);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.currentColor.lerp(this.targetColor,Math.min(dt*1.6,1));
    (this.stars.material as THREE.PointsMaterial).color.copy(this.currentColor).lerp(new THREE.Color('#e1eaff'),.5);
    (this.stars.material as THREE.PointsMaterial).opacity=this.active==='dark'?.06:.72;
    if(!this.reduceMotion){
      if(this.active==='galaxy'||this.active==='nebula'){
        // The galaxy lies in local XY: its normal is local Z.
        // Rotate around that local normal while preserving the viewing tilt.
        this.subject.rotateZ(-dt*.028);
      }else if(this.active!=='blackhole' && this.active!=='remnant'){
        this.subject.rotation.y+=dt*.045;
      }
      this.stars.rotation.y+=dt*.0015;
      this.incomingElapsed=Math.min(this.duration,this.incomingElapsed+dt);
      const enter=this.ease(this.incomingElapsed/this.duration);
      this.fade(this.subject,enter);
      this.subject.scale.setScalar(.82+.18*enter);
      for(const old of this.outgoing){
        old.elapsed=Math.min(this.duration,old.elapsed+dt);
        const exit=this.ease(old.elapsed/this.duration);
        this.fade(old.group,1-exit);
        old.group.scale.setScalar(1+.12*exit);
        if(old.group.userData.diskGalaxy)old.group.rotateZ(-dt*.028);
        else old.group.rotation.y+=dt*.06;
        if(old.elapsed>=this.duration)this.disposeGroup(old.group);
      }
      this.outgoing=this.outgoing.filter(old=>old.elapsed<this.duration);
    }
    for(const group of [this.subject,...this.outgoing.map(item=>item.group)]){
      group.traverse(object=>{
        if((object instanceof THREE.Mesh || object instanceof THREE.Points) && (object.userData.blackHole || object.userData.animatedShader)){
          const material=object.material as THREE.ShaderMaterial;
          if(material.uniforms.uTime)material.uniforms.uTime.value+=this.reduceMotion?0:dt;
        }
      });
    }
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){cancelAnimationFrame(this.frame);this.disposeGroup(this.subject);for(const old of this.outgoing)this.disposeGroup(old.group);this.stars.geometry.dispose();(this.stars.material as THREE.Material).dispose();this.renderer.dispose();}
}
