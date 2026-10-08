/* ═══════════════════════════════════════════════════════════════
   OWDOS UI — Core JavaScript Engine
   Based on chromiumos/platform2 session_manager, login_manager,
   oobe_config, power_manager, bash, init upstart configs
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── APP REGISTRY ─────────────────────────────────────────────────
const APPS = [
  { id:'browser',    name:'OW Browser',          icon:'🌐', color:'#4285f4', pinned:true  },
  { id:'files',      name:'Files',           icon:'📁', color:'#34a853', pinned:true  },
  { id:'settings',   name:'Settings',        icon:'⚙️', color:'#5f6368', pinned:true  },
  { id:'terminal',   name:'Terminal',        icon:'💻', color:'#202124', pinned:true  },
  { id:'calculator', name:'Calculator',      icon:'🔢', color:'#1a73e8', pinned:false },
  { id:'editor',     name:'Text Editor',     icon:'📝', color:'#1a73e8', pinned:false },
  { id:'music',      name:'Media',           icon:'🎵', color:'#9c27b0', pinned:false },
  { id:'camera',     name:'Camera',          icon:'📷', color:'#e91e63', pinned:false },
  { id:'calendar',   name:'Calendar',        icon:'📅', color:'#fbbc04', pinned:false },
  { id:'gmail',      name:'Gmail',           icon:'📧', color:'#d93025', pinned:false },
  { id:'maps',       name:'Maps',            icon:'🗺️', color:'#34a853', pinned:false },
  { id:'photos',     name:'Photos',          icon:'🖼️', color:'#e91e63', pinned:false },
  { id:'drive',      name:'Cloud files',    icon:'💾', color:'#fbbc04', pinned:false },
  { id:'docs',       name:'Docs',            icon:'📄', color:'#4285f4', pinned:false },
  { id:'sheets',     name:'Sheets',          icon:'📊', color:'#34a853', pinned:false },
  { id:'slides',     name:'Slides',          icon:'📑', color:'#fbbc04', pinned:false },
  { id:'youtube',    name:'YouTube',         icon:'▶️', color:'#ff0000', pinned:false },
  { id:'meet',       name:'Video call',     icon:'🎥', color:'#00897b', pinned:false },
  { id:'clock',      name:'Clock',           icon:'⏰', color:'#455a64', pinned:false },
  { id:'wallpaper',  name:'Wallpapers',      icon:'🎨', color:'#7c4dff', pinned:false },
  { id:'help',       name:'OWDOS Help',       icon:'?', color:'#5f6368', pinned:false  },
  { id:'feedback',   name:'Feedback',        icon:'💬', color:'#0288d1', pinned:false },
  { id:'print',      name:'Print',           icon:'🖨️', color:'#546e7a', pinned:false },
];

const WALLPAPERS = [
  { label:'Ocean Blue',    value:'linear-gradient(135deg,#1a73e8 0%,#0d47a1 40%,#4a148c 100%)' },
  { label:'Forest',        value:'linear-gradient(135deg,#2e7d32 0%,#1b5e20 60%,#004d40 100%)' },
  { label:'Sunset',        value:'linear-gradient(135deg,#f9ab00 0%,#e65100 50%,#b71c1c 100%)' },
  { label:'Midnight',      value:'linear-gradient(160deg,#0f2027 0%,#203a43 50%,#2c5364 100%)' },
  { label:'Aurora',        value:'linear-gradient(135deg,#4a148c 0%,#6a1b9a 40%,#1a237e 100%)' },
  { label:'Rose',          value:'linear-gradient(135deg,#c62828 0%,#ad1457 50%,#6a1b9a 100%)' },
  { label:'Steel Blue',    value:'linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' },
  { label:'Teal',          value:'linear-gradient(135deg,#00695c 0%,#006064 60%,#004d40 100%)' },
  { label:'Blush',         value:'linear-gradient(135deg,#f8bbd0 0%,#fce4ec 50%,#e1f5fe 100%)' },
  { label:'Sky',           value:'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)' },
  { label:'Charcoal',      value:'linear-gradient(135deg,#1c1c1e 0%,#2c2c2e 100%)' },
  { label:'Magma',         value:'linear-gradient(135deg,#ff6f00 0%,#e53935 60%,#880e4f 100%)' },
];

// ── STATE ─────────────────────────────────────────────────────────
const OWDOS = {
  windows: {},
  zCounter: 10,
  launcherOpen: false,
  qsOpen: false,
  ncOpen: false,
  overviewOpen: false,
  dragState: null,
  resizeState: null,
  toastTimer: null,
  clockTimer: null,
  termHistory: [],
  termHistIdx: -1,
  musicPlaying: false,
  wallpaper: WALLPAPERS[0].value,
  brightness: 80,
  volume: 60,
  wifi: true,
  bluetooth: true,
  dnd: false,
  darkMode: false,
};

// ── PERSIST ───────────────────────────────────────────────────────
const SETTINGS_KEY = 'owdos_settings_v3';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(OWDOS, JSON.parse(raw));
  } catch(e) {}
}
function saveSettings() {
  try {
    const {wallpaper,brightness,volume,wifi,bluetooth,dnd,darkMode} = OWDOS;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({wallpaper,brightness,volume,wifi,bluetooth,dnd,darkMode}));
  } catch(e) {}
}
function applySettings() {
  document.body.classList.toggle('dark-theme', !!OWDOS.darkMode);
  const desk = document.getElementById('desktop');
  if (desk && OWDOS.wallpaper) desk.style.background = OWDOS.wallpaper;
  document.querySelectorAll('[data-qs="wifi"]').forEach(el => el.classList.toggle('on', OWDOS.wifi));
  document.querySelectorAll('[data-qs="bluetooth"]').forEach(el => el.classList.toggle('on', OWDOS.bluetooth));
  document.querySelectorAll('[data-qs="dnd"]').forEach(el => el.classList.toggle('on', OWDOS.dnd));
  document.querySelectorAll('[data-qs="darkmode"]').forEach(el => el.classList.toggle('on', OWDOS.darkMode));
}
function setToggle(key, onMsg, offMsg) {
  OWDOS[key] = !OWDOS[key];
  saveSettings();
  applySettings();
  showToast(OWDOS[key] ? onMsg : offMsg);
}
function setDarkMode(on) {
  OWDOS.darkMode = on;
  saveSettings();
  applySettings();
  showToast(on ? 'Dark theme on' : 'Dark theme off');
}

// ── VIRTUAL FILESYSTEM ────────────────────────────────────────────
const VFS_KEY = 'owdos_vfs_v4';
function vfsDefault() {
  return {
    '/': { type:'dir', children:['Downloads','Documents','Pictures','Music','Videos','Linux files','README.txt'] },
    '/Downloads':    { type:'dir', children:[] },
    '/Documents':    { type:'dir', children:[] },
    '/Pictures':     { type:'dir', children:[] },
    '/Music':        { type:'dir', children:[] },
    '/Videos':       { type:'dir', children:[] },
    '/Linux files':  { type:'dir', children:[] },
    '/README.txt':   { type:'file', content:'Welcome to OWDOS.\nYour local OWDOS filesystem lives in this browser.\n' },
  };
}
function vfsLoad() {
  try { const r = localStorage.getItem(VFS_KEY); if (r) return JSON.parse(r); } catch(e) {}
  const d = vfsDefault(); vfsSave(d); return d;
}
function vfsSave(t) { try { localStorage.setItem(VFS_KEY, JSON.stringify(t)); } catch(e) {} }
function vfsJoin(dir, name) { return dir === '/' ? '/' + name : dir + '/' + name; }
function vfsList(dir) {
  const tree = vfsLoad(), node = tree[dir];
  if (!node || node.type !== 'dir') return [];
  return node.children.map(name => {
    const path = vfsJoin(dir, name);
    const child = tree[path] || { type:'file', content:'' };
    return { name, path, type:child.type };
  }).sort((a,b) => a.type===b.type ? a.name.localeCompare(b.name) : a.type==='dir' ? -1 : 1);
}
function vfsMkdir(dir, name) {
  const tree = vfsLoad(), path = vfsJoin(dir, name);
  if (tree[path]) return false;
  tree[path] = { type:'dir', children:[] };
  tree[dir].children.push(name);
  vfsSave(tree); return true;
}
function vfsTouch(dir, name, content='') {
  const tree = vfsLoad(), path = vfsJoin(dir, name);
  if (tree[path]) return false;
  tree[path] = { type:'file', content };
  tree[dir].children.push(name);
  vfsSave(tree); return true;
}
function vfsRead(path) { const t=vfsLoad(),n=t[path]; return n&&n.type==='file'?n.content:null; }
function vfsWrite(path, content) {
  const tree=vfsLoad(); if(!tree[path]||tree[path].type!=='file') return false;
  tree[path].content=content; vfsSave(tree); return true;
}
function vfsDelete(dir, name) {
  const tree=vfsLoad(), path=vfsJoin(dir,name);
  if(!tree[path]) return false;
  if(tree[path].type==='dir') tree[path].children.slice().forEach(c=>vfsDelRaw(tree,path,c));
  delete tree[path];
  tree[dir].children = tree[dir].children.filter(c=>c!==name);
  vfsSave(tree); return true;
}
function vfsDelRaw(tree,dir,name){const p=vfsJoin(dir,name);if(tree[p]&&tree[p].type==='dir')tree[p].children.slice().forEach(c=>vfsDelRaw(tree,p,c));delete tree[p];}
function vfsRename(dir, oldName, newName) {
  const tree=vfsLoad(), op=vfsJoin(dir,oldName), np=vfsJoin(dir,newName);
  if(!tree[op]||tree[np]) return false;
  tree[np]=tree[op]; delete tree[op];
  tree[dir].children = tree[dir].children.map(c=>c===oldName?newName:c);
  vfsSave(tree); return true;
}

// ── CLOCK ─────────────────────────────────────────────────────────
function owdosUpdateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const d = now.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' });
  const tw = document.getElementById('clock-time');
  const dw = document.getElementById('clock-date');
  if (tw) tw.textContent = t;
  if (dw) dw.textContent = d;
  const wc = document.getElementById('win-clock-display');
  if (wc) wc.textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function owdosStartClock() { owdosUpdateClock(); OWDOS.clockTimer = setInterval(owdosUpdateClock, 1000); }

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, duration=2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(OWDOS.toastTimer);
  OWDOS.toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── SHELF BUILD ───────────────────────────────────────────────────
function buildShelf() {
  const container = document.getElementById('shelf-pinned');
  if (!container) return;
  container.innerHTML = '';
  APPS.filter(a => a.pinned).forEach(app => {
    const btn = document.createElement('button');
    btn.className = 'shelf-btn'; btn.id = 'shelf-' + app.id;
    btn.title = app.name; btn.onclick = () => openApp(app.id);
    btn.innerHTML = `<span class="icon" style="font-size:20px">${app.icon}</span>`;
    container.appendChild(btn);
  });
}

function updateShelfRunning() {
  APPS.filter(a => a.pinned).forEach(app => {
    const btn = document.getElementById('shelf-' + app.id);
    if (!btn) return;
    const w = OWDOS.windows[app.id];
    btn.classList.toggle('running', !!w && !w.minimized);
    btn.classList.toggle('active', !!w && !w.minimized && getTopWindowId() === app.id);
  });
}

function getTopWindowId() {
  let topZ = -1, topId = null;
  Object.entries(OWDOS.windows).forEach(([id, w]) => {
    const z = parseInt(w.el.style.zIndex || 0);
    if (!w.minimized && z > topZ) { topZ = z; topId = id; }
  });
  return topId;
}

// ── LAUNCHER ─────────────────────────────────────────────────────
function buildLauncher(filter='') {
  const grid = document.getElementById('launcher-grid');
  if (!grid) return;
  const apps = filter ? APPS.filter(a => a.name.toLowerCase().includes(filter.toLowerCase())) : APPS;
  grid.innerHTML = '';
  apps.forEach(app => {
    const div = document.createElement('div');
    div.className = 'app-tile';
    div.onclick = () => { openApp(app.id); closeLauncher(); };
    div.innerHTML = `<div class="app-tile-icon" style="background:${app.color}22">${app.icon}</div><div class="app-tile-label">${app.name}</div>`;
    grid.appendChild(div);
  });
  if (!apps.length) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.35);padding:48px 0;font-size:14px">No results for "${filter}"</div>`;
}

function toggleLauncher() {
  OWDOS.launcherOpen = !OWDOS.launcherOpen;
  const el = document.getElementById('launcher');
  if (!el) return;
  el.classList.toggle('open', OWDOS.launcherOpen);
  if (OWDOS.launcherOpen) {
    buildLauncher(); closeQuickSettings(); closeNotifCenter();
    setTimeout(() => { const s = document.getElementById('launcher-search'); if(s) s.focus(); }, 320);
  }
}
function closeLauncher() {
  OWDOS.launcherOpen = false;
  const el = document.getElementById('launcher');
  const s = document.getElementById('launcher-search');
  if (el) el.classList.remove('open');
  if (s) { s.value = ''; buildLauncher(); }
}
function filterApps(v) { buildLauncher(v); }
function launcherKeydown(e) {
  if (e.key === 'Escape') { closeLauncher(); return; }
  if (e.key === 'Enter') {
    const v = e.target.value.trim().toLowerCase();
    const match = APPS.find(a => a.name.toLowerCase().startsWith(v) || a.name.toLowerCase().includes(v));
    if (match) { openApp(match.id); closeLauncher(); }
  }
}

// ── QUICK SETTINGS ────────────────────────────────────────────────
function toggleQuickSettings() {
  OWDOS.qsOpen = !OWDOS.qsOpen;
  const el = document.getElementById('quick-settings');
  if (!el) return;
  if (OWDOS.qsOpen) {
    el.style.display = 'block';
    requestAnimationFrame(() => el.classList.add('open'));
    closeLauncher(); closeNotifCenter();
  } else closeQuickSettings();
}
function closeQuickSettings() {
  OWDOS.qsOpen = false;
  const el = document.getElementById('quick-settings');
  if (!el) return;
  el.classList.remove('open');
  setTimeout(() => { if(!OWDOS.qsOpen) el.style.display = 'none'; }, 250);
}

// ── NOTIFICATION CENTER ───────────────────────────────────────────
function toggleNotifCenter() {
  OWDOS.ncOpen = !OWDOS.ncOpen;
  const el = document.getElementById('notif-center');
  if (!el) return;
  el.classList.toggle('open', OWDOS.ncOpen);
  if (OWDOS.ncOpen) { closeQuickSettings(); closeLauncher(); }
}
function closeNotifCenter() { OWDOS.ncOpen = false; const el=document.getElementById('notif-center'); if(el) el.classList.remove('open'); }
function clearNotifications() {
  const list = document.getElementById('notif-list');
  if (list) list.innerHTML = `<div style="padding:48px 16px;text-align:center;color:rgba(255,255,255,0.35);font-size:14px">No notifications</div>`;
  showToast('Notifications cleared');
}

// ── WINDOW MANAGEMENT ─────────────────────────────────────────────
function openApp(id) {
  const w = OWDOS.windows[id];
  if (w) {
    if (w.minimized) { w.minimized = false; w.el.classList.remove('minimized'); }
    focusWindow(id); return;
  }
  createWindow(id);
  updateShelfRunning();
}

function createWindow(id) {
  const app = APPS.find(a => a.id === id) || { id, name:id, icon:'📄', color:'#1a73e8' };
  const el = document.createElement('div');
  el.className = 'window'; el.id = 'win-' + id;

  const offset = Math.min(Object.keys(OWDOS.windows).length * 28, 140);
  const dw = window.innerWidth, dh = window.innerHeight - 48;
  let w = 920, h = 620;
  if (id==='calculator'){ w=344; h=540; }
  if (id==='music')     { w=580; h=460; }
  if (id==='camera')    { w=660; h=490; }
  if (id==='clock')     { w=380; h=340; }
  if (id==='feedback')  { w=480; h=420; }
  if (id==='print')     { w=520; h=540; }
  const left = Math.max(0, Math.min(dw-w, 80+offset));
  const top  = Math.max(0, Math.min(dh-h, 40+offset));

  el.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${++OWDOS.zCounter}`;
  el.innerHTML = `
    <div class="win-titlebar" id="tb-${id}">
      <span class="win-icon">${app.icon}</span>
      <div class="win-title">${app.name}</div>
      <div class="win-btns">
        <button class="win-btn win-min" title="Minimize" onclick="minimizeWindow('${id}')">
          <svg viewBox="0 0 12 12" fill="none"><line x1="2" y1="9.5" x2="10" y2="9.5" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button class="win-btn win-max" title="Maximize" onclick="maximizeWindow('${id}')">
          <svg viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="0.5" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button class="win-btn win-close" title="Close" onclick="closeWindow('${id}')">
          <svg viewBox="0 0 12 12" fill="none"><line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.5"/><line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </div>
    <div class="win-body" id="body-${id}">${buildAppContent(id)}</div>
    <div class="win-resize" onmousedown="startResize(event,'${id}')"></div>`;

  document.getElementById('window-container').appendChild(el);
  OWDOS.windows[id] = { el, minimized:false, maximized:false };
  makeDraggable(el, 'tb-'+id, id);
  el.addEventListener('mousedown', () => focusWindow(id));
  focusWindow(id);

  if (id==='terminal') setTimeout(() => { const inp=document.getElementById('term-input'); if(inp) inp.focus(); }, 50);
  if (id==='files') setTimeout(fmRender, 30);
}

function focusWindow(id) {
  const w = OWDOS.windows[id];
  if (!w) return;
  w.el.style.zIndex = ++OWDOS.zCounter;
  document.querySelectorAll('.window').forEach(el => el.classList.toggle('focused', el.id==='win-'+id));
  updateShelfRunning();
}

function closeWindow(id) {
  const w = OWDOS.windows[id]; if(!w) return;
  w.el.remove(); delete OWDOS.windows[id]; updateShelfRunning();
}
function minimizeWindow(id) {
  const w = OWDOS.windows[id]; if(!w) return;
  w.minimized = true; w.el.classList.add('minimized'); updateShelfRunning();
}
function maximizeWindow(id) {
  const w = OWDOS.windows[id]; if(!w) return;
  const btn = document.querySelector(`#tb-${id} .win-max svg`);
  if (w.maximized) {
    w.el.classList.remove('maximized'); w.maximized = false;
    if (btn) btn.innerHTML = '<rect x="2" y="2" width="8" height="8" rx="0.5" stroke="currentColor" stroke-width="1.3"/>';
  } else {
    w.el.classList.remove('snap-left','snap-right');
    w.el.classList.add('maximized'); w.maximized = true;
    if (btn) btn.innerHTML = '<rect x="3.5" y="1.5" width="6.5" height="6.5" rx="0.5" stroke="currentColor" stroke-width="1.1"/><path d="M2 3.5H1V9a0.5 0.5 0 0 0 .5.5H7V8H2.5V3.5Z" fill="currentColor" stroke="none"/>';
  }
}
function snapWindow(id, side) {
  const w = OWDOS.windows[id]; if(!w) return;
  w.el.classList.remove('maximized','snap-left','snap-right');
  w.el.classList.add('snap-'+side); w.maximized = false;
  showToast('Window snapped ' + side);
}

// ── DRAG & RESIZE ─────────────────────────────────────────────────
function makeDraggable(el, handleId, id) {
  const handle = document.getElementById(handleId);
  if (!handle) return;
  handle.addEventListener('dblclick', e => { if (!e.target.closest('.win-btns')) maximizeWindow(id); });
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.win-btns')) return;
    focusWindow(id);
    const w = OWDOS.windows[id];
    if (w?.maximized) return;
    OWDOS.dragState = { el, id, startX:e.clientX-el.offsetLeft, startY:e.clientY-el.offsetTop };
    e.preventDefault();
  });
}

document.addEventListener('mousemove', e => {
  if (OWDOS.dragState) {
    const { el, startX, startY } = OWDOS.dragState;
    el.style.left = (e.clientX - startX) + 'px';
    el.style.top  = Math.max(0, e.clientY - startY) + 'px';
    el.style.outline = (e.clientX <= 4 || e.clientX >= window.innerWidth-4) ? '2px solid rgba(138,180,248,0.6)' : '';
  }
  if (OWDOS.resizeState) {
    const { el, startX, startY, startW, startH } = OWDOS.resizeState;
    el.style.width  = Math.max(320, startW + (e.clientX-startX)) + 'px';
    el.style.height = Math.max(200, startH + (e.clientY-startY)) + 'px';
  }
});
document.addEventListener('mouseup', e => {
  if (OWDOS.dragState) {
    const { el, id } = OWDOS.dragState;
    el.style.outline = '';
    if (e.clientX <= 4)                         snapWindow(id,'left');
    else if (e.clientX >= window.innerWidth-4)  snapWindow(id,'right');
    OWDOS.dragState = null;
  }
  OWDOS.resizeState = null;
});
function startResize(e, id) {
  e.preventDefault(); e.stopPropagation();
  const w = OWDOS.windows[id]; if(!w||w.maximized) return;
  OWDOS.resizeState = { el:w.el, startX:e.clientX, startY:e.clientY, startW:w.el.offsetWidth, startH:w.el.offsetHeight };
}

// ── OVERVIEW ─────────────────────────────────────────────────────
function toggleOverview() {
  OWDOS.overviewOpen = !OWDOS.overviewOpen;
  const ov = document.getElementById('overview'); if(!ov) return;
  ov.classList.toggle('open', OWDOS.overviewOpen);
  if (OWDOS.overviewOpen) {
    ov.innerHTML = '';
    const openWins = Object.entries(OWDOS.windows).filter(([,w]) => !w.minimized);
    if (!openWins.length) { ov.innerHTML=`<div style="color:rgba(255,255,255,0.4);font-size:15px">No open windows</div>`; return; }
    openWins.forEach(([id,w]) => {
      const app = APPS.find(a=>a.id===id)||{name:id,icon:'📄'};
      const div = document.createElement('div'); div.className = 'ov-thumb';
      div.innerHTML = `<div style="background:var(--surface-3);height:100%;min-height:160px;display:flex;align-items:center;justify-content:center;font-size:52px">${app.icon}</div>
        <div class="ov-thumb-close" onclick="event.stopPropagation();closeWindow('${id}');toggleOverview()">✕</div>
        <div class="ov-thumb-label">${app.icon} ${app.name}</div>`;
      div.onclick = () => { focusWindow(id); OWDOS.overviewOpen=false; ov.classList.remove('open'); };
      ov.appendChild(div);
    });
  }
}

// ── CONTEXT MENU ─────────────────────────────────────────────────
function showCtxMenu(x, y) {
  const m = document.getElementById('ctx-menu'); if(!m) return;
  m.style.display = 'block';
  if (x+m.offsetWidth  > window.innerWidth)  x = window.innerWidth  - m.offsetWidth  - 8;
  if (y+m.offsetHeight > window.innerHeight-48) y = y - m.offsetHeight;
  m.style.left = x+'px'; m.style.top = y+'px';
}
function hideCtxMenu() { const m=document.getElementById('ctx-menu'); if(m) m.style.display='none'; }

// ── APP CONTENT BUILDERS ──────────────────────────────────────────
function buildAppContent(id) {
  switch(id) {
    case 'browser':    return buildBrowser();
    case 'files':      return buildFiles();
    case 'settings':   return buildSettings();
    case 'terminal':   return buildTerminal();
    case 'calculator': return buildCalculator();
    case 'editor':     return buildEditor();
    case 'music':      return buildMusic();
    case 'camera':     return buildCamera();
    case 'calendar':   return buildCalendar();
    case 'wallpaper':  return buildWallpaperPicker();
    case 'clock':      return buildClockApp();
    case 'feedback':   return buildFeedback();
    case 'help':       return buildHelp();
    case 'print':      return buildPrint();
    default:           return buildGenericApp(id);
  }
}

// ── BROWSER ───────────────────────────────────────────────────────
function buildBrowser() {
  return `<div style="display:flex;flex-direction:column;height:100%;background:#fff">
    <div class="ow-browser-tabs"><div class="ow-tab active">New tab</div><button class="ow-tab-add">+</button></div>
    <div class="ow-browser-toolbar">
      <button class="fm-tb-btn" onclick="browserBack()" aria-label="Back">‹</button><button class="fm-tb-btn" onclick="browserForward()" aria-label="Forward">›</button><button class="fm-tb-btn" onclick="browserReload()" aria-label="Reload">↻</button>
      <input id="browser-url" class="ow-browser-url" value="ow://newtab" onkeydown="browserGo(event,this)" onfocus="this.select()" placeholder="Search or enter a URL">
      <button class="fm-tb-btn" onclick="browserOpenExternal()" aria-label="Open externally">↗</button>
    </div>
    <div id="browser-frame" class="ow-browser-frame">
      <div class="ow-browser-home"><div class="ow-browser-mark"><span>OW</span></div><h2>OW Browser</h2><p>Search the web or enter a URL.</p><div class="ow-searchbox" onclick="document.getElementById('browser-url').focus()"><span>Search the web</span></div><div class="ow-browser-links"><button onclick="browserNavigate('https://www.google.com')">Google</button><button onclick="browserNavigate('https://www.wikipedia.org')">Wikipedia</button><button onclick="browserNavigate('https://github.com')">GitHub</button><button onclick="browserNavigate('https://example.com')">Example</button></div></div>
    </div>
  </div>`;
}
let owBrowserUrl='';
function browserNavigate(url){
  const input=document.getElementById('browser-url'); if(!input)return;
  if(url==='')return; if(!/^https?:\/\//i.test(url)) url=/^[^ .]+\.[^ .]+$/.test(url)?'https://'+url:'https://www.google.com/search?q='+encodeURIComponent(url);
  owBrowserUrl=url; input.value=url;
  const frame=document.getElementById('browser-frame'); frame.innerHTML='<iframe class="ow-browser-iframe" src="'+url.replace(/"/g,'&quot;')+'" referrerpolicy="no-referrer"></iframe><button class="ow-browser-fallback" onclick="browserReader()">Reader mode</button>';
}
function browserGo(e,input){if(e.key==='Enter')browserNavigate(input.value.trim());}
function browserBack(){try{history.back()}catch{}} function browserForward(){try{history.forward()}catch{}} function browserReload(){const f=document.querySelector('.ow-browser-iframe');if(f)f.src=f.src}
function browserOpenExternal(){if(owBrowserUrl)window.open(owBrowserUrl,'_blank','noopener');}
function browserReader(){if(!owBrowserUrl)return;window.open('https://r.jina.ai/'+owBrowserUrl,'_blank','noopener');}

function buildFiles() {
  return `
  <div style="display:flex;height:100%;position:relative">
    <div class="fm-sidebar">
      <div class="fm-sidebar-section-lbl">My Files</div>
      <div class="fm-sidebar-item active" id="fm-side-root" onclick="fmGoto('/')">📂 My Files</div>
      <div class="fm-sidebar-item" onclick="fmGoto('/Downloads')">⬇️ Downloads</div>
      <div class="fm-sidebar-item" onclick="fmGoto('/Documents')">📄 Documents</div>
      <div class="fm-sidebar-item" onclick="fmGoto('/Pictures')">🖼️ Pictures</div>
      <div class="fm-sidebar-item" onclick="fmGoto('/Music')">🎵 Music</div>
      <div class="fm-sidebar-section-lbl" style="margin-top:8px">Cloud files</div>
      ${[['💾','My Drive'],['👥','Shared'],['⏱️','Recent'],['🗑️','Trash']].map(([i,l])=>`<div class="fm-sidebar-item" onclick="showToast('${l} (not available offline)')">${i} ${l}</div>`).join('')}
      <div class="fm-sidebar-section-lbl" style="margin-top:8px">Devices</div>
      <div class="fm-sidebar-item" onclick="showToast('No removable storage connected')">💿 Removable</div>
    </div>
    <div style="display:flex;flex-direction:column;flex:1;min-width:0">
      <div class="fm-toolbar">
        <button class="fm-tb-btn" title="Back" onclick="fmUp()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="fm-breadcrumb" id="fm-breadcrumb"></div>
        <button class="fm-tb-btn" title="New folder" onclick="fmNewFolder()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></button>
        <button class="fm-tb-btn" title="New file" onclick="fmNewFile()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></button>
        <button class="fm-tb-btn" title="Rename" onclick="fmRename()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="fm-tb-btn" title="Delete" onclick="fmDelete()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
      <div style="flex:1;overflow:auto"><div class="fm-grid" id="fm-grid"></div></div>
      <div style="padding:6px 14px;font-size:11.5px;color:var(--text-hint);border-top:1px solid var(--border);background:var(--surface-2)" id="fm-status"></div>
    </div>
    <div id="fm-editor-overlay" style="display:none;position:absolute;inset:0;background:var(--surface);z-index:5;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
        <strong id="fm-editor-name" style="font-size:13px;color:var(--text-primary)"></strong>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="goog-btn goog-btn-primary" onclick="fmEditorSave()">Save</button>
          <button class="goog-btn" onclick="fmEditorClose()">Close</button>
        </div>
      </div>
      <textarea id="fm-editor-text" style="flex:1;border:none;outline:none;padding:16px;font-family:var(--font-mono);font-size:13px;resize:none;background:var(--surface);color:var(--text-primary)"></textarea>
    </div>
  </div>`;
}
function fmRender() {
  const entries = vfsList(FM.cwd);
  const grid = document.getElementById('fm-grid'); if(!grid) return;
  grid.innerHTML = entries.map(f=>`
    <div class="fm-item ${FM.selected===f.name?'selected':''}" data-name="${f.name}"
      onclick="fmSelect(this,'${f.name.replace(/'/g,"&#39;")}')"
      ondblclick="fmOpen('${f.name.replace(/'/g,"&#39;")}','${f.type}')">
      <div class="fm-item-ico">${fmIcon(f)}</div>
      <div class="fm-item-name">${f.name}</div>
    </div>`).join('') || `<div style="padding:24px;color:var(--text-hint);font-size:13px">This folder is empty</div>`;
  const crumbs = FM.cwd==='/' ? ['My Files'] : ['My Files',...FM.cwd.split('/').filter(Boolean)];
  const bc = document.getElementById('fm-breadcrumb');
  if(bc) bc.innerHTML = crumbs.map((c,i)=>{
    const p = i===0?'/':(i===1?'/'+crumbs[1]:'/'+crumbs.slice(1,i+1).join('/'));
    return `<span onclick="fmGoto('${p}')" style="cursor:pointer">${c}</span>`;
  }).join(' <span style="color:var(--text-hint)">›</span> ');
  const st = document.getElementById('fm-status');
  if(st) st.textContent = `${entries.length} item${entries.length===1?'':'s'}`;
  document.querySelectorAll('.fm-sidebar-item').forEach(x=>x.classList.remove('active'));
  const ri = document.getElementById('fm-side-root'); if(FM.cwd==='/'&&ri) ri.classList.add('active');
}
function fmSelect(el,name){ FM.selected=name; document.querySelectorAll('.fm-item').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); }
function fmOpen(name,type){
  const path=vfsJoin(FM.cwd,name);
  if(type==='dir'){fmGoto(path);return;}
  const content=vfsRead(path);
  if(content===null){showToast('Cannot open '+name);return;}
  const ov=document.getElementById('fm-editor-overlay');
  document.getElementById('fm-editor-name').textContent=name;
  document.getElementById('fm-editor-text').value=content;
  ov.dataset.path=path; ov.style.display='flex';
}
function fmEditorSave(){const ov=document.getElementById('fm-editor-overlay');vfsWrite(ov.dataset.path,document.getElementById('fm-editor-text').value);showToast('Saved');}
function fmEditorClose(){document.getElementById('fm-editor-overlay').style.display='none';}
function fmGoto(path){FM.cwd=path;FM.selected=null;fmRender();}
function fmUp(){if(FM.cwd==='/') return;const p=FM.cwd.split('/').filter(Boolean);p.pop();fmGoto(p.length?'/'+p.join('/'):'/');}
function fmNewFolder(){const n=prompt('Folder name:','New folder');if(!n)return;if(!vfsMkdir(FM.cwd,n)){showToast('Name already exists');return;}fmRender();}
function fmNewFile(){const n=prompt('File name:','Untitled.txt');if(!n)return;if(!vfsTouch(FM.cwd,n,'')){showToast('Name already exists');return;}fmRender();}
function fmRename(){if(!FM.selected){showToast('Select something first');return;}const n=prompt('Rename to:',FM.selected);if(!n||n===FM.selected)return;if(!vfsRename(FM.cwd,FM.selected,n)){showToast('Rename failed');return;}FM.selected=n;fmRender();}
function fmDelete(){if(!FM.selected){showToast('Select something first');return;}if(!confirm(`Delete "${FM.selected}"?`))return;vfsDelete(FM.cwd,FM.selected);FM.selected=null;fmRender();}

// ── SETTINGS ─────────────────────────────────────────────────────
function buildSettings() {
  const navItems = [
    ['Network','<path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M10.54 16.1a6 6 0 0 1 2.92 0M12 20h.01"/>'],
    ['Bluetooth','<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>'],
    ['Connected devices','<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'],
    ['Accounts','<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
    ['Device','<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'],
    ['Personalization','<circle cx="12" cy="12" r="3"/><path d="M20.18 8A8 8 0 0 0 12 4a8 8 0 0 0-8 8 8 8 0 0 0 4.76 7.26"/>'],
    ['Search & Assistant','<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'],
    ['Security & Privacy','<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
    ['Apps','<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'],
    ['Accessibility','<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'],
    ['About OWDOS','<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'],
  ];
  return `
  <div style="display:flex;height:100%">
    <div class="settings-sidebar">
      ${navItems.map(([n,p],i)=>`
      <div class="settings-nav-item ${i===0?'active':''}" onclick="loadSettingsPanel('${n}',this)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>${n}
      </div>`).join('')}
    </div>
    <div style="flex:1;overflow:auto" id="settings-main">
      <div class="settings-content" id="settings-panel">${buildNetworkPanel()}</div>
    </div>
  </div>`;
}
function loadSettingsPanel(name, navEl) {
  document.querySelectorAll('.settings-nav-item').forEach(x=>x.classList.remove('active'));
  navEl.classList.add('active');
  const panel = document.getElementById('settings-panel'); if(!panel) return;
  const builders = { 'Network':buildNetworkPanel,'Security & Privacy':buildSecurityPanel,'About OWDOS':buildAboutPanel,'Personalization':buildPersonalizationPanel };
  panel.innerHTML = (builders[name]||(() => buildGenericSettingsPanel(name)))();
}
function buildNetworkPanel() {
  const wifiOn = OWDOS.wifi;
  return `
  <h2 class="settings-h1">Network</h2>
  <div class="settings-section-lbl">Wi-Fi</div>
  <div class="settings-card">
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Wi-Fi</div><div class="settings-row-desc">${wifiOn?'Connected to OWDOS Wi-Fi':'Off'}</div></div>
      <button class="cros-toggle ${wifiOn?'on':''}" data-qs="wifi" onclick="setToggle('wifi','Wi-Fi on','Wi-Fi off');this.classList.toggle('on',OWDOS.wifi);this.closest('.settings-row').querySelector('.settings-row-desc').textContent=OWDOS.wifi?'Connected to OWDOS Wi-Fi':'Off'"></button>
    </div>
    ${[['OWDOS Wi-Fi','●●●●○'],['OW BrowserBook-Home','●●●●●'],['Xfinity WiFi','●●○○○']].map(([n,s])=>`
    <div class="settings-row" style="cursor:pointer" onclick="showToast('Connecting to ${n}...')">
      <div class="settings-row-info"><div class="settings-row-label">${n}</div><div class="settings-row-desc">${n==='OWDOS Wi-Fi'?'Connected · ':''}Secured · ${s}</div></div>
      ${n==='OWDOS Wi-Fi'?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>':''}
    </div>`).join('')}
  </div>`;
}
function buildSecurityPanel() {
  return `
  <h2 class="settings-h1">Security & Privacy</h2>
  <div class="settings-card">
    ${[['Lock screen & sign-in','Require password after sleep',true],['Safe Browsing','Help protect you from dangerous sites',true],['Verified Boot','This OWDOS device has been verified',true]].map(([l,d,s])=>`
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">${l}</div><div class="settings-row-desc">${d}</div></div>
      <button class="cros-toggle ${s?'on':''}" onclick="this.classList.toggle('on')"></button>
    </div>`).join('')}
  </div>
  <div class="settings-section-lbl" style="margin-top:16px">Developer options</div>
  <div class="settings-card">
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Developer mode</div><div class="settings-row-desc">Allows booting from USB. Enabling will Powerwash your device.</div></div>
      <button class="cros-toggle" onclick="this.classList.toggle('on');showToast('Restart required to enable developer mode')"></button>
    </div>
    <div class="settings-row" style="cursor:pointer" onclick="triggerPowerwash()">
      <div class="settings-row-info"><div class="settings-row-label" style="color:#d93025">Powerwash</div><div class="settings-row-desc">Reset this OWDOS device to factory settings</div></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  </div>`;
}
function buildAboutPanel() {
  return `
  <h2 class="settings-h1">About OWDOS</h2>
  <div class="settings-card" style="margin-bottom:16px">
    <div class="settings-row">
      <div style="width:56px;height:56px;flex-shrink:0">
        <svg viewBox="0 0 100 100" width="56" height="56"><circle cx="50" cy="50" r="50" fill="#4285f4"/><circle cx="50" cy="50" r="22" fill="#fff"/><path d="M50 0 A50 50 0 0 1 93.3 25 L72 37 A28 28 0 0 0 50 22Z" fill="#ea4335"/><path d="M93.3 25 A50 50 0 0 1 93.3 75 L72 63 A28 28 0 0 0 72 37Z" fill="#fbbc05"/><path d="M93.3 75 A50 50 0 0 1 6.7 75 L28 63 A28 28 0 0 0 72 63Z" fill="#34a853"/></svg>
      </div>
      <div class="settings-row-info">
        <div class="settings-row-label">OWDOS</div>
        <div class="settings-row-desc">Version 134.0.6998.170 (Official Build) (64-bit)</div>
        <div class="settings-row-desc" style="margin-top:2px">Platform 15917.88.0 (Official Build) beta-channel hatch</div>
      </div>
    </div>
    <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Firmware version</div><div class="settings-row-desc">OWDOS-FW.1.0.0</div></div></div>
  </div>
  <button class="goog-btn goog-btn-secondary" onclick="showToast('Checking for updates...')">Check for updates</button>`;
}
function buildPersonalizationPanel() {
  return `
  <h2 class="settings-h1">Personalization</h2>
  <div class="settings-section-lbl">Wallpaper</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
    ${WALLPAPERS.map((wp,i)=>`
    <div onclick="setWallpaper('${wp.value}',this)" title="${wp.label}"
      style="aspect-ratio:16/10;border-radius:8px;background:${wp.value};cursor:pointer;border:2px solid transparent;transition:border-color 0.15s;position:relative"
      onmouseover="this.style.borderColor='rgba(26,115,232,0.5)'" onmouseout="this.style.borderColor=''">
      <div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:10px;color:rgba(255,255,255,0.8)">${wp.label}</div>
    </div>`).join('')}
  </div>
  <div class="settings-section-lbl">Appearance</div>
  <div class="settings-card">
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Dark theme</div><div class="settings-row-desc">Use dark colours for system UI</div></div>
      <button class="cros-toggle ${OWDOS.darkMode?'on':''}" data-qs="darkmode" onclick="setDarkMode(!OWDOS.darkMode);this.classList.toggle('on',OWDOS.darkMode)"></button>
    </div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Shelf position</div><div class="settings-row-desc">Bottom (default)</div></div>
      <select style="border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;font-family:var(--font-ui)"><option selected>Bottom</option><option>Left</option><option>Right</option></select>
    </div>
  </div>`;
}
function buildGenericSettingsPanel(name) {
  return `<h2 class="settings-h1">${name}</h2><div class="settings-card">${[1,2,3].map(i=>`
  <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">${name} setting ${i}</div><div class="settings-row-desc">Configure ${name.toLowerCase()} option ${i}</div></div>
  <button class="cros-toggle ${i===1?'on':''}" onclick="this.classList.toggle('on')"></button></div>`).join('')}</div>`;
}

// ── TERMINAL ─────────────────────────────────────────────────────
let TERM_CWD = '/';
function termResolve(p) {
  if(!p||p==='.'||p==='~') return TERM_CWD;
  if(p==='..'){const parts=TERM_CWD.split('/').filter(Boolean);parts.pop();return parts.length?'/'+parts.join('/'):'/';}
  if(p.startsWith('/')) return p==='/'?'/':p.replace(/\/$/,'');
  return vfsJoin(TERM_CWD,p).replace(/\/$/,'')||'/';
}
let bashState={process:null,sandbox:null,wasmer:null,fit:null,term:null};
function buildTerminal(){return `<div class="ow-terminal-wrap"><div id="ow-terminal" class="ow-terminal"></div></div>`;}
async function ensureTerminal(){
 const host=document.getElementById('ow-terminal'); if(!host||bashState.term)return;
 const [{Terminal},{FitAddon}]=await Promise.all([import('https://esm.sh/@xterm/xterm@6.0.0'),import('https://esm.sh/@xterm/addon-fit@0.11.0')]);
 const term=new Terminal({cursorBlink:true,convertEol:true,scrollback:5000,theme:{background:'#0b0d10',foreground:'#e8ebef',cursor:'#9aa7ff',selectionBackground:'#313847'},fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',fontSize:13});
 const fit=new FitAddon();term.loadAddon(fit);term.open(host);fit.fit();bashState={...bashState,term,fit};
 if(!crossOriginIsolated){term.writeln('OWDOS: Bash requires cross-origin isolation. Reload after the service worker finishes installing.');return;}
 try{
   term.writeln('\x1b[1;36mOWDOS\x1b[0m starting Bash…');
   const {Wasmer}=await import('https://esm.sh/@wasmer/sdk@0.19.1/browser');
   const wasmer=new Wasmer();const username=(localStorage.getItem('owdos_username')||'user').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,24)||'user';
   const files={};const raw=localStorage.getItem('owdos_vfs_v4');if(raw){try{const tree=JSON.parse(raw);for(const [path,node] of Object.entries(tree)){if(node.type==='file')files[path.replace(/^\//,'')]=node.content||'';}}catch{}}
   const sandbox=await wasmer.sandboxes.create({packages:['wasmer/bash@=1.0.25'],files});
   const proc=await sandbox.command('bash',['--noprofile','--norc','-i']).spawn({terminal:{columns:term.cols,rows:term.rows}});
   bashState={...bashState,process:proc,sandbox,wasmer};
   const quote=v=>`'${String(v).replace(/'/g,`'"'"'`)}'`;
   await proc.stdin.write(`export USER=${quote(username)} LOGNAME=${quote(username)} HOME=/home/${quote(username)} PS1='\\[\\e[1;36m\\]${username}@owdos\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]$ '\ncd "$HOME"\n`);
   const pump=async stream=>{if(!stream)return;try{if(typeof stream[Symbol.asyncIterator]==='function'){for await(const chunk of stream)term.write(chunk instanceof Uint8Array?chunk:String(chunk));return;}if(typeof stream.getReader==='function'){const r=stream.getReader(),d=new TextDecoder();while(true){const x=await r.read();if(x.done)break;term.write(typeof x.value==='string'?x.value:d.decode(x.value,{stream:true}));}}}catch{}};
   pump(proc.stdout);pump(proc.stderr);
   term.onData(async data=>{try{await proc.stdin.write(data)}catch{term.writeln('\r\nOWDOS: Bash session closed.')}});
   term.onResize(({cols,rows})=>{try{proc.resizeTerminal(cols,rows)}catch{}});
   proc.wait().finally(async()=>{bashState.process=null;try{await sandbox.close()}catch{}try{await wasmer.close()}catch{} });
 }catch(err){term.writeln(`\r\nOWDOS: ${err?.message||err}`)}
}
function buildCalculator() {
  return `
  <div style="background:#f8f9fa;flex:1;display:flex;flex-direction:column;padding:14px;gap:10px">
    <div style="background:#fff;border-radius:10px;border:1px solid var(--border);padding:14px 16px;text-align:right">
      <div id="calc-expr" style="font-size:13px;color:var(--text-secondary);min-height:18px;word-break:break-all"></div>
      <div id="calc-result" style="font-size:38px;font-weight:300;color:var(--text-primary);word-break:break-all">0</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;flex:1">
      ${[['AC','fn'],['±','fn'],['%','fn'],['÷','op'],['7','num'],['8','num'],['9','num'],['×','op'],['4','num'],['5','num'],['6','num'],['−','op'],['1','num'],['2','num'],['3','num'],['+','op'],['0','num',true],['.','num'],['=','eq']].map(([v,c,wide])=>`
      <button onclick="calcInput('${v}')" style="border:none;border-radius:10px;font-size:18px;font-weight:500;cursor:pointer;transition:filter 0.1s;background:${c==='op'?'#e8f0fe':c==='eq'?'#1a73e8':c==='fn'?'#f1f3f4':'#fff'};color:${c==='op'?'#1a73e8':c==='eq'?'#fff':'var(--text-primary)'};border:1px solid ${c==='num'||c==='fn'?'var(--border)':'transparent'};${wide?'grid-column:span 2;':''}min-height:56px;" onmouseover="this.style.filter='brightness(0.93)'" onmouseout="this.style.filter=''">${v}</button>`).join('')}
    </div>
  </div>`;
}
let calcExpr='',calcOperand='',calcOp='',calcResult='0',calcNewNum=true;
function calcInput(v) {
  const expr=document.getElementById('calc-expr'),res=document.getElementById('calc-result');
  if(!expr||!res) return;
  if(v==='AC'){calcExpr='';calcOperand='';calcOp='';calcResult='0';calcNewNum=true;}
  else if(v==='±'){calcResult=String(-parseFloat(calcResult)||0);}
  else if(v==='%'){calcResult=String(parseFloat(calcResult)/100);}
  else if(['÷','×','−','+'].includes(v)){calcOperand=calcResult;calcOp=v;calcNewNum=true;expr.textContent=calcResult+' '+v;return;}
  else if(v==='='){
    const a=parseFloat(calcOperand),b=parseFloat(calcResult);
    let r=b;if(calcOp==='÷')r=a/b;else if(calcOp==='×')r=a*b;else if(calcOp==='−')r=a-b;else if(calcOp==='+')r=a+b;
    expr.textContent=`${calcOperand} ${calcOp} ${calcResult} =`;
    calcResult=String(parseFloat(r.toFixed(12)));calcOp='';calcNewNum=true;
  } else if(v==='.'){if(calcNewNum){calcResult='0.';calcNewNum=false;}else if(!calcResult.includes('.'))calcResult+='.';}
  else{if(calcNewNum){calcResult=v;calcNewNum=false;}else{calcResult=calcResult==='0'?v:calcResult+v;}}
  res.textContent=calcResult;
}

// ── EDITOR ───────────────────────────────────────────────────────
function buildEditor() {
  return `
  <div style="background:var(--surface-2);padding:6px 10px;display:flex;align-items:center;gap:3px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
    ${[['B','bold','font-weight:700'],['I','italic','font-style:italic'],['U','underline','text-decoration:underline']].map(([l,c,s])=>`<button onclick="document.execCommand('${c}')" style="padding:4px 8px;border:none;border-radius:4px;background:transparent;${s};cursor:pointer;font-size:13px;color:var(--text-secondary)" onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background='transparent'">${l}</button>`).join('')}
    <div style="width:1px;height:18px;background:var(--border);margin:0 4px"></div>
    <select onchange="document.execCommand('fontName',false,this.value)" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"><option>sans-serif</option><option>serif</option><option>monospace</option></select>
    <select onchange="document.execCommand('fontSize',false,this.value)" style="padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"><option value="2">Small</option><option value="3" selected>Normal</option><option value="5">Large</option><option value="7">Huge</option></select>
    <button onclick="showToast('Saved!')" style="margin-left:auto;padding:5px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer">Save</button>
  </div>
  <div contenteditable="true" style="flex:1;outline:none;padding:32px 48px;font-size:15px;font-family:var(--font-ui);color:var(--text-primary);line-height:1.8;background:var(--surface);overflow:auto"><p>Start typing here...</p></div>`;
}

// ── MUSIC ────────────────────────────────────────────────────────
function buildMusic() {
  const tracks=[{title:'Midnight City',artist:'M83',dur:'4:03',emoji:'🌃'},{title:'Redbone',artist:'Childish Gambino',dur:'5:27',emoji:'🎸'},{title:'The Less I Know',artist:'Tame Impala',dur:'3:37',emoji:'🌀'},{title:'HUMBLE.',artist:'Kendrick Lamar',dur:'2:57',emoji:'👑'}];
  return `
  <div style="display:flex;height:100%">
    <div style="width:200px;flex-shrink:0;background:#1a0533;border-right:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;overflow-y:auto">
      ${tracks.map((t,i)=>`
      <div onclick="document.getElementById('music-title').textContent='${t.title}';document.getElementById('music-artist').textContent='${t.artist}';document.getElementById('album-art-emoji').textContent='${t.emoji}';showToast('Now playing: ${t.title}')"
        style="padding:12px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.12s;${i===0?'background:rgba(255,255,255,0.1)':''}"
        onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='${i===0?'rgba(255,255,255,0.1)':''}'">
        <div style="font-size:13px;color:#fff;font-weight:500">${t.title}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">${t.artist} · ${t.dur}</div>
      </div>`).join('')}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:24px 20px;gap:14px;background:linear-gradient(180deg,#1a0533 0%,#0d001f 100%);color:#fff">
      <div id="album-art-emoji" style="width:152px;height:152px;border-radius:12px;background:linear-gradient(135deg,#6c63ff,#e96c6c);display:flex;align-items:center;justify-content:center;font-size:64px;box-shadow:0 12px 40px rgba(0,0,0,0.5)">🌃</div>
      <div style="text-align:center"><div id="music-title" style="font-size:18px;font-weight:600">Midnight City</div><div id="music-artist" style="font-size:13px;opacity:0.65;margin-top:3px">M83</div></div>
      <div style="width:100%">
        <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:2px;cursor:pointer" onclick="const p=event.offsetX/this.offsetWidth*100;document.getElementById('music-fill').style.width=p+'%'">
          <div id="music-fill" style="height:100%;width:35%;background:#fff;border-radius:2px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.5;margin-top:4px"><span>1:24</span><span>4:03</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <button onclick="showToast('Shuffle')" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;font-size:16px">🔀</button>
        <button onclick="showToast('Previous')" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;cursor:pointer;font-size:18px">⏮</button>
        <button id="music-play" onclick="OWDOS.musicPlaying=!OWDOS.musicPlaying;this.textContent=OWDOS.musicPlaying?'⏸':'▶'" style="width:52px;height:52px;border-radius:50%;background:#fff;border:none;color:#1a0533;cursor:pointer;font-size:22px;box-shadow:0 4px 16px rgba(0,0,0,0.4)">▶</button>
        <button onclick="showToast('Next')" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;cursor:pointer;font-size:18px">⏭</button>
        <button onclick="showToast('Repeat')" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;font-size:16px">🔁</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;width:100%"><span>🔈</span><input type="range" min="0" max="100" value="70" style="flex:1;accent-color:#fff"><span>🔊</span></div>
    </div>
  </div>`;
}

// ── CAMERA ───────────────────────────────────────────────────────
function buildCamera() {
  return `
  <div style="display:flex;flex-direction:column;height:100%;background:#000">
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;background:#111;overflow:hidden">
      <div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;pointer-events:none">${Array(9).fill('<div style="border:0.5px solid rgba(255,255,255,0.12)"></div>').join('')}</div>
      <div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;background:rgba(0,0,0,0.5);border-radius:20px;overflow:hidden">
        ${['Video','Photo','Portrait','Scan'].map((m,i)=>`<div style="padding:7px 16px;font-size:12px;color:${i===1?'#fff':'rgba(255,255,255,0.6)'};cursor:pointer;border-bottom:${i===1?'2px solid #fff':'2px solid transparent'}" onclick="showToast('${m} mode')">${m}</div>`).join('')}
      </div>
      <span style="color:rgba(255,255,255,0.25);font-size:13px">Camera not available in browser</span>
    </div>
    <div style="background:#111;padding:14px 28px;display:flex;align-items:center;gap:24px;flex-shrink:0">
      <button onclick="showToast('Gallery')" style="width:46px;height:46px;border-radius:10px;background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:20px;cursor:pointer">🖼️</button>
      <button onclick="showToast('📷 Photo taken!')" style="width:66px;height:66px;border-radius:50%;background:#fff;border:4px solid rgba(255,255,255,0.3);cursor:pointer;margin:auto;display:block;transition:transform 0.1s" onmousedown="this.style.transform='scale(0.93)'" onmouseup="this.style.transform=''"></button>
      <button onclick="showToast('Camera flipped')" style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:20px;cursor:pointer">🔄</button>
    </div>
  </div>`;
}

// ── CALENDAR ─────────────────────────────────────────────────────
function buildCalendar() {
  const now=new Date(),m=now.getMonth(),y=now.getFullYear();
  const mNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dNames=['S','M','T','W','T','F','S'];
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  let cells=dNames.map(d=>`<div style="font-size:10px;color:var(--text-hint);text-align:center;font-weight:600;padding:4px 0">${d}</div>`).join('');
  for(let i=0;i<first;i++) cells+='<div></div>';
  for(let d=1;d<=days;d++){const t=d===now.getDate();cells+=`<div onclick="showToast('${mNames[m]} ${d}')" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:12.5px;margin:1px auto;background:${t?'var(--accent)':''};color:${t?'#fff':'var(--text-primary)'};font-weight:${t?'600':'400'};transition:background 0.1s" onmouseover="if(!${t})this.style.background='var(--surface-3)'" onmouseout="if(!${t})this.style.background=''">${d}</div>`;}
  return `
  <div style="display:flex;height:100%">
    <div style="width:244px;flex-shrink:0;border-right:1px solid var(--border);padding:16px;background:var(--surface-2);display:flex;flex-direction:column;gap:14px">
      <button class="goog-btn goog-btn-primary" style="border-radius:24px;height:40px" onclick="showToast('Create event')">+ Create</button>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:8px">${mNames[m]} ${y}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0">${cells}</div>
      </div>
      <div>
        <div style="font-size:10.5px;font-weight:600;color:var(--text-hint);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px">My Calendars</div>
        ${[['#4285f4','Personal'],['#34a853','Work'],['#e91e63','Birthdays'],['#fbbc04','Reminders']].map(([c,n])=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--text-primary)"><div style="width:12px;height:12px;border-radius:3px;background:${c};flex-shrink:0"></div>${n}</div>`).join('')}
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column">
      <div style="padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">
        <button class="goog-btn goog-btn-secondary" style="height:32px;font-size:13px" onclick="showToast('Today')">Today</button>
        <button style="width:28px;height:28px;border:1px solid var(--border);border-radius:50%;background:var(--surface);cursor:pointer;font-size:14px" onclick="showToast('Previous')">‹</button>
        <button style="width:28px;height:28px;border:1px solid var(--border);border-radius:50%;background:var(--surface);cursor:pointer;font-size:14px" onclick="showToast('Next')">›</button>
        <span style="font-size:20px;font-weight:400;color:var(--text-primary)">${mNames[m]} ${y}</span>
        <div style="margin-left:auto;display:flex">${['Day','Week','Month','Year'].map((v,i)=>`<button onclick="showToast('${v} view')" style="padding:6px 12px;border:1px solid var(--border);${i>0?'border-left:none':''};border-radius:${i===0?'4px 0 0 4px':i===3?'0 4px 4px 0':'0'};background:${i===2?'var(--surface-3)':'var(--surface)'};font-size:13px;cursor:pointer;font-family:var(--font-ui)">${v}</button>`).join('')}</div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--text-secondary)"><span style="font-size:48px">📅</span><span style="font-size:15px">No events this month</span></div>
    </div>
  </div>`;
}

// ── WALLPAPER PICKER ────────────────────────────────────────────
function buildWallpaperPicker() {
  return `
  <div style="padding:20px">
    <div style="font-size:16px;font-weight:500;color:var(--text-primary);margin-bottom:16px">Choose a wallpaper</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${WALLPAPERS.map((wp,i)=>`<div onclick="setWallpaper('${wp.value}',this)" title="${wp.label}" style="aspect-ratio:16/10;border-radius:8px;background:${wp.value};cursor:pointer;border:2px solid transparent;transition:border-color 0.15s;position:relative" onmouseover="this.style.borderColor='rgba(26,115,232,0.5)'" onmouseout="this.style.borderColor=''"><div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:10px;color:rgba(255,255,255,0.8)">${wp.label}</div></div>`).join('')}
    </div>
    <div style="font-size:14px;font-weight:500;color:var(--text-primary);margin-bottom:12px">Custom color</div>
    <div style="display:flex;gap:10px;align-items:center">
      <input type="color" id="wp-color-pick" value="#1a73e8" style="width:44px;height:44px;border:none;border-radius:8px;cursor:pointer;padding:2px">
      <button onclick="const c=document.getElementById('wp-color-pick').value;setWallpaper(c,null)" class="goog-btn goog-btn-primary">Apply color</button>
    </div>
  </div>`;
}
function setWallpaper(value, el) {
  document.getElementById('desktop').style.background = value;
  document.querySelectorAll('[onclick*="setWallpaper"]').forEach(x=>{x.style.borderColor='transparent';x.style.borderWidth='2px';});
  if(el){el.style.borderColor='var(--accent)';el.style.borderWidth='3px';}
  OWDOS.wallpaper = value; saveSettings(); showToast('Wallpaper updated');
}

// ── CLOCK APP ────────────────────────────────────────────────────
function buildClockApp() {
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;background:linear-gradient(135deg,#1a2a4a,#0d1b2a)">
    <div id="win-clock-display" style="font-size:72px;font-weight:300;color:#fff;letter-spacing:-2px;line-height:1"></div>
    <div id="win-clock-date-lbl" style="font-size:17px;color:rgba(255,255,255,0.65)"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      ${['World','Timer','Stopwatch','Alarm'].map((t,i)=>`<button onclick="showToast('${t}')" style="padding:9px 18px;border:1px solid rgba(255,255,255,0.2);border-radius:22px;background:${i===0?'rgba(138,180,248,0.2)':'transparent'};color:${i===0?'#8ab4f8':'rgba(255,255,255,0.6)'};font-size:13px;cursor:pointer;font-family:var(--font-ui)">${t}</button>`).join('')}
    </div>
  </div>`;
}

// ── FEEDBACK ────────────────────────────────────────────────────
function buildHelp() { return `<div style="padding:26px;height:100%;overflow:auto;background:var(--surface);color:var(--text-primary)"><div class="settings-h1">OWDOS Help</div><p style="color:var(--text-secondary);line-height:1.7">OWDOS is a browser-native operating system with a local filesystem, real Bash runtime, device recovery tools, guest sessions, and a community app system.</p><div class="settings-card"><div class="section-title">Keyboard</div><div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Launcher</div><div class="settings-row-desc">Alt + Shift + L</div></div></div><div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Overview</div><div class="settings-row-desc">F5</div></div></div><div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Recovery</div><div class="settings-row-desc">Hold 1 + 4 + =</div></div></div></div></div>`; }

function buildFeedback() {
  return `
  <div style="padding:28px 32px;display:flex;flex-direction:column;gap:16px">
    <div style="font-size:20px;font-weight:400;color:var(--text-primary)">Send feedback to OWDOS</div>
    <div style="font-size:13px;color:var(--text-secondary)">Your feedback helps improve OWDOS for everyone.</div>
    <textarea placeholder="Describe your feedback..." style="width:100%;height:120px;border:1px solid var(--border);border-radius:8px;padding:12px;font-size:14px;font-family:var(--font-ui);color:var(--text-primary);resize:vertical;outline:none"></textarea>
    <div style="display:flex;gap:10px"><label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" checked> Include system info</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox"> Include screenshot</label></div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="goog-btn goog-btn-text" onclick="closeWindow('feedback')">Cancel</button>
      <button class="goog-btn goog-btn-primary" onclick="showToast('Feedback sent. Thank you!');closeWindow('feedback')">Send</button>
    </div>
  </div>`;
}

// ── PRINT ────────────────────────────────────────────────────────
function buildPrint() {
  return `
  <div style="display:flex;height:100%">
    <div style="flex:1;background:#e0e0e0;display:flex;align-items:center;justify-content:center">
      <div style="width:200px;height:260px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:var(--text-hint);font-size:13px">Preview</div>
    </div>
    <div style="width:280px;flex-shrink:0;border-left:1px solid var(--border);padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto">
      <div style="font-size:16px;font-weight:500">Print</div>
      <div><div style="font-size:12px;color:var(--text-hint);margin-bottom:6px">Destination</div><select style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-ui);font-size:13px"><option>Save as PDF</option><option>HP DeskJet 3700</option><option>Google Cloud Print</option></select></div>
      <div><div style="font-size:12px;color:var(--text-hint);margin-bottom:6px">Pages</div><select style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-ui);font-size:13px"><option>All</option><option>Current page</option><option>Custom</option></select></div>
      <div><div style="font-size:12px;color:var(--text-hint);margin-bottom:6px">Copies</div><input type="number" value="1" min="1" style="width:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-ui);font-size:13px"></div>
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
        <button class="goog-btn goog-btn-primary" style="width:100%;height:40px" onclick="showToast('Printing...');closeWindow('print')">Print</button>
        <button class="goog-btn goog-btn-secondary" style="width:100%;height:40px" onclick="closeWindow('print')">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── GENERIC APP ──────────────────────────────────────────────────
function buildGenericApp(id) {
  const app=APPS.find(a=>a.id===id)||{name:id,icon:'📄',color:'#1a73e8'};
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;background:var(--surface-2)">
    <div style="font-size:72px;line-height:1">${app.icon}</div>
    <div style="font-size:20px;font-weight:500;color:var(--text-primary)">${app.name}</div>
    <div style="font-size:14px;color:var(--text-secondary);text-align:center;max-width:300px">Opens in a full tab on real OWDOS. Simulated here.</div>
    <button class="goog-btn goog-btn-primary" onclick="showToast('Launching ${app.name}...')">Open ${app.name}</button>
  </div>`;
}

// ── CLOCK TICKER (clock app window) ──────────────────────────────
setInterval(() => {
  const d=document.getElementById('win-clock-display'),l=document.getElementById('win-clock-date-lbl');
  if(d){const n=new Date();d.textContent=n.toLocaleTimeString([]);if(l)l.textContent=n.toDateString();}
},500);

// ── POWERWASH ────────────────────────────────────────────────────
function triggerPowerwash() {
  if(confirm('Powerwash will erase all local data on this device. Continue?'))
    setTimeout(()=>{window.location.href='oobe.html';},600);
}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────────
let keyComboTimers={};
document.addEventListener('keydown', e => {
  const ctrl=e.ctrlKey,alt=e.altKey,shift=e.shiftKey,k=e.key;
  if(ctrl&&alt&&shift&&k==='R'){e.preventDefault();triggerPowerwash();return;}
  if(ctrl&&k==='q'){if(keyComboTimers['ctrlQ']){clearTimeout(keyComboTimers['ctrlQ']);delete keyComboTimers['ctrlQ'];showToast('Signing out...');setTimeout(()=>window.location.reload(),1200);}else{keyComboTimers['ctrlQ']=setTimeout(()=>delete keyComboTimers['ctrlQ'],800);}return;}
  if(k==='F6'||(alt&&k==='F1')){e.preventDefault();toggleLauncher();return;}
  if(k==='F5'){e.preventDefault();toggleOverview();return;}
  if(ctrl&&k==='F5'){e.preventDefault();showToast('📸 Screenshot taken');return;}
  if(ctrl&&shift&&k==='F5'){e.preventDefault();showToast('📸 Partial screenshot — drag to select');return;}
  if(ctrl&&alt&&k==='F5'){e.preventDefault();showToast('🎬 Screen recording started');return;}
  if((ctrl&&shift&&k==='L')||(alt&&k==='l')){e.preventDefault();if(typeof lockScreen==='function')lockScreen();return;}
  if(ctrl&&!shift&&k==='n'){e.preventDefault();openApp('browser');return;}
  if(ctrl&&shift&&k==='N'){e.preventDefault();showToast('Opening Incognito window...');return;}
  if(ctrl&&k==='w'){const t=getTopWindowId();if(t){e.preventDefault();closeWindow(t);}return;}
  if(alt&&k==='-'){const t=getTopWindowId();if(t){e.preventDefault();minimizeWindow(t);}return;}
  if(alt&&k==='='){const t=getTopWindowId();if(t){e.preventDefault();maximizeWindow(t);}return;}
  if(alt&&k==='['){const t=getTopWindowId();if(t){e.preventDefault();snapWindow(t,'left');}return;}
  if(alt&&k===']'){const t=getTopWindowId();if(t){e.preventDefault();snapWindow(t,'right');}return;}
  if(alt&&shift&&k==='S'){e.preventDefault();openApp('settings');return;}
  if(alt&&shift&&k==='M'){e.preventDefault();openApp('files');return;}
  if(ctrl&&shift&&k==='Escape'){e.preventDefault();showToast('Task Manager (not available in simulation)');return;}
  if(ctrl&&alt&&k==='/'){e.preventDefault();toggleKbdOverlay();return;}
  if(k==='F11'){e.preventDefault();showToast('Toggle full screen');return;}
  if(alt&&k==='Tab'){e.preventDefault();cycleWindows(shift?-1:1);return;}
  if(k==='Escape'){closeLauncher();closeQuickSettings();closeNotifCenter();if(OWDOS.overviewOpen)toggleOverview();hideCtxMenu();const ov=document.getElementById('kbd-overlay');if(ov)ov.classList.remove('show');}
});

function cycleWindows(dir){
  const ids=Object.keys(OWDOS.windows).filter(id=>!OWDOS.windows[id].minimized);
  if(ids.length<2)return;
  const top=getTopWindowId(),idx=ids.indexOf(top),next=ids[(idx+dir+ids.length)%ids.length];
  focusWindow(next);showToast(APPS.find(a=>a.id===next)?.name||next);
}
function toggleKbdOverlay(){const el=document.getElementById('kbd-overlay');if(el)el.classList.toggle('show');}

// ── CLICK OUTSIDE HANDLERS ───────────────────────────────────────
document.addEventListener('click', e => {
  if(!e.target.closest('#ctx-menu')) hideCtxMenu();
  if(!e.target.closest('#quick-settings')&&!e.target.closest('#clock-widget')) closeQuickSettings();
  if(!e.target.closest('#launcher')&&!e.target.closest('#launcher-btn')) closeLauncher();
});
document.addEventListener('mousedown', e => {
  const win=e.target.closest('.window');
  if(win) focusWindow(win.id.replace('win-',''));
});
document.addEventListener('contextmenu', e => {
  if(e.target.closest('.window')||e.target.closest('#shelf')||e.target.closest('#launcher')) return;
  e.preventDefault(); showCtxMenu(e.clientX, e.clientY);
});

// ── INIT ─────────────────────────────────────────────────────────
function owdosInit() {
  loadSettings();
  buildShelf();
  buildLauncher();
  owdosStartClock();
  applySettings();
}
new MutationObserver(()=>{if(document.getElementById('ow-terminal'))ensureTerminal()}).observe(document.documentElement,{childList:true,subtree:true});

(async()=>{try{const u=await window.OWAuth?.user?.();if(u){localStorage.setItem('owdos_username',u.user_metadata?.username||u.email?.split('@')[0]||'user');const n=document.getElementById('qs-name');if(n)n.textContent=u.user_metadata?.username||u.email?.split('@')[0]||'User';}}catch{}})();
