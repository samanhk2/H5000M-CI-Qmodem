(()=>{"use strict";
let timer,request,stopped=false,cell="",meters=null,zeroStreak=0;
function clear(){clearTimeout(timer);request?.abort();request=null;const node=document.getElementById("quectel-cell-distance");if(node)node.textContent="基站距离：未测得";cell="";meters=null;zeroStreak=0;}
function tag(){
 for(const title of document.querySelectorAll('.ant-card-head-title'))if(/流量统计|Traffic Statistics/.test(title.textContent||""))title.closest('.ant-card')?.setAttribute('data-modemwebui-traffic','1');
}
function dashboard(){return location.pathname==='/'||location.pathname.replace(/\/+$/,'')==='/dashboard';}
async function poll(){
 if(stopped||document.hidden||!dashboard()||request)return;
 const controller=new AbortController();request=controller;const timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch('/api/cell-distance',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('采样失败');const data=await response.json();if(controller.signal.aborted||!dashboard())return;
  const distance=data.cell_distance;let panel=document.getElementById('quectel-cell-distance');
  if(!panel){const heading=[...document.querySelectorAll('h2')].find(node=>node.textContent.trim()==='概览信息');const parent=heading?.closest('.ant-card')?.querySelector(':scope > .ant-card-body');if(!parent)return;panel=document.createElement('div');panel.id='quectel-cell-distance';panel.className='ant-card';panel.style.cssText='padding:12px 16px;margin-bottom:12px;overflow-wrap:anywhere';parent.prepend(panel);}
  const currentCell=distance?.cell||'';
  if(!currentCell||currentCell!==cell){meters=null;zeroStreak=0;}
  cell=currentCell;
  if(cell&&distance.status==='estimated'&&Number.isFinite(distance.meters)){
    meters=distance.meters;zeroStreak=0;
    panel.textContent=`基站距离：约 ${meters.toFixed(1)} 米`;
  }else{
    zeroStreak=cell&&distance.ta===0?Math.min(zeroStreak+1,3):0;
    if(meters!==null&&zeroStreak===3)meters=0;
    panel.textContent=meters===null?'基站距离：未测得':meters===0?'基站距离：0.0 米':`基站距离：上次估算约 ${meters.toFixed(1)} 米`;
  }
 }catch(_){if(!controller.signal.aborted){zeroStreak=0;const node=document.getElementById('quectel-cell-distance');if(node)node.textContent=meters===null?'基站距离：未测得':meters===0?'基站距离：0.0 米':`基站距离：上次估算约 ${meters.toFixed(1)} 米`;}}
 finally{clearTimeout(timeout);if(request===controller)request=null;if(!stopped&&!document.hidden&&dashboard())timer=setTimeout(poll,10000);}
}
let last=location.pathname;const observer=new MutationObserver(()=>{tag();if(last!==location.pathname){last=location.pathname;clear();document.getElementById('quectel-cell-distance')?.remove();poll();}});observer.observe(document.body,{childList:true,subtree:true});tag();poll();
document.addEventListener('visibilitychange',()=>{clear();if(!document.hidden)poll();});window.addEventListener('pagehide',()=>{stopped=true;clear();observer.disconnect();},{once:true});
})();
