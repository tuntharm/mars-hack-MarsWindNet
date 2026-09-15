import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// Original procedural schematic. Dimensions and movement are illustrative, not CAD.
export function createStation(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Rotatable 3D sensor schematic. Use the rotate buttons or drag to inspect it; the deployment slider folds the mast, panels and legs.');
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  controls.enableDamping = !motion.matches;
  motion.addEventListener('change', () => { controls.enableDamping = !motion.matches; });
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 + 0.06;
  controls.target.set(0, 1.6, 0);
  const materials = {
    shell: new THREE.MeshStandardMaterial({ color: 0xd6c8b3, metalness: .45, roughness: .48 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa5aa, metalness: .85, roughness: .28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x252c2e, metalness: .5, roughness: .5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151a1c, roughness: .94 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xed943f, metalness: .45, roughness: .4 }),
    solar: new THREE.MeshStandardMaterial({ color: 0x112c45, metalness: .55, roughness: .3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x163b46, metalness: .9, roughness: .16 }),
  };
  scene.add(new THREE.HemisphereLight(0xd9edff, 0x60412d, 3));
  const key = new THREE.DirectionalLight(0xffdfbc, 5);
  key.position.set(4, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc9ff, 3);rim.position.set(-4,4,-3);scene.add(rim);
  const root = new THREE.Group();scene.add(root);
  const parts = {};
  for (const name of ['wind','weather','dust','camera','power']) { parts[name] = new THREE.Group();root.add(parts[name]); }
  function mesh(geometry, material, parent, x=0,y=0,z=0) {
    const result = new THREE.Mesh(geometry, materials[material].clone());
    result.position.set(x,y,z);result.castShadow=true;result.receiveShadow=true;parent.add(result);return result;
  }
  function box(w,h,d,material,parent,x=0,y=0,z=0) {
    const radius = Math.min(.04,w/5,h/5,d/5);
    const shape = new THREE.Shape();const x0=-w/2,y0=-h/2;
    shape.moveTo(x0+radius,y0);shape.lineTo(x0+w-radius,y0);shape.quadraticCurveTo(x0+w,y0,x0+w,y0+radius);shape.lineTo(x0+w,y0+h-radius);shape.quadraticCurveTo(x0+w,y0+h,x0+w-radius,y0+h);shape.lineTo(x0+radius,y0+h);shape.quadraticCurveTo(x0,y0+h,x0,y0+h-radius);shape.lineTo(x0,y0+radius);shape.quadraticCurveTo(x0,y0,x0+radius,y0);
    const geometry = new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:2,steps:1});geometry.translate(0,0,-d/2);
    return mesh(geometry,material,parent,x,y,z);
  }
  function cylinder(r1,r2,h,material,parent,x=0,y=0,z=0){return mesh(new THREE.CylinderGeometry(r1,r2,h,24),material,parent,x,y,z);}
  function rod(a,b,r,material,parent){const direction = new THREE.Vector3().subVectors(b,a);const m=cylinder(r,r,direction.length(),material,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;}
  // Modular electronics bay, seams, corner rails and fasteners.
  box(.72,1.06,.53,'dark',parts.power,0,.94,0);
  box(.66,.61,.57,'shell',parts.power,0,1.12,0);
  box(.66,.37,.57,'shell',parts.power,0,.59,0);
  for(const x of [-.31,.31]) for(const z of [-.27,.27]) {
    cylinder(.038,.038,1.1,'dark',parts.power,x,.94,z);
    for(const y of [.45,.76,1.43]) cylinder(.045,.045,.06,'amber',parts.power,x,y,z);
  }
  for(const x of [-.25,.25]) for(const y of [.91,1.33,.46,.7]) {
    const bolt=cylinder(.015,.015,.018,'metal',parts.power,x,y,.304);bolt.rotation.x=Math.PI/2;
  }
  box(.12,.21,.025,'dark',parts.power,0,.65,.307);
  box(.035,.1,.016,'amber',parts.power,0,.65,.325);
  box(.28,.11,.016,'dark',parts.power,0,1.18,.309);
  // Wheels with separate hubs and individual tread blocks.
  for(const x of [-.48,.48]) for(const z of [-.28,.28]) {
    const wheel=new THREE.Group();wheel.position.set(x,.28,z);parts.power.add(wheel);
    const tire=cylinder(.245,.245,.16,'rubber',wheel);tire.rotation.z=Math.PI/2;
    const hub=cylinder(.13,.13,.18,'metal',wheel);hub.rotation.z=Math.PI/2;
    const centre=cylinder(.06,.06,.19,'amber',wheel);centre.rotation.z=Math.PI/2;
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const tread=box(.19,.047,.083,'rubber',wheel,0,Math.cos(a)*.241,Math.sin(a)*.241);tread.rotation.x=a;}
  }
  // Solar wings rotate about their hinges.
  const wings=[];
  for(const sign of [-1,1]){
    const hinge=new THREE.Group();hinge.position.set(sign*.4,1.4,0);parts.power.add(hinge);wings.push({hinge,sign});
    box(1,.045,.73,'amber',hinge,sign*.52,0,0);
    box(.95,.014,.68,'solar',hinge,sign*.52,.035,0);
    for(let i=1;i<8;i++)box(.005,.004,.68,'metal',hinge,sign*(.045+i*.119),.045,0);
    for(let i=1;i<5;i++)box(.95,.004,.004,'metal',hinge,sign*.52,.045,-.34+i*.136);
  }
  // Supports share a pivot so the folded/deployed change is visible.
  const legs=[];
  for(const angle of [Math.PI*.25,Math.PI*.75,Math.PI*1.25,Math.PI*1.75]){
    const pivot=new THREE.Group();pivot.position.set(Math.sin(angle)*.25,.52,Math.cos(angle)*.25);pivot.rotation.y=angle;parts.power.add(pivot);
    const leg=new THREE.Group();pivot.add(leg);legs.push(leg);
    rod(new THREE.Vector3(0,0,0),new THREE.Vector3(0,-.8,0),.039,'metal',leg);
    cylinder(.052,.052,.28,'dark',leg,0,-.16,0);
    cylinder(.065,.065,.06,'amber',leg,0,-.61,0);
    const foot=cylinder(.12,.14,.055,'dark',leg,0,-.8,0);leg.userData.foot=foot;
  }
  cylinder(.11,.13,.24,'dark',parts.power,0,1.5,0);
  const mast=new THREE.Group();root.add(mast);mast.position.y=1.54;
  cylinder(.065,.072,.65,'metal',mast,0,.325,0);
  cylinder(.087,.087,.08,'dark',mast,0,.6,0);
  const upper=cylinder(.045,.05,.96,'metal',mast,0,1.05,0);
  const tip=new THREE.Group();mast.add(tip);
  // Anemometer cups and direction vane at the sensor head.
  tip.add(parts.wind);parts.wind.position.set(0,.12,0);
  cylinder(.07,.07,.22,'dark',parts.wind);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;const end=new THREE.Vector3(Math.sin(a)*.31,.07,Math.cos(a)*.31);
    rod(new THREE.Vector3(0,.07,0),end,.012,'metal',parts.wind);
    const cup=mesh(new THREE.SphereGeometry(.09,18,12,0,Math.PI),'dark',parts.wind,end.x,end.y,end.z);cup.rotation.y=a+Math.PI*.5;
  }
  rod(new THREE.Vector3(0,-.04,0),new THREE.Vector3(.35,-.04,0),.013,'metal',parts.wind);
  box(.15,.12,.01,'shell',parts.wind,.32,-.04,0);
  // Weather shield louvers.
  tip.add(parts.weather);parts.weather.position.set(-.21,-.21,0);
  rod(new THREE.Vector3(0,-.12,0),new THREE.Vector3(.21,-.12,0),.022,'metal',parts.weather);
  for(let i=0;i<6;i++)cylinder(.11,.14,.035,'shell',parts.weather,0,i*.035-.07,0);
  cylinder(.07,.12,.035,'shell',parts.weather,0,.145,0);
  // Dust inlet and camera are independent selectable assemblies.
  mast.add(parts.dust);parts.dust.position.set(.1,.14,.13);
  box(.25,.22,.2,'shell',parts.dust);
  const inlet=cylinder(.052,.052,.035,'dark',parts.dust,0,0,.11);inlet.rotation.x=Math.PI/2;
  mast.add(parts.camera);parts.camera.position.set(.11,.8,.12);
  box(.23,.22,.21,'shell',parts.camera);
  box(.155,.155,.014,'amber',parts.camera,0,0,.12);
  const lens=cylinder(.06,.07,.046,'glass',parts.camera,0,0,.147);lens.rotation.x=Math.PI/2;
  box(.09,.4,.11,'shell',parts.camera,.1,-.29,-.12);
  cylinder(.009,.014,.48,'dark',parts.camera,.1,.04,-.12);
  // Gridded landing plane keeps scale and orientation legible.
  const pad=mesh(new THREE.CylinderGeometry(1.8,1.85,.055,64),'dark',scene,0,-.055,0);
  pad.material.color.set(0x1b292f);pad.material.roughness=.9;pad.castShadow=false;
  const grid=new THREE.GridHelper(3.3,22,0x637579,0x34454d);grid.position.y=-.023;scene.add(grid);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.74,.006,6,100),new THREE.MeshBasicMaterial({color:0xb47948}));ring.rotation.x=Math.PI/2;ring.position.y=-.02;scene.add(ring);
  let visible=true;
  function render(){renderer.render(scene,camera);}
  function resize(){const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;}).observe(container);
  controls.addEventListener('change',render);
  renderer.setAnimationLoop(()=>{if(visible&&!document.hidden)controls.update();});
  function reset(){camera.position.set(4.1,2.95,5.5);controls.target.set(0,1.58,0);root.rotation.y=0;controls.update();render();}
  function deploy(t){
    upper.scale.y=.2+.8*t;upper.position.y=.62+.48*t;
    tip.position.y=.76+.85*t;
    parts.camera.position.y=.48+.32*t;
    wings.forEach(({hinge,sign})=>hinge.rotation.z=sign*(-Math.PI/2+t*(Math.PI/2+.13)));
    legs.forEach(leg=>{leg.rotation.x=-.05-t*.82;leg.scale.y=.58+.42*t;leg.userData.foot.rotation.x=-leg.rotation.x;});
    render();
  }
  function highlight(name){
    Object.entries(parts).forEach(([key,group])=>group.traverse(object=>{if(object.isMesh){object.material.emissive.set(key===name?0xe89643:0x000000);object.material.emissiveIntensity=key===name?.16:0;}}));
    render();
  }
  reset();resize();
  return {deploy,highlight,reset,rotate(angle){root.rotation.y+=angle;render();}};
}
