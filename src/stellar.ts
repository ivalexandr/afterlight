import * as THREE from 'three';

/** Procedural, animated stellar photosphere with turbulent convection and soft limb glow. */
export function createStellarSurface(radius:number,kind:'sun'|'giant'|'dwarf'){
  const palette=kind==='giant'?['#7b1c0b','#ff6127','#ffd38b']:kind==='dwarf'?['#4b1724','#de6553','#ffe6bf']:['#b33c0a','#ffb338','#fff5ba'];
  const material=new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0},uFade:{value:1},
      uDark:{value:new THREE.Color(palette[0])},
      uBright:{value:new THREE.Color(palette[1])},
      uHot:{value:new THREE.Color(palette[2])},
    },
    transparent:true,depthWrite:false,
    vertexShader:`
      varying vec3 vPos; varying vec3 vNormal;
      void main(){
        vPos=position;
        vNormal=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:`
      precision highp float;
      uniform float uTime,uFade;
      uniform vec3 uDark,uBright,uHot;
      varying vec3 vPos,vNormal;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
      float noise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.04+vec3(2.1,4.3,1.7);a*=.5;}return v;}
      void main(){
        vec3 p=normalize(vPos);
        float n=fbm(p*5.5+vec3(uTime*.045,uTime*.025,0.));
        float detail=fbm(p*24.+n*3.+vec3(0.,uTime*.09,0.));
        float turbulence=clamp(n*.9+detail*.55,0.,1.);
        vec3 col=mix(uDark,uBright,smoothstep(.25,.72,turbulence));
        col=mix(col,uHot,smoothstep(.61,.91,turbulence)*.85);
        float limb=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);
        col+=uBright*limb*.35;
        gl_FragColor=vec4(col,uFade);
      }
    `
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),material);
  mesh.userData.animatedShader=true;
  return mesh;
}

/** Additive, depth-faded stellar halo that has no hard rectangular boundary. */
export function createStellarHalo(radius:number,color:string){
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uFade:{value:1},uColor:{value:new THREE.Color(color)},uTime:{value:0}},
    vertexShader:`
      varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uFade,uTime;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float r=length(p);
        float core=exp(-pow(r/.39,2.))* .26;
        float corona=exp(-pow((r-.43)/.13,2.))*.21;
        float rays=pow(max(0.,sin(atan(p.y,p.x)*13.+uTime*.08)*.5+.5),7.);
        float outer=exp(-pow(r/.65,2.))*rays*.06;
        float intensity=(core+corona+outer)*(1.-smoothstep(.78,1.,r));
        gl_FragColor=vec4(uColor*intensity,intensity*uFade);
      }
    `
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(radius*5,radius*5),material);
  mesh.position.z=-radius*.5;
  mesh.userData.animatedShader=true;
  return mesh;
}
