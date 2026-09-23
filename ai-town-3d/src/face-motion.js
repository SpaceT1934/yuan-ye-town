import * as T from 'three';

// Local presentation only. Facial motion is independent of body retargeting.
export function createFaceMotion(person,index){
 const lids=[];person.group.updateMatrixWorld(true);
 const right=new T.Vector3(1,0,0).applyQuaternion(person.group.getWorldQuaternion(new T.Quaternion()));
 const down=new T.Vector3(0,-1,0).applyQuaternion(person.group.getWorldQuaternion(new T.Quaternion()));
 person.visual.traverse(b=>{
  if(!b.isBone)return;
  const rotary=/(?:^|_)eyelid_[lr]$/.test(b.name),top=/EyeBlinkTop$/.test(b.name),bottom=/EyeBlinkBottom$/.test(b.name);
  if(!rotary&&!top&&!bottom)return;
  const rest=person.bindPose.get(b.name),axis=right.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert());
  const origin=b.getWorldPosition(new T.Vector3()),delta=b.parent.worldToLocal(origin.clone().addScaledVector(down,top?.0105:-.0022)).sub(b.parent.worldToLocal(origin));
  lids.push({bone:b,rest,axis,delta,rotary});
 });
 const rotation=new T.Quaternion();
 function apply(time,forced){
  const period=3.7+index*.31,phase=(time+index*.63)%period;
  const blink=forced??(phase<.12?phase/.12:phase<.32?1-(phase-.12)/.2:0);
  for(const l of lids){
   l.bone.position.copy(l.rest.position);l.bone.quaternion.copy(l.rest.quaternion);
   if(l.rotary)l.bone.quaternion.multiply(rotation.setFromAxisAngle(l.axis,.045+blink*.78));
   else l.bone.position.addScaledVector(l.delta,blink);
  }
 }
 return {apply,lids};
}
