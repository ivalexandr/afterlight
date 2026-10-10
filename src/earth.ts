import * as THREE from 'three';

// Earth imagery from the Three.js example asset collection (MIT).
// The future continental arrangement is illustrative, not a geophysical forecast.
const EARTH_MAP='https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const CLOUD_MAP='https://threejs.org/examples/textures/planets/earth_clouds_1024.png';
const loader=new THREE.TextureLoader();
let cached:THREE.Texture|undefined;
let cachedClouds:THREE.Texture|undefined;
function cloudTexture():THREE.Texture {
  if(!cachedClouds){
    cachedClouds=loader.load(CLOUD_MAP);
    cachedClouds.colorSpace=THREE.SRGBColorSpace;
    cachedClouds.wrapS=THREE.RepeatWrapping;
    cachedClouds.anisotropy=4;
  }
  return cachedClouds;
}

function earthTexture():THREE.Texture {
  if(!cached){
    cached=loader.load(EARTH_MAP);
    cached.colorSpace=THREE.SRGBColorSpace;
    cached.wrapS=THREE.RepeatWrapping;
    cached.anisotropy=4;
  }
  return cached;
}

export function createEarth(mode:'present'|'future'|'dry'):THREE.Group {
  const group=new THREE.Group();
  const radius=2.6;
  const material=new THREE.ShaderMaterial({
    uniforms:{
      uMap:{value:earthTexture()},
      uFuture:{value:mode==='future'?1:0},
      uDry:{value:mode==='dry'?1:0},
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
      uniform float uFuture,uDry,uFade,uTime;
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
        if(uDry>.5){
          // Expose a rocky seabed in place of oceans; keep continental relief.
          float ocean=smoothstep(.015,.095,surface.b-max(surface.r,surface.g));
          float grain=sin(uv.x*180.0+sin(uv.y*55.0)*2.0)*sin(uv.y*130.0);
          vec3 seabed=mix(vec3(.26,.21,.17),vec3(.51,.38,.27),clamp(surface.b*1.6,0.,1.));
          seabed*=.86+.14*grain;
          surface=mix(surface*vec3(1.27,1.07,.83),seabed,ocean);
        }
        vec3 normal=normalize(vNormal);
        // Key light near the viewer: keep the continents legible.
        vec3 light=normalize(vec3(-.25,.42,1.));
        float ndl=max(dot(normal,light),0.);
        float day=.62+.38*smoothstep(-.15,.8,ndl);
        vec3 col=surface*day*(uDry>.5?1.35:1.55);
        col=mix(col,col*vec3(1.06,1.09,1.12),.4);
        // Blue atmospheric scattering at the limb.
        float rim=pow(1.-max(dot(normal,normalize(-vWorld)),0.),3.);
        col+=mix(vec3(.11,.36,.9),vec3(.83,.43,.19),step(.5,uDry))*rim*(uDry>.5?.38:.65);
        gl_FragColor=vec4(col,uFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const globe=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),material);
  globe.rotation.y=.3;
  globe.userData.animatedShader=true;
  group.add(globe);

  // Real cloud-cover imagery, mapped to a slightly larger sphere.
  // A separate UV offset produces slow atmospheric drift.
  if(mode!=='dry'){
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(radius*1.013,96,64),
    new THREE.ShaderMaterial({
      uniforms:{uClouds:{value:cloudTexture()},uTime:{value:0},uFade:{value:1}},
      transparent:true,depthWrite:false,
      vertexShader:`
        varying vec2 vUv;varying vec3 vNormal;
        void main(){
          vUv=uv;
          vNormal=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }
      `,
      fragmentShader:`
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform sampler2D uClouds;
        uniform float uTime,uFade;
        void main(){
          vec2 uv=vec2(fract(vUv.x+uTime*.00055),vUv.y);
          vec4 tex=texture2D(uClouds,uv);
          float coverage=dot(tex.rgb,vec3(.299,.587,.114));
          float cloud=smoothstep(.12,.78,coverage)*tex.a*.43;
          float sun=.60+.40*max(dot(normalize(vNormal),normalize(vec3(-.25,.42,1.))),0.);
          cloud*=sun;
          if(cloud<.005)discard;
          gl_FragColor=vec4(vec3(.94,.97,1.),cloud*uFade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    })
  );
  clouds.rotation.y=.3;
  clouds.userData.animatedShader=true;
  group.add(clouds);
  }
  return group;
}
