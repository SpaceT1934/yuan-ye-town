import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {bakeTreeViews} from './tree-impostors.js';

export async function addEnvironmentAssets(scene,map,xy,height,renderer){
 const loader=new GLTFLoader();
 const files=['island_tree_01','tree_stump_01','rock_moss_set_01'];
 const loaded=await Promise.all(files.map(name=>loader.loadAsync(`/assets/environment/${name}.glb`)));
 function instances(root,placements,{navigation=true,shadows=true}={}){
  const batches=[];
  root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3()),h=bounds.max.y-bounds.min.y;
  root.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material.clone();material.side=T.DoubleSide;material.forceSinglePass=true;
   const batch=new T.InstancedMesh(mesh.geometry,material,placements.length);
   placements.forEach((p,i)=>{const [x,z]=xy(p.x,p.y),scale=p.height/h;
    const matrix=new T.Matrix4().makeTranslation(x,height(p.x,p.y),z)
     .multiply(new T.Matrix4().makeRotationY(p.rotation??0))
     .multiply(new T.Matrix4().makeScale(scale,scale,scale))
     .multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z))
     .multiply(mesh.matrixWorld);
    batch.setMatrixAt(i,matrix);
   });batch.castShadow=shadows;batch.receiveShadow=true;batch.userData.navigationObstacle=navigation;
   batch.userData.placementMatrices=placements.map((_,i)=>{const m=new T.Matrix4();batch.getMatrixAt(i,m);return m});
   batches.push(batch);scene.add(batch);
  });
  return batches;
 }
 const trees=[];
 for(let y=0;y<map.height;y+=2)for(let x=0;x<map.width;x+=2){let count=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)count+=map.forest[(y+dy)*map.width+x+dx]??0;if(count>=2)trees.push({x:x+.7,y:y+.7,height:5.3+(Math.sin(x*13+y*7)+1)*.7,rotation:x+y})}
 for(const p of map.props.filter(p=>['largeTree','sapling','pine'].includes(p.type)))trees.push({...p,height:p.type==='largeTree'?7:3.2,rotation:p.x});
 // Full-detail placements initially supply immutable navigation bounds.
 // Rendering switches detail independently; collisions never change with LOD.
 const detailed=instances(loaded[0].scene,trees);
 const baked=bakeTreeViews(renderer,loaded[0].scene);
 const billboards=baked.targets.map(target=>{const material=new T.MeshBasicMaterial({map:target.texture,transparent:false,alphaTest:.25,side:T.DoubleSide,toneMapped:false});const batch=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,trees.length);batch.count=0;batch.castShadow=false;batch.userData.treeImpostor=true;scene.add(batch);return batch});
 instances(loaded[1].scene,map.props.filter(p=>p.type==='stump').map(p=>({...p,height:.7,rotation:p.x})));
 // This scan contains a small cluster of moss-covered rocks, used as a cluster.
 instances(loaded[2].scene,map.props.filter(p=>['boulder','stone'].includes(p.type)).map(p=>({...p,height:p.type==='boulder'?.8:.3,rotation:p.x})));
 let lastUpdate=-Infinity;const frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere(),centers=trees.map(p=>{const[x,z]=xy(p.x,p.y);return new T.Vector3(x,height(p.x,p.y)+p.height*.5,z)});
 const lodCounts=[trees.length,0];const matrix=new T.Matrix4(),scale=new T.Vector3();
 function update(camera,time){
  if(time-lastUpdate<.25&&time>=lastUpdate)return;lastUpdate=time;
  camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const high=[],bins=Array.from({length:16},()=>[]);let near=0;
  const order=centers.map((center,i)=>({i,d:center.distanceTo(camera.position)})).sort((a,b)=>a.d-b.d);
  for(const {i,d}of order){sphere.center.copy(centers[i]);sphere.radius=trees[i].height*.9;if(!frustum.intersectsSphere(sphere))continue;
   if(d<16&&near<6){near++;high.push(i);continue}
   const delta=camera.position.clone().sub(centers[i]),yaw=Math.atan2(delta.x,delta.z)-(trees[i].rotation??0);
   const angle=((Math.round(yaw/(Math.PI/4))%8)+8)%8,elevation=Math.atan2(delta.y,Math.hypot(delta.x,delta.z))>Math.PI/6?1:0;
   bins[elevation*8+angle].push(i);
  }
  lodCounts[0]=high.length;lodCounts[1]=bins.reduce((n,b)=>n+b.length,0);
  for(const batch of detailed){batch.count=high.length;high.forEach((i,k)=>batch.setMatrixAt(k,batch.userData.placementMatrices[i]));batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere()}
  billboards.forEach((batch,v)=>{batch.count=bins[v].length;bins[v].forEach((i,k)=>{const span=baked.span*trees[i].height/baked.height;scale.set(span,span,span);matrix.compose(centers[i],camera.quaternion,scale);batch.setMatrixAt(k,matrix)});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere()});
 }
 return {trees:trees.length,assets:files,update,lodCounts};
}
