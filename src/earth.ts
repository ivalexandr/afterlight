import * as THREE from 'three';

// Earth imagery from the Three.js example asset collection (MIT).
// The future continental arrangement is illustrative, not a geophysical forecast.
const EARTH_MAP='https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const loader=new THREE.TextureLoader();
let cached:THREE.Texture|undefined;

function earthTexture():THREE.Texture {
  if(!cached){
    cached=loader.load(EARTH_MAP);
    cached.colorSpace=THREE.SRGBColorSpace;
    cached.wrapS=THREE.RepeatWrapping;
    cached.anisotropy=4;
  }
  return cached;
}

export function createEarth(future:boolean):THREE.Group {
  const group=new THREE.Group();
  const radius=2.6;
  const material=new THREE.ShaderMaterial({
    uniforms:{
      uMap:{value:earthTexture()},
      uFuture:{value:future?1:0},
      uFade:{value:1},
      uTime:{value:0},
    },
    transparent:true,
    depthWrite:true,
    vertexShader:`
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
      void main(){
        vUv=uv;
        vNormal=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.);
        vWorld=mv.xyz;
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:`
      precision highp float;
      uniform sampler2D uMap;
      uniform float uFuture,uFade,uTime;
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 uv=vUv;
        if(uFuture>.5){
          // Smoothly displace broad tectonic regions in longitude and latitude.
          // Deliberately stylized: not a prediction of a particular supercontinent.
          float region=sin(uv.x*18.85+sin(uv.y*11.3)*1.5);
          float region2=cos(uv.y*15.7+sin(uv.x*12.0)*.9);
          float plate=smoothstep(-.18,.18,region)*2.-1.;
          float plate2=smoothstep(-.2,.2,region2)*2.-1.;
          uv.x+=.13*plate+.055*plate2;
          uv.y+=.047*plate2-.023*plate;
          uv.y=clamp(uv.y,.001,.999);
        }
        vec3 surface=texture2D(uMap,uv).rgb;
        vec3 normal=normalize(vNormal);
        vec3 light=normalize(vec3(.3,.35,1.));
        float ndl=max(dot(normal,light),0.);
        float day=.48+.52*smoothstep(-.2,.72,ndl);
        vec3 col=surface*day*1.32;
        // Blue atmospheric scattering at the limb.
        float rim=pow(1.-max(dot(normal,normalize(-vWorld)),0.),3.);
        col+=vec3(.11,.36,.9)*rim*.65;
        gl_FragColor=vec4(col,uFade);
      }
    `
  });
  const globe=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),material);
  globe.rotation.y=.3;
  globe.userData.animatedShader=true;
  group.add(globe);

  const clouds=new THREE.Mesh(new THREE.SphereGeometry(radius*1.012,80,48),
    new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uFade:{value:1}},
      transparent:true,depthWrite:false,
      vertexShader:`
        varying vec3 vPos;varying vec3 vNormal;
        void main(){vPos=normalize(position);vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
      `,
      fragmentShader:`
        precision mediump float;
        varying vec3 vPos,vNormal;uniform float uTime,uFade;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise(vec3 p){
          vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        void main(){
          vec3 p=vPos*22.+vec3(uTime*.008,0.,0.);
          float n=noise(p)*.50+noise(p*2.1)*.32+noise(p*4.2)*.18;
          float cloud=smoothstep(.59,.78,n)*.19;
          if(cloud<.008)discard;
          gl_FragColor=vec4(vec3(.79,.87,1.),cloud*uFade);
        }
      `
    })
  );
  clouds.userData.animatedShader=true;
  group.add(clouds);
  return group;
}
