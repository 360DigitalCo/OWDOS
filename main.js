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
  booted: false
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
    showMessage(error.message || 'Authentication failed.', 'error');
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
    term.writeln('\r\nOWDOS: this page is not cross-origin isolated yet. Reloading usually fixes it on static hosting.');
    return;
  }
  term.write('\x1b[1;36mOWDOS\x1b[0m starting Bash...\r\n');
  const username = usernameFor(state.user);
  const files = {};
  Object.entries(state.disk).forEach(([path, node]) => {
    if (node.type !== 'file') return;
    if (!path.startsWith(`/home/${username}/`)) return;
    files[path.replace(/^\//, '')] = node.content || '';
  });
  const wasmer = new Wasmer();
  const sandbox = await wasmer.sandboxes.create({
    packages: ['wasmer/bash@=1.0.25'],
    files
  });
  state.bash = { wasmer, sandbox };
  const process = await sandbox.command('bash', ['--noprofile', '--norc', '-i']).spawn({ terminal: { columns: term.cols, rows: term.rows } });
  state.shell = process;
  state.shellReady = true;
  const encoder = new TextEncoder();
  const stdin = process.stdin;
  await stdin.write(encoder.encode(`export USER=${username}\nexport LOGNAME=${username}\nexport HOME=/workspace/home/${username}\ncd "$HOME"\nexport PS1='\\[\\e[1;36m\\]${username}@owdos\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ '\nclear\n`));
  process.stdout.pipeTo(new WritableStream({ write: chunk => term.write(chunk) })).catch(() => {});
  process.stderr.pipeTo(new WritableStream({ write: chunk => term.write(chunk) })).catch(() => {});
  term.onData(async data => {
    try { await stdin.write(encoder.encode(data)); }
    catch { term.writeln('\r\nOWDOS: Bash session closed.'); }
  });
  const sync = async () => { if (state.shellReady) await syncGuestHome(); };
  term.onResize(({ cols, rows }) => process.resizeTerminal(cols, rows));
  process.wait().then(async () => {
    await sync();
    state.shell = null;
    state.shellReady = false;
    state.bash = null;
    try { await sandbox.close(); } catch {}
    try { await wasmer.close(); } catch {}
  }).catch(async () => {
    state.shell = null;
    state.shellReady = false;
    state.bash = null;
    try { await sandbox.close(); } catch {}
    try { await wasmer.close(); } catch {}
  });
  window.addEventListener('resize', () => fit.fit());
}

async function syncGuestHome() {
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
    toast('Bash home synced to the local OWDOS disk.');
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

function createBrowserApp() {
  const root = appRoot();
  const bar = document.createElement('div'); bar.className = 'app-toolbar';
  const back = document.createElement('button'); back.className = 'tool-btn'; back.textContent = '←';
  const forward = document.createElement('button'); forward.className = 'tool-btn'; forward.textContent = '→';
  const reload = document.createElement('button'); reload.className = 'tool-btn'; reload.textContent = '↻';
  const address = document.createElement('input'); address.className = 'path'; address.value = 'https://example.com';
  const go = document.createElement('button'); go.className = 'tool-btn'; go.textContent = 'Go';
  const frame = document.createElement('iframe'); frame.className = 'browser-frame'; frame.referrerPolicy = 'no-referrer'; frame.allow = 'fullscreen';
  frame.sandbox = 'allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts';
  bar.append(back, forward, reload, address, go);
  root.append(bar, frame);
  const navigate = value => {
    let url = value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    address.value = url;
    frame.src = url;
  };
  go.onclick = () => navigate(address.value);
  address.addEventListener('keydown', event => { if (event.key === 'Enter') navigate(address.value); });
  back.onclick = () => { try { frame.contentWindow.history.back(); } catch { toast('This site does not allow in-frame history control.'); } };
  forward.onclick = () => { try { frame.contentWindow.history.forward(); } catch { toast('This site does not allow in-frame history control.'); } };
  reload.onclick = () => frame.contentWindow.location.reload();
  openWindow('browser', 'Browser', root, { width: 860, height: 560 });
  navigate(address.value);
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
          localStorage.setItem(storageKey(`app:${app.id}`), JSON.stringify({ ...app, source }));
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
  const app = JSON.parse(localStorage.getItem(storageKey(`app:${id}`)) || 'null');
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
  settings.innerHTML = `<h2>Settings</h2><div class="muted">OWDOS account and local system controls.</div><div class="settings-section"><div class="setting-row"><div><strong>Account</strong><span>${escapeHtml(user.email || '')}</span></div><button class="tool-btn" data-action="logout">Sign out</button></div><div class="setting-row"><div><strong>Username</strong><span>${escapeHtml(userLabel(user))}</span></div></div><div class="setting-row"><div><strong>Local disk</strong><span>Files are stored in this browser and are not uploaded to Supabase.</span></div><button class="tool-btn" data-action="save">Save now</button></div><div class="setting-row"><div><strong>Reset local disk</strong><span>Deletes the current OWDOS filesystem in this browser and recreates it.</span></div><button class="tool-btn danger" data-action="reset">Reset</button></div></div><div class="settings-section"><div class="setting-row"><div><strong>OWDOS</strong><span>Ordbit Web Distro Operating System</span></div><span>Foundation build</span></div></div>`;
  root.append(settings);
  settings.addEventListener('click', async event => {
    const action = event.target.dataset.action;
    if (action === 'logout') await supabase.auth.signOut();
    if (action === 'save') { saveDisk(); toast('Local disk saved.'); }
    if (action === 'reset') { if (confirm('Reset the local OWDOS filesystem?')) { state.disk = defaultDisk(usernameFor(state.user)); saveDisk(); toast('Local disk reset.'); } }
  });
  openWindow('settings', 'Settings', root, { width: 610, height: 470 });
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
}

function showDesktop() {
  auth.classList.add('hidden');
  desktop.classList.remove('hidden');
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
  window.addEventListener('beforeunload', saveDisk);
  document.addEventListener('click', event => {
    if (!event.target.closest('#launcher') && !event.target.closest('#launcher-menu')) launcherMenu.classList.add('hidden');
    if (!event.target.closest('#desktop-context')) $('desktop-context').classList.add('hidden');
  });
  setInterval(updateClock, 30000);

  $('boot-status').textContent = 'Loading account session...';
  const { data } = await supabase.auth.getSession();
  if (data.session) await bootIntoSession(data.session);
  else { boot.classList.add('hidden'); auth.classList.remove('hidden'); setAuthMode('signin'); }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      boot.classList.add('hidden');
      await bootIntoSession(session);
    }
    if (event === 'SIGNED_OUT') {
      state.user = null;
      state.windows.forEach(item => item.win.remove());
      state.windows.clear();
      state.bash = null;
      state.shell = null;
      state.booted = false;
      desktop.classList.add('hidden');
      auth.classList.remove('hidden');
      showMessage('Signed out.');
      setAuthMode('signin');
    }
    if (event === 'PASSWORD_RECOVERY') showRecoveryPrompt();
  });
}

bootApp().catch(error => {
  boot.classList.add('hidden');
  auth.classList.remove('hidden');
  showMessage(error.message || 'OWDOS could not start.', 'error');
});
