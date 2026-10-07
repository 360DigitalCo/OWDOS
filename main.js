import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import { Terminal } from 'https://esm.sh/@xterm/xterm@6.0.0';
import { FitAddon } from 'https://esm.sh/@xterm/addon-fit@0.11.0';
import { Wasmer } from 'https://esm.sh/@wasmer/sdk@0.19.1/browser';

const SUPABASE_URL = 'https://tojtsvnjbebdjxdtuhxq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9-80fso2pcykNvuWlCGJ3Q_JJeEJ2P5';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const boot = $('boot');
const auth = $('auth');
const desktop = $('desktop');
const windows = $('windows');
const taskList = $('task-list');
const launcherMenu = $('launcher-menu');
const toastArea = $('toast-area');

const state = {
  authMode: 'signin',
  user: null,
  windows: new Map(),
  nextZ: 10,
  disk: {},
  registry: [],
  installed: [],
  bash: null,
  shell: null,
  terminal: null,
  termFit: null,
  shellReady: false,
  saveTimer: null,
  booted: false,
  bootMode: null,
  oobe: null,
  mode: 'none',
  oobeAccountChoice: 'user',
  deviceReady: false,
  deviceId: null,
  devMode: false,
  deviceManaged: false,
  system: { oobeComplete: false, hostname: 'owdos', theme: 'midnight', language: 'English (US)', keyboard: 'US', accessibility: false, reduceMotion: false, diagnostics: false, firmwareVersion: '1.2.0', bootloaderVersion: '0.9.0', kernelVersion: '0.6.0-ow', tpmVersion: '2.0.1-virtual', devMode: false, managed: false, lastGoodSnapshot: null },
  kernel: null
};

const defaultDisk = username => ({
  '/': { type: 'dir', name: '/', updatedAt: Date.now() },
  '/home': { type: 'dir', name: 'home', updatedAt: Date.now() },
  [`/home/${username}`]: { type: 'dir', name: username, updatedAt: Date.now() },
  [`/home/${username}/Desktop`]: { type: 'dir', name: 'Desktop', updatedAt: Date.now() },
  [`/home/${username}/Documents`]: { type: 'dir', name: 'Documents', updatedAt: Date.now() },
  [`/home/${username}/Downloads`]: { type: 'dir', name: 'Downloads', updatedAt: Date.now() },
  [`/home/${username}/Pictures`]: { type: 'dir', name: 'Pictures', updatedAt: Date.now() },
  [`/home/${username}/Music`]: { type: 'dir', name: 'Music', updatedAt: Date.now() },
  [`/home/${username}/.config`]: { type: 'dir', name: '.config', updatedAt: Date.now() },
  [`/home/${username}/Desktop/Welcome.txt`]: {
    type: 'file',
    name: 'Welcome.txt',
    content: 'Welcome to OWDOS.\n\nYour desktop, filesystem, and installed apps live locally in this browser.\nYour OWDOS account is handled by Supabase.\n',
    updatedAt: Date.now()
  }
});

function storageKey(name) {
  return `owdos:${name}`;
}

function userStorageKey(name) {
  const id = state.user?.id || state.guestId || 'guest';
  return storageKey(`${name}:${id}`);
}

function loadSystemState() {
  const defaults = { oobeComplete: false, hostname: 'owdos', theme: 'midnight', language: 'English (US)', keyboard: 'US', accessibility: false, reduceMotion: false, diagnostics: false, firmwareVersion: '1.2.0', bootloaderVersion: '0.9.0', kernelVersion: '0.6.0-ow', tpmVersion: '2.0.1-virtual', devMode: false, managed: false, lastGoodSnapshot: null };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey('device')) || 'null');
    state.system = { ...defaults, ...(saved || {}) };
  } catch {
    state.system = { ...defaults };
  }
  state.deviceId = localStorage.getItem(storageKey('device-id')) || crypto.randomUUID().toUpperCase();
  localStorage.setItem(storageKey('device-id'), state.deviceId);
  state.devMode = !!state.system.devMode;
  state.deviceManaged = !!state.system.managed;
  document.documentElement.dataset.theme = state.system.theme || 'default';
  document.documentElement.classList.toggle('reduce-motion', !!state.system.reduceMotion);
}

function saveSystemState() {
  try {
    localStorage.setItem(storageKey('device'), JSON.stringify(state.system));
  } catch {}
}

function resetSetupScreens() {
  ['welcome', 'user', 'auth', 'guest', 'desktop'].forEach(id => $(id)?.classList.add('hidden'));
  boot.classList.add('hidden');
}

function showSetupPage(id) {
  resetSetupScreens();
  $(id)?.classList.remove('hidden');
}

function kernelLog(message, level = 'info') {
  if (!state.kernel) return;
  const entry = { time: new Date().toISOString(), level, message };
  state.kernel.logs.push(entry);
  if (state.kernel.logs.length > 150) state.kernel.logs.shift();
}

function createKernel() {
  const kernel = {
    version: state.system.kernelVersion || '0.5.0-ow',
    pidNext: 2,
    processes: new Map(),
    logs: [],
    bootId: crypto.randomUUID(),
    startedAt: Date.now(),
    spawn(name, type = 'service') {
      const pid = this.pidNext++;
      const process = { pid, name, type, startedAt: Date.now(), state: 'running' };
      this.processes.set(pid, process);
      kernelLog(`pid ${pid}: ${name} started`);
      return process;
    },
    stop(pid) {
      const process = this.processes.get(pid);
      if (!process) return false;
      process.state = 'stopped';
      this.processes.delete(pid);
      kernelLog(`pid ${pid}: ${process.name} stopped`);
      return true;
    },
    exec(name, type = 'process') {
      return this.spawn(name, type);
    },
    uptime() {
      return Math.max(0, Date.now() - this.startedAt);
    },
    snapshot() {
      return [...this.processes.values()].map(process => ({ ...process }));
    }
  };
  state.kernel = kernel;
  kernel.spawn('init', 'kernel');
  kernel.spawn('dbus', 'service');
  kernel.spawn('desktop', 'service');
  window.owdos = { kernel, fs: state.disk, auth: supabase, device: { id: state.deviceId, firmware: state.system.firmwareVersion, bootloader: state.system.bootloaderVersion, kernel: state.system.kernelVersion, tpm: state.system.tpmVersion } };
  return kernel;
}

function formatUptime(ms) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return days ? `${days}d ${hours}h ${minutes}m` : hours ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}

function showMessage(text, type = '') {
  const el = $('auth-message');
  el.textContent = text || '';
  el.className = `message ${type}`.trim();
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button.dataset.authTab === mode));
  $('username-wrap').classList.toggle('hidden', mode !== 'signup');
  $('password2-wrap').classList.toggle('hidden', mode !== 'signup');
  $('auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  $('forgot-password').classList.toggle('hidden', mode !== 'signin');
  showMessage('');
}

async function handleAuth(event) {
  event.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const username = $('username').value.trim();
  const password2 = $('password2').value;
  const submit = $('auth-submit');
  submit.disabled = true;
  try {
    if (state.authMode === 'signup') {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) throw new Error('Username must be 3-24 characters using letters, numbers, or underscores.');
      if (password !== password2) throw new Error('Passwords do not match.');
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
      if (error) throw error;
      if (!data.session) {
        showMessage('Account created. Check your email to confirm it, then sign in.', 'ok');
      } else {
        showMessage('Account created.', 'ok');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    const code = error?.code || error?.status;
    if (state.authMode === 'signin' && code === 'email_not_confirmed') {
      showMessage('Confirm your email address before signing in.', 'error');
    } else if (state.authMode === 'signin' && code === 'invalid_credentials') {
      showMessage('The email or password is incorrect.', 'error');
    } else {
      showMessage(error.message || 'Authentication failed.', 'error');
    }
  } finally {
    submit.disabled = false;
  }
}

async function forgotPassword() {
  const email = $('email').value.trim();
  if (!email) {
    showMessage('Enter your email address first.', 'error');
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
  if (error) showMessage(error.message, 'error');
  else showMessage('If that address can receive account email, a reset message has been sent.', 'ok');
}

function usernameFor(user) {
  if (!user && state.mode === 'guest') return 'guest';
  const name = user?.user_metadata?.username;
  if (name && /^[A-Za-z0-9_]{3,24}$/.test(name)) return name;
  return (user?.email?.split('@')[0] || 'user').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24) || 'user';
}

function userLabel(user) {
  if (!user && state.mode === 'guest') return 'Guest';
  return user?.user_metadata?.username || user?.email || 'user';
}

async function loadLocalState() {
  loadSystemState();
  createKernel();
  kernelLog('mounting local filesystem');
  const username = usernameFor(state.user);
  const diskKey = userStorageKey('disk');
  const installedKey = userStorageKey('installed');
  const store = state.mode === 'guest' ? sessionStorage : localStorage;
  const raw = store.getItem(diskKey);
  try {
    state.disk = raw ? JSON.parse(raw) : defaultDisk(username);
  } catch {
    state.disk = defaultDisk(username);
  }
  try {
    state.installed = JSON.parse(store.getItem(installedKey) || '[]');
    if (!Array.isArray(state.installed)) state.installed = [];
  } catch {
    state.installed = [];
  }
  saveDisk();
}

function saveDisk() {
  if (state.mode === 'none') return;
  try {
    const store = state.mode === 'guest' ? sessionStorage : localStorage;
    store.setItem(userStorageKey('disk'), JSON.stringify(state.disk));
    store.setItem(userStorageKey('installed'), JSON.stringify(state.installed));
  } catch (error) {
    toast('Local disk is full. Remove some files or reduce large file contents.');
  }
}

function normalizePath(path) {
  if (!path) return '/';
  const absolute = path.startsWith('/') ? path : `/home/${usernameFor(state.user)}/${path}`;
  const parts = absolute.split('/').filter(Boolean);
  const stack = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return `/${stack.join('/')}` || '/';
}

function parentPath(path) {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '/' : normalized.slice(0, index);
}

function basename(path) {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function ensureDir(path) {
  const p = normalizePath(path);
  if (!state.disk[p]) state.disk[p] = { type: 'dir', name: basename(p), updatedAt: Date.now() };
  return p;
}

function createPath(path, type = 'file', content = '') {
  const p = normalizePath(path);
  if (p === '/') throw new Error('Cannot replace the root directory.');
  ensureDir(parentPath(p));
  state.disk[p] = { type, name: basename(p), content: type === 'file' ? content : undefined, updatedAt: Date.now() };
  saveDisk();
  return p;
}

function removePath(path) {
  const p = normalizePath(path);
  if (p === '/') throw new Error('Cannot remove the root directory.');
  const children = Object.keys(state.disk).filter(key => key !== p && key.startsWith(`${p}/`));
  children.forEach(key => delete state.disk[key]);
  delete state.disk[p];
  saveDisk();
}

function listDir(path) {
  const p = normalizePath(path);
  const entry = state.disk[p];
  if (!entry || entry.type !== 'dir') throw new Error(`${p}: Not a directory`);
  const prefix = p === '/' ? '/' : `${p}/`;
  const names = new Map();
  for (const key of Object.keys(state.disk)) {
    if (!key.startsWith(prefix) || key === p) continue;
    const rest = key.slice(prefix.length);
    if (!rest || rest.includes('/')) continue;
    names.set(rest, state.disk[key]);
  }
  return [...names.entries()].sort((a, b) => {
    if (a[1].type !== b[1].type) return a[1].type === 'dir' ? -1 : 1;
    return a[0].localeCompare(b[0]);
  });
}

function openWindow(app, title, content, options = {}) {
  const id = options.id || `${app}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const width = options.width || 720;
  const height = options.height || 500;
  const win = document.createElement('section');
  win.className = 'window';
  win.dataset.id = id;
  win.dataset.app = app;
  win.style.width = `${Math.min(width, innerWidth - 16)}px`;
  win.style.height = `${Math.min(height, innerHeight - 74)}px`;
  win.style.left = `${Math.max(8, 70 + state.windows.size * 28)}px`;
  win.style.top = `${Math.max(8, 40 + state.windows.size * 24)}px`;
  win.innerHTML = `<div class="titlebar"><div class="title"></div><div class="win-actions"><button class="win-btn minimize" title="Minimize">−</button><button class="win-btn maximize" title="Maximize">□</button><button class="win-btn close" title="Close">×</button></div></div><div class="window-content"></div>`;
  win.querySelector('.title').textContent = title;
  win.querySelector('.window-content').append(content);
  windows.append(win);
  state.windows.set(id, { id, app, title, win, minimized: false, maximized: false });
  focusWindow(id);
  makeDraggable(win);
  refreshTasks();
  return state.windows.get(id);
}

function focusWindow(id) {
  state.windows.forEach(item => item.win.classList.remove('active'));
  const item = state.windows.get(id);
  if (!item) return;
  item.win.style.zIndex = ++state.nextZ;
  item.win.classList.add('active');
  item.minimized = false;
  item.win.style.display = '';
  refreshTasks();
}

function closeWindow(id) {
  const item = state.windows.get(id);
  if (!item) return;
  if (item.app === 'terminal' && state.shell) {
    syncGuestHome();
    try { state.shell.kill?.(); } catch {}
    state.shell = null;
    state.shellReady = false;
    state.bash = null;
  }
  item.win.remove();
  state.windows.delete(id);
  refreshTasks();
}

function toggleMinimize(id) {
  const item = state.windows.get(id);
  if (!item) return;
  item.minimized = !item.minimized;
  item.win.style.display = item.minimized ? 'none' : '';
  if (!item.minimized) focusWindow(id);
  refreshTasks();
}

function toggleMaximize(id) {
  const item = state.windows.get(id);
  if (!item) return;
  item.maximized = !item.maximized;
  item.win.classList.toggle('maximized', item.maximized);
  if (!item.maximized) {
    item.win.style.width = `${Math.min(720, innerWidth - 16)}px`;
    item.win.style.height = `${Math.min(500, innerHeight - 74)}px`;
  }
  focusWindow(id);
  if (state.termFit) setTimeout(() => state.termFit.fit(), 0);
}

function refreshTasks() {
  taskList.innerHTML = '';
  state.windows.forEach(item => {
    const task = document.createElement('button');
    task.className = `task ${item.win.classList.contains('active') && !item.minimized ? 'active' : ''}`;
    task.textContent = item.title;
    task.onclick = () => item.minimized ? focusWindow(item.id) : toggleMinimize(item.id);
    taskList.append(task);
  });
}

function makeDraggable(win) {
  const bar = win.querySelector('.titlebar');
  let drag = null;
  bar.addEventListener('pointerdown', event => {
    if (event.target.closest('.win-btn')) return;
    const item = state.windows.get(win.dataset.id);
    if (item?.maximized) return;
    focusWindow(win.dataset.id);
    drag = { x: event.clientX, y: event.clientY, left: win.offsetLeft, top: win.offsetTop };
    bar.setPointerCapture(event.pointerId);
  });
  bar.addEventListener('pointermove', event => {
    if (!drag) return;
    const left = Math.max(8, Math.min(innerWidth - 80, drag.left + event.clientX - drag.x));
    const top = Math.max(8, Math.min(innerHeight - 100, drag.top + event.clientY - drag.y));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  });
  bar.addEventListener('pointerup', () => drag = null);
  win.addEventListener('pointerdown', () => focusWindow(win.dataset.id));
  win.querySelector('.close').onclick = () => closeWindow(win.dataset.id);
  win.querySelector('.minimize').onclick = () => toggleMinimize(win.dataset.id);
  win.querySelector('.maximize').onclick = () => toggleMaximize(win.dataset.id);
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastArea.append(el);
  setTimeout(() => el.remove(), 3200);
}

function appRoot() {
  const root = document.createElement('div');
  root.className = 'app-shell';
  return root;
}

function createTerminalApp() {
  const root = appRoot();
  const wrap = document.createElement('div');
  wrap.className = 'terminal-wrap';
  const term = document.createElement('div');
  term.className = 'terminal';
  wrap.append(term);
  root.append(wrap);
  const item = openWindow('terminal', 'Terminal', root, { width: 820, height: 520 });

  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: 13,
    convertEol: true,
    scrollback: 5000,
    theme: { background: '#08090b', foreground: '#e5e7eb', cursor: '#7dd3fc', selectionBackground: '#1f3440' }
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(term);
  state.terminal = terminal;
  state.termFit = fit;
  setTimeout(() => fit.fit(), 0);
  startBash(terminal, fit).catch(error => terminal.writeln(`\r\nOWDOS: ${error.message || error}`));
  return item;
}

async function startBash(term, fit) {
  if (state.shell) {
    term.writeln('\r\nA Bash session is already running in OWDOS.');
    return;
  }
  if (!crossOriginIsolated) {
    term.writeln('\r\nOWDOS: the browser needs cross-origin isolation for the Bash runtime. Reload this page after the service worker finishes installing.');
    return;
  }

  term.write('\x1b[1;36mOWDOS\x1b[0m starting Bash...\r\n');
  const username = usernameFor(state.user);
  const files = {};
  Object.entries(state.disk).forEach(([path, node]) => {
    if (node.type !== 'file' || !path.startsWith(`/home/${username}/`)) return;
    files[path.replace(/^\//, '')] = node.content || '';
  });

  const wasmer = new Wasmer();
  const sandbox = await wasmer.sandboxes.create({
    packages: ['wasmer/bash@=1.0.25'],
    files
  });
  state.bash = { wasmer, sandbox, syncTimer: null };

  const process = await sandbox.command('bash', ['--noprofile', '--norc', '-i']).spawn({
    terminal: { columns: term.cols, rows: term.rows }
  });
  state.shell = process;
  state.shellReady = true;

  await process.stdin.write(`export USER=${shellQuote(username)}\nexport LOGNAME=${shellQuote(username)}\nexport HOME=/workspace/home/${shellQuote(username)}\ncd "$HOME"\nexport PS1='\\[\\e[1;36m\\]${username}@owdos\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ '\nclear\n`);

  const writeStream = async stream => {
    if (!stream) return;
    try {
      if (typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) {
          term.write(chunk instanceof Uint8Array ? chunk : String(chunk));
        }
        return;
      }
      if (typeof stream.lines === 'function') {
        for await (const line of stream.lines()) term.write(String(line));
        return;
      }
      if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          term.write(typeof value === 'string' ? value : decoder.decode(value, { stream: true }));
        }
      }
    } catch {}
  };

  writeStream(process.stdout);
  writeStream(process.stderr);

  term.onData(async data => {
    if (!state.shellReady) return;
    try {
      await process.stdin.write(data);
    } catch {
      state.shellReady = false;
      term.writeln('\r\nOWDOS: Bash session closed.');
    }
  });

  const sync = () => syncGuestHome(true);
  state.bash.syncTimer = setInterval(sync, 4000);
  term.onResize(({ cols, rows }) => {
    try { process.resizeTerminal(cols, rows); } catch {}
  });

  process.wait().then(async () => {
    if (state.bash?.syncTimer) clearInterval(state.bash.syncTimer);
    await syncGuestHome();
    state.shell = null;
    state.shellReady = false;
    state.bash = null;
    try { await sandbox.close(); } catch {}
    try { await wasmer.close(); } catch {}
  }).catch(async () => {
    if (state.bash?.syncTimer) clearInterval(state.bash.syncTimer);
    await syncGuestHome();
    state.shell = null;
    state.shellReady = false;
    state.bash = null;
    try { await sandbox.close(); } catch {}
    try { await wasmer.close(); } catch {}
  });

  const resize = () => fit.fit();
  window.addEventListener('resize', resize);
  state.bash.resize = resize;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

async function syncGuestHome(silent = false) {
  if (!state.bash) return;
  const username = usernameFor(state.user);
  const root = `home/${username}`;
  const walk = async path => {
    const entries = await state.bash.sandbox.fs.readDir(path);
    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry.name;
      if (!name || name === '.' || name === '..') continue;
      const child = `${path}/${name}`;
      try {
        const children = await state.bash.sandbox.fs.readDir(child);
        ensureDir(`/${child}`);
        if (children) await walk(child);
        continue;
      } catch {}
      try {
        const content = await state.bash.sandbox.fs.readText(child);
        createPath(`/${child}`, 'file', content);
      } catch {}
    }
  };
  try {
    ensureDir(`/${root}`);
    await walk(root);
    saveDisk();
    if (!silent) toast('Bash home synced to the local OWDOS disk.');
  } catch {}
}

function createFilesApp(startPath = null) {
  const root = appRoot();
  const layout = document.createElement('div');
  layout.className = 'file-layout';
  const side = document.createElement('aside');
  side.className = 'file-side';
  const main = document.createElement('div');
  main.className = 'file-main';
  layout.append(side, main);
  root.append(layout);
  const userRoot = `/home/${usernameFor(state.user)}`;
  let currentPath = startPath ? normalizePath(startPath) : userRoot;
  if (!currentPath.startsWith(userRoot) || state.disk[currentPath]?.type !== 'dir') currentPath = userRoot;
  const renderSide = () => {
    side.innerHTML = '';
    ['Desktop','Documents','Downloads','Pictures','Music'].forEach(name => {
      const button = document.createElement('button');
      button.textContent = name;
      button.className = currentPath === `${userRoot}/${name}` ? 'active' : '';
      button.onclick = () => { currentPath = `${userRoot}/${name}`; render(); };
      side.append(button);
    });
  };
  const render = () => {
    main.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'app-toolbar';
    const up = document.createElement('button'); up.className = 'tool-btn'; up.textContent = '↑'; up.title = 'Parent folder'; up.onclick = () => { currentPath = parentPath(currentPath); render(); };
    const path = document.createElement('div'); path.className = 'path'; path.textContent = currentPath;
    const newFile = document.createElement('button'); newFile.className = 'tool-btn'; newFile.textContent = 'New file';
    const newFolder = document.createElement('button'); newFolder.className = 'tool-btn'; newFolder.textContent = 'New folder';
    bar.append(up, path, newFile, newFolder);
    const grid = document.createElement('div'); grid.className = 'file-grid';
    try {
      const entries = listDir(currentPath);
      if (!entries.length) grid.innerHTML = '<div class="empty">This folder is empty.</div>';
      entries.forEach(([name, node]) => {
        const card = document.createElement('div'); card.className = 'file-card';
        card.innerHTML = `<div class="app-icon">${node.type === 'dir' ? '▣' : '—'}</div><strong></strong><span></span>`;
        card.querySelector('strong').textContent = name;
        card.querySelector('span').textContent = node.type === 'dir' ? 'Folder' : `${(node.content || '').length} bytes`;
        card.ondblclick = () => node.type === 'dir' ? (currentPath = `${currentPath}/${name}`, render()) : openEditor(`${currentPath}/${name}`);
        card.oncontextmenu = event => { event.preventDefault(); showFileMenu(event.clientX, event.clientY, `${currentPath}/${name}`); };
        grid.append(card);
      });
    } catch (error) { grid.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
    main.append(bar, grid);
    renderSide();
    newFile.onclick = () => { const name = prompt('File name'); if (name) { createPath(`${currentPath}/${name}`, 'file', ''); render(); } };
    newFolder.onclick = () => { const name = prompt('Folder name'); if (name) { createPath(`${currentPath}/${name}`, 'dir'); render(); } };
  };
  function openEditor(path) {
    const node = state.disk[path];
    if (!node || node.type !== 'file') return;
    const editor = document.createElement('div'); editor.className = 'file-editor';
    const bar = document.createElement('div'); bar.className = 'app-toolbar';
    const save = document.createElement('button'); save.className = 'tool-btn'; save.textContent = 'Save';
    const close = document.createElement('button'); close.className = 'tool-btn'; close.textContent = 'Close';
    const title = document.createElement('div'); title.className = 'path'; title.textContent = path;
    const textarea = document.createElement('textarea'); textarea.value = node.content || '';
    save.onclick = () => { state.disk[path].content = textarea.value; state.disk[path].updatedAt = Date.now(); saveDisk(); toast(`Saved ${basename(path)}`); };
    close.onclick = () => { editor.remove(); render(); };
    bar.append(save, close, title); editor.append(bar, textarea); main.append(editor); textarea.focus();
  }
  openWindow('files', 'Files', root, { width: 760, height: 510 });
  render();
}

function showFileMenu(x, y, path) {
  const menu = $('desktop-context');
  menu.innerHTML = '';
  const edit = document.createElement('button'); edit.textContent = state.disk[path]?.type === 'file' ? 'Open' : 'Open folder';
  edit.onclick = () => { menu.classList.add('hidden'); state.disk[path]?.type === 'dir' ? createFilesApp(path) : openFileFromMenu(path); };
  const rename = document.createElement('button'); rename.textContent = 'Rename';
  rename.onclick = () => { menu.classList.add('hidden'); const next = prompt('New name', basename(path)); if (next) renamePath(path, next); };
  const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.className = 'danger';
  remove.onclick = () => { menu.classList.add('hidden'); removePath(path); toast(`Deleted ${basename(path)}`); };
  menu.append(edit, rename, remove);
  menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.classList.remove('hidden');
}

function openFileFromMenu(path) {
  const root = appRoot();
  const editor = document.createElement('div'); editor.className = 'file-editor';
  const bar = document.createElement('div'); bar.className = 'app-toolbar';
  const save = document.createElement('button'); save.className = 'tool-btn'; save.textContent = 'Save';
  const title = document.createElement('div'); title.className = 'path'; title.textContent = path;
  const textarea = document.createElement('textarea'); textarea.value = state.disk[path]?.content || '';
  save.onclick = () => { state.disk[path].content = textarea.value; state.disk[path].updatedAt = Date.now(); saveDisk(); toast(`Saved ${basename(path)}`); };
  bar.append(save, title); editor.append(bar, textarea); root.append(editor); openWindow('files', basename(path), root, { width:720, height:500 });
}

function renamePath(path, newName) {
  const next = `${parentPath(path)}/${newName}`;
  if (state.disk[next]) return toast('That name already exists.');
  const moved = {};
  Object.entries(state.disk).forEach(([key, node]) => {
    if (key === path || key.startsWith(`${path}/`)) moved[key.replace(path, next)] = { ...node, name: basename(key.replace(path, next)), updatedAt: Date.now() };
  });
  Object.keys(moved).forEach(key => delete state.disk[key.replace(next, path)]);
  Object.assign(state.disk, moved);
  saveDisk();
}

function markdownToHtml(markdown) {
  const safe = escapeHtml(markdown || '').replace(/\r/g, '');
  const lines = safe.split('\n');
  const out = [];
  let list = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (list) { out.push('</ul>'); list = false; }
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${line.slice(level + 1)}</h${level}>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${line.replace(/^[-*]\s+/, '')}</li>`);
    } else if (!line.trim()) {
      if (list) { out.push('</ul>'); list = false; }
      out.push('');
    } else {
      if (list) { out.push('</ul>'); list = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (list) out.push('</ul>');
  let html = out.join('\n');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" data-url="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function createBrowserApp() {
  const root = appRoot();
  const bar = document.createElement('div');
  bar.className = 'app-toolbar browser-toolbar';
  const back = document.createElement('button'); back.className = 'tool-btn'; back.textContent = '←'; back.title = 'Back';
  const forward = document.createElement('button'); forward.className = 'tool-btn'; forward.textContent = '→'; forward.title = 'Forward';
  const reload = document.createElement('button'); reload.className = 'tool-btn'; reload.textContent = '↻'; reload.title = 'Reload';
  const address = document.createElement('input'); address.className = 'path browser-address'; address.value = 'https://example.com'; address.spellcheck = false; address.autocomplete = 'off';
  const go = document.createElement('button'); go.className = 'tool-btn'; go.textContent = 'Go';
  const reader = document.createElement('button'); reader.className = 'tool-btn'; reader.textContent = 'Reader'; reader.title = 'Open a server-rendered reader view';
  const status = document.createElement('div'); status.className = 'browser-status';
  const shell = document.createElement('div'); shell.className = 'browser-shell';
  const view = document.createElement('iframe'); view.className = 'browser-frame'; view.referrerPolicy = 'strict-origin-when-cross-origin'; view.setAttribute('allow', 'fullscreen; autoplay; clipboard-read; clipboard-write');
  const info = document.createElement('div'); info.className = 'browser-info hidden';
  shell.append(view, info);
  bar.append(back, forward, reload, address, go, reader, status);
  root.append(bar, shell);

  const history = ['https://example.com'];
  let historyIndex = 0;
  let currentUrl = history[0];
  let readerMode = false;

  const normalizeWebUrl = value => {
    const raw = value.trim();
    if (!raw) return null;
    if (/^(javascript:|data:|blob:|file:)/i.test(raw)) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
    return `https://www.google.com/search?igu=1&q=${encodeURIComponent(raw)}`;
  };

  const setInfo = (title, text, url = currentUrl) => {
    info.innerHTML = `<div class="browser-info-icon">◎</div><div><div class="browser-info-title">${escapeHtml(title)}</div><p>${escapeHtml(text)}</p><button class="tool-btn" data-open>Open externally</button></div>`;
    info.querySelector('[data-open]').onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
    info.classList.remove('hidden');
  };

  const loadDirect = url => {
    readerMode = false; info.classList.add('hidden'); view.classList.remove('hidden'); view.src = url; address.value = url; currentUrl = url; status.textContent = 'Direct';
  };

  const loadReader = async url => {
    readerMode = true; view.classList.add('hidden'); info.classList.add('hidden');
    shell.insertAdjacentHTML('beforeend', '<div class="browser-loading"><div class="spinner"></div><strong>Reader mode</strong><span>Loading a clean server-rendered copy…</span></div>');
    const loading = shell.lastElementChild;
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: 'text/plain' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Reader returned HTTP ${response.status}`);
      const content = await response.text();
      loading.remove();
      view.classList.remove('hidden');
      view.srcdoc = `<!doctype html><meta charset="utf-8"><style>body{font:16px/1.7 system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 22px;color:#15181d}a{color:#1769d1}pre{white-space:pre-wrap}</style><h1>Reader mode</h1><p style="color:#667085">${escapeHtml(url)}</p><pre>${escapeHtml(content)}</pre>`;
      address.value = url; status.textContent = 'Reader';
    } catch (error) {
      loading.remove(); view.classList.remove('hidden'); view.src = 'about:blank'; setInfo('This site could not be fetched in reader mode', `${error.message}. The direct site view is still available from the button below.`, url); status.textContent = 'Blocked';
    }
  };

  const navigate = value => {
    const url = normalizeWebUrl(value);
    if (!url) { status.textContent = 'Invalid'; return; }
    history.splice(historyIndex + 1); history.push(url); historyIndex = history.length - 1;
    loadDirect(url);
    updateButtons();
  };
  const updateButtons = () => { back.disabled = historyIndex <= 0; forward.disabled = historyIndex >= history.length - 1; };

  go.onclick = () => navigate(address.value);
  address.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(address.value); });
  back.onclick = () => { if (historyIndex > 0) { historyIndex--; loadDirect(history[historyIndex]); updateButtons(); } };
  forward.onclick = () => { if (historyIndex < history.length - 1) { historyIndex++; loadDirect(history[historyIndex]); updateButtons(); } };
  reload.onclick = () => readerMode ? loadReader(currentUrl) : loadDirect(currentUrl);
  reader.onclick = () => loadReader(currentUrl);
  view.addEventListener('load', () => { status.textContent = 'Direct'; info.classList.add('hidden'); });

  const item = openWindow('browser', 'Browser', root, { width: 1080, height: 680 });
  updateButtons();
  loadDirect(currentUrl);
  return item;
}

function createStoreApp() {
  const root = appRoot();
  const store = document.createElement('div'); store.className = 'store';
  root.append(store);
  const item = openWindow('store', 'OWD Store', root, { width: 760, height: 530 });
  loadRegistry().then(() => renderStore(store)).catch(error => { store.innerHTML = `<div class="empty">Could not load the OWDOS app registry.<br>${escapeHtml(error.message)}</div>`; });
  return item;
}

async function loadRegistry() {
  const response = await fetch('./apps.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Registry returned ${response.status}.`);
  state.registry = await response.json();
}

function renderStore(root) {
  root.innerHTML = `<h2>OWD Store</h2><p class="store-sub">Apps are distributed through the OWDOS registry. Add new apps by submitting a PR that follows the registry format.</p><div class="store-list"></div>`;
  const list = root.querySelector('.store-list');
  if (!state.registry.length) { list.innerHTML = '<div class="empty">No apps are published yet.</div>'; return; }
  state.registry.forEach(app => {
    const card = document.createElement('article'); card.className = 'store-card';
    card.innerHTML = `<div class="store-card-head"><div class="store-card-icon"></div><div><h3></h3><span class="muted"></span></div></div><p></p><button></button>`;
    card.querySelector('.store-card-icon').textContent = app.icon || '□';
    card.querySelector('h3').textContent = app.name;
    card.querySelector('.muted').textContent = `v${app.version} · ${app.author || 'Unknown'}`;
    card.querySelector('p').textContent = app.description || '';
    const button = card.querySelector('button');
    const installed = state.installed.some(id => id === app.id);
    button.textContent = installed ? 'Launch' : 'Install';
    if (installed) button.classList.add('primary');
    button.onclick = async () => {
      try {
        if (!installed) {
          const response = await fetch(`./${app.entry}`);
          if (!response.ok) throw new Error(`App source returned ${response.status}.`);
          const source = await response.text();
          localStorage.setItem(userStorageKey(`app:${app.id}`), JSON.stringify({ ...app, source }));
          state.installed.push(app.id);
          saveDisk();
          toast(`${app.name} installed.`);
          renderStore(root);
        } else {
          launchInstalledApp(app.id);
        }
      } catch (error) { toast(error.message || 'App install failed.'); }
    };
    list.append(card);
  });
}

function launchInstalledApp(id) {
  const app = JSON.parse(localStorage.getItem(userStorageKey(`app:${id}`)) || 'null');
  if (!app?.source) return toast('Installed app data is missing.');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:100%;height:100%;border:0;background:#101216;';
  frame.sandbox = 'allow-scripts';
  frame.srcdoc = app.source;
  openWindow(app.id, app.name, frame, { width: 560, height: 430 });
}

function createSettingsApp() {
  const root = appRoot();
  const settings = document.createElement('div'); settings.className = 'settings';
  const user = state.user;
  settings.innerHTML = `
    <div class="settings-hero"><div><div class="eyebrow">SYSTEM SETTINGS</div><h2>OWDOS</h2><div class="muted">Ordbit Web Distro Operating System</div></div><div class="system-pill">Kernel ${state.kernel?.version || '—'}</div></div>
    <div class="settings-section"><div class="setting-row"><div><strong>Account</strong><span>${escapeHtml(user.email || '')}</span></div><button class="tool-btn" data-action="logout">Sign out</button></div><div class="setting-row"><div><strong>Username</strong><span>${escapeHtml(userLabel(user))}</span></div></div></div>
    <div class="settings-section"><div class="section-title">System</div><div class="setting-row"><div><strong>Hostname</strong><span>${escapeHtml(state.system.hostname)}</span></div><button class="tool-btn" data-action="hostname">Change</button></div><div class="setting-row"><div><strong>Appearance</strong><span>Choose the desktop finish used by OWDOS.</span></div><select class="tool-select" id="theme-select"><option value="default">Midnight</option><option value="slate">Slate</option><option value="snow">Snow</option></select></div><div class="setting-row"><div><strong>Uptime</strong><span>${formatUptime(state.kernel?.uptime() || 0)}</span></div></div><div class="setting-row"><div><strong>Processes</strong><span>${state.kernel?.processes.size || 0} running</span></div><button class="tool-btn" data-action="monitor">Open monitor</button></div></div>
    <div class="settings-section"><div class="section-title">Maintenance</div><div class="setting-row"><div><strong>Save local disk</strong><span>Your files stay in this browser.</span></div><button class="tool-btn" data-action="save">Save now</button></div><div class="setting-row"><div><strong>Recovery mode</strong><span>Restart into the OWDOS recovery environment.</span></div><button class="tool-btn" data-action="recovery">Restart</button></div><div class="setting-row"><div><strong>Bootloader</strong><span>Restart to the firmware-style boot menu.</span></div><button class="tool-btn" data-action="bootloader">Restart</button></div><div class="setting-row"><div><strong>Powerwash</strong><span>Erase this account’s local OWDOS disk and settings. The Supabase account stays intact.</span></div><button class="tool-btn danger" data-action="powerwash">Powerwash</button></div></div>
    <div class="settings-section system-facts"><div><span>Build</span><strong>OWDOS 1.0 Foundation</strong></div><div><span>Boot ID</span><strong>${escapeHtml(state.kernel?.bootId || 'unknown')}</strong></div><div><span>Storage</span><strong>IndexedDB / local browser storage</strong></div></div>`;
  root.append(settings);
  const theme = settings.querySelector('#theme-select');
  theme.value = state.system.theme || 'default';
  theme.onchange = () => { state.system.theme = theme.value; document.documentElement.dataset.theme = theme.value; saveSystemState(); toast('Appearance updated.'); };
  settings.addEventListener('click', async event => {
    const action = event.target.dataset.action;
    if (action === 'logout') await supabase.auth.signOut();
    if (action === 'save') { saveDisk(); saveSystemState(); toast('System state saved.'); }
    if (action === 'hostname') { const next = prompt('Hostname', state.system.hostname); if (next && /^[A-Za-z0-9-]{1,32}$/.test(next)) { state.system.hostname = next.toLowerCase(); saveSystemState(); toast(`Hostname set to ${state.system.hostname}.`); } }
    if (action === 'monitor') launch('monitor');
    if (action === 'recovery') rebootInto('recovery');
    if (action === 'bootloader') rebootInto('bootloader');
    if (action === 'powerwash') powerwash();
  });
  openWindow('settings', 'Settings', root, { width: 720, height: 580 });
}

function findWindowByApp(app) {
  return [...state.windows.values()].find(item => item.app === app);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function launch(app) {
  launcherMenu.classList.add('hidden');
  if (app === 'files') createFilesApp();
  else if (app === 'terminal') createTerminalApp();
  else if (app === 'browser') createBrowserApp();
  else if (app === 'store') createStoreApp();
  else if (app === 'settings') createSettingsApp();
  else if (app === 'monitor') createMonitorApp();
}

function createMonitorApp() {
  const root = appRoot();
  const monitor = document.createElement('div'); monitor.className = 'monitor';
  root.append(monitor);
  openWindow('monitor', 'System Monitor', root, { width: 700, height: 470 });
  const render = () => {
    const processes = state.kernel?.snapshot() || [];
    monitor.innerHTML = `<div class="monitor-head"><div><div class="eyebrow">OWDOS KERNEL</div><h2>System Monitor</h2><div class="muted">${processes.length} processes · uptime ${formatUptime(state.kernel?.uptime() || 0)}</div></div><button class="tool-btn" data-refresh>Refresh</button></div><div class="process-list"></div><div class="kernel-log"><div class="section-title">Kernel log</div><pre></pre></div>`;
    const list = monitor.querySelector('.process-list');
    processes.forEach(proc => {
      const row = document.createElement('div'); row.className = 'process-row';
      row.innerHTML = `<span>${proc.pid}</span><strong>${escapeHtml(proc.name)}</strong><span>${escapeHtml(proc.type)}</span><span>${formatUptime(Date.now() - proc.startedAt)}</span>`;
      list.append(row);
    });
    monitor.querySelector('pre').textContent = (state.kernel?.logs || []).slice(-18).map(item => `[${item.level}] ${item.message}`).join('\n');
    monitor.querySelector('[data-refresh]').onclick = render;
  };
  render();
}

function showOobe() {
  if (state.oobe) state.oobe.remove();
  resetSetupScreens();
  const overlay = document.createElement('div');
  overlay.className = 'oobe';
  overlay.innerHTML = `
    <section class="oobe-shell">
      <aside class="oobe-sidebar">
        <div class="oobe-logo"><span>OW</span><div><b>OWDOS</b><small>Ordbit Web Distro</small></div></div>
        <div class="oobe-side-copy"><strong>Set up your device</strong><span>A full first-boot experience, not a settings page pretending to be one.</span></div>
        <div class="oobe-side-meta"><span>OWDOS 1.0</span><span>Kernel ${escapeHtml(state.kernel?.version || '0.4.0')}</span></div>
      </aside>
      <section class="oobe-main">
        <div class="oobe-top"><span id="oobe-step-label">1 of 8</span><button class="oobe-access" data-access type="button">Accessibility</button></div>
        <div class="oobe-progress"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="oobe-body" data-oobe-body></div>
        <div class="oobe-actions"><button class="setup-back" data-back type="button">Back</button><button class="primary oobe-next" data-next type="button">Next</button></div>
      </section>
    </section>`;
  document.body.append(overlay);
  state.oobe = overlay;
  let step = 0;
  const body = overlay.querySelector('[data-oobe-body]');
  const next = overlay.querySelector('[data-next]');
  const back = overlay.querySelector('[data-back]');
  const label = overlay.querySelector('#oobe-step-label');

  const setTheme = theme => {
    state.system.theme = theme;
    document.documentElement.dataset.theme = theme;
    overlay.querySelectorAll('[data-theme]').forEach(button => button.classList.toggle('selected', button.dataset.theme === theme));
  };

  const render = () => {
    const dots = overlay.querySelectorAll('.oobe-progress span');
    dots.forEach((dot, i) => dot.classList.toggle('active', i <= step));
    label.textContent = `${step + 1} of 8`;
    back.disabled = step === 0;
    if (step === 0) {
      body.innerHTML = `<div class="oobe-center"><div class="oobe-emblem">OW</div><div class="oobe-kicker">WELCOME TO OWDOS</div><h1>Let’s make this machine yours.</h1><p>OWDOS is a browser-native operating system with a local filesystem, real Bash, a web browser, and a community app ecosystem.</p><div class="oobe-choice-row"><div><b>Private by default</b><span>Your OS files live in this browser unless you explicitly move them elsewhere.</span></div><div><b>Built for the web</b><span>Apps are web apps, and the browser is a first-class part of the desktop.</span></div></div></div>`;
      next.textContent = 'Begin setup';
    } else if (step === 1) {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">LANGUAGE & INPUT</div><h2>Choose your language and keyboard</h2><p>These settings control the shell, system labels, and keyboard shortcuts.</p><div class="oobe-form-grid"><label>Language<select id="oobe-language"><option>English (US)</option><option>English (UK)</option><option>Spanish</option><option>French</option><option>German</option></select></label><label>Keyboard<select id="oobe-keyboard"><option>US</option><option>US International</option><option>UK</option><option>German</option><option>French</option></select></label></div></div>`;
      body.querySelector('#oobe-language').value = state.system.language;
      body.querySelector('#oobe-keyboard').value = state.system.keyboard;
      next.textContent = 'Continue';
    } else if (step === 2) {
      const online = navigator.onLine;
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">NETWORK</div><h2>Connect to the internet</h2><p>Internet access is used for OWDOS accounts, updates, web browsing, and the app store.</p><div class="network-card"><div class="network-dot ${online ? 'online' : ''}"></div><div><b>${online ? 'Connected' : 'Offline'}</b><span>${online ? 'Your browser reports an active network connection.' : 'OWDOS can continue offline, but account services and the web will be unavailable.'}</span></div></div><button class="tool-btn oobe-wide" data-test-network type="button">Check connection again</button></div>`;
      body.querySelector('[data-test-network]').onclick = render;
      next.textContent = online ? 'Continue' : 'Continue offline';
    } else if (step === 3) {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">ACCESSIBILITY</div><h2>Make OWDOS easier to use</h2><p>These options can be changed later in Settings.</p><label class="toggle-card"><input id="oobe-accessibility" type="checkbox" ${state.system.accessibility ? 'checked' : ''}><span><b>Enhanced accessibility</b><small>Increase focus visibility and control hints throughout OWDOS.</small></span></label><label class="toggle-card"><input id="oobe-motion" type="checkbox" ${state.system.reduceMotion ? 'checked' : ''}><span><b>Reduce motion</b><small>Use fewer animated transitions.</small></span></label></div>`;
      next.textContent = 'Continue';
    } else if (step === 4) {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">TERMS</div><h2>One small agreement</h2><p>OWDOS is open source software. You control the local OS data stored in this browser.</p><div class="terms-box"><h3>OWDOS terms</h3><p>Use OWDOS responsibly. Third-party websites, apps, and content are governed by their own terms. OWDOS does not guarantee availability of external services.</p><p>The OWDOS application registry is community maintained. Review apps before installing them.</p><p>Nothing here grants you ownership of third-party content.</p></div><label class="toggle-card compact"><input id="oobe-terms" type="checkbox"><span><b>I understand and agree</b><small>You can change system settings later, but the agreement is required to finish setup.</small></span></label></div>`;
      next.textContent = 'Accept and continue';
      next.disabled = true;
      body.querySelector('#oobe-terms').onchange = e => { next.disabled = !e.target.checked; };
    } else if (step === 5) {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">DEVICE IDENTITY</div><h2>Name this machine</h2><p>This hostname appears in Bash and system tools.</p><label class="oobe-field">Device name<input id="oobe-host" maxlength="32" value="${escapeHtml(state.system.hostname)}" spellcheck="false"></label><div class="identity-preview"><span>Hostname</span><b>${escapeHtml(state.system.hostname)}.owdos</b></div></div>`;
      body.querySelector('#oobe-host').addEventListener('input', event => { document.querySelector('.identity-preview b').textContent = `${event.target.value || 'owdos'}.owdos`; });
      next.textContent = 'Continue';
    } else if (step === 6) {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">ACCOUNT</div><h2>Who will use OWDOS?</h2><p>Choose a user session. You can sign in with an OWDOS account, create one, or use Guest.</p><div class="account-choices"><button class="oobe-account-choice" data-account="login" type="button"><span class="choice-icon">→</span><b>Sign in</b><small>Use an existing OWDOS account.</small></button><button class="oobe-account-choice" data-account="signup" type="button"><span class="choice-icon">+</span><b>Create an account</b><small>Make a new OWDOS account.</small></button><button class="oobe-account-choice" data-account="guest" type="button"><span class="choice-icon">G</span><b>Use Guest</b><small>Temporary session. Local data is discarded when it ends.</small></button></div><div id="oobe-account-state" class="setup-note"></div></div>`;
      overlay.querySelectorAll('[data-account]').forEach(button => button.onclick = () => {
        state.oobeAccountChoice = button.dataset.account === 'guest' ? 'guest' : 'user';
        overlay.querySelectorAll('[data-account]').forEach(item => item.classList.toggle('selected', item === button));
        body.querySelector('#oobe-account-state').textContent = state.oobeAccountChoice === 'guest' ? 'Guest can be chosen now. You can create or sign in to an account later.' : 'An OWDOS account will be available from the next screen after setup.';
      });
      overlay.querySelectorAll('[data-account]').forEach(button => button.classList.toggle('selected', (state.oobeAccountChoice === 'guest' && button.dataset.account === 'guest') || (state.oobeAccountChoice === 'user' && button.dataset.account !== 'guest')));
      next.textContent = 'Continue';
    } else {
      body.innerHTML = `<div class="oobe-section"><div class="oobe-kicker">READY</div><h2>OWDOS is ready for first login.</h2><div class="final-checks"><div><b>Bootloader</b><span>Available at startup.</span></div><div><b>Recovery</b><span>System recovery environment installed.</span></div><div><b>Filesystem</b><span>Local storage will be mounted per session.</span></div><div><b>Browser</b><span>Direct site views plus reader fallback.</span></div></div><div class="setup-note">Finishing setup takes you to the OWDOS welcome screen. No account is required to use Guest.</div></div>`;
      next.textContent = 'Finish setup';
      next.disabled = false;
    }
  };

  next.onclick = () => {
    if (step === 1) { state.system.language = body.querySelector('#oobe-language').value; state.system.keyboard = body.querySelector('#oobe-keyboard').value; }
    if (step === 3) { state.system.accessibility = body.querySelector('#oobe-accessibility').checked; state.system.reduceMotion = body.querySelector('#oobe-motion').checked; document.documentElement.classList.toggle('reduce-motion', state.system.reduceMotion); }
    if (step === 5) { const value = body.querySelector('#oobe-host').value.trim(); if (!/^[A-Za-z0-9-]{1,32}$/.test(value)) return toast('Device name must use letters, numbers, or hyphens.'); state.system.hostname = value.toLowerCase(); }
    if (step === 6) { state.system.diagnostics = false; }
    if (step < 7) { step++; render(); saveSystemState(); return; }
    saveDeviceSnapshot('post-oobe');
    state.system.oobeComplete = true; saveSystemState(); overlay.remove(); state.oobe = null; kernelLog('OOBE complete');
    if (state.user) showUserPage(); else if (state.oobeAccountChoice === 'guest') enterGuestPage(); else showWelcomePage();
  };
  back.onclick = () => { if (step > 0) { step--; next.disabled = false; render(); } };
  overlay.querySelector('[data-access]').onclick = () => { state.system.accessibility = !state.system.accessibility; document.documentElement.classList.toggle('accessibility-on', state.system.accessibility); toast(state.system.accessibility ? 'Accessibility hints enabled.' : 'Accessibility hints disabled.'); saveSystemState(); };
  render();
}


function saveDeviceSnapshot(label = 'last-good') {
  try {
    const snapshot = { label, at: new Date().toISOString(), system: { ...state.system, lastGoodSnapshot: null }, disk: state.disk, installed: [...state.installed] };
    localStorage.setItem(storageKey('snapshot'), JSON.stringify(snapshot));
    state.system.lastGoodSnapshot = label;
    saveSystemState();
  } catch {}
}

function loadDeviceSnapshot() {
  try { return JSON.parse(localStorage.getItem(storageKey('snapshot')) || 'null'); } catch { return null; }
}

function revertDevice() {
  const snapshot = loadDeviceSnapshot();
  if (!snapshot) return toast('No recovery snapshot is available.');
  if (!confirm(`Revert OWDOS to ${snapshot.label || 'the last good state'}? Current local changes will be discarded.`)) return;
  state.disk = snapshot.disk || state.disk;
  state.installed = Array.isArray(snapshot.installed) ? snapshot.installed : state.installed;
  state.system = { ...state.system, ...(snapshot.system || {}), lastGoodSnapshot: snapshot.label || 'last-good' };
  saveDisk(); saveSystemState();
  location.assign('index.html?loader=1');
}

function setDevMode(enabled) {
  saveDeviceSnapshot('before-devmode');
  state.devMode = !!enabled;
  state.system.devMode = state.devMode;
  saveSystemState();
  kernelLog(`developer mode ${state.devMode ? 'enabled' : 'disabled'}`);
}

function activateOwdosExploit(id) {
  const exploits = {
    sh1ttyoobe: { label: 'sh1ttyoobe', version: '0.1', effect: 'OOBE bypass lab flag enabled.' },
    bootbreak: { label: 'bootbreak', version: '0.2', effect: 'Bootloader test path enabled.' },
    tpmglitch: { label: 'tpmglitch', version: '0.1', effect: 'Virtual TPM compatibility mode enabled.' },
    devunlock: { label: 'devunlock', version: '0.3', effect: 'Developer-mode lab unlock enabled.' }
  };
  const exploit = exploits[id];
  if (!exploit) return;
  saveDeviceSnapshot(`before-${id}`);
  state.system.exploitLab = { id, label: exploit.label, version: exploit.version, active: true, at: new Date().toISOString() };
  if (id === 'sh1ttyoobe') state.system.oobeBypass = true;
  if (id === 'bootbreak') state.system.bootTest = true;
  if (id === 'tpmglitch') state.system.tpmVersion = '2.0.1-virtual-glitch';
  if (id === 'devunlock') setDevMode(true);
  saveSystemState();
  toast(`${exploit.label}: ${exploit.effect}`);
}

function showAdminConsole() {
  if (!state.devMode) return toast('Enable Developer mode first.');
  state.bootMode = 'admin';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  const managedFor = state.system.managedUserId ? 'Provisioned' : 'Not provisioned';
  card.innerHTML = `<div class="admin-console"><div class="console-top"><div><div class="boot-mark">OW</div><div class="boot-name">OWDOS Admin Console</div><div class="boot-subtitle">Developer firmware services</div></div><div class="admin-badge">${managedFor}</div></div><div class="device-proof"><span>Device ID</span><code>${escapeHtml(state.deviceId)}</code></div><div class="admin-form"><label>Prove device ownership<input id="device-proof-input" autocomplete="off" spellcheck="false" placeholder="Enter the full device ID"></label><button class="primary" data-provision>Provision device</button></div><div class="admin-grid"><button data-admin="devmode">${state.devMode ? 'Disable developer mode' : 'Enable developer mode'}</button><button data-admin="powerwash" class="danger-btn">Powerwash</button><button data-admin="revert">Revert last snapshot</button><button data-admin="safe">Set kernel to stable</button><button data-admin="kernel">Cycle kernel version</button><button data-admin="tpm">Cycle TPM version</button></div><div class="admin-lab"><div class="section-title">OWDOS exploit lab</div><p>These are emulated OWDOS firmware test cases. They change only this local browser OS.</p><div class="exploit-grid"><button data-exploit="sh1ttyoobe"><b>sh1ttyoobe</b><small>OOBE bypass lab · 0.1</small></button><button data-exploit="bootbreak"><b>bootbreak</b><small>Bootloader test · 0.2</small></button><button data-exploit="tpmglitch"><b>tpmglitch</b><small>TPM compatibility · 0.1</small></button><button data-exploit="devunlock"><b>devunlock</b><small>Dev unlock · 0.3</small></button></div></div><div class="admin-footer"><span>Firmware ${state.system.firmwareVersion}</span><span>Bootloader ${state.system.bootloaderVersion}</span><span>Kernel ${state.system.kernelVersion}</span><span>TPM ${state.system.tpmVersion}</span></div><button class="setup-back" data-admin-back>Back to bootloader</button><div id="admin-status" class="boot-status-line"></div></div>`;
  card.querySelector('[data-provision]').onclick = () => {
    const value = card.querySelector('#device-proof-input').value.trim().toUpperCase();
    const status = card.querySelector('#admin-status');
    if (!value || value !== state.deviceId) { status.textContent = 'Ownership proof failed. The device ID must match exactly.'; return; }
    state.system.managed = true;
    state.system.managedUserId = state.user?.id || null;
    state.deviceManaged = true;
    saveSystemState();
    status.textContent = state.user ? `Device provisioned for ${state.user.email}.` : 'Device provisioned locally. Sign in to attach a user account.';
    card.querySelector('.admin-badge').textContent = 'Provisioned';
  };
  card.querySelector('[data-admin-back]').onclick = showBootloader;
  card.querySelectorAll('[data-exploit]').forEach(button => button.onclick = () => activateOwdosExploit(button.dataset.exploit));
  card.querySelector('[data-admin="devmode"]').onclick = () => { setDevMode(!state.devMode); showAdminConsole(); };
  card.querySelector('[data-admin="powerwash"]').onclick = () => powerwashDevice();
  card.querySelector('[data-admin="revert"]').onclick = revertDevice;
  card.querySelector('[data-admin="safe"]').onclick = () => { saveDeviceSnapshot('before-stable'); state.system.kernelVersion = '0.5.0-ow'; state.system.tpmVersion = '2.0.1-virtual'; state.system.exploitLab = null; saveSystemState(); showAdminConsole(); };
  card.querySelector('[data-admin="kernel"]').onclick = () => { const versions = ['0.4.0-legacy','0.5.0-ow','0.6.0-dev']; const i = versions.indexOf(state.system.kernelVersion); saveDeviceSnapshot('before-kernel-change'); state.system.kernelVersion = versions[(i + 1) % versions.length]; saveSystemState(); showAdminConsole(); };
  card.querySelector('[data-admin="tpm"]').onclick = () => { const versions = ['1.2-compat','2.0.1-virtual','2.0.1-virtual-glitch']; const i = versions.indexOf(state.system.tpmVersion); saveDeviceSnapshot('before-tpm-change'); state.system.tpmVersion = versions[(i + 1) % versions.length]; saveSystemState(); showAdminConsole(); };
}

function powerwashDevice() {
  if (!confirm('Powerwash this OWDOS device? This resets device setup, local OS data, developer mode, snapshots, and all local user disks. Your Supabase account is not deleted.')) return;
  Object.keys(localStorage).filter(key => key.startsWith('owdos:')).forEach(key => localStorage.removeItem(key));
  sessionStorage.clear();
  state.disk = {};
  state.installed = [];
  state.user = null;
  state.mode = 'none';
  state.devMode = false;
  state.deviceManaged = false;
  location.assign(location.pathname);
}


function showOobeRecoveryMenu(preselect = 'powerwash') {
  let overlay = document.querySelector('.oobe-recovery-overlay');
  if (overlay) { overlay.remove(); return; }
  overlay = document.createElement('div');
  overlay.className = 'oobe-recovery-overlay';
  overlay.innerHTML = `<section class="recovery-card oobe-hotkey-card"><div class="eyebrow">DEVICE RECOVERY</div><h2>Recovery shortcut</h2><p>OWDOS detected the setup recovery chord. Choose what the device should do.</p><div class="oobe-hotkey-grid"><button data-oobe-action="powerwash"><b>Powerwash</b><small>Erase local setup and return to first boot.</small></button><button data-oobe-action="revert"><b>Revert</b><small>Restore the last good local device snapshot.</small></button></div><div class="oobe-actions"><button class="setup-back" data-oobe-cancel>Cancel</button></div></section>`;
  document.body.append(overlay);
  overlay.querySelector('[data-oobe-action="powerwash"]').classList.toggle('selected', preselect === 'powerwash');
  overlay.querySelector('[data-oobe-action="revert"]').classList.toggle('selected', preselect === 'revert');
  overlay.querySelector('[data-oobe-action="powerwash"]').onclick = powerwashDevice;
  overlay.querySelector('[data-oobe-action="revert"]').onclick = () => { overlay.remove(); revertDevice(); };
  overlay.querySelector('[data-oobe-cancel]').onclick = () => overlay.remove();
}

function showWelcomePage() {
  showSetupPage('welcome');
  const page = $('welcome');
  page.innerHTML = `<section class="welcome-page"><div class="welcome-brand"><div class="boot-mark">OW</div><div><div class="eyebrow">ORDBIT WEB DISTRO</div><h1>Welcome to OWDOS</h1><p>Choose how you want to use this machine.</p></div></div><div class="welcome-grid"><button data-welcome="user" class="welcome-choice"><span>→</span><b>Sign in or create account</b><small>Your files and installed apps stay separate for your account.</small></button><button data-welcome="guest" class="welcome-choice"><span>G</span><b>Browse as Guest</b><small>Temporary session with no OWDOS account.</small></button></div><div class="welcome-footer"><button data-welcome="recovery" class="linkish">Recovery</button><button data-welcome="bootloader" class="linkish">Bootloader</button></div></section>`;
  page.querySelector('[data-welcome="user"]').onclick = () => showUserPage();
  page.querySelector('[data-welcome="guest"]').onclick = enterGuestPage;
  page.querySelector('[data-welcome="recovery"]').onclick = showRecoveryMode;
  page.querySelector('[data-welcome="bootloader"]').onclick = showBootloader;
}

function showUserPage() {
  showSetupPage('user');
  const page = $('user');
  const label = state.user ? userLabel(state.user) : 'OWDOS user';
  page.innerHTML = `<section class="user-page"><div class="user-top"><button class="back-link" data-user-back>Back</button><span>OWDOS user</span></div><div class="user-card"><div class="user-avatar">${escapeHtml(label.slice(0,1).toUpperCase())}</div><div class="user-card-copy"><div class="eyebrow">USER SESSION</div><h1>${escapeHtml(label)}</h1><p>${escapeHtml(state.user?.email || 'Choose an account to sign in.')}</p></div></div><div class="user-actions"><button class="primary" data-user="continue">Continue</button><button class="tool-btn" data-user="switch">Switch account</button><button class="tool-btn" data-user="guest">Browse as Guest</button><button class="tool-btn danger" data-user="logout">Sign out</button></div></section>`;
  page.querySelector('[data-user="continue"]').onclick = () => state.user ? bootIntoSession({user: state.user}) : showAuthPage('signin');
  page.querySelector('[data-user="switch"]').onclick = () => showAuthPage('signin');
  page.querySelector('[data-user="guest"]').onclick = enterGuestPage;
  page.querySelector('[data-user="logout"]').onclick = async () => { await supabase.auth.signOut(); };
  page.querySelector('[data-user-back]').onclick = showWelcomePage;
}

function showAuthPage(mode = 'signin') {
  showSetupPage('auth');
  setAuthMode(mode);
  $('auth-back').onclick = () => state.user ? showUserPage() : showWelcomePage();
}

function enterGuestPage() {
  showSetupPage('guest');
  const page = $('guest');
  page.innerHTML = `<section class="guest-page"><div class="guest-mark">G</div><div class="eyebrow">GUEST SESSION</div><h1>Browse without an account.</h1><p>Guest mode gives you a clean temporary OWDOS session. Files and installed apps are stored only for this browser session and are discarded when you exit Guest.</p><div class="guest-points"><span>Temporary filesystem</span><span>No Supabase account</span><span>Web browser available</span><span>Bash available</span></div><div class="guest-actions"><button class="primary" data-guest="enter">Enter Guest</button><button class="tool-btn" data-guest="back">Back</button></div></section>`;
  page.querySelector('[data-guest="enter"]').onclick = enterGuest;
  page.querySelector('[data-guest="back"]').onclick = state.user ? showUserPage : showWelcomePage;
}

async function enterGuest() {
  state.mode = 'guest';
  state.guestId = `guest-${crypto.randomUUID()}`;
  state.user = null;
  await loadLocalState();
  state.system.oobeComplete = true;
  saveSystemState();
  showDesktop();
  if (!state.booted) { state.booted = true; setTimeout(() => launch('files'), 180); }
}

function showRecoveryMode() {
  state.bootMode = 'recovery';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS Recovery</div><div class="boot-subtitle">System recovery environment</div><div class="boot-device">${escapeHtml(state.deviceId)}</div><div class="boot-facts"><span>Kernel ${escapeHtml(state.system.kernelVersion)}</span><span>TPM ${escapeHtml(state.system.tpmVersion)}</span></div><div class="recovery-menu"><button data-recovery="continue">Continue boot</button><button data-recovery="repair">Repair local filesystem</button><button data-recovery="revert">Revert last snapshot</button><button data-recovery="settings">Reset OWDOS settings</button><button data-recovery="devmode">Developer mode</button><button data-recovery="powerwash" class="danger-btn">Powerwash account</button><button data-recovery="device-powerwash" class="danger-btn">Powerwash device</button><button data-recovery="bootloader">Back to bootloader</button><button data-recovery="shutdown">Power off</button></div><div id="recovery-status" class="boot-status-line"></div>`;
  card.querySelectorAll('[data-recovery]').forEach(button => button.onclick = () => recoveryAction(button.dataset.recovery));
}

function recoveryAction(action) {
  const status = $('recovery-status');
  if (action === 'continue') {
    history.replaceState(null, '', location.pathname);
    boot.classList.add('hidden');
    if (state.user) bootIntoSession({ user: state.user }); else showWelcomePage();
    return;
  }
  if (action === 'repair') {
    if (!state.user) return status.textContent = 'Sign in first to repair a user disk.';
    const username = usernameFor(state.user);
    const required = [`/home/${username}`, `/home/${username}/Desktop`, `/home/${username}/Documents`, `/home/${username}/Downloads`, `/home/${username}/Pictures`, `/home/${username}/Music`, `/home/${username}/.config`];
    state.disk['/'] ||= { type:'dir', name:'/', updatedAt:Date.now() };
    state.disk['/home'] ||= { type:'dir', name:'home', updatedAt:Date.now() };
    required.forEach(path => ensureDir(path));
    state.disk[`/home/${username}/etc`] ||= { type:'dir', name:'etc', updatedAt:Date.now() };
    saveDisk();
    status.textContent = 'Filesystem repair completed. Missing directories were recreated.';
    kernelLog('filesystem repair completed');
  }
  if (action === 'settings') {
    if (!state.user) return status.textContent = 'Sign in first to reset settings.';
    state.system = { oobeComplete: false, hostname: 'owdos', theme: 'midnight' };
    saveSystemState();
    document.documentElement.dataset.theme = 'default';
    status.textContent = 'OWDOS settings reset. The next boot will run OOBE.';
  }
  if (action === 'powerwash') powerwash();
  if (action === 'device-powerwash') powerwashDevice();
  if (action === 'revert') revertDevice();
  if (action === 'devmode') { setDevMode(true); showDevMode(); }
  if (action === 'bootloader') showBootloader();
  if (action === 'shutdown') shutdownSystem();
}

function powerwash() {
  if (!state.user) {
    const status = $('recovery-status');
    if (status) status.textContent = 'No signed-in account to powerwash.';
    return;
  }
  saveDeviceSnapshot('before-user-powerwash');
  if (!confirm(`Powerwash ${userLabel(state.user)}? This deletes local OWDOS files, installed apps, and system settings for this account. Your Supabase account and email stay untouched.`)) return;
  const prefix = `owdos:${state.user.id}`;
  const disk = userStorageKey('disk');
  const installed = userStorageKey('installed');
  const system = userStorageKey('system');
  const keys = Object.keys(localStorage).filter(key => key === disk || key === installed || key === system || key.startsWith(`${prefix}:app:`));
  keys.forEach(key => localStorage.removeItem(key));
  state.disk = defaultDisk(usernameFor(state.user));
  state.installed = [];
  state.system = { oobeComplete: false, hostname: 'owdos', theme: 'midnight', language: 'English (US)', keyboard: 'US', accessibility: false, reduceMotion: false, diagnostics: false };
  saveSystemState();
  state.windows.forEach(item => item.win.remove());
  state.windows.clear();
  supabase.auth.signOut();
}

function rebootInto(mode) {
  saveDisk(); saveSystemState();
  if (mode === 'recovery') return location.assign('recovery.html?from=desktop');
  if (mode === 'bootloader') return location.assign('index.html?loader=1');
  if (mode === 'devmode') return location.assign('devmode.html?from=desktop');
  location.assign('index.html?loader=1');
}

function shutdownSystem() {
  saveDisk(); saveSystemState();
  state.windows.forEach(item => item.win.remove());
  state.windows.clear();
  desktop.classList.add('hidden');
  auth.classList.add('hidden');
  boot.classList.remove('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS</div><div class="boot-subtitle">System powered off</div><button class="primary shutdown-restart" type="button">Restart OWDOS</button>`;
  card.querySelector('button').onclick = () => location.assign(location.pathname);
}


function showDevMode() {
  state.bootMode = 'devmode';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="devmode-page"><div class="devmode-top"><div><div class="boot-mark">OW</div><div class="boot-name">OWDOS Developer Mode</div><div class="boot-subtitle">Unverified firmware environment</div></div><span class="devmode-pill">${state.devMode ? 'ENABLED' : 'DISABLED'}</span></div><div class="devmode-warning">Developer mode disables the normal trust chain for this local OWDOS instance. This is a simulated browser OS feature.</div><div class="devmode-actions"><button class="primary" data-dev="admin">Open admin console</button><button data-dev="recovery">Recovery</button><button data-dev="revert">Revert</button><button data-dev="powerwash" class="danger-btn">Powerwash</button><button data-dev="toggle">${state.devMode ? 'Disable developer mode' : 'Enable developer mode'}</button></div><div class="devmode-facts"><div><span>Device</span><code>${escapeHtml(state.deviceId)}</code></div><div><span>Kernel</span><b>${escapeHtml(state.system.kernelVersion)}</b></div><div><span>TPM</span><b>${escapeHtml(state.system.tpmVersion)}</b></div><div><span>Exploit lab</span><b>${state.system.exploitLab?.label || 'None active'}</b></div></div><button class="setup-back" data-dev="back">Back to bootloader</button></div>`;
  card.querySelector('[data-dev="admin"]').onclick = showAdminConsole;
  card.querySelector('[data-dev="recovery"]').onclick = showRecoveryMode;
  card.querySelector('[data-dev="revert"]').onclick = revertDevice;
  card.querySelector('[data-dev="powerwash"]').onclick = powerwashDevice;
  card.querySelector('[data-dev="toggle"]').onclick = () => { setDevMode(!state.devMode); showDevMode(); };
  card.querySelector('[data-dev="back"]').onclick = showBootloader;
}

function showBootloader() {
  state.bootMode = 'bootloader';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS Bootloader</div><div class="boot-subtitle">Ordbit firmware</div><div class="boot-device">${escapeHtml(state.system.hostname)} · ${escapeHtml(state.deviceId)}</div><div class="boot-facts"><span>FW ${escapeHtml(state.system.firmwareVersion)}</span><span>BL ${escapeHtml(state.system.bootloaderVersion)}</span><span>Kernel ${escapeHtml(state.system.kernelVersion)}</span><span>TPM ${escapeHtml(state.system.tpmVersion)}</span></div><div class="recovery-menu"><button data-boot="continue">Boot OWDOS</button><button data-boot="recovery">Recovery mode</button><button data-boot="devmode">Developer mode</button><button data-boot="admin">Admin console</button><button data-boot="shutdown">Power off</button></div><div class="boot-hint">Arrow keys select · Enter boots · R recovery · D developer mode · A admin · P power off</div>`;
  const buttons = [...card.querySelectorAll('[data-boot]')];
  let selected = 0;
  const select = value => { selected = (value + buttons.length) % buttons.length; buttons.forEach((button, i) => button.classList.toggle('selected', i === selected)); };
  select(0);
  const keydown = event => {
    if (boot.classList.contains('hidden')) return window.removeEventListener('keydown', keydown);
    if (event.key === 'ArrowDown') { event.preventDefault(); select(selected + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); select(selected - 1); }
    if (event.key.toLowerCase() === 'r') buttons.find(button => button.dataset.boot === 'recovery')?.click();
    if (event.key.toLowerCase() === 'd') buttons.find(button => button.dataset.boot === 'devmode')?.click();
    if (event.key.toLowerCase() === 'a') buttons.find(button => button.dataset.boot === 'admin')?.click();
    if (event.key.toLowerCase() === 'p') buttons.find(button => button.dataset.boot === 'shutdown')?.click();
    if (event.key === 'Enter') buttons[selected]?.click();
  };
  window.addEventListener('keydown', keydown);
  buttons.forEach((button, i) => button.onclick = () => {
    if (button.dataset.boot === 'continue') {
      history.replaceState(null, '', location.pathname);
      window.removeEventListener('keydown', keydown);
      runBootSequence();
    } else if (button.dataset.boot === 'recovery') { window.removeEventListener('keydown', keydown); showRecoveryMode(); }
    else if (button.dataset.boot === 'devmode') { window.removeEventListener('keydown', keydown); if (!state.devMode) setDevMode(true); showDevMode(); }
    else if (button.dataset.boot === 'admin') { window.removeEventListener('keydown', keydown); showAdminConsole(); }
    else shutdownSystem();
  });
}

function showRecoveryPrompt() {
  const overlay = document.createElement('div');
  overlay.className = 'recovery-overlay';
  overlay.innerHTML = `<section class="recovery-card"><div class="eyebrow">ACCOUNT RECOVERY</div><h2>Set a new password</h2><p class="muted">Your recovery link is valid. Choose a new password for your Supabase account.</p><label>New password<input id="recovery-password" type="password" minlength="6" autocomplete="new-password"></label><label>Confirm password<input id="recovery-password-2" type="password" minlength="6" autocomplete="new-password"></label><div class="oobe-actions"><button class="tool-btn" data-cancel>Cancel</button><button class="primary" data-save>Update password</button></div><div class="message" data-message></div></section>`;
  document.body.append(overlay);
  overlay.querySelector('[data-cancel]').onclick = () => overlay.remove();
  overlay.querySelector('[data-save]').onclick = async () => {
    const first = overlay.querySelector('#recovery-password').value;
    const second = overlay.querySelector('#recovery-password-2').value;
    const message = overlay.querySelector('[data-message]');
    if (first.length < 6 || first !== second) { message.textContent = 'Use at least 6 characters and make both passwords match.'; message.className = 'message error'; return; }
    const { error } = await supabase.auth.updateUser({ password: first });
    if (error) { message.textContent = error.message; message.className = 'message error'; return; }
    overlay.remove();
    toast('Password updated.');
  };
}

async function runBootSequence() {
  state.bootMode = 'booting';
  boot.classList.remove('hidden');
  ['welcome','user','auth','guest','desktop'].forEach(id => $(id)?.classList.add('hidden'));
  const card = document.createElement('div');
  card.className = 'firmware-screen';
  card.innerHTML = `<div class="firmware-brand"><span>OW</span><div><strong>OWDOS</strong><small>Ordbit Web Distro</small></div></div><div class="firmware-status" data-status>Starting firmware…</div><div class="firmware-log" data-log></div><div class="firmware-progress"><span></span></div><button class="firmware-key" data-bootloader>Press F12 for boot options</button>`;
  boot.innerHTML = '';
  boot.append(card);
  const status = card.querySelector('[data-status]');
  const log = card.querySelector('[data-log]');
  card.querySelector('[data-bootloader]').onclick = showBootloader;
  const steps = [
    ['ROM', 'Verifying boot image'],
    ['BL1', 'Loading OWDOS bootloader'],
    ['KERNEL', 'Starting Ordbit kernel'],
    ['VFS', 'Mounting local filesystem services'],
    ['INIT', 'Starting userspace services'],
    ['LOGIN', 'Checking session state']
  ];
  for (const [name, message] of steps) {
    if (state.bootMode !== 'booting') return;
    status.textContent = message;
    const line = document.createElement('div');
    line.innerHTML = `<span>${name}</span><b>OK</b>`;
    log.append(line);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  loadSystemState();
  const mode = new URLSearchParams(location.search).get('owdos');
  const { data } = await supabase.auth.getSession();
  if (data.session) { state.user = data.session.user; state.mode = 'user'; }
  if (mode === 'bootloader') return showBootloader();
  if (mode === 'recovery') return showRecoveryMode();
  if (state.system.oobeBypass) { state.system.oobeComplete = true; saveSystemState(); }
  if (!state.system.oobeComplete) return showOobe();
  if (data.session) return showUserPage();
  showWelcomePage();
}

function showDesktop() {
  auth.classList.add('hidden');
  boot.classList.add('hidden');
  desktop.classList.remove('hidden');
  document.documentElement.dataset.theme = state.system.theme || 'default';
  $('status-user').textContent = state.mode === 'guest' ? 'Guest' : userLabel(state.user);
  $('launcher-user').textContent = state.mode === 'guest' ? 'Guest session' : userLabel(state.user);
  updateClock();
}

function updateClock() {
  $('clock').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

async function bootIntoSession(session) {
  state.user = session.user;
  state.mode = 'user';
  state.guestId = null;
  await loadLocalState();
  if (window.owdos) window.owdos.fs = state.disk;
  kernelLog(`session ready for ${userLabel(state.user)}`);
  if (!state.system.oobeComplete) { showOobe(); return; }
  showDesktop();
  if (!state.booted) {
    state.booted = true;
    setTimeout(() => launch('files'), 180);
  }
}

async function bootDesktopPage() {
  loadSystemState();
  const params = new URLSearchParams(location.search);
  const guest = params.get('guest') === '1';
  if (guest) {
    state.mode = 'guest';
    state.guestId = sessionStorage.getItem('owdos:guest:id') || `guest-${crypto.randomUUID()}`;
    sessionStorage.setItem('owdos:guest:id', state.guestId);
    state.user = null;
  } else {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return location.assign('welcome.html');
    state.mode = 'user';
    state.user = data.session.user;
    state.guestId = null;
  }
  if (!state.system.oobeComplete) return location.assign('oobe.html');
  await loadLocalState();
  showDesktop();
  state.booted = true;
  document.querySelectorAll('.app-launch').forEach(button => button.onclick = () => launch(button.dataset.app));
  $('launcher').onclick = () => launcherMenu.classList.toggle('hidden');
  $('clock').onclick = () => launch('monitor');
  window.addEventListener('beforeunload', () => { saveDisk(); saveSystemState(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('#launcher') && !event.target.closest('#launcher-menu')) launcherMenu.classList.add('hidden');
    if (!event.target.closest('#desktop-context')) $('desktop-context').classList.add('hidden');
  });
  setInterval(updateClock, 30000);
  const held = new Set();
  const keydown = event => {
    held.add(event.code);
    if (['Digit1','Digit4','Equal'].every(code => held.has(code))) { event.preventDefault(); held.clear(); return location.assign('recovery.html?from=desktop&reason=key-chord'); }
    if (event.key === 'F12' || event.key === 'Escape') { event.preventDefault(); location.assign('index.html?loader=1'); }
  };
  const keyup = event => held.delete(event.code);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') location.assign('welcome.html');
    if (event === 'PASSWORD_RECOVERY') location.assign('login.html?recovery=1');
  });
  if (!findWindowByApp('files')) setTimeout(() => launch('files'), 220);
}

async function bootApp() {
  if (document.body.dataset.page === 'desktop') return bootDesktopPage();
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.onclick = () => setAuthMode(button.dataset.authTab));
  $('auth-form').addEventListener('submit', handleAuth);
  $('forgot-password').onclick = forgotPassword;
  $('launcher').onclick = () => launcherMenu.classList.toggle('hidden');
  document.querySelectorAll('.app-launch').forEach(button => button.onclick = () => launch(button.dataset.app));
  $('clock').onclick = () => launch('monitor');
  window.addEventListener('beforeunload', () => { saveDisk(); saveSystemState(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('#launcher') && !event.target.closest('#launcher-menu')) launcherMenu.classList.add('hidden');
    if (!event.target.closest('#desktop-context')) $('desktop-context').classList.add('hidden');
  });
  setInterval(updateClock, 30000);
  const heldKeys = new Set();
  const heldCodes = new Set();
  let oobePowerwashPress = 0;
  let oobePowerwashTimer = null;
  const bootKey = event => {
    heldKeys.add(event.key);
    heldCodes.add(event.code);
    if (['Digit1','Digit4','Equal'].every(code => heldCodes.has(code))) { event.preventDefault(); heldKeys.clear(); heldCodes.clear(); showRecoveryMode(); return; }
    const target = event.target;
    const inOobe = !!document.querySelector('.oobe');
    if (inOobe && event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      oobePowerwashPress += 1;
      clearTimeout(oobePowerwashTimer);
      oobePowerwashTimer = setTimeout(() => { oobePowerwashPress = 0; }, 700);
      if (oobePowerwashPress === 1) showOobeRecoveryMenu();
      if (oobePowerwashPress >= 2) { oobePowerwashPress = 0; showOobeRecoveryMenu('revert'); }
    }
    if ((event.key === 'F12' || event.key === 'Escape') && (boot.classList.contains('hidden') || !document.querySelector('.oobe'))) { event.preventDefault(); showBootloader(); }
  };
  window.addEventListener('keydown', bootKey);
  window.addEventListener('keyup', event => { heldKeys.delete(event.key); heldCodes.delete(event.code); });
  await runBootSequence();
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) { state.mode = 'user'; await bootIntoSession(session); }
    if (event === 'SIGNED_OUT') {
      state.user = null;
      state.mode = 'none';
      state.guestId = null;
      state.windows.forEach(item => item.win.remove());
      state.windows.clear();
      state.bash = null; state.shell = null; state.shellReady = false; state.booted = false;
      showWelcomePage();
    }
    if (event === 'PASSWORD_RECOVERY') showRecoveryPrompt();
  });
}

bootApp().catch(error => {
  boot.classList.add('hidden');
  auth.classList.remove('hidden');
  showMessage(error.message || 'OWDOS could not start.', 'error');
});
