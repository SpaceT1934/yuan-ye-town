import * as T from 'three';

// Bake the existing tree into direction/elevation views on this GPU. These are
// derived from the real asset, not generated artwork; keep every leaf silhouette.
export function bakeTreeViews(renderer,root){
 const stage=new T.Scene(),tree=root.clone(true);stage.add(tree);stage.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(tree),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const half=Math.max(size.x,size.y,size.z)*.66;
 stage.add(new T.HemisphereLight('#cfe5ff','#778466',1.65));
 const sun=new T.DirectionalLight('#ffecd2',2.5);sun.position.set(-35,65,28);stage.add(sun);
 const camera=new T.OrthographicCamera(-half,half,half,-half,.01,2000),targets=[];
 const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha(),oldShadow=renderer.shadowMap.enabled;
 renderer.shadowMap.enabled=false;renderer.setClearColor(0,0);
 try{
  for(let elevation=0;elevation<2;elevation++)for(let azimuth=0;azimuth<8;azimuth++){
   const yaw=azimuth*Math.PI/4,pitch=(elevation?45:15)*Math.PI/180,d=half*5;
   camera.position.set(center.x+Math.sin(yaw)*Math.cos(pitch)*d,center.y+Math.sin(pitch)*d,center.z+Math.cos(yaw)*Math.cos(pitch)*d);camera.lookAt(center);
   const target=new T.WebGLRenderTarget(512,512,{minFilter:T.LinearMipmapLinearFilter,generateMipmaps:true});
   renderer.setRenderTarget(target);renderer.clear();renderer.render(stage,camera);targets.push(target);
  }
 }finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);renderer.shadowMap.enabled=oldShadow}
 return {targets,span:half*2,height:size.y};
}
