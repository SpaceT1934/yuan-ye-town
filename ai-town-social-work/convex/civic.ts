import {v} from 'convex/values';
import {mutation,query,MutationCtx,QueryCtx} from './_generated/server';
import {Doc,Id} from './_generated/dataModel';
import {PROJECTS,preference,projectKey,repayment,boundedAmount,command,rumor,ProjectKey} from './civicRules';
type Ctx=MutationCtx|QueryCtx;
type Resident=Doc<'societyResidents'>;
type PID=string;
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const residents=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('societyResidents').withIndex('worldId',q=>q.eq('worldId',w)).collect();
const projects=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('civicProjects').withIndex('worldId',q=>q.eq('worldId',w)).collect();
const commitments=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('civicCommitments').withIndex('worldId',q=>q.eq('worldId',w)).order('desc').take(160);
const stateFor=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('societyWorlds').withIndex('worldId',q=>q.eq('worldId',w)).unique();
const seasonFor=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('civicSeasons').withIndex('worldId',q=>q.eq('worldId',w)).unique();
const latestElection=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('civicElections').withIndex('worldId',q=>q.eq('worldId',w)).order('desc').first();
const requests=(ctx:Ctx,w:Id<'worlds'>)=>ctx.db.query('civicRequests').withIndex('worldId',q=>q.eq('worldId',w)).order('desc').take(60);
const inventory=(r:Resident,item:string)=>r.inventory.find(i=>i.item===item)?.quantity??0;
async function takeStock(ctx:MutationCtx,r:Resident,item:string,n:number){
 if(n<0||inventory(r,item)<n)throw Error('库存不足');
 await ctx.db.patch(r._id,{inventory:r.inventory.map(i=>i.item===item?{...i,quantity:i.quantity-n}:i).filter(i=>i.quantity>0)});
}
async function transfer(ctx:MutationCtx,w:Id<'worlds'>,from:Resident,to:Resident,amount:number,item:string,day:number){
 if(!Number.isInteger(amount)||amount<0||from._id===to._id||from.coins<amount)throw Error('无效转账');
 await ctx.db.patch(from._id,{coins:from.coins-amount});await ctx.db.patch(to._id,{coins:to.coins+amount});
 await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,fromPlayerId:from.playerId,toPlayerId:to.playerId,item,quantity:1,total:amount,tax:0,createdAt:Date.now()});
}
async function relationship(ctx:Ctx,w:Id<'worlds'>,a:PID,b:PID){const pair=[a,b].sort();return ctx.db.query('societyRelationships').withIndex('pair',q=>q.eq('worldId',w).eq('player1',pair[0]).eq('player2',pair[1])).unique();}
async function affect(ctx:MutationCtx,w:Id<'worlds'>,a:PID,b:PID,trust:number,conflict:number){
 const rel=await relationship(ctx,w,a,b);if(!rel)return;
 await ctx.db.patch(rel._id,{trust:clamp(rel.trust+trust,-100,100),conflict:clamp(rel.conflict+conflict,0,100),lastInteractionAt:Date.now()});
}
async function learn(ctx:MutationCtx,w:Id<'worlds'>,owner:PID,noticeId:Id<'civicNotices'>,account:string,source:string,day:number,confidence=100,hops=0){
 const exists=await ctx.db.query('civicKnowledge').withIndex('fact',q=>q.eq('worldId',w).eq('owner',owner).eq('noticeId',noticeId)).unique();
 if(exists)return;
 await ctx.db.insert('civicKnowledge',{worldId:w,owner,noticeId,account,source,day,confidence,hops});
}
async function notice(ctx:MutationCtx,w:Id<'worlds'>,day:number,kind:string,title:string,body:string,participants:PID[]=[],isPublic=true){
 const id=await ctx.db.insert('civicNotices',{worldId:w,day,kind,title,body,participants,public:isPublic});
 const readers=(await residents(ctx,w)).filter(r=>r.alive!==false&&(isPublic||participants.includes(r.playerId)));
 for(const r of readers)await learn(ctx,w,r.playerId,id,body,isPublic?'公共公告':'亲身经历',day);
 if(isPublic)await ctx.db.insert('societyEvents',{worldId:w,simulatedDay:day,title,description:body,kind:'civic-'+kind,status:'active',startedAt:Date.now(),endsAt:Date.now()+30*60_000,effects:['事件写入社会档案','影响后续选择与对话']});
 return id;
}
export async function ensureSeason(ctx:MutationCtx,w:Id<'worlds'>,day:number){
 const existing=await seasonFor(ctx,w);if(existing)return existing;
 const id=await ctx.db.insert('civicSeasons',{worldId:w,version:1,startedDay:day,lastDay:day-1,lastFestivalDay:day});
 for(const p of PROJECTS)await ctx.db.insert('civicProjects',{worldId:w,...p,funds:0,spent:0,materials:0,labor:0,status:'proposed',startedDay:day,votes:[],contributions:[]});
 await notice(ctx,w,day,'season','小镇建设季开始','医院、集市与河桥争取同一笔公共预算。居民可以支持、反对、捐资或出工；建设需要真实资金、材料和劳动。旧有记忆、财产与关系全部保留。');
 return (await ctx.db.get(id))!;
}
async function resolveCommitments(ctx:MutationCtx,w:Id<'worlds'>,day:number){
 for(const c of await commitments(ctx,w)){
  if(c.status!=='active'&&c.status!=='offered')continue;
  const all=await residents(ctx,w),from=all.find(r=>r.playerId===c.from),to=all.find(r=>r.playerId===c.to);
  if(!from||from.alive===false||(c.to&&(!to||to.alive===false))){await ctx.db.patch(c._id,{status:'cancelled',outcome:'当事人去世，契约终止；历史账目保留，不抹去已发生的转账。'});continue;}
  if(c.status==='offered'){if(day>c.dueDay)await ctx.db.patch(c._id,{status:'cancelled',outcome:'对方未接受，未转移任何资金或物品。'});continue;}
  if(c.kind==='campaign'){
   const p=(await projects(ctx,w)).find(p=>p.key===c.projectKey);
   if(p?.status==='completed'){await ctx.db.patch(c._id,{status:'fulfilled',outcome:'任期承诺已兑现'});await ctx.db.patch(from._id,{reputation:clamp(from.reputation+5,0,100)});await notice(ctx,w,day,'promise',`${from.name}兑现建设承诺`,`${from.name}竞选时承诺的${p.title}已经建成。`,[from.playerId]);}
   else if(day>c.dueDay){await ctx.db.patch(c._id,{status:'broken',outcome:'未在承诺期限内建成'});await ctx.db.patch(from._id,{reputation:clamp(from.reputation-7,0,100)});await notice(ctx,w,day,'promise',`${from.name}的竞选承诺逾期`,`${from.name}承诺的${p?.title??'建设'}未按期完成，居民会在下一轮选举中考虑这次失约。`,[from.playerId]);}
   continue;
  }
  if(!to)continue;
  const rel=await relationship(ctx,w,from.playerId,to.playerId);
  const willing=(rel?.trust??0)>-20||from.values?.some(v=>['财政稳健','公平','互助','市场'].includes(v));
  if(c.kind==='loan'&&day>=c.dueDay&&willing){const paid=repayment(from.coins,c.amount-c.paid);if(paid){await transfer(ctx,w,from,to,paid,'借款归还',day);await ctx.db.patch(c._id,{paid:c.paid+paid});if(c.paid+paid===c.amount){await ctx.db.patch(c._id,{status:'fulfilled',outcome:'如约归还借款'});await affect(ctx,w,c.from,c.to!,5,-1);await notice(ctx,w,day,'promise',`${from.name}归还借款`,`${from.name}向${to.name}归还了${c.amount}枚金币，双方信任有所增加。`,[c.from,c.to!],false);continue;}}}
  if(c.kind==='delivery'&&day>=c.dueDay&&willing&&inventory(from,'建筑材料')>=c.amount&&to.coins>=c.amount*4){
   await transfer(ctx,w,to,from,c.amount*4,'履约交付建筑材料',day);await takeStock(ctx,from,'建筑材料',c.amount);
   const items=to.inventory.map(i=>({...i})),stock=items.find(i=>i.item==='建筑材料');if(stock)stock.quantity+=c.amount;else items.push({item:'建筑材料',quantity:c.amount});await ctx.db.patch(to._id,{inventory:items});
   await ctx.db.patch(c._id,{status:'fulfilled',paid:c.amount,outcome:'物资和货款已实际交割'});await affect(ctx,w,c.from,c.to!,4,-1);await notice(ctx,w,day,'promise','供货承诺兑现',`${from.name}向${to.name}交付${c.amount}份建筑材料，收到${c.amount*4}枚金币。`,[c.from,c.to!],false);continue;
  }
  if(day>c.dueDay+1){await ctx.db.patch(c._id,{status:'broken',outcome:'宽限期结束仍未履行，余额与历史保留'});await affect(ctx,w,c.from,c.to!,-8,2);await notice(ctx,w,day,'promise',`${from.name}的承诺逾期`,`${from.name}对${to.name}的“${c.title}”逾期未完成，对方不再轻易信任。`,[c.from,c.to!],false);}
 }
}
async function projectWork(ctx:MutationCtx,w:Id<'worlds'>,day:number){
 const all=(await residents(ctx,w)).filter(r=>r.alive!==false),ps=await projects(ctx,w);let state=(await stateFor(ctx,w))!;
 for(const p of ps){
  if(p.status==='completed')continue;
  const votes=p.votes.filter(v=>all.some(r=>r.playerId===v.playerId));
  for(const r of all)if(!votes.some(v=>v.playerId===r.playerId))votes.push({playerId:r.playerId,support:preference(r,p.key)>=3,reason:'依据职业、伤势、饥饿与价值观评估',explicit:false});
  await ctx.db.patch(p._id,{votes});p.votes=votes;
 }
 // One project competes for the surplus; never exhaust the operating reserve.
 const ranked=ps.filter(p=>p.status!=='completed'&&p.votes.filter(v=>v.support).length>all.length/2).sort((a,b)=>b.votes.filter(v=>v.support).length-a.votes.filter(v=>v.support).length||a.cost-b.cost);
 const chosen=ranked[0];
 if(chosen&&day>chosen.startedDay){const grant=Math.min(20,Math.max(0,state.treasury-40),Math.max(0,chosen.cost-chosen.funds));if(grant){await ctx.db.patch(state._id,{treasury:state.treasury-grant});await ctx.db.patch(chosen._id,{funds:chosen.funds+grant});await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,item:`建设拨款：${chosen.title}`,quantity:1,total:grant,tax:0,createdAt:Date.now()});}}
 for(let p of await projects(ctx,w)){
  if(p.status==='completed')continue;
  if(p.status==='proposed'&&p.funds>=p.cost&&p.votes.filter(v=>v.support).length>all.length/2){await ctx.db.patch(p._id,{status:'building'});p={...p,status:'building'};await notice(ctx,w,day,'construction',`${p.title}开工`,`${p.title}已筹齐${p.cost}枚金币并获得多数支持，开始采购材料和招募劳动。`);}
  if(p.status!=='building')continue;
  let materials=p.materials,labor=p.labor,spent=p.spent;const contributions=[...p.contributions];
  for(const seller of (await residents(ctx,w)).filter(r=>r.alive!==false)){
   const units=Math.min(2,inventory(seller,'建筑材料'),p.materialGoal-materials,Math.floor((p.funds-spent)/4));
   if(units<=0)continue;
   await takeStock(ctx,seller,'建筑材料',units);await ctx.db.patch(seller._id,{coins:seller.coins+units*4});materials+=units;spent+=units*4;
   await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,toPlayerId:seller.playerId,item:`${p.title}采购建筑材料`,quantity:units,total:units*4,tax:0,createdAt:Date.now()});
  }
  for(const r of (await residents(ctx,w)).filter(r=>r.alive!==false)){
   if(contributions.some(c=>c.playerId===r.playerId&&c.day===day&&c.labor>0))continue;
   const pref=preference(r,p.key),vote=p.votes.find(v=>v.playerId===r.playerId);
   if(vote?.support===false||(!vote?.explicit&&pref<3)||r.energy<40||(r.health??100)<35)continue;
   const work=Math.min(2,p.laborGoal-labor,Math.floor((p.funds-spent)/2));if(work>0){labor+=work;spent+=work*2;await ctx.db.patch(r._id,{energy:r.energy-8,coins:r.coins+work*2});contributions.push({playerId:r.playerId,day,coins:0,labor:work});await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,toPlayerId:r.playerId,item:`${p.title}劳动报酬`,quantity:work,total:work*2,tax:0,createdAt:Date.now()});}
  }
  await ctx.db.patch(p._id,{materials,labor,spent,contributions});
  if(materials>=p.materialGoal&&labor>=p.laborGoal){const refund=p.funds-spent;const current=(await stateFor(ctx,w))!;await ctx.db.patch(current._id,{treasury:current.treasury+refund});await ctx.db.patch(p._id,{status:'completed',completedDay:day,spent:p.funds});if(refund)await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,item:`${p.title}结余退回财政`,quantity:1,total:refund,tax:0,createdAt:Date.now()});
   if(p.key==='bridge'){const map=await ctx.db.query('maps').withIndex('worldId',q=>q.eq('worldId',w)).unique();if(map){const tiles=map.objectTiles.map(layer=>layer.map(column=>[...column]));for(const layer of tiles)for(let x=23;x<=27;x++)for(let y=28;y<=29;y++)if(layer[x]?.[y]===458)layer[x][y]=-1;await ctx.db.patch(map._id,{objectTiles:tiles});}}
   await notice(ctx,w,day,'construction',`${p.title}建成`,`${p.title}实际支出${spent}金币购买${p.materialGoal}份材料与${p.laborGoal}点劳动；结余${refund}金币退回公共财政。${p.description}三维场景将显示完工设施。`);}
 }
}
async function elections(ctx:MutationCtx,w:Id<'worlds'>,day:number){
 const all=(await residents(ctx,w)).filter(r=>r.alive!==false),state=(await stateFor(ctx,w))!,ps=await projects(ctx,w);if(all.length<2)return;
 let e=await latestElection(ctx,w);
 if(!e||e.status==='completed'){
  if(day-state.lastElectionDay<5)return;
  const candidates=all.map(r=>{const options=ps.filter(p=>p.status!=='completed'),key=(options.length?options:ps).slice().sort((a,b)=>preference(r,b.key)-preference(r,a.key))[0].key;return {playerId:r.playerId,projectKey:key,pledge:`优先推动${PROJECTS.find(p=>p.key===key)!.title}`};});
  const id=await ctx.db.insert('civicElections',{worldId:w,startedDay:day,votingDay:day+1,endsDay:day+2,status:'campaigning',candidates,ballots:[]});
  await notice(ctx,w,day,'election','新一轮市长竞选开始',`候选人公开建设主张，第${day+1}日投票，第${day+2}日计票。居民可参选、退选、争取支持；失约记录会影响选票。`);return;
 }
 const candidates=e.candidates.filter(c=>all.some(r=>r.playerId===c.playerId));
 if(day>=e.votingDay&&e.status==='campaigning'){await ctx.db.patch(e._id,{status:'voting',candidates});e={...e,status:'voting',candidates};}
 if(day<e.endsDay||!candidates.length){if(!candidates.length&&day>=e.endsDay){await ctx.db.patch(e._id,{status:'completed'});await ctx.db.patch(state._id,{lastElectionDay:day});await notice(ctx,w,day,'election','本轮选举流选','没有在世候选人，现有市长任期暂时延续。');}return;}
 const promises=await commitments(ctx,w);const ballots=e.ballots.filter(b=>all.some(r=>r.playerId===b.voterId)&&candidates.some(c=>c.playerId===b.candidateId));
 for(const voter of all){if(ballots.some(b=>b.voterId===voter.playerId))continue;
  const scored=[];for(const c of candidates){const candidate=all.find(r=>r.playerId===c.playerId)!,rel=await relationship(ctx,w,voter.playerId,c.playerId);const broken=promises.filter(p=>p.from===c.playerId&&p.status==='broken'&&p.kind==='campaign').length;
   scored.push({c,score:preference(voter,c.projectKey)*3+(rel?.trust??0)*.15-(rel?.conflict??0)*.5+candidate.reputation*.15+(voter.faction===candidate.faction?3:0)-broken*8+(voter.playerId===c.playerId?2:0)});
  }scored.sort((a,b)=>b.score-a.score||a.c.playerId.localeCompare(b.c.playerId));
  ballots.push({voterId:voter.playerId,candidateId:scored[0].c.playerId,reason:'综合个人政策利益、双方信任、派系与候选人履约记录',explicit:false});
 }
 const ranked=candidates.map(c=>({...c,votes:ballots.filter(b=>b.candidateId===c.playerId).length})).sort((a,b)=>b.votes-a.votes||a.playerId.localeCompare(b.playerId));
 const winner=ranked[0],r=all.find(r=>r.playerId===winner.playerId)!;
 await ctx.db.patch(e._id,{status:'completed',candidates,ballots,winnerId:r.playerId});await ctx.db.patch(state._id,{mayorId:r.playerId,lastElectionDay:day});
 const p=ps.find(p=>p.key===winner.projectKey)!;
 if(p.status!=='completed')await ctx.db.insert('civicCommitments',{worldId:w,kind:'campaign',from:r.playerId,projectKey:p.key,amount:0,paid:0,status:'active',createdDay:day,dueDay:day+6,title:`在六日任期内推动${p.title}建成`});
 await notice(ctx,w,day,'election',`${r.name}当选市长`,`${r.name}获得${winner.votes}/${ballots.length}票。主张：${winner.pledge}。本轮保存逐人选票和选择依据，同票按固定候选人编号决胜。`,[r.playerId]);
}
async function civicRequests(ctx:MutationCtx,w:Id<'worlds'>,day:number,season:Doc<'civicSeasons'>){
 const all=(await residents(ctx,w)).filter(r=>r.alive!==false);if(!all.length)return;
 for(const req of await requests(ctx,w)){
  if(req.status==='accepted'){
   const a=all.find(r=>r.playerId===req.from),b=all.find(r=>r.playerId===req.other);
   let outcome='居民收到访客的支持，感谢你参与小镇生活。';
   if(req.kind==='mediation'&&a&&b){const rel=await relationship(ctx,w,a.playerId,b.playerId);const willing=(rel?.trust??0)>-35&&(a.health??100)>20&&(b.health??100)>20;if(willing){await affect(ctx,w,a.playerId,b.playerId,4,-2);outcome='双方接受了调解邀请，信任 +4、冲突 -2；没有强制和解。';}else outcome='至少一方拒绝调解；保留原关系，不强迫居民和好。';}
   if(req.kind==='project'){const p=(await projects(ctx,w)).find(p=>p.key===req.projectKey);if(p)outcome=`访客参加了${p.title}的建设讨论，居民仍按自身意愿决定是否出资和出工。`;}
   await ctx.db.patch(req._id,{status:'completed',outcome});await notice(ctx,w,day,'visitor',req.title,outcome,[req.from,...(req.other?[req.other]:[])]);
  }else if(req.status==='open'&&day>req.expiresDay)await ctx.db.patch(req._id,{status:'expired',outcome:'访客未回复，居民继续自己的生活。'});
 }
 const open=(await requests(ctx,w)).filter(r=>r.status==='open'||r.status==='accepted');if(open.length>=3)return;
 if(day-season.lastFestivalDay>=7){
  const state=(await stateFor(ctx,w))!,farmer=all.find(r=>inventory(r,'食物')>=3);
  if(state.treasury>=52&&farmer){await ctx.db.patch(state._id,{treasury:state.treasury-12});await ctx.db.patch(farmer._id,{coins:farmer.coins+12});await takeStock(ctx,farmer,'食物',3);await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,toPlayerId:farmer.playerId,item:'社区晚餐采购',quantity:3,total:12,tax:0,createdAt:Date.now()});
   const attendees=all.filter(r=>r.energy>=35&&(r.values?.includes('互助')||r.coins>25||r.hunger>35));for(let i=1;i<attendees.length;i++)await affect(ctx,w,attendees[i-1].playerId,attendees[i].playerId,2,-1);
   await notice(ctx,w,day,'festival','社区晚餐开席',`财政花费12枚金币向${farmer.name}采购3份食物。${attendees.map(r=>r.name).join('、')||'暂时无人'}选择参加，邻里获得一次温和的交流机会。`);
   await ctx.db.insert('civicRequests',{worldId:w,kind:'festival',title:'居民邀请你参加社区晚餐',body:'来听听最近的故事，也向居民打个招呼。',from:all[0].playerId,createdDay:day,expiresDay:day+1,status:'open'});
   await ctx.db.patch(season._id,{lastFestivalDay:day});return;
  }
 }
 if(open.some(r=>r.createdDay===day))return;
 const rels=await ctx.db.query('societyRelationships').withIndex('worldId',q=>q.eq('worldId',w)).collect();
 const rel=rels.filter(r=>r.conflict>=4&&all.some(a=>a.playerId===r.player1)&&all.some(a=>a.playerId===r.player2)).sort((a,b)=>b.conflict-a.conflict)[0];
 if(rel&&!open.some(r=>r.kind==='mediation')){const a=all.find(r=>r.playerId===rel.player1)!,b=all.find(r=>r.playerId===rel.player2)!;await ctx.db.insert('civicRequests',{worldId:w,kind:'mediation',title:`${a.name}希望你协调一场分歧`,body:`与${b.name}的冲突尚未解决。你可以邀请双方谈谈，但无法替居民做决定。`,from:a.playerId,other:b.playerId,createdDay:day,expiresDay:day+3,status:'open'});return;}
 const p=(await projects(ctx,w)).find(p=>p.status!=='completed');if(p&&!open.some(r=>r.kind==='project')){const from=all.slice().sort((a,b)=>preference(b,p.key)-preference(a,p.key))[0];await ctx.db.insert('civicRequests',{worldId:w,kind:'project',title:`${from.name}邀请你讨论${p.title}`,body:`尚需${Math.max(0,p.cost-p.funds)}枚金币、${p.materialGoal-p.materials}份材料。居民希望你听听不同意见。`,from:from.playerId,projectKey:p.key,createdDay:day,expiresDay:day+3,status:'open'});}
}
export async function advanceCivic(ctx:MutationCtx,w:Id<'worlds'>,day:number){
 const season=await ensureSeason(ctx,w,day);if(day<=season.lastDay)return;
 await resolveCommitments(ctx,w,day);await projectWork(ctx,w,day);await elections(ctx,w,day);await civicRequests(ctx,w,day,season);
 const rs=(await residents(ctx,w)).filter(r=>r.alive!==false),ps=await projects(ctx,w);
 await notice(ctx,w,day,'daily',`建设季第${day}日小报`,`公共财政${(await stateFor(ctx,w))!.treasury}枚金币；${ps.map(p=>`${p.title}：${p.status==='completed'?'已建成':`${p.funds}/${p.cost}筹款、${p.materials}/${p.materialGoal}材料、${p.labor}/${p.laborGoal}劳动`}`).join('；')}。在世居民${rs.length}位。`);
 await ctx.db.patch(season._id,{lastDay:day});
}
export async function civicConversation(ctx:MutationCtx,w:Id<'worlds'>,messages:Doc<'messages'>[],ids:PID[]){
 const state=await stateFor(ctx,w);if(!state||!(await seasonFor(ctx,w)))return;const day=state.simulatedDay;
 for(const msg of messages.slice().sort((a,b)=>a._creationTime-b._creationTime)){
  const cmd=command(msg.text);if(!cmd||!ids.includes(msg.author))continue;
  const all=await residents(ctx,w),actor=all.find(r=>r.playerId===msg.author),other=all.find(r=>r.playerId===ids.find(id=>id!==msg.author));if(!actor||!other||actor.alive===false||other.alive===false)continue;
  const ps=await projects(ctx,w),cs=await commitments(ctx,w);
  if(cmd==='采收食物'||cmd==='制作建材'){
   const worked=await ctx.db.query('civicWork').withIndex('workerDay',q=>q.eq('worldId',w).eq('playerId',actor.playerId).eq('day',day)).first();
   if(worked||actor.energy<45||(actor.health??100)<35)continue;
   const item=cmd==='采收食物'?'食物':'建筑材料',quantity=item==='食物'?2:1,items=actor.inventory.map(i=>({...i})),stock=items.find(i=>i.item===item);
   if((stock?.quantity??0)+quantity>(item==='食物'?30:24))continue;
   if(stock)stock.quantity+=quantity;else items.push({item,quantity});
   await ctx.db.patch(actor._id,{inventory:items,energy:actor.energy-12});await ctx.db.insert('civicWork',{worldId:w,playerId:actor.playerId,day,item,quantity});
   await notice(ctx,w,day,'work',`${actor.name}主动承担短工`,`${actor.name}花费12点精力${cmd}，获得${quantity}份${item}。这不改变原职业，今天不能再次领取短工产出。`,[actor.playerId]);continue;
  }
  const support=cmd.match(/^(支持|反对)(医院|集市|修桥)$/);
  if(support){const p=ps.find(p=>p.key===projectKey(support[2]));if(p&&p.status!=='completed'){await ctx.db.patch(p._id,{votes:[...p.votes.filter(v=>v.playerId!==actor.playerId),{playerId:actor.playerId,support:support[1]==='支持',reason:'居民在对话中明确表态',explicit:true}]});await notice(ctx,w,day,'position',`${actor.name}表达建设立场`,`${actor.name}${support[1]}${p.title}。`,[actor.playerId]);}continue;}
  const donate=cmd.match(/^捐助(医院|集市|修桥)：(\d+)$/);
  if(donate){const p=ps.find(p=>p.key===projectKey(donate[1])),n=boundedAmount(donate[2],10);if(p&&p.status!=='completed'&&n&&actor.coins-n>=20&&p.funds+n<=p.cost&&!p.contributions.some(c=>c.playerId===actor.playerId&&c.day===day&&c.coins>0)){await ctx.db.patch(actor._id,{coins:actor.coins-n});await ctx.db.patch(p._id,{funds:p.funds+n,contributions:[...p.contributions,{playerId:actor.playerId,day,coins:n,labor:0}]});await ctx.db.insert('societyTransactions',{worldId:w,simulatedDay:day,fromPlayerId:actor.playerId,item:`自愿捐资：${p.title}`,quantity:1,total:n,tax:0,createdAt:Date.now()});await notice(ctx,w,day,'donation',`${actor.name}支持${p.title}`,`${actor.name}自愿捐出${n}枚金币，不可重复领回。`,[actor.playerId]);}continue;}
  const loan=cmd.match(/^借款：(\d+)$/),delivery=cmd.match(/^承诺供货：(\d+)$/);
  if(loan||delivery){const kind=loan?'loan':'delivery',amount=boundedAmount((loan??delivery)![1],loan?20:5);if(amount&&!cs.some(c=>c.from===actor.playerId&&c.kind===kind&&['offered','active'].includes(c.status))){await ctx.db.insert('civicCommitments',{worldId:w,kind,from:actor.playerId,to:other.playerId,amount,paid:0,status:'offered',createdDay:day,dueDay:day+1,title:loan?`向${other.name}借款${amount}枚金币`:`向${other.name}供应${amount}份建筑材料（每份4金币）`});await notice(ctx,w,day,'offer','新的契约提议',`${actor.name}向${other.name}提出${loan?'借款':'供货'}请求，尚未获接受，未发生转账。`,[actor.playerId,other.playerId],false);}continue;}
  if(cmd==='同意借款'||cmd==='接受供货'){const kind=cmd==='同意借款'?'loan':'delivery',c=cs.find(c=>c.kind===kind&&c.from===other.playerId&&c.to===actor.playerId&&c.status==='offered'&&c.dueDay>=day);if(c&&(kind!=='loan'||actor.coins-c.amount>=20)){if(kind==='loan')await transfer(ctx,w,actor,other,c.amount,'双方同意的借款',day);await ctx.db.patch(c._id,{status:'active',dueDay:day+(kind==='loan'?3:2)});await notice(ctx,w,day,'contract','契约生效',`${other.name}与${actor.name}接受了“${c.title}”，约定${kind==='loan'?3:2}日内履行。`,[actor.playerId,other.playerId],false);}continue;}
  if(cmd==='还款'){const c=cs.find(c=>c.kind==='loan'&&c.from===actor.playerId&&c.to===other.playerId&&c.status==='active');if(c){const n=repayment(actor.coins,c.amount-c.paid);if(n){await transfer(ctx,w,actor,other,n,'主动还款',day);const done=n+c.paid===c.amount;await ctx.db.patch(c._id,{paid:n+c.paid,status:done?'fulfilled':'active',outcome:done?'主动兑现借款承诺':'部分归还'});await affect(ctx,w,actor.playerId,other.playerId,done?5:1,0);await notice(ctx,w,day,'promise','主动归还借款',`${actor.name}向${other.name}归还${n}枚金币。`,[actor.playerId,other.playerId],false);}}continue;}
  if(cmd==='分享消息'){
   const known=await ctx.db.query('civicKnowledge').withIndex('owner',q=>q.eq('worldId',w).eq('owner',actor.playerId)).order('desc').take(16);
   for(const k of known){const fact=await ctx.db.get(k.noticeId);if(!fact||fact.public||k.hops>=3)continue;const existing=await ctx.db.query('civicKnowledge').withIndex('fact',q=>q.eq('worldId',w).eq('owner',other.playerId).eq('noticeId',k.noticeId)).unique();if(existing)continue;await learn(ctx,w,other.playerId,k.noticeId,rumor(k.account,k.hops+1),`${actor.name}转述`,day,Math.max(35,k.confidence-20),k.hops+1);break;}continue;
  }
  const e=await latestElection(ctx,w);if(!e||e.status==='completed')continue;
  const run=cmd.match(/^参选：(医院|集市|修桥)$/),vote=cmd.match(/^投票：(.+)$/);
  if(run&&e.status==='campaigning'){const key=projectKey(run[1])!;await ctx.db.patch(e._id,{candidates:[...e.candidates.filter(c=>c.playerId!==actor.playerId),{playerId:actor.playerId,projectKey:key,pledge:`优先推动${PROJECTS.find(p=>p.key===key)!.title}`} ]});}
  else if(cmd==='退选'&&e.status==='campaigning')await ctx.db.patch(e._id,{candidates:e.candidates.filter(c=>c.playerId!==actor.playerId)});
  else if(vote&&e.status==='voting'){const candidate=all.find(r=>r.name===vote[1]&&r.alive!==false);if(candidate&&e.candidates.some(c=>c.playerId===candidate.playerId))await ctx.db.patch(e._id,{ballots:[...e.ballots.filter(b=>b.voterId!==actor.playerId),{voterId:actor.playerId,candidateId:candidate.playerId,reason:'居民在对话中明确投票',explicit:true}]});}
 }
}
export async function civicContext(ctx:Ctx,w:Id<'worlds'>,owner:PID){
 if(!(await seasonFor(ctx,w)))return null;
 const knowledge=await ctx.db.query('civicKnowledge').withIndex('owner',q=>q.eq('worldId',w).eq('owner',owner)).order('desc').take(8);
 const cs=(await commitments(ctx,w)).filter(c=>c.from===owner||c.to===owner).filter(c=>['active','offered','broken'].includes(c.status)).slice(0,6);
 const all=await residents(ctx,w),name=(id:PID)=>all.find(r=>r.playerId===id)?.name??id,e=await latestElection(ctx,w);
 return {production:{farmerAvailable:all.some(r=>r.alive!==false&&/农/.test(r.job)),builderAvailable:all.some(r=>r.alive!==false&&/工匠|建筑/.test(r.job)),shortWork:'可自愿采收2份食物或制作1份建材，每日一次，消耗12精力，须健康至少35、精力至少45；不强迫接班。'},knowledge:knowledge.map(k=>({account:k.account,source:k.source,confidence:k.confidence,day:k.day})),commitments:cs.map(c=>({title:c.title,from:name(c.from),to:c.to?name(c.to):'选民',status:c.status,dueDay:c.dueDay,remaining:c.amount-c.paid})),projects:(await projects(ctx,w)).map(p=>({title:p.title,status:p.status,funds:p.funds,cost:p.cost,materials:p.materials,labor:p.labor})),election:e?{status:e.status,endsDay:e.endsDay,candidates:e.candidates.map(c=>({name:name(c.playerId),pledge:c.pledge}))}:null};
}
export async function civicOverview(ctx:Ctx,w:Id<'worlds'>){
 const season=await seasonFor(ctx,w);if(!season)return null;
 const people=await residents(ctx,w),name=(id:PID)=>people.find(r=>r.playerId===id)?.name??id,e=await latestElection(ctx,w);
 return {season,projects:await projects(ctx,w),commitments:(await commitments(ctx,w)).slice(0,30).map(c=>({...c,fromName:name(c.from),toName:c.to?name(c.to):'选民'})),notices:await ctx.db.query('civicNotices').withIndex('worldId',q=>q.eq('worldId',w)).order('desc').take(24),requests:(await requests(ctx,w)).map(r=>({...r,fromName:name(r.from)})),election:e?{...e,candidates:e.candidates.map(c=>({...c,name:name(c.playerId)})),ballots:e.status==='completed'?e.ballots.map(b=>({...b,voterName:name(b.voterId),candidateName:name(b.candidateId)})):[],winnerName:e.winnerId?name(e.winnerId):null}:null};
}
export const overview=query({args:{worldId:v.id('worlds')},handler:(ctx,{worldId})=>civicOverview(ctx,worldId)});
export const respond=mutation({args:{worldId:v.id('worlds'),requestId:v.id('civicRequests'),accept:v.boolean()},handler:async(ctx,args)=>{
 const r=await ctx.db.get(args.requestId),s=await stateFor(ctx,args.worldId);if(!r||r.worldId!==args.worldId||!s)throw Error('请求不存在');
 if(r.status!=='open')return {status:r.status};if(s.simulatedDay>r.expiresDay)throw Error('邀请已过期');
 await ctx.db.patch(r._id,{status:args.accept?'accepted':'declined',outcome:args.accept?'访客已回应；等待居民在下个社会日处理。':'访客婉拒，居民不会因此被惩罚。'});return {status:args.accept?'accepted':'declined'};
}});
