import {bindRecoveryChord,esc,getDeviceId,loadDevice,saveDevice,currentSession,redirect} from './page.js';

const device = loadDevice();
const body = document.querySelector('#body');
const next = document.querySelector('#next');
const back = document.querySelector('#back');
const stepLabel = document.querySelector('#step-label');
const progress = document.querySelector('#progress');
const network = document.querySelector('#network-label');
const total = 9;
let step = 0;
let accountChoice = 'user';
let readyUser = null;
let termsAccepted = false;
let revertPress = 0;
let revertTimer = null;

const savedDraft = device.oobeDraft || {};
Object.assign(device, savedDraft.settings || {});
accountChoice = savedDraft.accountChoice || 'user';
if (new URLSearchParams(location.search).get('resume') === 'account') readyUser = (await currentSession())?.user || null;

if (!device.hostname) device.hostname = 'owdos';
document.querySelector('#oobe-device').textContent = `Device ${getDeviceId()}`;
document.querySelector('#oobe-firmware').textContent = `Firmware ${device.firmwareVersion} · Bootloader ${device.bootloaderVersion}`;
document.querySelector('#oobe-kernel').textContent = `Kernel ${device.kernelVersion} · TPM ${device.tpmVersion}`;
network.textContent = navigator.onLine ? 'Network connected' : 'Offline setup';

progress.innerHTML = Array.from({length:total},(_,i)=>`<span${i===0?' class="active"':''}></span>`).join('');

function saveDraft(){device.oobeDraft={accountChoice,settings:{hostname:device.hostname,language:device.language,keyboard:device.keyboard,theme:device.theme,accessibility:device.accessibility,reduceMotion:device.reduceMotion}};saveDevice(device)}
function setStatus(message,ok=true){const old=document.querySelector('.oobe-inline-status');old?.remove();const el=document.createElement('div');el.className=`status ${ok?'good':'bad'} oobe-inline-status`;el.textContent=message;body.append(el)}
function sync(){stepLabel.textContent=`Step ${step+1} of ${total}`;document.querySelectorAll('#progress span').forEach((s,i)=>s.classList.toggle('active',i<=step));back.disabled=step===0;next.disabled=false;next.textContent=step===0?'Begin setup':step===total-1?'Finish setup':'Continue';render()}

function render(){
  if(step===0){body.innerHTML=`<div><div class="eyebrow">FIRST BOOT</div><h1>Welcome to OWDOS.</h1><p>You're about to set up a browser-native operating system with a local filesystem, real Bash, web browsing, and a community app system.</p><div class="light-grid"><button class="light-choice selected"><b>Local by default</b><small>Files and installed apps stay in this browser unless you choose otherwise.</small></button><button class="light-choice"><b>Account when you want it</b><small>Supabase handles identity. It does not become your virtual hard drive.</small></button></div></div>`;return}
  if(step===1){body.innerHTML=`<div><div class="eyebrow">LANGUAGE</div><h2>Choose your language.</h2><p>These settings control OWDOS labels and the first-run environment.</p><div class="stack"><label class="field">Language<select id="language"><option>English (US)</option><option>English (UK)</option><option>Spanish</option><option>French</option><option>German</option><option>Japanese</option></select></label></div></div>`;body.querySelector('#language').value=device.language;return}
  if(step===2){body.innerHTML=`<div><div class="eyebrow">KEYBOARD</div><h2>Pick your keyboard.</h2><p>The Bash terminal and OWDOS shortcuts use this layout.</p><div class="light-grid">${['US','US International','UK','German','French'].map(v=>`<button class="light-choice ${device.keyboard===v?'selected':''}" data-key="${esc(v)}"><b>${esc(v)}</b><small>Physical keyboard layout</small></button>`).join('')}</div></div>`;body.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{device.keyboard=b.dataset.key;render()});return}
  if(step===3){body.innerHTML=`<div><div class="eyebrow">ACCESSIBILITY</div><h2>Make OWDOS easier to use.</h2><p>These settings can be changed later. They are applied to the whole desktop.</p><div class="stack"><label class="check"><input id="accessibility" type="checkbox" ${device.accessibility?'checked':''}><span><b>Enhanced focus</b>Make active controls easier to spot.</span></label><label class="check"><input id="motion" type="checkbox" ${device.reduceMotion?'checked':''}><span><b>Reduce motion</b>Use fewer transitions across the system.</span></label></div></div>`;body.querySelector('#accessibility').onchange=e=>device.accessibility=e.target.checked;body.querySelector('#motion').onchange=e=>device.reduceMotion=e.target.checked;return}
  if(step===4){body.innerHTML=`<div><div class="eyebrow">NETWORK</div><h2>Connect the device.</h2><p>OWDOS can boot offline, but account sign-in, web access, and the app registry need an internet connection.</p><div class="light-card"><div style="display:flex;align-items:center;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:${navigator.onLine?'#238653':'#8a6f36'}"></span><b>${navigator.onLine?'Connected':'Offline'}</b></div><p style="margin:9px 0 0">${navigator.onLine?'Your browser reports an active network connection.':'Setup can continue. Network services can be used after you reconnect.'}</p></div><div class="button-row" style="justify-content:flex-start"><button class="button" id="check-network">Check again</button></div></div>`;body.querySelector('#check-network').onclick=()=>{network.textContent=navigator.onLine?'Network connected':'Offline setup';render()};return}
  if(step===5){body.innerHTML=`<div><div class="eyebrow">TERMS</div><h2>One agreement before the desktop.</h2><p>OWDOS is open-source software. External websites and community apps have their own rules.</p><div class="light-card"><p style="margin:0">The local OWDOS filesystem is stored in this browser. Community apps can run code with the permissions granted by their sandbox. Review unfamiliar apps before installing them.</p></div><label class="check" style="margin-top:18px"><input id="terms" type="checkbox"><span><b>I understand</b>I agree to continue setup and use OWDOS responsibly.</span></label></div>`;body.querySelector('#terms').checked=termsAccepted;body.querySelector('#terms').onchange=e=>{termsAccepted=e.target.checked;next.disabled=!termsAccepted};next.disabled=!termsAccepted;return}
  if(step===6){body.innerHTML=`<div><div class="eyebrow">DEVICE IDENTITY</div><h2>Give the machine a name.</h2><p>This hostname appears in Bash, diagnostics, and system tools.</p><div class="stack"><label class="field">Device name<input id="hostname" maxlength="32" value="${esc(device.hostname)}" spellcheck="false"></label></div><div class="status">Device ID <b>${esc(getDeviceId())}</b> stays unique to this browser profile.</div></div>`;body.querySelector('#hostname').oninput=e=>device.hostname=e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,32)||'owdos';return}
  if(step===7){const signed=readyUser;body.innerHTML=`<div><div class="eyebrow">ACCOUNT</div><h2>${signed?'Account connected.':'Who will use OWDOS?'}</h2><p>${signed?`Continue as ${esc(signed.user_metadata?.username||signed.email||'user')}.`:'Choose a permanent account or a temporary Guest session.'}</p><div class="light-grid"><button class="light-choice ${accountChoice==='user'?'selected':''}" data-account="user"><b>${signed?'Continue with this account':'Use an account'}</b><small>${signed?'Your account is ready.':'Sign in or create an OWDOS account.'}</small></button><button class="light-choice ${accountChoice==='guest'?'selected':''}" data-account="guest"><b>Use Guest</b><small>Temporary filesystem and no account required.</small></button></div>${signed?'<div class="status good" style="margin-top:18px">Authentication is complete. OOBE will continue into the desktop after the final step.</div>':''}</div>`;body.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>{accountChoice=b.dataset.account;saveDraft();if(accountChoice==='guest')render();else if(!readyUser)redirect('login.html',{from:'oobe'});else render()});return}
  body.innerHTML=`<div style="text-align:center"><div class="eyebrow">READY</div><h1>OWDOS is ready.</h1><p>Your device setup is complete. The next screen is your OWDOS session.</p><div class="facts-grid" style="text-align:left">${[['Hostname',device.hostname],['Language',device.language],['Keyboard',device.keyboard],['Theme',device.theme],['Account',accountChoice==='guest'?'Guest':readyUser?'Connected':'Sign in next'],['Kernel',device.kernelVersion],['TPM',device.tpmVersion],['Storage','Local browser storage']].map(([a,b])=>`<div class="fact"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div></div>`;
}

next.onclick=async()=>{
  if(step===1)device.language=body.querySelector('#language').value;
  if(step===5&&!termsAccepted)return;
  if(step===6&&(!/^[a-z0-9-]{1,32}$/.test(device.hostname)))return setStatus('Use 1–32 letters, numbers, or hyphens.',false);
  if(step===7&&!readyUser&&accountChoice==='user')return redirect('login.html',{from:'oobe'});
  if(step<total-1){saveDraft();step++;sync();return}
  device.oobeComplete=true;device.oobeDraft=null;saveDevice(device);if(accountChoice==='guest')return redirect('guest.html',{from:'oobe'});const session=await currentSession();if(session)return redirect('desktop.html');redirect('login.html',{from:'oobe'});
};
back.onclick=()=>{if(step>0){step--;sync()}};
window.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.key.toLowerCase()==='r'){e.preventDefault();revertPress++;clearTimeout(revertTimer);revertTimer=setTimeout(()=>revertPress=0,700);const target=revertPress>1?'revert':'powerwash';revertPress=0;const overlay=document.createElement('div');overlay.className='modal-shell';overlay.innerHTML=`<section class="modal-card"><div class="eyebrow">OOBE RECOVERY</div><h2>${target==='revert'?'Restore the last setup':'Powerwash during setup'}?</h2><p>${target==='revert'?'Restore the most recent local device snapshot and restart setup.':'Erase the local OWDOS device state and restart from the first boot screen.'}</p><div class="modal-actions"><button class="button ghost" data-cancel>Cancel</button><button class="button danger" data-go>${target==='revert'?'Revert':'Powerwash'}</button></div></section>`;document.body.append(overlay);overlay.querySelector('[data-cancel]').onclick=()=>overlay.remove();overlay.querySelector('[data-go]').onclick=()=>{overlay.remove();if(target==='revert'){location.assign('recovery.html?from=oobe&action=revert')}else{localStorage.clear();sessionStorage.clear();location.assign('index.html')}}}
});
window.addEventListener('online',()=>{network.textContent='Network connected'});window.addEventListener('offline',()=>{network.textContent='Offline setup'});
bindRecoveryChord();sync();
