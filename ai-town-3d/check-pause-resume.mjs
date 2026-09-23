import assert from 'node:assert/strict';
const worldId='m17egvyawz4s4ef1b2bfr9zbks8dgbce';
async function call(kind,path,args={}){
  const apiBase=process.env.TOWN_API_URL??'http://localhost:3210/api/';
  const response=await fetch(apiBase+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,args,format:'json'}),signal:AbortSignal.timeout(30000)});
  const data=await response.json();assert.equal(data.status,'success',data.errorMessage);return data.value;
}
let paused=false;
try {
  await call('mutation','testing:stop');paused=true;
  const before=await call('query','world:worldState',{worldId});
  const societyBefore=await call('mutation','society:tickNow',{worldId});
  await new Promise(r=>setTimeout(r,15000));
  const stopped=await call('query','world:worldState',{worldId});
  const societyStopped=await call('mutation','society:tickNow',{worldId});
  assert.equal(stopped.engine.currentTime,before.engine.currentTime);
  assert.equal(societyStopped.simulatedDay,societyBefore.simulatedDay);
  assert.equal(societyStopped.lastTick,societyBefore.lastTick);
  await call('mutation','testing:resume');paused=false;
  const after=await call('query','world:worldState',{worldId});
  const societyAfter=await call('mutation','society:tickNow',{worldId});
  // The five-minute society cron can lag the engine across a day boundary.
  // Compare effective elapsed simulation time, not that stale display field.
  const beforeElapsed=before.engine.currentTime-societyBefore.simStartedAt;
  const afterElapsed=after.engine.currentTime-societyAfter.simStartedAt;
  assert(afterElapsed-beforeElapsed>=0 && afterElapsed-beforeElapsed<5000);
  assert.equal(societyAfter.simulatedDay,Math.floor(afterElapsed/1800000)+1);
  assert(societyAfter.simStartedAt-societyBefore.simStartedAt>=15000);
  assert(after.engine.running);
  assert(Date.now()-after.engine.currentTime<20000);
  console.log(JSON.stringify({pass:true,day:societyAfter.simulatedDay,pausedClockUnchanged:true,excludedPauseMs:societyAfter.simStartedAt-societyBefore.simStartedAt,generation:after.engine.generationNumber}));
} finally { if(paused) await call('mutation','testing:resume'); }
