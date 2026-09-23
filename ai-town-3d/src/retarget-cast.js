import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
export function boneKey(name){
 if(!name.startsWith('Bip01'))return name.replace(/^.*_(walking|idling|dancing)_/,'');
 const plain=name.replace(/^Bip01[ _]*/,''),parts=plain.split(/[ _]+/),side=parts[0]==='L'?'l':parts[0]==='R'?'r':null;
 if(side){const key={Clavicle:'shoulder',UpperArm:'upperarm',Forearm:'lowerarm',Hand:'hand',Thigh:'upperleg',Calf:'lowerleg',Foot:'foot',Toe0:'ball'}[parts[1]];return key?`${key}_${side}`:name}
 return {Pelvis:'hip',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',Neck:'neck',Head:'head'}[plain]??name;
}
export function retargetCast(asset,person,label){
 const source=clone(asset.scene),sourceBones=new Map(),sourceRest=new Map(),mixer=new T.AnimationMixer(source),q=new T.Quaternion();
 source.updateMatrixWorld(true);
 source.traverse(o=>{if(o.isBone){const key=boneKey(o.name);sourceBones.set(key,o);sourceRest.set(key,o.getWorldQuaternion(new T.Quaternion()).invert())}});
 person.visual.traverse(o=>{if(o.isBone){const rest=person.bindPose.get(o.name);if(rest){o.position.copy(rest.position);o.quaternion.copy(rest.quaternion);o.scale.copy(rest.scale)}}});person.group.updateMatrixWorld(true);
 const invGroup=person.group.getWorldQuaternion(new T.Quaternion()).invert(),bones=[],rest=new Map(),parents=new Map();
 person.visual.traverse(o=>{if(o.isBone){bones.push(o);rest.set(o,o.getWorldQuaternion(new T.Quaternion()).premultiply(invGroup));parents.set(o,o.parent.getWorldQuaternion(new T.Quaternion()).premultiply(invGroup))}});
 const targetBones=new Map(bones.map(b=>[boneKey(b.name),b])),directions=new Map(),childKeys={shoulder_l:'upperarm_l',shoulder_r:'upperarm_r',upperarm_l:'lowerarm_l',upperarm_r:'lowerarm_r',lowerarm_l:'hand_l',lowerarm_r:'hand_r',upperleg_l:'lowerleg_l',upperleg_r:'lowerleg_r',lowerleg_l:'foot_l',lowerleg_r:'foot_r',foot_l:'ball_l',foot_r:'ball_r'};
 for(const [key,child]of Object.entries(childKeys)){const b=targetBones.get(key),c=targetBones.get(child);if(b&&c)directions.set(key,c.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize().applyQuaternion(invGroup))}
 const sourceClip=asset.animations[0],duration=Math.min(sourceClip.duration-.1,label==='walk'?2.4:5),start=.1,frames=Math.ceil(duration*24),times=[],values=new Map(bones.map(b=>[b,[]]));
 const bodyKey=key=>/^(hip|spine_\d+|neck|head|shoulder_[lr]|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|upperleg_[lr]|lowerleg_[lr]|foot_[lr]|ball_[lr])$/.test(key);
 mixer.clipAction(sourceClip).play();
 for(let i=0;i<=frames;i++){
  const t=i/frames*duration;times.push(t);mixer.setTime(start+t);source.updateMatrixWorld(true);const current=new Map();
  for(const bone of bones){const key=boneKey(bone.name),from=sourceBones.get(key),parent=current.get(bone.parent)??parents.get(bone);let world=rest.get(bone).clone();
   // Body motion must not transplant another person's jaw/lip/eye animation.
   // Unmapped bones inherit their animated parent, retaining LOCAL rest pose;
   // locking their WORLD pose made the mouth counter-rotate against the head.
   if(!from||!bodyKey(key)){world.copy(parent).multiply(person.bindPose.get(bone.name)?.quaternion??bone.quaternion)}
   else if(person.assetId.includes('Adult')&&directions.has(key)){const child=sourceBones.get(childKeys[key]),direction=child.getWorldPosition(new T.Vector3()).sub(from.getWorldPosition(new T.Vector3())).normalize();world.premultiply(new T.Quaternion().setFromUnitVectors(directions.get(key),direction))}
   else world=from.getWorldQuaternion(new T.Quaternion()).multiply(sourceRest.get(key)).multiply(world);
   current.set(bone,world);q.copy(parent).invert().multiply(world);values.get(bone).push(q.x,q.y,q.z,q.w)}
 }
 // Close the loop without blending through the rig's unanimated reference pose.
 for(const v of values.values())v.splice(v.length-4,4,...v.slice(0,4));
 return new T.AnimationClip(label,duration,bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b))));
}
