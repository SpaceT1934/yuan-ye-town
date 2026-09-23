import * as T from 'three';
const palettes=['#376483','#657746','#984f66','#417f88','#86674b','#dde6da','#744936','#7b6594'];
export function dress(person,index){
 person.outfit=palettes[index];
 person.visual.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
  mesh.geometry=mesh.geometry.clone();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,mask=[];
  for(let i=0;i<indices.count;i++){let w=0;for(let k=0;k<4;k++){const name=mesh.skeleton.bones[indices.getComponent(i,k)]?.name??'';if(/_spine_/.test(name))w+=weights.getComponent(i,k)}mask.push(T.MathUtils.smoothstep(w,.25,.85))}
  mesh.geometry.setAttribute('clothingMask',new T.Float32BufferAttribute(mask,1));
  const tint=new T.Color(palettes[index]);mesh.material.onBeforeCompile=shader=>{shader.uniforms.outfitTint={value:tint};shader.vertexShader='attribute float clothingMask; varying float vClothingMask;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClothingMask=clothingMask;');shader.fragmentShader='uniform vec3 outfitTint; varying float vClothingMask;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat fabricLight=dot(diffuseColor.rgb,vec3(.299,.587,.114)); diffuseColor.rgb=mix(diffuseColor.rgb,outfitTint*(.25+fabricLight*1.3),vClothingMask*.88);')};mesh.material.customProgramCacheKey=()=> 'resident-fabric-v1';mesh.material.needsUpdate=true;
 });
}
