
import {supabase,loadDevice,saveDevice,redirect,confirmAction,userName} from './page.js';
const $=id=>document.getElementById(id);
const qsPanel=$('quick-panel'), notif=$('notif-panel');
const device=loadDevice();
function closePanels(except){if(except!=='qs')qsPanel?.classList.add('hidden');if(except!=='notif')notif?.classList.add('hidden');}
$('clock')?.addEventListener('click',()=>{const open=qsPanel.classList.contains('hidden');closePanels();if(open)qsPanel.classList.remove('hidden')});
$('notif-toggle')?.addEventListener('click',()=>{const open=notif.classList.contains('hidden');closePanels();if(open)notif.classList.remove('hidden')});
document.querySelectorAll('[data-qs]').forEach(b=>b.addEventListener('click',()=>{
  b.classList.toggle('on');const span=b.querySelector('span');if(span)span.textContent=b.classList.contains('on')?'On':'Off';
}));
$('qs-settings')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('owdos:launch',{detail:'settings'})));
$('qs-lock')?.addEventListener('click',()=>{localStorage.setItem('owdos:locked','1');location.reload()});
$('qs-signout')?.addEventListener('click',async()=>{if(await confirmAction('Sign out of OWDOS?','Your account remains intact. The current local session will close.','Sign out'))await supabase.auth.signOut()});
$('clear-notifs')?.addEventListener('click',()=>{const host=$('notif-list');if(host)host.innerHTML='<div style="padding:24px;color:#9ea5ae;font-size:11px;text-align:center">No notifications</div>'});
window.addEventListener('owdos:launch',e=>{const btn=document.querySelector(`[data-app="${e.detail}"]`);btn?.click()});
document.addEventListener('click',e=>{if(!e.target.closest('.taskbar')&&!e.target.closest('.quick-panel')&&!e.target.closest('.notif-panel'))closePanels()});
function clock(){const t=new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(new Date());$('clock').textContent=t}
setInterval(clock,30000);clock();
const user=window.owdos?.auth?null:null;

function syncPanel(){
  const label=$('status-user')?.textContent?.trim()||'OWDOS';
  $('panel-name').textContent=label;
  $('panel-email').textContent=label==='Guest'?'Temporary guest session':'Signed-in OWDOS session';
  $('desktop-status').textContent=`OWDOS · ${device.kernelVersion} · TPM ${device.tpmVersion}`;
}
setInterval(syncPanel,1000);syncPanel();
