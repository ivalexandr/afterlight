import * as THREE from 'three';
import type { Era } from './timeline';
import { createBlackHole } from './blackHole';
import { createStellarSurface, createStellarHalo } from './stellar';

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
    if(era.scene==='earth'){
      const earth=this.sphere(2.6,'#276a9c','#082544',.3);earth.rotation.z=.35;this.subject.add(earth);
      const continents=new THREE.Mesh(new THREE.IcosahedronGeometry(2.615,5),new THREE.MeshBasicMaterial({color:'#4a9d86',wireframe:true,transparent:true,opacity:.13}));this.subject.add(continents);
      this.glow(2.85,'#5ca8ff',.10);
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
      const count=8500,pos=new Float32Array(count*3),colors=new Float32Array(count*3),base=new THREE.Color(era.accent);
      for(let i=0;i<count;i++){const r=Math.pow(Math.random(),.7)*5.7,arm=i%3,angle=arm*Math.PI*2/3+r*.85+(Math.random()-.5)*.85;
        pos[i*3]=Math.cos(angle)*r;pos[i*3+1]=Math.sin(angle)*r*.5;pos[i*3+2]=(Math.random()-.5)*.65;
        const c=base.clone().lerp(new THREE.Color('#ffffff'),Math.random()*.65);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const starsMaterial=new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        uniforms:{uTime:{value:0},uFade:{value:1}},
        vertexShader:`
          attribute vec3 color;varying vec3 vColor;
          uniform float uTime;
          void main(){
            vColor=color;
            vec4 mv=modelViewMatrix*vec4(position,1.);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp(15.0/-mv.z,1.5,6.0);
          }
        `,
        fragmentShader:`
          precision mediump float;
          varying vec3 vColor;uniform float uFade;
          void main(){
            float r=length(gl_PointCoord-.5)*2.;
            float glow=exp(-r*r*5.0);
            float core=exp(-r*r*32.0);
            float a=(glow*.4+core*.9)*uFade;
            gl_FragColor=vec4(vColor*(glow*.6+core*1.7),a);
          }
        `
      });
      const galacticStars=new THREE.Points(geo,starsMaterial);
      galacticStars.userData.animatedShader=true;
      this.subject.add(galacticStars);
      this.subject.rotation.x=.6;
    }else{
      const count=era.scene==='remnant'?420:1000,pos=new Float32Array(count*3);
      for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*15;pos[i*3+1]=(Math.random()-.5)*9;pos[i*3+2]=(Math.random()-.5)*8;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      this.subject.add(new THREE.Points(geo,new THREE.PointsMaterial({color:era.accent,size:.075,transparent:true,opacity:.75})));
      this.subject.add(this.sphere(1.35,'#b3c1d9','#657ba6',.25));this.glow(1.55,era.accent,.07);
    }
  }
  private fade(group:THREE.Group,opacity:number){
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh || object instanceof THREE.Points))return;
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
      this.subject.rotation.y+=this.active==='blackhole'?0:dt*.045;
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
        old.group.rotation.y+=dt*.06;
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
