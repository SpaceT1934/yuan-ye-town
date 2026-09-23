import * as T from 'three';
import {boneKey,retargetCast} from './retarget-cast.js';
import {createFaceMotion} from './face-motion.js';

// Presentation-only state. Never write to the imported resident records.
export function createLife(people,assets,terrain,map){
 let liveMode=false,liveRunning=false;
 const W=map.width,H=map.height,S=map.metersPerTile,blocked=new Uint8Array(W*H);
 const labels={walk:'散步中',idle:'驻足休息',greet:'遇见居民 · 点头致意',water:'河边观景',camp:'营地休息'};
 const worldToTile=v=>({x:v.x/S+W/2,y:v.z/S+H/2});
 function water(x,y){if(terrain.isWalkableBridge?.(x,y))return false;const R=map.resolution;return map.fields[Math.floor(y*R)*W*R+Math.floor(x*R)]===1}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  blocked[y*W+x]=x<1||y<1||x>=W-1||y>=H-1||map.objectTiles.some(l=>l[x][y]>=0)||map.forest[y*W+x]||[[-.35,-.35],[.35,.35],[0,0]].some(([dx,dy])=>water(x+.5+dx,y+.5+dy))?1:0;
 }
 for(const prop of map.props.filter(p=>['tent','windmill','largeTree','boulder','crates','campfire'].includes(p.type))){const r=prop.type==='tent'?1.7:prop.type==='windmill'?1.3:.75;for(let y=Math.max(0,Math.floor(prop.y-r));y<Math.min(H,prop.y+r+1);y++)for(let x=Math.max(0,Math.floor(prop.x-r));x<Math.min(W,prop.x+r+1);x++)if(Math.hypot(x+.5-prop.x,y+.5-prop.y)<r)blocked[y*W+x]=1}
 const radius=.55;
 function clearWorld(x,z){const tx=x/S+W/2,ty=z/S+H/2;if(tx<1||ty<1||tx>=W-1||ty>=H-1)return false;for(const b of terrain.colliders)if(x>b.min.x-radius&&x<b.max.x+radius&&z>b.min.z-radius&&z<b.max.z+radius)return false;for(let i=0;i<8;i++){const xx=tx+Math.cos(i*Math.PI/4)*radius/S,yy=ty+Math.sin(i*Math.PI/4)*radius/S;if(water(xx,yy))return false;if(Math.abs(terrain.surfaceHeight(xx,yy)-terrain.surfaceHeight(tx,ty))>.22)return false}return true}
 for(let k=0;k<blocked.length;k++){const [x,z]=terrain.xy(k%W+.5,Math.floor(k/W)+.5);if(!clearWorld(x,z))blocked[k]=1}
 const valid=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&!blocked[y*W+x];
 const reserved=new Set();
 const nearest=(x,y,ignoreReserved=false)=>{let best=-1,d=Infinity;for(let k=0;k<blocked.length;k++)if(!blocked[k]&&(ignoreReserved||!reserved.has(k))){const v=(k%W+.5-x)**2+(Math.floor(k/W)+.5-y)**2;if(v<d){d=v;best=k}}return best};
 function route(start,goal){const previous=new Int32Array(W*H).fill(-1),q=[start];previous[start]=start;for(let n=0;n<q.length&&previous[goal]<0;n++){const k=q[n],x=k%W,y=Math.floor(k/W);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*W+nx;if(!valid(nx,ny)||previous[j]>=0)continue;if(Math.abs(terrain.surfaceHeight(nx+.5,ny+.5)-terrain.surfaceHeight(x+.5,y+.5))>.45)continue;previous[j]=k;q.push(j)}}if(previous[goal]<0)return [];const out=[];for(let k=goal;k!==start;k=previous[k])out.push(k);return out.reverse()}
 let seed=430;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const vector=new T.Vector3();
 function align(p){p.group.updateMatrixWorld(true);p.visual.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update()});let gap=Infinity;for(const [mesh,indices] of p.feet)for(const i of indices){mesh.getVertexPosition(i,vector);vector.applyMatrix4(mesh.matrixWorld);const t=worldToTile(vector);gap=Math.min(gap,vector.y-terrain.surfaceHeight(t.x,t.y))}if(Number.isFinite(gap))p.visual.position.y+=.006-gap;p.groundGap=.006;p.tag.position.copy(p.group.position).add(new T.Vector3(0,2.1,0))}
 function setState(p,state){if(p.state===state)return;p.state=state;const next=state==='walk'?p.walk:p.idle;if(next!==p.action){if(p.action){p.transition={time:0,bones:[]};p.visual.traverse(b=>{if(b.isBone)p.transition.bones.push([b,b.quaternion.clone()])})}p.action?.stop();next.reset().setEffectiveWeight(1).play();p.action=next}p.status=labels[state]}
 function clipFor(source,p){const prefix=p.hip.name.slice(0,-3);const tracks=source.tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>{const v=t.clone();const suffix=t.name.match(/(?:walking|idling|dancing)_(.+)$/)?.[1];if(suffix)v.name=prefix+suffix;return v});return new T.AnimationClip('local-'+source.name,source.duration,tracks)}
 for(const [i,p] of people.entries()){
  p.mixer.stopAllAction();p.walk=p.mixer.clipAction(retargetCast(assets.get('nathan'),p,'walk'));p.idle=p.mixer.clipAction(retargetCast(assets.get('sophia'),p,'idle'));p.feet=[];
  p.visual.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,indices=[];for(let j=0;j<si.count;j+=2){let weight=0;for(let k=0;k<4;k++)if(/^(foot|ball)_/.test(boneKey(mesh.skeleton.bones[si.getComponent(j,k)]?.name??'')))weight+=sw.getComponent(j,k);if(weight>.3)indices.push(j)}p.feet.push([mesh,indices])});
  p.faceMotion=createFaceMotion(p,i);
  p.speed=.65+i%3*.09;p.wait=i*.6;p.path=[];p.elapsed=0;p.greetCooldown=8+i;p.start=p.group.position.clone();p.savedVisual=p.visual.position.clone();
  const start=nearest(p.resident.position.x,p.resident.position.y),[x,z]=terrain.xy(start%W+.5,Math.floor(start/W)+.5);p.group.position.set(x,terrain.surfaceHeight(start%W+.5,Math.floor(start/W)+.5),z);reserved.add(start);setState(p,'idle');p.mixer.update(.1);align(p);
 }
 reserved.clear();
 function choose(p){if(liveMode)return;const t=worldToTile(p.group.position),start=nearest(t.x,t.y);for(let attempt=0;attempt<35;attempt++){const tx=Math.max(1,Math.min(W-2,Math.floor(t.x+(random()-.5)*18))),ty=Math.max(1,Math.min(H-2,Math.floor(t.y+(random()-.5)*18)));if(!valid(tx,ty))continue;const path=route(start,ty*W+tx);if(path.length>2){p.path=path;setState(p,'walk');return}}p.wait=2;setState(p,'idle')}
 function step(dt){for(const p of people){p.elapsed+=dt;p.greetCooldown-=dt;if(p.state==='walk'&&p.path.length){const k=p.path[0],tx=k%W+.5,ty=Math.floor(k/W)+.5,[x,z]=terrain.xy(tx,ty),dx=x-p.group.position.x,dz=z-p.group.position.z,dist=Math.hypot(dx,dz),move=Math.min(dist,p.speed*dt);const occupied=!clearWorld(p.group.position.x+dx/(dist||1)*move,p.group.position.z+dz/(dist||1)*move)||people.some(other=>other!==p&&Math.hypot(other.group.position.x-(p.group.position.x+dx/(dist||1)*move),other.group.position.z-(p.group.position.z+dz/(dist||1)*move))<1.1);if(!occupied){p.group.position.x+=dx/(dist||1)*move;p.group.position.z+=dz/(dist||1)*move;p.group.rotation.y=Math.atan2(dx,dz);if(dist<.03)p.path.shift()}else{p.path=[];p.wait=1;setState(p,'idle')}if(!p.path.length){const t=worldToTile(p.group.position),nearWater=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>water(t.x+dx,t.y+dy)),camp=map.props.some(v=>v.type==='tent'&&Math.hypot(v.x-t.x,v.y-t.y)<5);setState(p,nearWater?'water':camp?'camp':'idle');p.wait=3+random()*5}}else{p.wait-=dt;if(p.wait<=0)choose(p)}
   if(!liveMode&&p.greetCooldown<=0){const other=people.find(q=>q!==p&&p.group.position.distanceTo(q.group.position)<2);if(other){p.path=[];setState(p,'greet');p.wait=2.5;p.greetCooldown=15;p.group.rotation.y=Math.atan2(other.group.position.x-p.group.position.x,other.group.position.z-p.group.position.z)}}
   p.mixer.update(dt);if(p.transition){p.transition.time+=dt;const a=Math.min(1,p.transition.time/.22);for(const [b,q]of p.transition.bones)b.quaternion.slerpQuaternions(q,b.quaternion,a);if(a>=1)p.transition=null}p.group.updateMatrixWorld(true);if(p.hip){p.group.worldToLocal(p.hip.getWorldPosition(vector));p.visual.position.x+=p.hipAnchor.x-vector.x;p.visual.position.z+=p.hipAnchor.z-vector.z}
   if(p.state==='greet'){p.visual.traverse(b=>{if(b.isBone&&boneKey(b.name)==='head')b.rotateX(Math.sin(p.elapsed*5)*.08)})}
   p.faceMotion.apply(p.elapsed);
   const t=worldToTile(p.group.position);p.group.position.y=terrain.surfaceHeight(t.x,t.y);align(p);
   const pin=document.querySelector(`.map-pin[data-id="${p.resident.playerId}"]`);if(pin){pin.style.left=`${t.x/W*100}%`;pin.style.top=`${t.y/H*100}%`;pin.title=p.resident.name+' · '+p.status}
  }}
 function groundingReport(){return people.map(p=>{p.group.updateMatrixWorld(true);let min=Infinity;for(const [mesh,indices]of p.feet){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,vector);vector.applyMatrix4(mesh.matrixWorld);const t=worldToTile(vector);min=Math.min(min,vector.y-terrain.surfaceHeight(t.x,t.y))}}return {name:p.resident.name,minimumSoleClearance:min}})}
 function setLiveWorld(world,running){liveMode=true;liveRunning=running;reserved.clear();for(const p of people){const source=world.players.find(v=>v.id===p.resident.playerId);if(!source){p.group.visible=false;p.tag.visible=false;p.path=[];continue}p.group.visible=true;p.resident.position={...source.position};p.speed=2.2;const goal=nearest(source.position.x,source.position.y);reserved.add(goal);const t=worldToTile(p.group.position),start=nearest(t.x,t.y,true);if(goal>=0&&(p.liveGoal!==goal||!p.path.length&&start!==goal)){p.path=[start,...route(start,goal)];p.liveGoal=goal;if(p.path.length>1)setState(p,'walk');else{p.path=[];setState(p,'idle')}}const conv=world.conversations.find(c=>c.participants.some(v=>v.playerId===source.id));p.backendStatus=conv?'正在交谈 / 等待对方':source.activity?.description??'自主活动'}reserved.clear()}
 return {step(dt){if(liveMode&&!liveRunning)return;step(dt);if(liveMode)people.forEach(p=>p.status=p.backendStatus??'自主活动')},setLiveWorld,pauseLive(){liveMode=true;liveRunning=false},align,blocked,clearWorld,route,worldToTile,setState,groundingReport,reset(){people.forEach(p=>{p.path=[];p.wait=2;setState(p,'idle');p.group.position.copy(p.start);align(p)})}};
}
