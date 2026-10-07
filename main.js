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
  system: { oobeComplete: false, hostname: 'owdos', theme: 'default' },
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
  return storageKey(`${name}:${state.user.id}`);
}

function loadSystemState() {
  const key = userStorageKey('system');
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    state.system = { oobeComplete: false, hostname: 'owdos', theme: 'default', ...(saved || {}) };
  } catch {
    state.system = { oobeComplete: false, hostname: 'owdos', theme: 'default' };
  }
  document.documentElement.dataset.theme = state.system.theme || 'default';
}

function saveSystemState() {
  if (!state.user) return;
  try {
    localStorage.setItem(userStorageKey('system'), JSON.stringify(state.system));
  } catch {}
}

function kernelLog(message, level = 'info') {
  if (!state.kernel) return;
  const entry = { time: new Date().toISOString(), level, message };
  state.kernel.logs.push(entry);
  if (state.kernel.logs.length > 150) state.kernel.logs.shift();
}

function createKernel() {
  const kernel = {
    version: '0.4.0',
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
  window.owdos = { kernel, fs: state.disk, auth: supabase };
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
  const name = user?.user_metadata?.username;
  if (name && /^[A-Za-z0-9_]{3,24}$/.test(name)) return name;
  return (user?.email?.split('@')[0] || 'user').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24) || 'user';
}

function userLabel(user) {
  return user?.user_metadata?.username || user?.email || 'user';
}

async function loadLocalState() {
  loadSystemState();
  createKernel();
  kernelLog('mounting local filesystem');
  const username = usernameFor(state.user);
  const diskKey = storageKey(`disk:${state.user.id}`);
  const installedKey = storageKey(`installed:${state.user.id}`);
  const raw = localStorage.getItem(diskKey);
  try {
    state.disk = raw ? JSON.parse(raw) : defaultDisk(username);
  } catch {
    state.disk = defaultDisk(username);
  }
  try {
    state.installed = JSON.parse(localStorage.getItem(installedKey) || '[]');
    if (!Array.isArray(state.installed)) state.installed = [];
  } catch {
    state.installed = [];
  }
  saveDisk();
}

function saveDisk() {
  if (!state.user) return;
  try {
    localStorage.setItem(storageKey(`disk:${state.user.id}`), JSON.stringify(state.disk));
    localStorage.setItem(storageKey(`installed:${state.user.id}`), JSON.stringify(state.installed));
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
  const address = document.createElement('input'); address.className = 'path browser-address'; address.value = 'https://example.com'; address.spellcheck = false;
  const go = document.createElement('button'); go.className = 'tool-btn'; go.textContent = 'Go';
  const status = document.createElement('div'); status.className = 'browser-status';
  const view = document.createElement('div'); view.className = 'browser-view';
  bar.append(back, forward, reload, address, go, status);
  root.append(bar, view);

  const history = ['https://example.com'];
  let historyIndex = 0;
  let navigationToken = 0;
  let currentUrl = history[0];
  let lastContent = '';

  const normalizeWebUrl = value => {
    const raw = value.trim();
    if (!raw) return null;
    if (/^(javascript:|data:|blob:|file:)/i.test(raw)) return null;
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
    return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
  };

  const readerUrl = url => `https://r.jina.ai/${url}`;

  const renderMarkdown = (data, url) => {
    const title = escapeHtml(data?.title || new URL(url).hostname);
    const content = data?.content || '';
    lastContent = content;
    view.innerHTML = `<article class="browser-page"><header><div class="browser-secure">WEB</div><div><h1>${title}</h1><div class="browser-url">${escapeHtml(url)}</div></div></header><div class="browser-content">${markdownToHtml(content)}</div></article>`;
    view.querySelectorAll('a[data-url]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      navigate(link.dataset.url);
    }));
    view.querySelectorAll('a[href]').forEach(link => link.setAttribute('target', '_blank'));
  };

  const renderError = (message, url, statusCode = '') => {
    view.innerHTML = `<div class="browser-error"><div class="browser-error-code">${statusCode || 'WEB'}</div><h2>Couldn’t load this page</h2><p>${escapeHtml(message)}</p><div class="browser-error-url">${escapeHtml(url)}</div><p class="muted">OWDOS Browser uses a server-side reader instead of unsafe public CORS relays. Sites that deny automated fetching may still reject the request.</p><button class="tool-btn" data-retry>Try again</button></div>`;
    view.querySelector('[data-retry]').onclick = () => render(url, false);
  };

  const fetchPage = async url => {
    const response = await fetch(readerUrl(url), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw Object.assign(new Error(`Web reader returned HTTP ${response.status}.`), { status: response.status });
    const raw = await response.text();
    try {
      const json = JSON.parse(raw);
      const data = json?.data || json;
      return { title: data?.title, content: data?.content || data?.text || '' };
    } catch {
      return { title: new URL(url).hostname, content: raw };
    }
  };

  async function render(url, push = true) {
    if (!/^https?:\/\//i.test(url)) return;
    const token = ++navigationToken;
    currentUrl = url;
    address.value = url;
    status.textContent = 'Connecting…';
    view.innerHTML = '<div class="browser-loading"><div class="spinner"></div><strong>Connecting to the web</strong><span>Fetching and simplifying the page...</span></div>';
    try {
      const data = await fetchPage(url);
      if (token !== navigationToken) return;
      renderMarkdown(data, url);
      status.textContent = 'Connected';
      if (push) {
        history.splice(historyIndex + 1);
        history.push(url);
        historyIndex = history.length - 1;
      }
    } catch (error) {
      if (token !== navigationToken) return;
      status.textContent = `HTTP ${error.status || 'ERR'}`;
      renderError(error.message || 'The web reader could not fetch the page.', url, error.status ? `HTTP ${error.status}` : 'ERR');
    }
    back.disabled = historyIndex <= 0;
    forward.disabled = historyIndex >= history.length - 1;
  }

  function navigate(value) {
    const url = normalizeWebUrl(value);
    if (!url || !/^https?:\/\//i.test(url)) {
      status.textContent = 'Invalid address';
      return;
    }
    render(url, true);
  }

  go.onclick = () => navigate(address.value);
  address.addEventListener('keydown', event => { if (event.key === 'Enter') navigate(address.value); });
  back.onclick = () => { if (historyIndex > 0) { historyIndex--; render(history[historyIndex], false); } };
  forward.onclick = () => { if (historyIndex < history.length - 1) { historyIndex++; render(history[historyIndex], false); } };
  reload.onclick = () => render(currentUrl, false);

  openWindow('browser', 'Browser', root, { width: 980, height: 620 });
  render(currentUrl, false);
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
  const overlay = document.createElement('div');
  overlay.className = 'oobe';
  overlay.innerHTML = `<section class="oobe-card"><div class="oobe-brand"><div class="boot-mark">OW</div><div><div class="eyebrow">ORDBIT WEB DISTRO</div><h1>Welcome to OWDOS</h1></div></div><div class="oobe-progress"><span class="active"></span><span></span><span></span><span></span></div><div class="oobe-body"></div><div class="oobe-actions"><button class="tool-btn" data-back>Back</button><button class="primary oobe-next" data-next>Continue</button></div></section>`;
  document.body.append(overlay);
  state.oobe = overlay;
  let step = 0;
  const body = overlay.querySelector('.oobe-body');
  const next = overlay.querySelector('[data-next]');
  const back = overlay.querySelector('[data-back]');
  const render = () => {
    const dots = overlay.querySelectorAll('.oobe-progress span'); dots.forEach((dot, i) => dot.classList.toggle('active', i <= step));
    back.disabled = step === 0;
    if (step === 0) {
      body.innerHTML = `<div class="oobe-kicker">A browser that boots like a computer.</div><h2>Your machine is ready.</h2><p>OWDOS gives this browser a desktop, a persistent local disk, a real Bash environment, a web browser, and a community app store.</p><div class="oobe-grid"><div><strong>Local by default</strong><span>Your OS files stay in this browser.</span></div><div><strong>Account ready</strong><span>${escapeHtml(userLabel(state.user))} is signed in through Supabase.</span></div><div><strong>Built to hack</strong><span>Apps can be submitted through GitHub pull requests.</span></div></div>`;
      next.textContent = 'Set up OWDOS';
    } else if (step === 1) {
      body.innerHTML = `<div class="oobe-kicker">IDENTITY</div><h2>Choose your machine name</h2><p>This is the hostname shown by the shell and system tools.</p><label class="oobe-field">Hostname<input id="oobe-host" maxlength="32" value="${escapeHtml(state.system.hostname)}"></label><div class="oobe-account"><span>Signed in as</span><strong>${escapeHtml(state.user.email || '')}</strong></div>`;
      next.textContent = 'Continue';
    } else if (step === 2) {
      body.innerHTML = `<div class="oobe-kicker">APPEARANCE</div><h2>Pick a desktop finish</h2><p>This can be changed later in Settings.</p><div class="theme-picks"><button data-theme="default" class="theme-pick"><b>Midnight</b><span>Dark · subtle blue</span></button><button data-theme="slate" class="theme-pick"><b>Slate</b><span>Dark · neutral</span></button><button data-theme="snow" class="theme-pick"><b>Snow</b><span>Light · clean</span></button></div>`;
      overlay.querySelectorAll('[data-theme]').forEach(button => button.classList.toggle('selected', button.dataset.theme === state.system.theme));
      overlay.querySelectorAll('[data-theme]').forEach(button => button.onclick = () => { state.system.theme = button.dataset.theme; document.documentElement.dataset.theme = state.system.theme; overlay.querySelectorAll('[data-theme]').forEach(item => item.classList.toggle('selected', item === button)); });
      next.textContent = 'Finish setup';
    } else {
      body.innerHTML = `<div class="oobe-finished"><div class="oobe-check">✓</div><div class="oobe-kicker">READY</div><h2>OWDOS is yours.</h2><p>The kernel is mounted, the local filesystem is ready, and your account is connected. The rest of the system can grow from here without rebuilding the foundation.</p></div>`;
      next.textContent = 'Enter OWDOS';
    }
  };
  next.onclick = () => {
    if (step === 1) {
      const value = overlay.querySelector('#oobe-host').value.trim();
      if (!/^[A-Za-z0-9-]{1,32}$/.test(value)) return toast('Hostname must use letters, numbers, or hyphens.');
      state.system.hostname = value.toLowerCase();
    }
    if (step < 3) step++; else {
      state.system.oobeComplete = true;
      saveSystemState();
      overlay.remove(); state.oobe = null;
      showDesktop();
      launch('files');
      kernelLog('OOBE complete');
    }
    render();
  };
  back.onclick = () => { if (step > 0) { step--; render(); } };
  render();
}

function showRecoveryMode() {
  state.bootMode = 'recovery';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS Recovery</div><div class="boot-subtitle">System recovery environment</div><div class="recovery-menu"><button data-recovery="continue">Continue boot</button><button data-recovery="repair">Repair local filesystem</button><button data-recovery="settings">Reset OWDOS settings</button><button data-recovery="powerwash" class="danger-btn">Powerwash account</button><button data-recovery="bootloader">Back to bootloader</button><button data-recovery="shutdown">Power off</button></div><div id="recovery-status" class="boot-status-line"></div>`;
  card.querySelectorAll('[data-recovery]').forEach(button => button.onclick = () => recoveryAction(button.dataset.recovery));
}

function recoveryAction(action) {
  const status = $('recovery-status');
  if (action === 'continue') {
    history.replaceState(null, '', location.pathname);
    boot.classList.add('hidden');
    if (state.user) bootIntoSession({ user: state.user }); else { auth.classList.remove('hidden'); setAuthMode('signin'); }
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
    state.system = { oobeComplete: false, hostname: 'owdos', theme: 'default' };
    saveSystemState();
    document.documentElement.dataset.theme = 'default';
    status.textContent = 'OWDOS settings reset. The next boot will run OOBE.';
  }
  if (action === 'powerwash') powerwash();
  if (action === 'bootloader') showBootloader();
  if (action === 'shutdown') shutdownSystem();
}

function powerwash() {
  if (!state.user) {
    const status = $('recovery-status');
    if (status) status.textContent = 'No signed-in account to powerwash.';
    return;
  }
  if (!confirm(`Powerwash ${userLabel(state.user)}? This deletes local OWDOS files, installed apps, and system settings for this account. Your Supabase account and email stay untouched.`)) return;
  const prefix = `owdos:${state.user.id}`;
  const disk = userStorageKey('disk');
  const installed = userStorageKey('installed');
  const system = userStorageKey('system');
  const keys = Object.keys(localStorage).filter(key => key === disk || key === installed || key === system || key.startsWith(`${prefix}:app:`));
  keys.forEach(key => localStorage.removeItem(key));
  state.disk = defaultDisk(usernameFor(state.user));
  state.installed = [];
  state.system = { oobeComplete: false, hostname: 'owdos', theme: 'default' };
  state.windows.forEach(item => item.win.remove());
  state.windows.clear();
  supabase.auth.signOut();
}

function rebootInto(mode) {
  saveDisk(); saveSystemState();
  location.assign(`${location.pathname}?owdos=${encodeURIComponent(mode)}`);
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

function showBootloader() {
  state.bootMode = 'bootloader';
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS Bootloader</div><div class="boot-subtitle">Ordbit firmware</div><div class="boot-device">OWDOS / boot</div><div class="recovery-menu"><button data-boot="continue">Boot OWDOS</button><button data-boot="recovery">Recovery mode</button><button data-boot="shutdown">Power off</button></div><div class="boot-hint">Arrow keys select · Enter boots · R opens recovery · P powers off</div>`;
  const buttons = [...card.querySelectorAll('[data-boot]')];
  let selected = 0;
  const select = value => { selected = (value + buttons.length) % buttons.length; buttons.forEach((button, i) => button.classList.toggle('selected', i === selected)); };
  select(0);
  const keydown = event => {
    if (boot.classList.contains('hidden')) return window.removeEventListener('keydown', keydown);
    if (event.key === 'ArrowDown') { event.preventDefault(); select(selected + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); select(selected - 1); }
    if (event.key.toLowerCase() === 'r') buttons[1]?.click();
    if (event.key.toLowerCase() === 'p') buttons[2]?.click();
    if (event.key === 'Enter') buttons[selected]?.click();
  };
  window.addEventListener('keydown', keydown);
  buttons.forEach((button, i) => button.onclick = () => {
    if (button.dataset.boot === 'continue') {
      history.replaceState(null, '', location.pathname);
      window.removeEventListener('keydown', keydown);
      runBootSequence();
    } else if (button.dataset.boot === 'recovery') { window.removeEventListener('keydown', keydown); showRecoveryMode(); }
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
  boot.classList.remove('hidden'); auth.classList.add('hidden'); desktop.classList.add('hidden');
  const card = boot.querySelector('.boot-card');
  card.innerHTML = `<div class="boot-mark">OW</div><div class="boot-name">OWDOS</div><div id="boot-status">Starting kernel...</div><div id="boot-log" class="boot-log"></div><div class="boot-bar"><span></span></div><button id="bootloader-trigger" class="boot-trigger">Bootloader</button>`;
  const log = $('boot-log');
  const status = $('boot-status');
  const steps = [
    ['boot ROM', 'Verifying boot image'],
    ['bootloader', 'Loading OWDOS bootloader'],
    ['kernel', 'Starting Ordbit kernel'],
    ['filesystem', 'Mounting local disk'],
    ['services', 'Starting system services'],
    ['session', 'Loading account session']
  ];
  for (const [name, message] of steps) {
    if (state.bootMode !== 'booting') return;
    status.textContent = message;
    const line = document.createElement('div'); line.textContent = `${name.padEnd(11, ' ')}  OK`; log.append(line); log.scrollTop = log.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, 115));
  }
  $('bootloader-trigger').onclick = showBootloader;
  if (state.bootMode !== 'booting') return;
  const mode = new URLSearchParams(location.search).get('owdos');
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    state.user = data.session.user;
    if (mode === 'recovery') await loadLocalState();
  }
  if (mode === 'bootloader') return showBootloader();
  if (mode === 'recovery') return showRecoveryMode();
  if (data.session) await bootIntoSession(data.session); else { boot.classList.add('hidden'); auth.classList.remove('hidden'); setAuthMode('signin'); }
}

function showDesktop() {
  auth.classList.add('hidden');
  boot.classList.add('hidden');
  desktop.classList.remove('hidden');
  document.documentElement.dataset.theme = state.system.theme || 'default';
  $('status-user').textContent = userLabel(state.user);
  $('launcher-user').textContent = userLabel(state.user);
  updateClock();
}

function updateClock() {
  $('clock').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

async function bootIntoSession(session) {
  state.user = session.user;
  await loadLocalState();
  if (window.owdos) window.owdos.fs = state.disk;
  kernelLog(`session ready for ${userLabel(state.user)}`);
  if (!state.system.oobeComplete) {
    showOobe();
    return;
  }
  showDesktop();
  if (!state.booted) {
    state.booted = true;
    setTimeout(() => launch('files'), 180);
  }
}

async function bootApp() {
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
  let escapeBoot = false;
  const bootKey = event => { if (event.key === 'Escape' && !boot.classList.contains('hidden')) { escapeBoot = true; showBootloader(); window.removeEventListener('keydown', bootKey); } };
  window.addEventListener('keydown', bootKey);
  $('bootloader-trigger').onclick = showBootloader;
  await runBootSequence();
  if (!escapeBoot) window.removeEventListener('keydown', bootKey);
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) await bootIntoSession(session);
    if (event === 'SIGNED_OUT') {
      state.user = null;
      state.windows.forEach(item => item.win.remove());
      state.windows.clear();
      state.bash = null; state.shell = null; state.shellReady = false; state.booted = false;
      desktop.classList.add('hidden'); boot.classList.add('hidden'); auth.classList.remove('hidden');
      setAuthMode('signin'); showMessage('Signed out.');
    }
    if (event === 'PASSWORD_RECOVERY') showRecoveryPrompt();
  });
}

bootApp().catch(error => {
  boot.classList.add('hidden');
  auth.classList.remove('hidden');
  showMessage(error.message || 'OWDOS could not start.', 'error');
});
