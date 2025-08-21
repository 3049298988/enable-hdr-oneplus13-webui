// ==== HDR WebUI main.js — Fast start + correct preselect ====
// 用法：<script type="module" src="scripts/main.js"></script>
import { exec, spawn, toast } from './assets/kernelsu.js';

const MODULE_DIR    = '/data/adb/modules/enable-hdr-oneplus13-webui';
const APP_LIST_XMLS = [
  `${MODULE_DIR}/appList.xml`,   // 你模块的 XML（大写 L）
];
const LOG_PATH      = `${MODULE_DIR}/webui.log`;
// 移除 LOG_MAX_BYTES，因为每次启动都会清除日志

const $ = (id) => document.getElementById(id);
const listEl   = () => document.getElementById('list') || document.getElementById('applist');
const emptyEl  = () => document.getElementById('empty');
const searchEl = () => document.getElementById('search');
const loadEl   = () => document.getElementById('loading');
const countEl  = () => document.getElementById('count');

// 状态
let APPS = [];             // [{ pkg, name, apk?, labeled:boolean }]
let APP_MAP = new Map();   // pkg -> app
let SELECTED = new Set();  // 预选集合
let FILTER_Q = '';
let NEED_SORT_SELECTED = false; // 是否需要将已选应用排到前面

// —— 工具 & 日志 ——
const isPromise = (x) => !!x && typeof x.then === 'function';
async function runExec(cmd, opts){
  try { const r = exec(cmd, opts); return isPromise(r) ? await r : r; }
  catch(e){ return { errno: 1, stdout: '', stderr: String(e) }; }
}

// ---------- logging ----------
function nowISO(){ try { return new Date().toISOString(); } catch(_) { return ''; } }
function esc(s){ return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r'); }

// 每次启动时清除旧日志
async function clearLogOnStartup(){
  try{
    await runExec(`sh -c 'rm -f "${LOG_PATH}" "${LOG_PATH}.1" 2>/dev/null || true'`);
    console.log('Previous logs cleared');
  }catch(_){}
}

async function fileLog(stage,msg,data){
  try{
    const line = JSON.stringify({ ts: nowISO(), stage: stage||'', msg: msg||'', data: (data===undefined?null:data) });
    // 简化版：直接追加到日志文件，不需要大小检查
    await runExec(`sh -c 'printf "%s\\n" "${esc(line)}" >> "${LOG_PATH}"'`);
  }catch(_){}
}
function showLoading(show){ const el=loadEl(); if(el) el.style.display = show?'':'none'; }
function setCount(sel,total){ const el=countEl(); if(el) el.textContent = `已选 ${sel} / 共 ${total}`; }

// ---------- 已选读取/保存 ----------
async function loadSelectedFromXml(){
  const found = new Set();
  
  await fileLog('loadSelected','start',{ paths: APP_LIST_XMLS });

  // 读取文件内容
  for (const p of APP_LIST_XMLS){
    const r = await runExec(`sh -c 'cat "${p}" 2>/dev/null'`);
    const s = (r.stdout||'').trim();
    
    await fileLog('loadSelected','read-file',{ path: p, hasContent: !!s, contentLength: s.length });
    
    if (!s) continue;

    // 直接逐行读取，不使用 XML 解析器
    try{
      const lines = s.split('\n');
      let foundInFile = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 跳过空行和注释行（以 <!-- 开头的行）
        if (!trimmedLine || trimmedLine.startsWith('<!--')) {
          continue;
        }
        
        // 匹配你的格式：<application name="包名"></application>
        const appMatch = trimmedLine.match(/<application\s+name="([^"]+)"\s*><\/application>/);
        if (appMatch && appMatch[1]) {
          const pkg = appMatch[1].trim();
          if (pkg) {
            found.add(pkg);
            foundInFile++;
            console.log('Found app via line parsing:', pkg);
          }
          continue;
        }
        
        // 兼容旧格式：<app package="包名"/>
        const legacyMatch = trimmedLine.match(/<app\s+package="([^"]+)"\s*\/?\s*>/);
        if (legacyMatch && legacyMatch[1]) {
          const pkg = legacyMatch[1].trim();
          if (pkg) {
            found.add(pkg);
            foundInFile++;
            console.log('Found app via line parsing (legacy):', pkg);
          }
          continue;
        }
        
        // 如果这行看起来像是配置行但没有匹配，记录一下
        if (trimmedLine.includes('application') || trimmedLine.includes('app')) {
          await fileLog('loadSelected','unmatched-line',{ line: trimmedLine });
        }
      }
      
      await fileLog('loadSelected','line-parsed',{ path: p, foundInFile, totalFound: found.size });
      
    }catch(e){
      await fileLog('loadSelected','line-parse-error',{ path: p, error: String(e) });
      console.error("Line parsing error:", e);
    }
  }

  SELECTED = found;
  await fileLog('loadSelected','complete',{ totalSelected: SELECTED.size, selectedApps: Array.from(SELECTED) });
  console.log('Loaded selected apps:', Array.from(SELECTED));
}

async function saveSelected(){
  const pkgs = Array.from(SELECTED);

  // 读取现有文件，保留注释和格式
  let existingContent = '';
  let existingLines = [];
  let commentedApps = new Set(); // 记录被注释的应用
  
  try {
    const r = await runExec(`sh -c 'cat "${MODULE_DIR}/appList.xml" 2>/dev/null'`);
    existingContent = r.stdout || '';
    existingLines = existingContent.split('\n');
    
    // 查找被注释的应用
    for (const line of existingLines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('<!--') && trimmedLine.includes('<application name=')) {
        const match = trimmedLine.match(/<!--\s*<application\s+name="([^"]+)"/);
        if (match && match[1]) {
          commentedApps.add(match[1].trim());
        }
      }
    }
  } catch(e) {
    await fileLog('save','read-existing-failed',{ error: String(e) });
  }

  // 生成新的文件内容
  const newLines = [];
  
  // 1. 先添加所有选中的应用（活跃状态）
  for (const pkg of pkgs) {
    newLines.push(`<application name="${pkg}"></application>`);
  }
  
  // 2. 再添加被注释的应用（保持注释状态）
  for (const pkg of commentedApps) {
    if (!pkgs.includes(pkg)) { // 只有当应用没有被重新选中时才保持注释状态
      newLines.push(`<!-- <application name="${pkg}"></application> -->`);
    }
  }
  
  const payload = newLines.join('\n') + (newLines.length > 0 ? '\n' : '');
  
  const target = `${MODULE_DIR}/appList.xml`;
  const tmp    = `${target}.tmp`;

  const cmd =
    `sh -c 'cat > "${tmp}" << "EOF"\n${payload}EOF\n` +
    `mv "${tmp}" "${target}" && chmod 0644 "${target}"'`;

  const r = await runExec(cmd);
  await fileLog('save','result',{ 
    errno: r.errno, 
    selectedCount: pkgs.length, 
    commentedCount: commentedApps.size,
    format: 'line-by-line' 
  });
  
  if (r.errno === 0) {
    toast('保存完成，请重启手机以套用更变');
    // 保存后需要重新排序，将已选应用排到前面
    NEED_SORT_SELECTED = true;
    render(APPS);
  } else {
    toast('保存失败');
    await fileLog('save','error',{ stderr: r.stderr });
  }
}

// ---------- ABI & aapt 检测（仅在真的需要时才调用） ----------
let AAPT_PATH = '';
async function detectAbi(){
  const r = await runExec(`getprop ro.product.cpu.abilist || getprop ro.product.cpu.abi`);
  const s = (r.stdout||'').toLowerCase();
  if (s.includes('arm64')) return 'arm64-v8a';
  if (s.includes('armeabi-v7a')) return 'armeabi-v7a';
  return 'arm64-v8a';
}
async function ensureAapt(){
  if (AAPT_PATH) return AAPT_PATH;
  const abi = await detectAbi();
  const cand = `${MODULE_DIR}/bin/${abi}/aapt`;
  await runExec(`sh -c '[ -f "${cand}" ] && chmod 0755 "${cand}" || true'`);
  const ok = await runExec(`sh -c '[ -x "${cand}" ] && echo ok || echo no'`);
  if ((ok.stdout||'').trim()==='ok'){ AAPT_PATH = cand; }
  else {
    const r2 = await runExec(`sh -c 'which aapt 2>/dev/null || which aapt2 2>/dev/null || true'`);
    AAPT_PATH = (r2.stdout||'').trim().split('\n')[0] || '';
  }
  await fileLog('aapt','detect',{ path: AAPT_PATH || null });
  return AAPT_PATH;
}

// ---------- 列包（首屏"快"）：只拿包名，先渲染，再懒加载名称 ——
async function listPackagesFast(){
  const cmds = [
    'pm list packages -3',
    'cmd package list packages -3',
    '/system/bin/pm list packages -3',
    '/system/bin/cmd package list packages -3',
  ];
  for (const c of cmds){
    const r = await runExec(c);
    await fileLog('pm','run',{ cmd:c, errno:r.errno, len:(r.stdout||'').length });
    if (r.errno===0 && r.stdout){
      return r.stdout.split('\n').map(s=>s.replace(/^package:/,'').trim()).filter(Boolean);
    }
  }
  return [];
}

// ---------- 快速通道拿应用名（不阻塞 UI） ——
function fastLabelByAPI(pkg){
  try{
    if (typeof window.ksu?.getPackagesInfo === 'function'){
      const info = JSON.parse(window.ksu.getPackagesInfo(`[${pkg}]`));
      if (info?.[0]?.appLabel) return String(info[0].appLabel);
    }
  }catch{}
  try{
    if (typeof window.$packageManager !== 'undefined'){
      const ai = window.$packageManager.getApplicationInfo(pkg, 0, 0);
      const label = ai?.getLabel?.();
      if (label) return String(label);
    }
  }catch{}
  return null;
}

// ---------- 慢通道（只对出现在视口的项尝试）：pm path → aapt → dumpsys —— 
async function getApkPath(pkg){
  const r = await runExec(`sh -c 'pm path "${pkg}" | grep -m 1 "base.apk" | cut -d: -f2'`);
  return (r.stdout||'').trim();
}
async function labelByAapt(pkg){
  const apk = await getApkPath(pkg);
  if (!apk) return '';
  const aapt = await ensureAapt();
  if (!aapt) return '';
  const r = await runExec(`sh -c '${aapt} dump badging "${apk}" 2>/dev/null | grep -m 1 "application-label"'`);
  if (r.errno===0 && r.stdout) return parseAaptLabel(r.stdout);
  return '';
}
async function labelByDump(pkg){
  const tries = [ `dumpsys package "${pkg}"`, `pm dump "${pkg}"` ];
  for (const cmd of tries){
    const r = await runExec(cmd);
    if (r.errno===0 && r.stdout){
      let m = r.stdout.match(/application-label:\s*(.*)/);
      if (m && m[1]) return m[1].trim();
      m = r.stdout.match(/label=([^\n]+)/);
      if (m && m[1]) return m[1].trim();
    }
  }
  return '';
}

// 解析 aapt 输出的应用标签
function parseAaptLabel(output) {
  const match = output.match(/application-label:'([^']+)'/);
  return match ? match[1] : '';
}

// ---------- 快速首屏 + 并发补齐 ----------
const LABEL_QUEUE = [];
const LABEL_DONE  = new Set();
let   LABEL_RUNNING = 0;
const LABEL_CONCURRENCY = 3;

async function labelWorker(){
  if (LABEL_RUNNING >= LABEL_CONCURRENCY) return;
  LABEL_RUNNING++;
  try{
    while (LABEL_QUEUE.length){
      const app = LABEL_QUEUE.shift();
      if (!app || app.labeled) continue;

      // 快速通道先试（一般足够快）
      let label = fastLabelByAPI(app.pkg);

      // 慢通道只在必要时使用
      if (!label) label = await labelByAapt(app.pkg);
      if (!label) label = await labelByDump(app.pkg);

      if (label && label !== app.name){
        app.name = label;
        app.labeled = true;
        const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
        if (row){
          const nameEl = row.querySelector('.name');
          if (nameEl) nameEl.textContent = label;
        }
      }
      await fileLog('label','update',{ pkg: app.pkg, got: !!label });
    }
  } finally {
    LABEL_RUNNING--;
  }
}

// 定义 runLabelWorkers 函数
function runLabelWorkers(){
  // 这个函数会启动多个 worker 来并发处理所有未标记的应用
  while (LABEL_QUEUE.length > 0 && LABEL_RUNNING < LABEL_CONCURRENCY) {
    labelWorker();
  }
}

// ---------- 渲染 & 懒加载名称（IntersectionObserver） ——
let OBSERVER = null; // 初始化 OBSERVER 变量
OBSERVER = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      const pkg = e.target.getAttribute('data-pkg');
      const app = APP_MAP.get(pkg);
      if (app && !app.labeled) {
        LABEL_QUEUE.push(app);
        runLabelWorkers();
      }
    }
  }
}, { root: null, rootMargin: '100px', threshold: 0 });

// 渲染应用列表
function render(apps){
  const L = listEl(); if (!L) return;
  L.innerHTML = '';
  const tpl = document.getElementById('card');

  // 智能排序：只在需要时将已选应用排到前面
  let sortedApps = [...apps];
  if (NEED_SORT_SELECTED) {
    sortedApps = apps.sort((a, b) => {
      if (SELECTED.has(a.pkg) && !SELECTED.has(b.pkg)) return -1;
      if (!SELECTED.has(a.pkg) && SELECTED.has(b.pkg)) return 1;
      return 0;
    });
    // 排序完成后重置标志
    NEED_SORT_SELECTED = false;
  }

  // 注销旧 observer
  if (OBSERVER){ try{ OBSERVER.disconnect(); }catch(_){ } }
  
  // 为每个应用项绑定 IntersectionObserver
  for (const app of sortedApps){
    let node;
    if (tpl && tpl.content && tpl.content.firstElementChild){
      node = tpl.content.firstElementChild.cloneNode(true);
    } else {
      node = document.createElement('div');
      node.className = 'card';
      node.innerHTML = `
        <input type="checkbox" class="checkbox" />
        <div class="info">
          <div class="name"></div>
          <div class="pkg"></div>
        </div>`;
    }
    node.setAttribute('data-pkg', app.pkg);

    const nameEl = node.querySelector('.name');
    const pkgEl  = node.querySelector('.pkg');
    const cb     = node.querySelector('.checkbox');

    if (nameEl) nameEl.textContent = app.name || app.pkg;
    if (pkgEl)  pkgEl.textContent  = app.pkg;

    if (cb){
      cb.checked = SELECTED.has(app.pkg);  // 预勾选 ✅
      cb.onchange = () => {
        if (cb.checked) {
          SELECTED.add(app.pkg);
        } else {
          SELECTED.delete(app.pkg);
        }
        setCount(SELECTED.size, APPS.length);
        // 注意：这里不重新排序，只有保存和重新加载时才排序
      };
    }

    L.appendChild(node);
    // 观察进入视口后再补齐真实名称
    OBSERVER.observe(node);
  }

  setCount(SELECTED.size, APPS.length);
  console.log('Rendered apps, selected count:', SELECTED.size);
}

// ---------- 过滤 ---------- 
function applyFilter(){
  const q = (searchEl()?.value || '').trim().toLowerCase();
  FILTER_Q = q;
  if (!q) return render(APPS);
  const filtered = APPS.filter(a =>
    (a.pkg||'').toLowerCase().includes(q) ||
    (a.name||'').toLowerCase().includes(q)
  );
  render(filtered);
}

// ---------- 初始化 ---------- 
async function init(){
  // 每次启动时清除旧日志
  await clearLogOnStartup();
  
  await fileLog('init','start',{ ua:(navigator?.userAgent)||'', url:(location?.href)||'' });
  showLoading(true);
  try{
    // 1) 先读取预勾选（XML）
    await loadSelectedFromXml();
    console.log('Selected apps after loading XML:', Array.from(SELECTED));

    // 2) 秒拿包名并渲染（标题先用包名尾段）
    const pkgs = await listPackagesFast();
    APPS = pkgs.map(pkg => {
      const tail = pkg.split('.').pop() || pkg;
      const quick = tail.charAt(0).toUpperCase() + tail.slice(1);
      const app = { pkg, name: quick, labeled: false };
      APP_MAP.set(pkg, app);
      return app;
    });
    
    // 3) 重新加载时需要排序
    NEED_SORT_SELECTED = true;
    
    // 4) 渲染列表（此时 SELECTED 已经包含了从 XML 读取的数据）
    render(APPS);

    // 5) 后台懒加载：把"首屏前 30 个"先排队补齐名称，提高主观速度
    LABEL_QUEUE.push(...APPS.slice(0, 30));
    runLabelWorkers();
    
    await fileLog('init','first-render',{ count: APPS.length, preselected: SELECTED.size });
  }catch(e){
    await fileLog('init','error',{ error: String(e) });
    console.error('Init error:', e);
  }finally{
    showLoading(false);
    await fileLog('init','complete');
  }

  // 事件
  const s = searchEl(); if (s) s.addEventListener('input', applyFilter);
  const r = $('reload'); if (r) r.onclick = async () => {
    NEED_SORT_SELECTED = true; // 重新加载时需要排序
    await init();
  };
  const sa= $('selectAll'); if (sa) sa.onclick = () => { 
    APPS.forEach(a=>SELECTED.add(a.pkg)); 
    applyFilter(); 
  };
  const da= $('deselectAll'); if (da) da.onclick = () => { 
    SELECTED.clear(); 
    applyFilter(); 
  };
  const sv= $('save'); if (sv) sv.onclick = async () => saveSelected();
}

document.addEventListener('DOMContentLoaded', () => { init(); });