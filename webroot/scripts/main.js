
import { exec, toast } from './assets/kernelsu.js';
import { t } from './i18n.js';

const MODULE_ID = 'enable-hdr-oneplus13-webui';
const MODULE_DIR = `/data/adb/modules/${MODULE_ID}`;
const APP_LIST_XML = `${MODULE_DIR}/appList.xml`;

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');
const loadingEl = document.getElementById('loading');
const countEl = document.getElementById('count');
const clearBtn = document.getElementById('clear-btn');
const cardTpl = document.getElementById('card');
// i18n static labels
document.getElementById('search').placeholder = t('searchPlaceholder');
const loadingTxt = document.querySelector('#loading span'); if (loadingTxt) loadingTxt.textContent = t('loading');
const _selAll=document.getElementById('selectAll'); if(_selAll) _selAll.textContent = t('selectAll');
const _deselAll=document.getElementById('deselectAll'); if(_deselAll) _deselAll.textContent = t('deselectAll');
const _refresh=document.getElementById('refresh'); if(_refresh) _refresh.textContent = t('refresh');
const _saveBtn=document.getElementById('save'); if(_saveBtn) _saveBtn.textContent = t('save');


let installed = []; // [{pkg,name,checked}]
let defaults = new Set(); // default checked from existing appList.xml

function showLoading(on){ loadingEl.classList.toggle('show', !!on); }

async function sh(cmd){
  const { errno, stdout, stderr } = await exec(cmd);
  if (errno !== 0) { console.log(stderr); }
  return stdout ?? '';
}

// Parse appList.xml -> Set(packages)
function parseXmlToSet(xml){
  const re = /name="([^"]+)"/g;
  const s = new Set();
  let m;
  while ((m = re.exec(xml))){ s.add(m[1]); }
  return s;
}

// Build xml from array of pkgs
function buildXml(pkgs){
  return pkgs.map(p=>`<application name="${p}"></application>`).join('\n') + '\n';
}

// Try to list installed apps with labels
async function getInstalledApps(){
  // Prefer $packageManager if available
  if (typeof window.$packageManager !== 'undefined'){
    try{
      const list = $packageManager.getInstalledPackages(0, 0); // flags,user
      const apps = [];
      for (let i=0;i<list.size();i++){
        const pInfo = list.get(i);
        if ((pInfo.applicationInfo.flags & 1) !== 0) { /* SYSTEM */ }
        const pkg = pInfo.packageName;
        const label = pInfo.applicationInfo.loadLabel($packageManager).toString();
        apps.push({ pkg, name: label });
      }
      return apps;
    }catch(e){ console.log('PM API failed', e); }
  }
  // Fallback: shell
  const out = await sh(`cmd package list packages -3 -f | sed 's/.*=//' | sort -u`);
  const pkgs = out.trim().split('\n').filter(Boolean);
  return pkgs.map(pkg => ({ pkg, name: pkg }));
}


async function resolveIconDataUrl(pkg){
  // Try via Android PackageManager if exposed in this environment
  try{
    if (typeof $context !== 'undefined'){
      const BitmapFactory = Packages.android.graphics.BitmapFactory;
      const ByteArrayOutputStream = Packages.java.io.ByteArrayOutputStream;
      const Base64 = Packages.android.util.Base64;
      const pm = $context.getPackageManager();
      const ai = pm.getApplicationInfo(pkg, 0);
      const drawable = pm.getApplicationIcon(ai);
      // Convert drawable to bitmap
      const Bitmap = Packages.android.graphics.Bitmap;
      const bmp = Packages.android.graphics.drawable.BitmapDrawable.prototype.isPrototypeOf(drawable) ? drawable.getBitmap() : null;
      if (bmp){
        const stream = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.PNG, 100, stream);
        const bytes = stream.toByteArray();
        const b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        return 'data:image/png;base64,' + b64;
      }
    }
  }catch(e){ /* ignore */ }
  // Fallback SVG placeholder (neutral tone)
  const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#1b2332"/><path d="M8 8h8v8H8z" fill="#2d3a52"/></svg>');
  return 'data:image/svg+xml;charset=utf-8,' + svg;
}

function render(list){
  listEl.innerHTML='';
  for (const app of list){
    const node = cardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.name').textContent = app.name || app.pkg;
    node.querySelector('.pkg').textContent = app.pkg;
    const cb = node.querySelector('.checkbox');
    cb.checked = app.checked;
    cb.addEventListener('change', ()=>{
      app.checked = cb.checked;
      updateCount();
    });
    listEl.appendChild(node);
  }
  emptyEl.style.display = list.length? 'none':'block';
  updateCount();
}

function updateCount(){
  const total = installed.length;
  const sel = installed.filter(a=>a.checked).length;
  countEl.textContent = t('selectedCount', {sel, total});
}

function applyFilter(){
  const q = searchEl.value.trim().toLowerCase();
  const filtered = !q? installed : installed.filter(a => 
    a.pkg.toLowerCase().includes(q) || (a.name||'').toLowerCase().includes(q)
  );
  render(filtered);
}

if (document.getElementById('selectAll')) document.getElementById('selectAll').onclick = ()=>{
  installed.forEach(a=>a.checked=true); applyFilter();
};
if (document.getElementById('deselectAll')) document.getElementById('deselectAll').onclick = ()=>{
  installed.forEach(a=>a.checked=false); applyFilter();
};
if (document.getElementById('refresh')) document.getElementById('refresh').onclick = init;
if (document.getElementById('save')) document.getElementById('save').onclick = async ()=>{
  const pkgs = installed.filter(a=>a.checked).map(a=>a.pkg);
  const xml = buildXml(pkgs);
  // Write atomically
  const tmp = `${MODULE_DIR}/appList.xml.tmp`;
  const esc = xml.replace(/(["`\\$])/g,'\\$1').replace(/\n/g,'\\n');
  const cmd = `echo -e "${esc}" > "${tmp}" && mv "${tmp}" "${APP_LIST_XML}" && chmod 0644 "${APP_LIST_XML}"`;
  const { errno } = await exec(cmd);
  if (errno===0){ toast(t('savedToastNeedsReboot')); } else { toast(t('saveFailed')); }
};

searchEl.addEventListener('input', ()=>{
  applyFilter();
  if (clearBtn) clearBtn.classList.toggle('show', !!searchEl.value);
});
if (clearBtn) clearBtn.addEventListener('click', ()=>{ searchEl.value=''; applyFilter(); clearBtn.classList.remove('show'); window.scrollTo(0,0); });

async function init(){
  showLoading(true);
  // Load defaults: module shipped appList.xml or existing one
  let xml = await sh(`[ -f "${APP_LIST_XML}" ] && cat "${APP_LIST_XML}" || cat "${MODULE_DIR}/appList.xml" 2>/dev/null || true`);
  defaults = parseXmlToSet(xml);
  const apps = await getInstalledApps();
  // merge with defaults (defaults may include not-installed packages)
  const setAll = new Set([...defaults, ...apps.map(a=>a.pkg)]);
  // Build installed array; include default-only pkgs as well (name = pkg)
  installed = Array.from(setAll).map(pkg=>{
    const found = apps.find(a=>a.pkg===pkg);
    return { pkg, name: found?found.name:pkg, checked: defaults.has(pkg) };
  }).sort((a,b)=> (a.name||a.pkg).localeCompare(b.name||b.pkg));
  applyFilter();
  showLoading(false);
}

init();
