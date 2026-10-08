(() => {
  const KEY='owdos_system_v3';
  const fresh={oobe:false,guest:false,devmode:false,hostname:'owdos-device',kernel:'6.6-ow1',tpm:'2.0-virtual',firmware:'1.0.0',deviceId:crypto.randomUUID(),snapshot:null};
  function load(){try{return {...fresh,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...fresh}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s));return s}
  function get(){return load()}
  function set(p){const s=save({...load(),...p});return s}
  function snapshot(){const s=load();s.snapshot={disk:localStorage.getItem('owdos_vfs_v4'),settings:localStorage.getItem('owdos_settings_v3'),time:Date.now()};return save(s)}
  function revert(){const s=load();if(!s.snapshot)return false;if(s.snapshot.disk===null)localStorage.removeItem('owdos_vfs_v4');else localStorage.setItem('owdos_vfs_v4',s.snapshot.disk);if(s.snapshot.settings===null)localStorage.removeItem('owdos_settings_v3');else localStorage.setItem('owdos_settings_v3',s.snapshot.settings);save({...s,snapshot:null});return true}
  function powerwash(){for(const k of Object.keys(localStorage)) if(k.startsWith('owdos_') && k!=='owdos_system_v3') localStorage.removeItem(k);sessionStorage.clear();save({...fresh,deviceId:load().deviceId});}
  window.OWSystem={get,set,snapshot,revert,powerwash};
  window.addEventListener('keydown',e=>{const keys=window.__owRecKeys||(window.__owRecKeys=new Set());if(['1','4','='].includes(e.key)){keys.add(e.key);if(keys.size===3){e.preventDefault();location.href='recovery.html';}}});
})();
