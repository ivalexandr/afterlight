import * as THREE from 'three';

/**
 * Artistic WebGL black-hole study for AFTERLIGHT.
 * Inspired by the techniques in public WebGL raymarching demos, but
 * independently implemented. This is NOT a GR geodesic solver.
 * A late-universe black hole would normally have no luminous accretion disk.
 */
export function createBlackHole(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uDisk: { value: 0.78 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uFade;
      uniform float uDisk;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
                   mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p) {
        float a=.5, v=0.;
        for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}
        return v;
      }
      void main() {
        vec2 p=(vUv-.5)*2.0;
        // A tilted accretion plane, with a secondary lensed image above/below.
        vec2 q=vec2(p.x,p.y*2.15);
        float r=length(p);
        float diskR=length(q);
        float a=atan(q.y,q.x);
        float swirl=fbm(vec2(a*5.5-diskR*7.0-uTime*.17,diskR*12.0));
        float filament=fbm(vec2(a*17.0-diskR*11.0-uTime*.36,diskR*31.0));
        float turbulent=mix(swirl,filament,.48);
        float inner=smoothstep(.27,.37,diskR);
        float outer=1.0-smoothstep(1.10,1.68,diskR);
        float disk=inner*outer;
        float lanes=smoothstep(.23,.84,turbulent);
        float doppler=mix(.47,1.85,smoothstep(-1.0,1.0,cos(a+.3)));
        vec3 hot=vec3(1.0,.83,.56);
        vec3 amber=vec3(1.0,.36,.11);
        vec3 diskColor=mix(amber,hot,pow(max(0.0,1.0-diskR/1.6),1.4));
        vec3 color=diskColor*disk*lanes*doppler*uDisk*2.0;
        // A warped far-side image, seen above and below the shadow.
        float lensR=length(vec2(p.x,p.y*1.05));
        float lensArc=exp(-pow((lensR-.42)/.075,2.0));
        float upper=smoothstep(-.27,.03,p.y);
        float arcNoise=.72+.28*fbm(vec2(a*8.0-uTime*.12,3.0));
        color+=mix(amber,hot,.68)*lensArc*arcNoise*(.65+.35*upper)*uDisk*.9;
        // Photon ring: concentrated, slightly asymmetric.
        float photon=exp(-pow((r-.286)/.013,2.0));
        color+=vec3(1.0,.76,.48)*photon*(.55+.45*smoothstep(-.9,.8,p.x))*.95;
        // Capture region: no light emerges from inside the shadow.
        float shadow=1.0-smoothstep(.245,.279,r);
        color*=1.0-shadow;
        // Gentle hot dust halo and a faint blue scattering component.
        float haze=exp(-pow((diskR-.66)/.48,2.0))*exp(-abs(p.y)*3.2);
        color+=vec3(.30,.14,.32)*haze*.13*uDisk;
        float blue=exp(-pow((r-.45)/.26,2.0))*.045;
        color+=vec3(.18,.31,.67)*blue;
        // Feather the entire shader plane into the background (no visible rectangle).
        float edge=1.0-smoothstep(.73,.995,max(abs(p.x),abs(p.y)));
        edge*=1.0-smoothstep(.76,1.08,length(p));
        color*=edge;
        float alpha=clamp(max(max(color.r,color.g),color.b)*1.1,0.0,1.0);
        alpha=max(alpha,shadow*.99)*edge;
        // Premultiply is intentionally disabled: keep the dark shadow opaque.
        gl_FragColor=vec4(color*uFade,alpha*uFade);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11.5,11.5), material);
  mesh.position.z=1.2;
  mesh.userData.blackHole=true;
  return mesh;
}
