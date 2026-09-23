import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from '@playwright/test';

const source=JSON.parse(fs.readFileSync('source-world/world-snapshot.json','utf8'));
const t=source.tables,world=t.worlds[0],map=t.maps.find(m=>m.worldId===world._id),society=t.societyWorlds.find(s=>s.worldId===world._id);
const descriptions=new Map(t.playerDescriptions.filter(p=>p.worldId===world._id).map(p=>[p.playerId,p]));
const agents=new Map(t.agentDescriptions.map(a=>[a.agentId,a]));
const societyResidents=new Map(t.societyResidents.map(p=>[p.playerId,p]));
const order=['乐乐','鲍勃','斯黛拉','爱丽丝','皮特','林岚','周石','苏菲'];
const appearances={乐乐:['nathan','#90b4db'],鲍勃:['manuel','#9eae8a'],斯黛拉:['sophia','#dac5d2'],爱丽丝:['sophia','#b8cbd9'],皮特:['manuel','#bcb8a7'],林岚:['sophia','#ffffff'],周石:['nathan','#adc2b0'],苏菲:['sophia','#dbd5bc']};
const residents=world.players.map(player=>{const d=descriptions.get(player.id),agent=agents.get(world.agents.find(a=>a.playerId===player.id)?.id),s=societyResidents.get(player.id);if(!d||!s)throw Error(`Missing identity for ${player.id}`);return {...s,character:d.character,identity:agent?.identity??d.description,longTermPlan:agent?.plan??'',position:player.position,facing:player.facing,savedActivity:player.activity??null,memories:source.memorySummaries[player.id]??{count:0,reflections:0,recent:[]},appearance:{asset:appearances[d.name][0],tint:appearances[d.name][1],note:'真人扫描基础模型复用；姓名与资料来自原存档，脸型不是像素图的精确还原。'}}}).sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));
if(residents.length!==world.players.length||new Set(residents.map(r=>r.playerId)).size!==residents.length)throw Error('Resident identity mismatch');
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:5183');
const rendered=await page.evaluate(async map=>{const img=new Image();img.src='/source-world/gentle-obj.png';await img.decode();const atlas=document.createElement('canvas');atlas.width=img.width;atlas.height=img.height;const ac=atlas.getContext('2d',{willReadFrequently:true});ac.drawImage(img,0,0);const pixels=ac.getImageData(0,0,img.width,img.height).data;
 const original=document.createElement('canvas');original.width=map.width*32;original.height=map.height*32;const c=original.getContext('2d');for(const layer of [...map.bgTiles,...map.objectTiles])for(let x=0;x<map.width;x++)for(let y=0;y<map.height;y++){const id=layer[x][y];if(id>=0)c.drawImage(img,id%45*32,Math.floor(id/45)*32,32,32,x*32,y*32,32,32)}
 const fields=[],forest=[],resolution=4;for(let y=0;y<map.height*resolution;y++)for(let x=0;x<map.width*resolution;x++){const tx=Math.floor(x/resolution),ty=Math.floor(y/resolution),id=map.bgTiles[0][tx][ty],col=id%45,row=Math.floor(id/45);let water=0,dirt=0,n=0;for(let sy=0;sy<8;sy+=2)for(let sx=0;sx<8;sx+=2){const px=col*32+(x%4)*8+sx,py=row*32+(y%4)*8+sy,k=(py*img.width+px)*4;const[r,g,b]=pixels.slice(k,k+3);if(b>r*1.3&&b>g*1.07&&g>18&&b>35)water++;if(r>g*1.08&&g>b*1.15)dirt++;n++}const isPath=col<=5&&row<=3;fields.push(water/n>.32?1:isPath&&dirt/n>.08?2:0)}
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const id=map.bgTiles[0][x][y],col=id%45,row=Math.floor(id/45),blocked=map.objectTiles.some(l=>l[x][y]>=0);const treeAtlas=(col>=16&&col<=24)||(col>=26&&row<13)||(col<9&&row>=16);forest.push(blocked&&treeAtlas?1:0)}
 // Animated landmarks are drawn only as locations in the comparison map.
 for(const s of map.animatedSprites.filter(s=>s.sheet==='windmill.json'||s.sheet==='campfire.json')){c.strokeStyle=s.sheet==='windmill.json'?'#ead3a2':'#ff874b';c.lineWidth=5;c.strokeRect(s.x,s.y,s.w,s.h);c.fillStyle='#fff';c.font='18px sans-serif';c.fillText(s.sheet==='windmill.json'?'风车':'营火',s.x,s.y+20)}
 return {fields,forest,resolution,reference:original.toDataURL('image/png')};},map);
await browser.close();
// Clean photographic tile flecks: close tiny gaps, retain substantial water
// components, then fill enclosed holes. Raw source map layers remain untouched.
const fw=map.width*rendered.resolution,fh=map.height*rendered.resolution;
let mask=rendered.fields.map(v=>v===1?1:0);
const morph=(input,dilate)=>input.map((_,i)=>{const x=i%fw,y=Math.floor(i/fw);let hit=dilate?0:1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,v=xx<0||xx>=fw||yy<0||yy>=fh?input[i]:input[yy*fw+xx];hit=dilate?hit|v:hit&v}return hit});
mask=morph(morph(mask,true),false);
const seen=new Set();for(let i=0;i<mask.length;i++){if(!mask[i]||seen.has(i))continue;const group=[i];seen.add(i);for(let j=0;j<group.length;j++){const k=group[j],x=k%fw;for(const n of[k-fw,k+fw,...(x?[k-1]:[]),...(x<fw-1?[k+1]:[])])if(n>=0&&n<mask.length&&mask[n]&&!seen.has(n)){seen.add(n);group.push(n)}}if(group.length<120)group.forEach(k=>mask[k]=0)}
const outside=new Set(),queue=[];for(let i=0;i<mask.length;i++)if(!mask[i]&&(i<fw||i>=mask.length-fw||i%fw===0||i%fw===fw-1)){outside.add(i);queue.push(i)}
for(let j=0;j<queue.length;j++){const k=queue[j],x=k%fw;for(const n of[k-fw,k+fw,...(x?[k-1]:[]),...(x<fw-1?[k+1]:[])])if(n>=0&&n<mask.length&&!mask[n]&&!outside.has(n)){outside.add(n);queue.push(n)}}
rendered.fields=rendered.fields.map((v,i)=>mask[i]||!outside.has(i)?1:v===1?0:v);
const props=[];
const anchors={8:['sapling',1,2],11:['largeTree',5,6],141:['stump',2,2],143:['log',3,2],6:['logStanding',2,3],231:['boulder',2,2],233:['stone',1,1],235:['flowers',1,1],240:['flowers',1,1],278:['flowers',1,1],279:['flowers',1,1],280:['flowers',1,1],751:['tent',3,3],754:['sapling',2,3],762:['barrel',1,1],763:['crates',2,3],806:['barrel',1,1],846:['plant',1,1],850:['mushroom',1,1],889:['plant',1,1],893:['stump',1,1],894:['pine',1,2],896:['boulder',1,1],934:['flowers',1,1],935:['flowers',1,1],936:['flowers',1,1],937:['flowers',1,1],941:['crates',1,1],1026:['largeTree',4,4]};
for(let layer=0;layer<map.bgTiles.length;layer++)for(let x=0;x<map.width;x++)for(let y=0;y<map.height;y++){const id=map.bgTiles[layer][x][y],a=anchors[id];if(!a)continue;props.push({id:`tile-${layer}-${x}-${y}`,type:a[0],x:x+a[1]/2,y:y+a[2]-.5,width:a[1],depth:a[2],source:{layer,x,y,tileId:id}})}
for(const s of map.animatedSprites){if(!['windmill.json','campfire.json','gentlewaterfall.json'].includes(s.sheet))continue;props.push({id:`animation-${s.sheet}-${s.x}-${s.y}`,type:s.sheet==='windmill.json'?'windmill':s.sheet==='campfire.json'?'campfire':'waterfall',x:(s.x+s.w/2)/32,y:(s.y+s.h/2)/32,width:s.w/32,depth:s.h/32,source:s})}
fs.mkdirSync('public/world',{recursive:true});fs.writeFileSync('public/world/original-map.png',Buffer.from(rendered.reference.split(',')[1],'base64'));fs.copyFileSync('source-world/32x32folk.png','public/world/original-residents.png');
const output={version:1,provenance:{worldId:world._id,savedAt:t.engines[0].currentTime,generation:t.engines[0].generationNumber,day:society.simulatedDay,source:'PCUbuntu stopped Convex database, read-only export',rawMapSha256:crypto.createHash('sha256').update(JSON.stringify(map)).digest('hex'),llmConnected:false},map:{...map,metersPerTile:1.5,fields:rendered.fields,forest:rendered.forest,resolution:rendered.resolution,props},residents,society,relationships:t.societyRelationships,laws:t.societyLaws,events:t.societyEvents.sort((a,b)=>b._creationTime-a._creationTime),conversations:world.conversations};
fs.writeFileSync('public/world/snapshot.json',JSON.stringify(output));
fs.writeFileSync('source-world/migration-report.json',JSON.stringify({residents:residents.map(r=>({name:r.name,playerId:r.playerId,character:r.character,health:r.health,position:r.position})),map:{width:map.width,height:map.height,props:props.length,forestCells:rendered.forest.filter(Boolean).length,waterSamples:rendered.fields.filter(v=>v===1).length},provenance:output.provenance},null,2));
console.log(JSON.stringify({residents:residents.length,props:props.length,worldId:world._id,generation:output.provenance.generation}));
