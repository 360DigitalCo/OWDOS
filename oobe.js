
import {esc,getDeviceId,loadDevice,saveDevice,bindRecoveryChord,redirect,currentSession,supabase,resetDevice,revertDevice} from './page.js';

const stepEl=document.querySelector('#step'), back=document.querySelector('#back'), next=document.querySelector('#next'), progress=document.querySelector('#progress');
let device=loadDevice(), step=0, session=null, terms=false;
const steps=['welcome','language','keyboard','accessibility','network','terms','account','finish'];

document.querySelector('#device-id').textContent=`DEVICE ${getDeviceId()}`;
bindRecoveryChord();

function renderProgress(){
  progress.innerHTML=steps.map((_,i)=>`<span class="${i<=step?'active':''}"></span>`).join('');
}
function setStep(n){
  step=Math.max(0,Math.min(steps.length-1,n)); renderProgress(); renderStep();
  back.hidden=step===0||step===steps.length-1;
  next.hidden=step===steps.length-1;
  next.textContent=step===0?'Get started':step===steps.length-2?'Finish':'Next';
}
function choice(title,sub,key,selected){return `<button class="oobe-choice ${selected?'selected':''}" data-choice="${esc(key)}"><b>${esc(title)}</b><span>${esc(sub)}</span></button>`}
function renderStep(){
  const t=steps[step];
  if(t==='welcome'){
    stepEl.innerHTML=`<div class="oobe-layout"><div><div class="oobe-eyebrow">FIRST BOOT</div><h1>Welcome to OWDOS</h1><p class="oobe-lead">Set up your device the way you want it. Your account is separate from the local machine, just like it damn well should be.</p><div class="oobe-facts"><div><b>Private by default</b><span>Files and installed apps stay on this browser profile.</span></div><div><b>Real web apps</b><span>Desktop windows, terminal, browser, Files, Store and system tools.</span></div><div><b>Open platform</b><span>Apps can be added through the OWDOS registry and GitHub PRs.</span></div></div></div><div class="oobe-art"><div class="orb orb1"></div><div class="orb orb2"></div><div class="laptop"><div class="screen"></div><div class="base"></div></div></div></div>`;
    document.querySelector('#a11y').innerHTML=`<button class="oobe-link" id="a11y-btn">Accessibility</button>`;
    document.querySelector('#a11y-btn').onclick=()=>setStep(3);
    return;
  }
  document.querySelector('#a11y').innerHTML='';
  if(t==='language'){
    const opts=['English (United States)','English (United Kingdom)','Español','Français','Deutsch','日本語','Português (Brasil)'];
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">LANGUAGE</div><h2>Choose your language</h2><p class="oobe-lead">You can change this later in Settings.</p><div class="choice-list">${opts.map(v=>choice(v,'System language',v,(device.language||opts[0])===v)).join('')}</div></div>`;
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{device.language=b.dataset.choice;saveDevice({...device,oobeDraft:null}) ;renderStep()});
    return;
  }
  if(t==='keyboard'){
    const opts=['US','US International','UK','German','French'];
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">KEYBOARD</div><h2>Pick your keyboard</h2><p class="oobe-lead">OWDOS will use this layout for shortcuts and terminal input.</p><div class="choice-list">${opts.map(v=>choice(v,'Keyboard layout',v,(device.keyboard||'US')===v)).join('')}</div></div>`;
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{device.keyboard=b.dataset.choice;saveDevice(device);renderStep()});
    return;
  }
  if(t==='accessibility'){
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">ACCESSIBILITY</div><h2>Make OWDOS easier to use</h2><p class="oobe-lead">These apply across the desktop and can be changed later.</p><div class="toggle-list"><label><input id="focus" type="checkbox" ${device.accessibility?'checked':''}><span><b>Enhanced focus</b>Make keyboard focus easier to see.</span></label><label><input id="motion" type="checkbox" ${device.reduceMotion?'checked':''}><span><b>Reduce motion</b>Use fewer transitions.</span></label></div></div>`;
    focus.onchange=()=>{device.accessibility=focus.checked;saveDevice(device)}; motion.onchange=()=>{device.reduceMotion=motion.checked;saveDevice(device)}; return;
  }
  if(t==='network'){
    const online=navigator.onLine;
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">NETWORK</div><h2>Connect to the internet</h2><p class="oobe-lead">OWDOS can boot offline. Sign-in, browser access and app downloads need a connection.</p><div class="network-card"><div class="network-icon">${online?'✓':'!'}</div><div><b>${online?'Connected':'Offline'}</b><span>${online?'Your browser reports an active network connection.':'Setup can continue. Connect later from Quick Settings.'}</span></div></div><button class="oobe-link" id="skip-net">Continue offline</button></div>`;
    document.querySelector('#skip-net').onclick=()=>setStep(step+1); return;
  }
  if(t==='terms'){
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">TERMS</div><h2>One agreement before the desktop</h2><p class="oobe-lead">OWDOS is open-source software. Websites and community apps have their own rules.</p><div class="terms-box">OWDOS stores local OS data in your browser profile. Community applications are distributed through the OWDOS app registry. Review software before installing it.</div><label class="agree"><input id="agree" type="checkbox" ${terms?'checked':''}> <span>I understand and agree to continue.</span></label></div>`;
    document.querySelector('#agree').onchange=e=>{terms=e.target.checked;next.disabled=!terms}; next.disabled=!terms; return;
  }
  if(t==='account'){
    stepEl.innerHTML=`<div class="center-step"><div class="oobe-eyebrow">ACCOUNT</div><h2>Who will use this OWDOS device?</h2><p class="oobe-lead">${session?`Signed in as ${esc(session.user.email||'user')}.`:'Use a permanent account or start a temporary Guest session.'}</p><div class="choice-list">${choice('Use an OWDOS account','Sign in or create an account with Supabase.', 'user',true)}${choice('Use Guest','Temporary session. No account required.','guest',false)}</div><div class="account-note">Supabase is used only for authentication. Your local OS files are not uploaded.</div></div>`;
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{if(b.dataset.choice==='guest') redirect('guest.html',{from:'oobe'}); else redirect('login.html',{from:'oobe'})});
    return;
  }
  if(t==='finish'){
    stepEl.innerHTML=`<div class="finish-step"><div class="finish-mark">✓</div><div class="oobe-eyebrow">READY</div><h2>OWDOS is ready.</h2><p class="oobe-lead">The machine is configured. Choose your session and enter the desktop.</p><button class="button primary" id="finish-open">Open session</button></div>`;
    document.querySelector('#finish-open').onclick=()=>{device.oobeComplete=true;device.oobeDraft=null;saveDevice(device);redirect(session?'user.html':'welcome.html')};
  }
}
back.onclick=()=>setStep(step-1);
next.onclick=async()=>{if(step===steps.length-2){setStep(steps.length-1);return} if(step===5&&!terms)return; setStep(step+1)};
setInterval(()=>document.querySelector('#oobe-time').textContent=new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(new Date()),1000);
document.querySelector('#oobe-network').textContent=navigator.onLine?'Connected':'Offline';
session=await currentSession();
if(session) document.body.dataset.signed='1';
setStep(0);

let recoveryPress=0,recoveryTimer;
window.addEventListener('keydown',e=>{
  if(!(e.ctrlKey&&e.altKey&&e.shiftKey&&e.key.toLowerCase()==='r'))return;
  e.preventDefault();
  recoveryPress++;
  clearTimeout(recoveryTimer);
  recoveryTimer=setTimeout(()=>recoveryPress=0,850);
  if(recoveryPress===2){
    recoveryPress=0;
    const d=loadDevice();
    if(revertDevice(d)) location.reload(); else alert('No OWDOS snapshot is available to revert.');
    return;
  }
  if(confirm('Powerwash OWDOS? This deletes local device state and restarts setup. Your Supabase account will not be deleted.')){
    resetDevice();
    location.replace('oobe.html');
  }
});
