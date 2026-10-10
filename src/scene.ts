import * as THREE from 'three';
import type { Era } from './timeline';

export class CosmicScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, .1, 1200);
  private stars: THREE.Points;
  private subject: THREE.Group = new THREE.Group();
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
    this.subject.clear();
    this.subject.rotation.set(0,0,0);
    if(era.scene==='dark')return;
    if(era.scene==='earth'){
      const earth=this.sphere(2.6,'#276a9c','#082544',.3);earth.rotation.z=.35;this.subject.add(earth);
      const continents=new THREE.Mesh(new THREE.IcosahedronGeometry(2.615,5),new THREE.MeshBasicMaterial({color:'#4a9d86',wireframe:true,transparent:true,opacity:.13}));this.subject.add(continents);
      this.glow(2.85,'#5ca8ff',.10);
    }else if(era.scene==='sun'||era.scene==='giant'||era.scene==='dwarf'){
      const radius=era.scene==='giant'?4.4:era.scene==='dwarf'?1.5:2.65;
      const color=era.scene==='giant'?'#ef673e':era.scene==='dwarf'?'#ba4c35':'#ffbd65';
      const star=this.sphere(radius,color,color,.95);this.subject.add(star);this.glow(radius*1.16,color,.13);
      const corona=new THREE.Mesh(new THREE.TorusGeometry(radius*1.23,.012,6,180),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.35}));corona.rotation.x=.9;this.subject.add(corona);
    }else if(era.scene==='blackhole'){
      const core=new THREE.Mesh(new THREE.SphereGeometry(1.85,64,48),new THREE.MeshBasicMaterial({color:'#000000'}));this.subject.add(core);
      const disc=new THREE.Mesh(new THREE.TorusGeometry(2.7,.48,20,150),new THREE.MeshBasicMaterial({color:'#d5a0f5',transparent:true,opacity:.8,side:THREE.DoubleSide}));disc.rotation.x=1.18;disc.rotation.y=.22;this.subject.add(disc);
      this.glow(2.15,'#9e78e5',.12);
    }else if(era.scene==='galaxy'||era.scene==='nebula'){
      const count=8500,pos=new Float32Array(count*3),colors=new Float32Array(count*3),base=new THREE.Color(era.accent);
      for(let i=0;i<count;i++){const r=Math.pow(Math.random(),.7)*5.7,arm=i%3,angle=arm*Math.PI*2/3+r*.85+(Math.random()-.5)*.85;
        pos[i*3]=Math.cos(angle)*r;pos[i*3+1]=Math.sin(angle)*r*.5;pos[i*3+2]=(Math.random()-.5)*.65;
        const c=base.clone().lerp(new THREE.Color('#ffffff'),Math.random()*.65);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      this.subject.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.055,vertexColors:true,transparent:true,opacity:.8,depthWrite:false})));
      this.subject.rotation.x=.6;
    }else{
      const count=era.scene==='remnant'?420:1000,pos=new Float32Array(count*3);
      for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*15;pos[i*3+1]=(Math.random()-.5)*9;pos[i*3+2]=(Math.random()-.5)*8;}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      this.subject.add(new THREE.Points(geo,new THREE.PointsMaterial({color:era.accent,size:.075,transparent:true,opacity:.75})));
      this.subject.add(this.sphere(1.35,'#b3c1d9','#657ba6',.25));this.glow(1.55,era.accent,.07);
    }
  }
  private animate=()=>{
    this.frame=requestAnimationFrame(this.animate);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.currentColor.lerp(this.targetColor,Math.min(dt*1.6,1));
    (this.stars.material as THREE.PointsMaterial).color.copy(this.currentColor).lerp(new THREE.Color('#e1eaff'),.5);
    (this.stars.material as THREE.PointsMaterial).opacity=this.active==='dark'?.06:.72;
    if(!this.reduceMotion){this.subject.rotation.y+=dt*.045;this.stars.rotation.y+=dt*.0015;}
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){cancelAnimationFrame(this.frame);this.renderer.dispose();}
}
