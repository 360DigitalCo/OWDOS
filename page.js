import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';

const SUPABASE_URL = 'https://tojtsvnjbebdjxdtuhxq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9-80fso2pcykNvuWlCGJ3Q_JJeEJ2P5';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const deviceDefaults = {
  oobeComplete: false,
  hostname: 'owdos',
  language: 'English (US)',
  keyboard: 'US',
  theme: 'midnight',
  accessibility: false,
  reduceMotion: false,
  firmwareVersion: '1.2.0',
  bootloaderVersion: '0.9.0',
  kernelVersion: '0.6.0-ow',
  tpmVersion: '2.0.1-virtual',
  devMode: false,
  managed: false,
  managedOwnerId: null,
  exploitLab: null,
  lastGoodSnapshot: null,
  oobeDraft: null
};

export function storageKey(key) {
  return `owdos:${key}`;
}

export function getDeviceId() {
  let id = localStorage.getItem(storageKey('device-id'));
  if (!id) {
    id = crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase();
    localStorage.setItem(storageKey('device-id'), id);
  }
  return id;
}

export function loadDevice() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey('device')) || '{}'); } catch {}
  return { ...deviceDefaults, ...saved };
}

export function saveDevice(device) {
  localStorage.setItem(storageKey('device'), JSON.stringify(device));
}

export function deviceSnapshot(device) {
  return {
    hostname: device.hostname,
    language: device.language,
    keyboard: device.keyboard,
    theme: device.theme,
    accessibility: device.accessibility,
    reduceMotion: device.reduceMotion,
    firmwareVersion: device.firmwareVersion,
    bootloaderVersion: device.bootloaderVersion,
    kernelVersion: device.kernelVersion,
    tpmVersion: device.tpmVersion,
    devMode: device.devMode,
    managed: device.managed,
    managedOwnerId: device.managedOwnerId,
    exploitLab: device.exploitLab
  };
}

export function saveSnapshot(device, reason = 'manual') {
  device.lastGoodSnapshot = { reason, createdAt: new Date().toISOString(), ...deviceSnapshot(device) };
  saveDevice(device);
}

export function revertDevice(device) {
  if (!device.lastGoodSnapshot) return false;
  const snapshot = device.lastGoodSnapshot;
  Object.assign(device, snapshot);
  device.lastGoodSnapshot = null;
  saveDevice(device);
  return true;
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'midnight';
}

export function redirect(path, params = {}) {
  const url = new URL(path, location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  location.assign(url.href);
}

export function userName(user) {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || 'user';
}

export function resetDevice() {
  Object.keys(localStorage).filter(key => key.startsWith('owdos:')).forEach(key => localStorage.removeItem(key));
  sessionStorage.clear();
}

export function bindRecoveryChord() {
  const pressed = new Set();
  const onDown = event => {
    pressed.add(event.code);
    if (['Digit1', 'Digit4', 'Equal'].every(code => pressed.has(code))) {
      event.preventDefault();
      pressed.clear();
      redirect('recovery.html', { reason: 'key-chord' });
    }
  };
  const onUp = event => pressed.delete(event.code);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}

export async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export function showToast(message, tone = '') {
  let host = qs('#toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast';
    document.body.append(host);
  }
  host.textContent = message;
  host.dataset.tone = tone;
  host.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => host.classList.remove('show'), 3200);
}

export function confirmAction(title, text, confirmLabel = 'Continue') {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal-shell';
    modal.innerHTML = `<section class="modal-card"><div class="eyebrow">OWDOS</div><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-actions"><button class="button ghost" data-cancel>Cancel</button><button class="button danger" data-confirm>${esc(confirmLabel)}</button></div></section>`;
    document.body.append(modal);
    modal.querySelector('[data-cancel]').onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector('[data-confirm]').onclick = () => { modal.remove(); resolve(true); };
  });
}

export function pageFrame({eyebrow = 'OWDOS', title, subtitle, body, footer = ''}) {
  document.body.innerHTML = `<main class="page-shell"><div class="page-grid"></div><section class="panel"><header class="panel-head"><a class="brand" href="index.html"><span class="brand-mark">OW</span><span><b>OWDOS</b><small>Ordbit Web Distro</small></span></a><div class="device-mini"><span>${esc(getDeviceId())}</span><i></i></div></header><div class="panel-content"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ''}${body}</div>${footer ? `<footer class="panel-foot">${footer}</footer>` : ''}</section></main>`;
}

export function systemCard(items) {
  return `<div class="facts-grid">${items.map(([label, value]) => `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
}

