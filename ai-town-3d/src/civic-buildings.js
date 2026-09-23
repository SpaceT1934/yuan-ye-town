import * as T from 'three';
// Persistent project state is the only authority for these scene upgrades.
export function createCivicBuildings(town){
 const {scene,terrain}=town,root=new T.Group();root.name='公共建设';scene.add(root);
 const loader=new T.TextureLoader(),textures=[],materials=[],hidden=new Set();let signature='';
 const baseSurface=terrain.surfaceHeight;let bridgeOpen=false;
 terrain.isWalkableBridge=(x,y)=>bridgeOpen&&x>=22.5&&x<=28.5&&y>=28.117&&y<=29.883;
 terrain.surfaceHeight=(x,y)=>terrain.isWalkableBridge(x,y)?.28:baseSurface(x,y);
 const mat=(color,roughness=.85)=>{const m=new T.MeshStandardMaterial({color,roughness});materials.push(m);return m};
 const brick=mat('#cac2ae'),wood=mat('#958069'),metal=mat('#46534f',.45),roof=mat('#55665b'),red=mat('#a34635'),glass=mat('#546e71',.18);
 for(const [m,name]of[[brick,'bricks'],[wood,'bark']])for(const [part,key]of[['color','map'],['normal','normalMap']]){const t=loader.load(`/assets/${name}-${part}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);if(key==='map')t.colorSpace=T.SRGBColorSpace;m[key]=t;textures.push(t)}
 function box(g,w,h,d,m,x,y,z){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh}
 function sign(g,text,x,y,z){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=160;const c=canvas.getContext('2d');c.fillStyle='#e7e1cc';c.fillRect(0,0,640,160);c.strokeStyle='#687360';c.lineWidth=10;c.strokeRect(8,8,624,144);c.fillStyle='#354739';c.font='bold 44px sans-serif';c.textAlign='center';c.fillText(text,320,98);const tex=new T.CanvasTexture(canvas),m=new T.MeshStandardMaterial({map:tex,roughness:.9});const mesh=new T.Mesh(new T.PlaneGeometry(2.3,.57),m);mesh.position.set(x,y,z);mesh.userData.disposableMaterial=true;g.add(mesh)}
 function pitched(g){for(const side of[-1,1]){const r=box(g,2.18,.13,3.35,roof,side*.96,2.93,0);r.rotation.z=-side*.36}box(g,.1,.12,3.4,metal,0,3.34,0)}
 function clinic(g){box(g,3.8,2.5,2.9,brick,0,1.25,0);pitched(g);box(g,.85,1.95,.06,wood,0,.99,1.49);for(const x of[-1.2,1.2]){box(g,.8,.85,.08,wood,x,1.5,1.51);box(g,.67,.72,.09,glass,x,1.5,1.54);box(g,.035,.75,.1,metal,x,1.5,1.59)}box(g,.16,.57,.08,red,0,2.4,1.55);box(g,.57,.16,.08,red,0,2.4,1.55);sign(g,'原野诊所',0,3.03,1.74)}
 function market(g){for(const x of[-1.7,1.7])for(const z of[-1.2,1.2])box(g,.15,2.7,.15,wood,x,1.35,z);pitched(g);for(const x of[-1.08,1.08]){box(g,1.45,.85,.8,wood,x,.425,.45);for(let i=0;i<3;i++){box(g,.39,.22,.6,wood,x+(i-1)*.45,.96,.45);for(let j=0;j<3;j++){const fruit=new T.Mesh(new T.SphereGeometry(.075,8,6),i%2?red:roof);fruit.position.set(x+(i-1)*.45+(j-1)*.1,1.12,.43);g.add(fruit)}}}sign(g,'原野公共集市',0,2.4,1.55)}
 function bridge(g){for(let i=0;i<30;i++)box(g,.28,.16,2.65,wood,(i-14.5)*.3,0,0);for(const z of[-1.27,1.27]){for(let i=0;i<6;i++)box(g,.13,1.05,.13,wood,-4.2+i*1.68,.48,z);box(g,8.55,.13,.13,wood,0,.94,z);box(g,8.55,.09,.09,wood,0,.48,z)}sign(g,'河桥 · 公共工程',0,1.45,1.32)}
 function clear(){root.traverse(o=>{o.geometry?.dispose();if(o.userData.disposableMaterial){o.material.map?.dispose();o.material.dispose()}});root.clear();for(const o of hidden)o.visible=true;hidden.clear()}
 function update(projects){const key=JSON.stringify(projects.map(p=>[p.key,p.status]));if(key===signature)return;signature=key;clear();bridgeOpen=projects.some(p=>p.key==='bridge'&&p.status==='completed');if(bridgeOpen)for(let x=23;x<=27;x++)for(let y=28;y<=29;y++){const [xx,zz]=terrain.xy(x+.5,y+.5);if(town.life.clearWorld(xx,zz))town.life.blocked[y*town.data.map.width+x]=0;}for(const p of projects){const g=new T.Group();g.name=p.title;const [tx,ty]=p.key==='hospital'?[45.5,9.5]:p.key==='market'?[10.5,9.5]:[25.5,29];const [x,z]=terrain.xy(tx,ty);g.position.set(x,p.key==='bridge'?.2:terrain.surfaceHeight(tx,ty),z);root.add(g);
   if(p.status==='completed'){if(p.key==='bridge')bridge(g);else{const id=p.key==='hospital'?'tile-1-44-7':'tile-1-9-7';const old=scene.children.find(o=>o.userData.sourcePropId===id);if(old){old.visible=false;hidden.add(old)}(p.key==='hospital'?clinic:market)(g)}}
   else{const offset=p.key==='bridge'?3:1.5;box(g,.1,1.6,.1,wood,-.85,.8,offset);box(g,.1,1.6,.1,wood,.85,.8,offset);sign(g,`${p.title} · ${p.status==='building'?'施工中':'提案'}`,0,1.35,offset+.08);if(p.status==='building'){for(const a of[-1.9,1.9])for(const b of[-1.5,1.5])box(g,.055,3.1,.055,metal,a,1.55,b);for(const h of[.7,1.8,2.8])box(g,3.8,.05,.05,metal,0,h,1.5);box(g,1,.4,.8,brick,1,.2,-1)}}
  }}
 return {update,dispose(){clear();root.removeFromParent();terrain.surfaceHeight=baseSurface;delete terrain.isWalkableBridge;textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose())}};
}
