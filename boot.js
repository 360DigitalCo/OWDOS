import {bindRecoveryChord, esc, getDeviceId, loadDevice, saveDevice, redirect, currentSession} from './page.js';

const device = loadDevice();
const card = document.querySelector('.boot-card');
const bootMenu = document.querySelector('#boot-menu');
const meta = document.querySelector('#boot-meta');
const status = document.querySelector('#boot-status');
const params = new URLSearchParams(location.search);
const showLoader = params.get('loader') === '1';

const items = [
  ['boot', 'Boot OWDOS', 'Start the installed system.'],
  ['oobe', 'First-boot setup', 'Run OOBE from the device boundary.'],
  ['recovery', 'Recovery mode', 'Repair, revert, restore or Powerwash.'],
  ['devmode', 'Developer mode', 'Use the local development firmware environment.'],
  ['admin', 'Admin console', 'Provision this device after proving ownership.'],
  ['shutdown', 'Power off', 'Stop at the firmware screen.']
];

meta.innerHTML = [['Device', getDeviceId()],['Firmware',device.firmwareVersion],['Bootloader',device.bootloaderVersion],['Kernel',device.kernelVersion],['TPM',device.tpmVersion],['Mode',device.devMode?'Developer':'Verified'],['Managed',device.managed?'Yes':'No'],['Host',device.hostname]].map(([a,b])=>`<div><span>${a}</span><b>${esc(b)}</b></div>`).join('');

function menu(){
  bootMenu.innerHTML = items.map(([id,title,desc]) => `<button data-boot="${id}"><b>${esc(title)}</b><span>${esc(desc)}</span></button>`).join('');
  const buttons=[...bootMenu.querySelectorAll('button')];
  let selected=0;
  const select=n=>{selected=(n+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.classList.toggle('selected',i===selected))};
  const go=kind=>{
    if(kind==='boot'){status.textContent='BOOTING'; return routeAfterBoot()}
    if(kind==='oobe')return redirect('oobe.html',{from:'bootloader'});
    if(kind==='recovery')return redirect('recovery.html',{from:'bootloader'});
    if(kind==='devmode'){device.devMode=true;device.oobeComplete=true;saveDevice(device);return redirect('devmode.html',{from:'bootloader'})}
    if(kind==='admin')return redirect('admin.html',{from:'bootloader'});
    if(kind==='shutdown'){status.textContent='POWERED OFF';bootMenu.innerHTML='<button data-restart><b>Restart OWDOS</b><span>Return to firmware.</span></button>';bootMenu.querySelector('[data-restart]').onclick=()=>location.assign('index.html')}
  };
  select(0);buttons.forEach(b=>b.onclick=()=>go(b.dataset.boot));
  window.addEventListener('keydown',function handler(e){
    if(e.key==='ArrowDown'){e.preventDefault();select(selected+1)}
    if(e.key==='ArrowUp'){e.preventDefault();select(selected-1)}
    if(e.key==='Enter')go(buttons[selected].dataset.boot);
    const k=e.key.toLowerCase(); if(k==='r')go('recovery');if(k==='d')go('devmode');if(k==='a')go('admin');if(k==='p')go('shutdown');
  },{once:false});
}

async function routeAfterBoot(){
  await new Promise(r=>setTimeout(r,180));
  if(!device.oobeComplete)return redirect('oobe.html');
  const session=await currentSession();
  redirect(session?'user.html':'welcome.html');
}

async function startup(){
  if(showLoader){
    card.querySelector('.boot-title').textContent='OWDOS Bootloader';
    status.textContent='READY';
    menu();
    bindRecoveryChord();
    return;
  }
  bootMenu.innerHTML='';
  status.textContent='STARTING FIRMWARE';
  const steps=[['ROM','Checking firmware image'],['BL1','Loading Ordbit bootloader'],['TPM','Checking virtual TPM profile'],['KERNEL','Loading OWDOS kernel'],['VFS','Mounting local storage'],['INIT','Starting system services']];
  for(const [name,message] of steps){
    status.textContent=message;
    const line=document.createElement('div');line.className='boot-line';line.innerHTML=`<span>${name}</span><b>OK</b>`;bootMenu.append(line);await new Promise(r=>setTimeout(r,170));
  }
  card.querySelector('.boot-title').textContent='OWDOS';
  status.textContent='HANDING OFF';
  await routeAfterBoot();
}

bindRecoveryChord();
startup();
