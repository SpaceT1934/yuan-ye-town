import './civic.css';
import {createCivicBuildings} from './civic-buildings.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={proposed:'筹备中',building:'施工中',completed:'已完成',offered:'等待同意',active:'履行中',fulfilled:'已兑现',broken:'已失约',cancelled:'已终止',campaigning:'竞选中',voting:'投票中',open:'待回应',accepted:'等待居民处理',declined:'已婉拒',expired:'已过期'};
export function connectCivic(town,backend){
 const worldId=town.data.provenance.worldId,buildings=createCivicBuildings(town);
 const button=document.createElement('button');button.id='show-civic';button.textContent='建设季';document.querySelector('.live-controls').append(button);
 const dialog=document.createElement('dialog');dialog.id='civic-dialog';dialog.innerHTML='<header><div><small>原野小镇 · 社会档案</small><h2>建设季</h2></div><button aria-label="关闭建设季">关闭</button></header><p class="civic-status">正在读取存档…</p><div class="civic-content"></div>';document.body.append(dialog);
 const status=dialog.querySelector('.civic-status'),content=dialog.querySelector('.civic-content');let data,busy=false,disposed=false;
 button.onclick=()=>{dialog.showModal();void refresh()};dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-request]');if(!b||b.disabled)return;const controls=[...content.querySelectorAll(`[data-request="${b.dataset.request}"]`)];controls.forEach(b=>b.disabled=true);try{await backend('mutation','civic:respond',{worldId,requestId:b.dataset.request,accept:b.dataset.accept==='yes'});await refresh()}catch(e){status.textContent=e.message;controls.forEach(b=>b.disabled=false)}});
 function render(){
  if(!data){status.textContent='建设季尚未开始，等待下一次社会更新；暂停时不会推进。';return}
  const {season,projects,requests,commitments,notices,election:e}=data;
  button.textContent=`建设季${requests.some(r=>r.status==='open')?' · 有邀请':''}`;
  status.textContent=`第 ${season.lastDay} 日 · 第 ${season.startedDay} 日启动 · 原居民、记忆与财产沿用。居民可主动表态；未明确表态时按个人利益和关系作规则决策。`;
  const card=(title,body)=>`<article><h3>${esc(title)}</h3>${body}</article>`;
  content.innerHTML=`<h3>共同建设 · 同一笔公共预算</h3><div class="civic-grid">${projects.map(p=>card(p.title,`<span class="civic-chip">${labels[p.status]}</span><p>${esc(p.description)}</p><progress max="${p.cost}" value="${p.funds}"></progress><p>筹资 ${p.funds}/${p.cost} 金币 · 可用 ${p.funds-p.spent}<br>材料 ${p.materials}/${p.materialGoal} · 劳动 ${p.labor}/${p.laborGoal}<br>支持 ${p.votes.filter(v=>v.support).length} / ${p.votes.length} 人</p><small>多数支持且资金到位才开工，材料和劳动另行采购。</small>`)).join('')}</div>
  <h3>居民给你的邀请</h3><div class="civic-grid">${requests.slice(0,6).map(r=>card(r.title,`<span class="civic-chip">${labels[r.status]}</span><p>${esc(r.body)}</p><small>来自 ${esc(r.fromName)} · 第 ${r.expiresDay} 日后过期</small>${r.status==='open'?`<div class="civic-actions"><button data-request="${esc(r._id)}" data-accept="yes">愿意参与</button><button data-request="${esc(r._id)}" data-accept="no">暂不参与</button></div>`:`<p>${esc(r.outcome)}</p>`}`)).join('')||'<p>暂时没有邀请，居民仍在生活。</p>'}</div>
  <h3>市长选举</h3>${e?card(labels[e.status],`<p>第 ${e.startedDay} 日竞选 / 第 ${e.votingDay} 日投票 / 第 ${e.endsDay} 日计票${e.winnerName?` · 当选：${esc(e.winnerName)}`:''}</p>${e.candidates.map(c=>`<p><b>${esc(c.name)}</b> · ${esc(c.pledge)}</p>`).join('')}${e.ballots.length?`<details><summary>查看逐人选票与依据</summary>${e.ballots.map(b=>`<p>${esc(b.voterName)} → ${esc(b.candidateName)}<br><small>${b.explicit?'对话中的明确选择':'个人规则决策'}：${esc(b.reason)}</small></p>`).join('')}</details>`:'<small>投票阶段不公开个人选票，计票后可查阅。</small>'}`):'<p>尚未到下一轮竞选时间。</p>'}
  <h3>契约与承诺</h3><p class="civic-muted">观察者档案包含私下契约；其他居民并不会自动知道。</p>${commitments.slice(0,12).map(c=>card(c.title,`<span class="civic-chip">${labels[c.status]}</span><p>${esc(c.fromName)} → ${esc(c.toName)} · 截止第 ${c.dueDay} 日${c.kind!=='campaign'?` · 已履行 ${c.paid}/${c.amount}`:''}</p><small>${esc(c.outcome??'等待当事人行动')}</small>`)).join('')||'<p>尚无新契约，不会凭空生成借款。</p>'}
  <h3>小镇纪事</h3>${notices.map(n=>card(`第 ${n.day} 日 · ${n.title}`,`<small>${n.public?'公共公告':'私下事件 · 仅观察者与知情者可见'}</small><p>${esc(n.body)}</p>`)).join('')}`;
 }
 async function refresh(){if(busy||disposed)return;busy=true;try{data=await backend('query','civic:overview',{worldId});if(disposed)return;buildings.update(data?.projects??[]);render()}catch(e){status.textContent=`建设季暂时无法更新：${e.message}。保留上次画面。`}finally{busy=false}}
 const timer=setInterval(refresh,15000);void refresh();return {refresh,get data(){return data},dispose(){disposed=true;clearInterval(timer);buildings.dispose();button.remove();dialog.remove()}};
}
