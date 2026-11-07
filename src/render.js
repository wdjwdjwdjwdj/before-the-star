import * as THREE from 'three';
import { ROOMS, WALLS, PROPS, DEVICES, RULES, FE, roomAt } from './config.js';
const C = { hull: 0x25394a, edge: 0x536a7b, dark: 0x0e202e, white: 0xeee3d1, cyan: 0x48e2eb, orange: 0xffa368, red: 0xff6056, green: 0x96f4bb };
export class World {
  constructor(container) {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x050c16);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35)); this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-18,18,12,-12,.1,180); this.camera.position.set(0,28,23); this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight(0xb8d9ef,0x25324a,2.25));
    this.key = new THREE.DirectionalLight(0xffdbac,3); this.key.position.set(-7,20,-12); this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024,1024); Object.assign(this.key.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:70}); this.key.shadow.bias=-.0003; this.scene.add(this.key);
    this.mats = {}; this.powerMats = []; this.roomLights = []; this.colliders = PROPS;
    this.station = new THREE.Group(); this.scene.add(this.station);
    this.mainMat = this.mat(C.cyan, .25, C.cyan, 1.6); this.backupMat = this.mat(0x35505c,.3,0x48ecc5,.02);
    this.screenMat = this.mat(0x3badae,.25,C.cyan,.9); this.lockMat = this.mat(C.orange,.35,C.orange,1.5);
    this.buildSpace(); this.buildLevel(); this.buildDevices(); this.buildPlayer();
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.65,.72,48),new THREE.MeshBasicMaterial({color:0xffdc98,side:THREE.DoubleSide,depthWrite:false}));
    this.marker.rotation.x = -Math.PI/2; this.marker.position.y=.08; this.scene.add(this.marker);
    this.resize(); this.onResize=()=>this.resize(); window.addEventListener('resize',this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault(); document.dispatchEvent(new CustomEvent('game-context-lost'));});
  }
  mat(color, roughness=.6, emissive=0, intensity=0) { return new THREE.MeshStandardMaterial({color,roughness,metalness:.25,emissive,emissiveIntensity:intensity}); }
  box(x,y,z,w,h,d,mat,parent=this.station) {
    if (typeof mat==='number') mat=this.mat(mat);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  cyl(x,y,z,r,h,mat,parent=this.station,r2=r,sides=16) {
    if(typeof mat==='number')mat=this.mat(mat);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,sides),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  label(text,x,y,z,color='#bfdae6',size=.4,w=4,parent=this.station,vertical=false) {
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');
    ctx.font='500 56px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,64,1000);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(w,size),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    if(!vertical)p.rotation.x=-Math.PI/2;else p.rotation.x=-.4;p.position.set(x,y,z);p.userData={canvas:c,context:ctx,color};parent.add(p);return p;
  }
  cable(points,mat,r=.045,parent=this.station) {
    const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
    const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(10,points.length*8),r,6,false),mat);parent.add(m);return m;
  }
  buildSpace() {
    const positions=[];let seed=9431;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<950;i++)positions.push((random()-.5)*150,(random()-.2)*65,-18-random()*65);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xb9cddd,size:1.4,transparent:true,opacity:.8,sizeAttenuation:true})));
    this.sunGroup=new THREE.Group();this.sunGroup.position.set(10,-1,-17);this.scene.add(this.sunGroup);
    const sunMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},heat:{value:0}},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v; uniform float time; uniform float heat; float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);} float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=v*2.4+vec3(time*.025,0,0);float f=noise(p)*.65+noise(p*3.)*.25+noise(p*8.)*.1;float rim=pow(max(0.,1.-length(v.xy)/5.),.4);vec3 col=mix(vec3(.95,.24,.035),vec3(1.,.86,.42),smoothstep(.1,.85,f));gl_FragColor=vec4(col*(1.+heat*.3+rim*.1),1.);}',toneMapped:false});
    this.sun=new THREE.Mesh(new THREE.SphereGeometry(5,48,32),sunMat);this.sunGroup.add(this.sun);
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(128,128,26,128,128,128);
    grad.addColorStop(0,'rgba(255,188,85,.75)');grad.addColorStop(.45,'rgba(255,128,42,.28)');grad.addColorStop(1,'rgba(255,80,20,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
    this.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),color:0xffad65,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.glow.scale.set(29,29,1);this.sunGroup.add(this.glow);
    // Station structure underneath the cutaway, with radiator fins and service spines.
    const under=this.mat(0x122532);
    this.box(0,-.85,0,25,.7,15,under);
    for(let x=-11;x<=11;x+=2){this.box(x,-1.4,0,.16,.5,16,C.edge);this.box(x,-1.65,7.8,1.25,.1,1.2,under);}
    for(let side of [-1,1]){
      this.box(side*14,-.8,-1,3.4,.13,9,0x182d42);
      for(let z=-5;z<=3;z+=.55)this.box(side*14,-.68,z,3.2,.05,.05,0x527184);
      this.box(side*12.8,-1,0,2.5,.2,.35,C.edge);
    }
    const orbit=new THREE.Mesh(new THREE.TorusGeometry(20,.022,6,120),new THREE.MeshBasicMaterial({color:0x324252,transparent:true,opacity:.45}));orbit.rotation.x=Math.PI/2;orbit.position.y=-2.4;this.scene.add(orbit);
    this.pulse=new THREE.Mesh(new THREE.RingGeometry(.95,1,128),new THREE.MeshBasicMaterial({color:0xffc697,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.pulse.rotation.x=-Math.PI/2;this.pulse.position.set(10,1,-17);this.scene.add(this.pulse);
  }
  buildLevel() {
    const edge=this.mat(C.edge), hull=this.mat(C.hull), dark=this.mat(C.dark);
    for(const r of ROOMS){
      this.box(r.x,-.32,r.z,r.w-.12,.55,r.d-.12,dark);
      const tile=this.mat(r.color,.86);
      const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.96,.13,.96),tile,r.w*r.d);
      let ti=0;const matrix=new THREE.Matrix4();
      for(let x=r.x-r.w/2+.5;x<r.x+r.w/2;x+=1)for(let z=r.z-r.d/2+.5;z<r.z+r.d/2;z+=1){matrix.makeTranslation(x,-.025,z);tiles.setMatrixAt(ti++,matrix);}
      tiles.receiveShadow=true;this.station.add(tiles);
      const strip=this.mat(new THREE.Color(r.accent),.4,new THREE.Color(r.accent),.55);
      this.box(r.x,.05,r.z+r.d/2-.48,r.w-1,.02,.035,strip);
      this.label(r.code,r.x,.07,r.z+r.d/2-1.1,r.accent,.5,5.8);
      this.label(r.name,r.x,.07,r.z+r.d/2-1.8,r.accent,.65,3.6);
      const l=new THREE.PointLight(r.accent,10,9,2);l.position.set(r.x,3.5,r.z);this.scene.add(l);this.roomLights.push(l);
    }
    for(const b of WALLS){
      const h=b.z===-7?1.2:.65;
      this.box(b.x,h/2,b.z,b.w,h,b.d,hull);this.box(b.x,h+.035,b.z,b.w+.03,.07,b.d+.03,edge);
      if(b.outer && b.d<1)this.box(b.x,.18,b.z+.04,b.w-.2,.06,b.d+.03,this.mainMat);
    }
    // Door jambs and warm thresholds. Inner arches stay open in the cutaway.
    for(const [x,z,across] of [[-4,-3,false],[-4,3,false],[-8,0,true]]){
      for(const d of [-1,1])this.box(x+(across?d*1.4:0),.85,z+(across?0:d*1.4),across?.18:.34,1.7,across?.34:.18,edge);
      this.box(x,.04,z,across?2.5:.65,.05,across?.65:2.5,this.mat(0x81929a));
    }
    // Observation window: clear pane, struts and stars beyond; no opaque roof.
    const glass=new THREE.MeshPhysicalMaterial({color:0x79cbea,metalness:.1,roughness:.05,transparent:true,opacity:.16,side:THREE.DoubleSide});
    this.box(-11.98,1.7,3.6,.07,2.3,4.5,glass);
    for(let z of [1.3,3.5,5.8])this.box(-12,1.8,z,.18,2.55,.12,edge);
    this.box(-12,3.05,3.55,.18,.12,4.7,edge);
    // Bed, wall equipment and domestic details.
    this.box(-10.3,.32,3.7,1.6,.6,2.7,hull);this.box(-10.3,.68,3.7,1.4,.16,2.5,0xddcfb7);
    this.box(-10.3,.81,3.2,1.42,.13,1.6,0x8e9ba0);this.box(-10.3,.86,4.55,1.1,.16,.55,C.white);
    this.box(-10.3,.3,2.2,1.7,.6,.14,edge);
    this.box(-10.6,.42,1.4,.8,.8,.65,hull);this.box(-10.6,.86,1.4,.55,.06,.42,this.screenMat);
    this.label('07',-10.25,1.18,4.7,'#172a39',.25,.6,undefined,true);
    this.clock=this.label(String(RULES.cycle),-7.3,1.75,6.1,'#ffe0ad',.8,2.2,undefined,true);
    this.label('DAWN STATION',-8,1.25,6.5,'#b5bcb8',.22,3.2,undefined,true);
    // Maintenance locker, wall plates, floor hazard markings.
    this.box(-1.4,.68,5.7,2.8,1.35,1,hull);
    for(let x=-2.3;x<=-.4;x+=.7){this.box(x,.7,5.15,.57,1.12,.07,edge);this.box(x+.14,.73,5.09,.04,.2,.04,C.white);}
    for(let i=0;i<8;i++)this.box(3.3,.06,-1.2+i*.35,.23,.02,.14,i%2?C.orange:C.dark);
    this.box(2.8,.55,3.5,.65,1.1,.55,hull);this.box(2.8,1.14,3.5,.55,.06,.4,this.mat(C.orange,.4,C.orange,.4));
    this.box(10.6,.45,5.4,1.7,.9,1.5,hull);this.box(10.6,.94,5.4,1.8,.1,1.6,edge);
    for(let x of [10.05,11.15])this.box(x,.5,6.17,.12,.9,.04,C.orange);
    this.box(10.6,.5,2.8,.55,1,.55,hull);this.box(10.6,1.05,2.8,.5,.05,.4,this.screenMat);
    // Cable routes are explicit: main along the back, branch to gate and launch terminal.
    this.cable([[-7.4,.11,-5.2],[-7.4,.11,-6.25],[2.7,.11,-6.25],[2.7,.11,-1.3],[4,.11,-1.3]],this.mainMat,.055);
    this.cable([[.1,.12,-4.7],[.1,.12,-6.25]],this.mainMat,.05);
    this.cable([[2.7,.1,-6.25],[6,.1,-6.25],[6,.1,1.1],[7.3,.1,1.1]],this.mainMat,.045);
    this.cable([[1.1,.13,-4.7],[1.8,.13,-4.7],[1.8,.13,-2],[3.5,.13,-2],[5,.13,-2],[5,.13,2.2],[7.3,.13,2.2]],this.backupMat,.07);
    this.label('备用 / AUX',1.8,.08,-2.6,'#91d7ba',.22,1.9);
  }
  buildDevices() {
    const dark=this.mat(C.dark), edge=this.mat(C.edge), white=this.mat(C.white,.4);
    // Toroidal reactor with visible concentric housing and luminous core.
    this.cyl(-10.3,.26,-5.4,1.18,.5,edge);this.cyl(-10.3,1,-5.4,.85,1.1,dark);
    this.reactor=new THREE.Group();this.reactor.position.set(-10.3,1.25,-5.4);this.station.add(this.reactor);
    for(let y of [-.45,0,.45]){const t=new THREE.Mesh(new THREE.TorusGeometry(.85,.13,8,28),edge);t.rotation.x=Math.PI/2;t.position.y=y;this.reactor.add(t);}
    this.reactorHeatMat=this.mat(C.cyan,.25,C.cyan,1.6);
    this.cyl(-10.3,1.2,-5.4,.45,1.4,this.reactorHeatMat);
    this.heatWarning=this.box(-9.3,1.85,-5.4,.22,.16,.22,this.mat(C.orange,.4,C.orange,.1));
    this.heatReadout=this.label('H 2.0',-10.3,.12,-3.8,'#8ff6ee',.28,1.8);
    this.scarFins=[];
    for(let a=0;a<6;a++){const angle=a*Math.PI/3;const fin=this.box(-10.3+Math.cos(angle)*.92,1.1,-5.4+Math.sin(angle)*.92,.16,1.5,.16,edge);this.scarFins.push(fin);}
    this.box(-7.4,.6,-5.4,1.7,1.2,1.1,dark);this.box(-7.4,1.23,-5.4,1.8,.1,1.2,edge);
    this.box(-7.4,1.25,-5.55,1.4,.08,.5,this.screenMat);
    this.lever=this.box(-7.4,1.39,-5.02,.6,.14,.17,C.orange);this.lever.rotation.x=-.5;
    this.label('01 · 主断路器',-7.4,.1,-3.55,'#8ff6ee',.55,4.1);
    // Battery cradle, four glass cells and a mechanical isolation switch.
    this.box(.1,.3,-4.7,2.6,.55,1.6,dark);this.box(.1,.59,-4.7,2.7,.1,1.7,edge);
    this.cells=[];
    for(let i=0;i<4;i++){
      const x=-.77+i*.58;
      this.cyl(x,1.15,-4.7,.22,1.05,this.mat(0x274451));
      const cell=this.cyl(x,1.15,-4.7,.16,.84,this.mat(0x6ce2dd,.2,0x6ce2dd,.05));this.cells.push(cell);
      this.cyl(x,1.72,-4.7,.24,.13,edge);this.cyl(x,.68,-4.7,.24,.13,edge);
    }
    this.isolator=this.box(1.44,.9,-4.7,.22,.56,.55,C.orange);
    this.chargeBars=[];for(let i=0;i<10;i++)this.chargeBars.push(this.box(-.9+i*.22,.69,-3.85,.16,.06,.07,this.mat(0x29434c,.4,C.cyan,.01)));
    this.label('02 · 备用电池',.1,.1,-2.7,'#a8d5ee',.55,4.1);
    this.energyCoolMat=this.mat(0x59e4c5,.3,0x59e4c5,1.4);
    this.cryoCoolMat=this.mat(0x92b0ff,.3,0x92b0ff,.1);
    this.box(2.25,.5,-4.7,1.05,1,1.4,dark);this.box(2.25,1.04,-4.7,1.18,.12,1.5,edge);
    this.thermalLamp=this.box(2.25,1.16,-4.48,.83,.12,.75,this.energyCoolMat);
    this.valveWheel=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.06,6),white);
    this.valveWheel.rotation.x=-Math.PI/2;this.valveWheel.position.set(2.25,1.35,-4.75);this.station.add(this.valveWheel);
    this.thermalReadout=this.label('能源优先',2.25,1.8,-4.7,'#b6e9e0',.32,1.7,undefined,true);
    this.label('温控 / THERMAL',2.15,.1,-1.65,'#b6c6ff',.3,2.7);
    this.cable([[2.25,.2,-5.2],[2.25,.2,-6.65],[-10.3,.2,-6.65],[-10.3,.2,-5.7]],this.energyCoolMat,.065);
    for(const o of [0,.14])this.cable([[2.55+o,.16,-4.7],[3.45+o,.16,-4.7],[3.45+o,.16,6.5],[-11.35+o,.16,6.5],[-11.35+o,.16,5.85],[-10.8,.16,5.85]],this.cryoCoolMat,.04);
    this.box(-10.8,.55,5.9,.85,1.1,.65,dark);
    this.cryoScreenMat=this.mat(0x92b0ff,.3,0x92b0ff,1);
    this.box(-10.8,1.13,5.9,.8,.1,.6,this.cryoScreenMat);
    this.frostPane=this.box(-10.8,1.2,5.55,.86,.42,.04,new THREE.MeshStandardMaterial({color:0xd7ecff,roughness:.15,metalness:.05,transparent:true,opacity:0,emissive:0x9ecbff,emissiveIntensity:0}));
    this.cryoReadout=this.label('乘员保障 C 2.0',-9.65,1.45,6.15,'#c6d0ff',.32,3,undefined,true);
    this.label('休眠乘员 / REMOTE',-10.2,.08,5.4,'#b6c6ff',.23,2.7);
    this.warmColor=new THREE.Color(C.orange);this.hotColor=new THREE.Color(C.red);this.coolColor=new THREE.Color(C.cyan);
    // Gate panels retract into the jambs, and collision releases immediately.
    this.gatePanels=[];
    for(const z of [-.75,.75]){
      const g=new THREE.Group();g.position.set(4,0,z);this.station.add(g);
      this.box(0,.85,0,.28,1.7,1.45,white,g);this.box(-.16,.8,0,.03,.18,1.3,this.lockMat,g);this.box(.16,.8,0,.03,.18,1.3,this.lockMat,g);
      for(let zz of [-.5,.5])this.box(-.17,.9,zz,.04,1.35,.05,edge,g);
      this.gatePanels.push(g);
    }
    for(const z of [-1.6,1.6]){this.box(4,1.1,z,.6,2.2,.24,edge);this.box(3.68,1.2,z,.04,.8,.1,this.lockMat);}
    this.label('S-04',3.2,.1,.1,'#ffb58a',.25,1);
    // Escape pod: angular white shell, navy visor, docking cradle and engine bell.
    this.pod=new THREE.Group();this.pod.position.set(9.2,0,-3);this.station.add(this.pod);
    this.box(9.2,.15,-3,3.1,.25,4.4,dark);
    const body=this.cyl(0,1.45,0,1.16,2.4,white,this.pod,.88,8);body.rotation.x=Math.PI/2;
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.88,1.25,8),white);nose.rotation.x=-Math.PI/2;nose.position.set(0,1.45,-1.75);nose.castShadow=true;this.pod.add(nose);
    this.box(0,2.15,-.3,1.35,.35,1.3,this.mat(0x153d52,.18,0x408f9c,.25),this.pod);
    for(let x of [-1,1]){this.box(x,1.1,.1,.24,.9,2.1,edge,this.pod);this.box(x,1.48,.15,.25,.06,1.5,this.backupMat,this.pod);}
    this.cyl(0,1.45,1.5,.55,.4,dark,this.pod,.68,12).rotation.x=Math.PI/2;
    this.engine=new THREE.Mesh(new THREE.ConeGeometry(.45,2,16),this.mat(0xa9ecff,.2,0x53cfff,4));this.engine.rotation.x=Math.PI/2;this.engine.position.set(0,1.45,2.2);this.engine.visible=false;this.pod.add(this.engine);
    this.label('AURORA · 07',0,2.32,.6,'#2b4658',.2,1.3,this.pod);
    this.box(7.3,.5,1.1,1.1,1,.85,dark);this.podScreen=this.box(7.3,1.1,1.1,1,.18,.8,this.mat(0x34767b,.3,C.cyan,1));this.podScreen.rotation.x=.22;
    this.label('03 · 发射终端',7.3,.09,3,'#ffc08f',.55,4.1);
    this.podIndicator=new THREE.PointLight(0x71fbd7,5,5);this.podIndicator.position.set(7.3,1.8,1.1);this.scene.add(this.podIndicator);
  }
  buildPlayer() {
    this.player=new THREE.Group();this.scene.add(this.player);const suit=this.mat(0xeee7d7,.72),trim=this.mat(0xca7e4d),dark=this.mat(0x163442,.28);
    this.cyl(0,.8,0,.28,.5,suit,this.player,.34,8);this.box(0,.89,-.25,.4,.4,.2,trim,this.player);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),suit);helmet.position.y=1.32;helmet.castShadow=true;this.player.add(helmet);
    this.box(0,1.33,.26,.5,.25,.19,dark,this.player);this.box(.2,1.31,.36,.07,.05,.025,this.mainMat,this.player);
    this.box(0,.85,-.35,.4,.5,.22,dark,this.player);
    this.legs=[];this.arms=[];
    for(let side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.16,.55,0);this.player.add(leg);this.box(0,-.2,0,.21,.42,.24,suit,leg);this.box(0,-.42,.08,.23,.13,.36,dark,leg);this.legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*.37,1,0);this.player.add(arm);this.box(0,-.18,0,.18,.4,.2,suit,arm);this.box(0,-.38,0,.19,.12,.21,trim,arm);this.arms.push(arm);
    }
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.46,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;this.player.add(shadow);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.43,.47,40),new THREE.MeshBasicMaterial({color:0xcde4dd,transparent:true,opacity:.65,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;this.player.add(ring);
  }
  updateReadout(mesh, text, color) {
    const u = mesh.userData;
    if (u.text === text && u.lastColor === color) return;
    u.context.clearRect(0, 0, 1024, 128);
    u.context.fillStyle = color || u.color;
    u.context.fillText(text, 512, 64, 1000);
    mesh.material.map.needsUpdate = true;
    u.text = text;
    u.lastColor = color;
  }
  resize() {
    const w=Math.max(1,this.renderer.domElement.parentElement.clientWidth),h=Math.max(1,this.renderer.domElement.parentElement.clientHeight);
    this.width=w;this.height=h;this.renderer.setSize(w,h,false);const aspect=w/h;
    // Narrow screens track the player, while desktop reveals the compact complete station.
    this.halfHeight=aspect<.85?9:Math.max(10.5,17/aspect);
    this.camera.left=-this.halfHeight*aspect;this.camera.right=this.halfHeight*aspect;this.camera.top=this.halfHeight;this.camera.bottom=-this.halfHeight;this.camera.updateProjectionMatrix();
  }
  project(x,y,z) { const p=new THREE.Vector3(x,y,z).project(this.camera);return {x:(p.x*.5+.5)*this.width,y:(-.5*p.y+.5)*this.height}; }
  update(s, target, memory, t, dt) {
    // The distant station visibly returns to its initial equipment state, not the escaped player.
    if(['ending','won'].includes(s.mode)&&s.ending>4.5)s={...s,power:true,charge:0,isolated:false,elapsed:0,cooling:'energy',heat:FE.baseHeat,cold:FE.baseCold,overheated:false};
    const heat=Math.min(1,s.elapsed/RULES.cycle), power=s.power;
    this.mainMat.emissiveIntensity=power?1.6:.01;this.mainMat.color.setHex(power?C.cyan:0x203c47);
    this.screenMat.emissiveIntensity=power?.9:0;this.screenMat.color.setHex(power?0x3badae:0x152936);
    this.backupMat.emissiveIntensity=s.isolated?2:.02;this.backupMat.color.setHex(s.isolated?0x83f7bf:0x264b50);
    this.lockMat.color.setHex(power?C.orange:C.green);this.lockMat.emissive.setHex(power?C.orange:C.green);
    this.roomLights.forEach((l,i)=>l.intensity=power?10:i===3&&s.isolated?6:1.1);
    this.key.intensity=2.8+heat*2;this.key.color.setHex(heat>.75?0xffac76:0xffdbac);
    const clockText=String(Math.ceil(Math.max(0,RULES.cycle-s.elapsed))).padStart(2,'0');
    if(this.clock.userData.text!==clockText){const u=this.clock.userData;u.context.clearRect(0,0,1024,128);u.context.fillStyle=heat>.75?'#ff9f7f':u.color;u.context.fillText(clockText,512,64);this.clock.material.map.needsUpdate=true;u.text=clockText;}
    this.sun.material.uniforms.time.value=t;this.sun.material.uniforms.heat.value=heat;this.glow.material.opacity=.65+heat*.35;this.sun.rotation.y=t*.015;
    const thermal = s.heat ?? FE.baseHeat, cold = s.cold ?? FE.baseCold, over = !!s.overheated, energy = (s.cooling || 'energy') === 'energy';
    const scarHeat = !!memory.scarHeat, scarFrost = !!memory.scarFrost;
    const load = THREE.MathUtils.clamp((thermal - FE.baseHeat) / 2, 0, 1);
    const scarTint = scarHeat ? Math.min(1, load + .45) : load;
    this.reactorHeatMat.color.copy(this.coolColor).lerp(over || scarHeat ? this.hotColor : this.warmColor, scarTint);
    this.reactorHeatMat.emissive.copy(this.reactorHeatMat.color);
    this.reactorHeatMat.emissiveIntensity = power ? 1.1 + scarTint : .03;
    const blinkFast = memory.settings.flash ? (Math.sin(t * 16) > 0) : (Math.sin(t * 3) * .5 + .5);
    this.heatWarning.material.emissiveIntensity = thermal >= 3.5 || scarHeat ? (blinkFast > .35 ? 2.4 : .15) : .04;
    this.heatWarning.material.color.setHex(over ? C.red : C.orange);
    if (scarHeat) { this.heatWarning.position.y = 1.85 + Math.sin(t * 9) * .04; this.reactor.rotation.z = Math.sin(t * 7) * .03; }
    else { this.heatWarning.position.y = 1.85; this.reactor.rotation.z = 0; }
    for (const fin of this.scarFins) fin.rotation.z = scarHeat ? Math.sin(t * 8 + fin.position.x) * .08 : 0;
    this.updateReadout(this.heatReadout, `${over ? '保护 ' : ''}${scarHeat ? '账 ' : ''}H ${thermal.toFixed(1)}`, thermal >= 3.5 || scarHeat ? '#ff9b7d' : '#8ff6ee');
    const pipeHot = scarHeat ? 0xff6a4a : (power && energy ? 0x59e4c5 : 0x254b47);
    this.energyCoolMat.emissiveIntensity = power ? (energy ? 1.8 : .08) : .025;
    this.energyCoolMat.color.setHex(pipeHot);
    this.energyCoolMat.emissive.setHex(scarHeat ? 0xff6a4a : 0x59e4c5);
    const frostBlink = scarFrost ? (memory.settings.flash ? (Math.sin(t * 14) > 0 ? 2.2 : .2) : (.7 + Math.sin(t * 3) * .25)) : 0;
    this.cryoCoolMat.emissiveIntensity = cold < 1 ? (Math.sin(t * 7) > 0 ? .9 : .05) : power ? (energy ? .08 : 1.8) : .15;
    this.cryoCoolMat.color.setHex(cold < 1 ? C.red : power && !energy ? 0x92b0ff : 0x354464);
    this.cryoCoolMat.emissive.setHex(cold < 1 ? C.red : 0x92b0ff);
    this.thermalLamp.material = energy ? this.energyCoolMat : this.cryoCoolMat;
    this.valveWheel.rotation.z = THREE.MathUtils.damp(this.valveWheel.rotation.z, energy ? 0 : Math.PI / 2, 12, dt);
    this.updateReadout(this.thermalReadout, energy ? '能源优先' : '休眠优先', energy ? '#a0f5d6' : '#bcc7ff');
    this.cryoScreenMat.color.setHex(scarFrost ? 0x9fd0ff : cold < 1 ? C.red : 0x92b0ff);
    this.cryoScreenMat.emissive.setHex(scarFrost ? 0xb9dcff : cold < 1 ? C.red : 0x92b0ff);
    this.cryoScreenMat.emissiveIntensity = scarFrost ? .4 + frostBlink : cold < 1 ? (Math.sin(t * 7) > 0 ? 2 : .1) : .35 + cold * .25;
    this.frostPane.material.opacity = scarFrost ? (memory.settings.flash ? .28 + frostBlink * .08 : .22) : 0;
    this.updateReadout(this.cryoReadout, `${scarFrost ? '霜 ' : ''}乘员保障 C ${cold.toFixed(1)}${cold < 1 ? ' !' : ''}`, cold < 1 ? '#ff8979' : scarFrost ? '#d7ecff' : '#c6d0ff');
    this.lever.rotation.x=power?-.5:.5;
    for(let i=0;i<4;i++){const m=this.cells[i].material;const lit=s.charge>i/4;m.color.setHex(s.isolated?C.green:lit?C.cyan:0x2c4551);m.emissive.setHex(s.isolated?C.green:C.cyan);m.emissiveIntensity=lit?(s.charging?.8+Math.sin(t*6)*.3:1):.01;}
    this.chargeBars.forEach((b,i)=>{b.material.emissiveIntensity=s.charge*10>i?2:.01;b.material.color.setHex(s.isolated?C.green:s.charge*10>i?C.cyan:0x29434c);});
    this.isolator.rotation.z=s.isolated?.65:0;
    for(let i=0;i<2;i++){const g=this.gatePanels[i];const goal=(i===0?-1:1)*(power?.75:2.15);g.position.z=THREE.MathUtils.damp(g.position.z,goal,14,dt);}
    const pp=power||(s.isolated&&s.charge>=1);
    this.podScreen.material.emissiveIntensity=pp?1.4:0;this.podScreen.material.color.setHex(pp?0x6cf3ca:0x162c35);this.podIndicator.intensity=pp?5:0;
    const rewinding=s.mode==='rewind';
    const slice=rewinding?Math.floor(s.rewindTime*16):0;
    this.player.visible=!['launch','trueend'].includes(s.mode)&&!(rewinding&&s.rewindTime>.58);
    const jx=rewinding?((slice%2)?.42:-.28)*(1-s.rewindTime/.72):0;
    const jz=rewinding?((slice%3)-1)*.22*(1-s.rewindTime/.72):0;
    this.player.position.set(s.player.x+jx,s.moving?Math.sin(t*18)*.035:0,s.player.z+jz);this.player.rotation.y=s.facing+(rewinding?slice*.4:0);
    this.station.position.x=rewinding?(slice%3-1)*.12:0;
    this.station.position.z=rewinding?((slice+1)%3-1)*.08:0;
    for(let i=0;i<2;i++){const v=s.moving?Math.sin(t*13+i*Math.PI)*.5:0;this.legs[i].rotation.x=v;this.arms[i].rotation.x=-v*.8;}
    this.marker.visible=!!target&&s.mode==='play';if(target){this.marker.position.set(target.x,.09,target.z);const scale=1+Math.sin(t*4)*.05;this.marker.scale.setScalar(scale);}
    const flying=s.mode==='trueend';this.engine.visible=flying||s.mode==='launch'||s.mode==='rewind';
    const e=flying?Math.min(7,s.ending):0;this.pod.visible=!flying||e<2.7;this.pod.position.set(9.2+e*1.9,e*1.25,-3-e*1.75);this.pod.rotation.z=flying?-Math.min(.23,e*.08):0;
    if(s.mode==='launch'){this.pod.position.y=s.launch*.15;this.engine.scale.y=.3+s.launch*.35;}
    else this.engine.scale.y=1+(Math.sin(t*40)*.08);
    const pulse=rewinding?Math.floor(s.rewindTime*8)/8:(s.waveFlash>0?.55-s.waveFlash:flying?Math.max(0,s.ending-1.2):0);
    this.pulse.material.opacity=pulse>0?Math.min(.75,pulse+ (rewinding?.25:0)):0;this.pulse.scale.setScalar(Math.max(pulse,0)*34);
    const narrow=this.width/this.height<.85;const cx=narrow?THREE.MathUtils.clamp(s.player.x,-7,7):0,cz=narrow?THREE.MathUtils.clamp(s.player.z,-2,2):0;
    let shake=0;
    if(memory.settings.shake)shake=rewinding?(slice%2?.16:-.11):(s.mode==='launch'||s.scarPulse>0||s.waveFlash>0)?Math.sin(t*64)*.04:0;
    this.camera.zoom=flying?1-Math.max(0,e-2.5)*.055:1;this.camera.updateProjectionMatrix();
    this.camera.position.set(cx+shake,28,23+cz);this.camera.lookAt(cx,0,cz);
    this.renderer.render(this.scene,this.camera);
  }
}
