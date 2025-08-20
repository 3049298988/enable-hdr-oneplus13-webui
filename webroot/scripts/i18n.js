
// Simple i18n
let LANG = 'auto'; // 'auto'|'zh-Hans'|'zh-Hant'|'en'
const LS_KEY = 'hdr_webui_lang';

const dict = {
  'zh-Hans': {
    title: 'HDR 应用选择器',
    moduleLabel: '模块',
    searchPlaceholder: '搜索（包名 / 应用名）',
    loading: '载入中',
    selectAll: '全选',
    deselectAll: '全不选',
    refresh: '刷新列表',
    save: '保存',
    savedToastNeedsReboot: '保存完成，请重启手机以套用更变',
    saveFailed: '保存失败',
    emptyList: '没有找到匹配的应用',
    selectedCount: ({sel,total}) => `已选 ${sel} / 共 ${total}`,
    langAuto: '跟随系统',
    langZhHans: '中文（简体）',
    langZhHant: '中文（繁體／台灣）',
    langEn: 'English',
  },
  'zh-Hant': {
    title: 'HDR 應用選擇器',
    moduleLabel: '模組',
    searchPlaceholder: '搜尋（套件名／應用名）',
    loading: '載入中',
    selectAll: '全選',
    deselectAll: '全不選',
    refresh: '重新整理',
    save: '儲存',
    savedToastNeedsReboot: '已儲存，請重新開機以套用變更',
    saveFailed: '儲存失敗',
    emptyList: '沒有符合的應用',
    selectedCount: ({sel,total}) => `已選 ${sel}／共 ${total}`,
    langAuto: '跟隨系統',
    langZhHans: '中文（簡體）',
    langZhHant: '中文（繁體／台灣）',
    langEn: 'English',
  },
  'en': {
    title: 'HDR App Picker',
    moduleLabel: 'Module',
    searchPlaceholder: 'Search (package / app name)',
    loading: 'Loading',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    refresh: 'Refresh',
    save: 'Save',
    savedToastNeedsReboot: 'Saved. Please reboot to apply changes.',
    saveFailed: 'Save failed',
    emptyList: 'No matching apps',
    selectedCount: ({sel,total}) => `Selected ${sel} / ${total}`,
    langAuto: 'System default',
    langZhHans: 'Chinese (Simplified)',
    langZhHant: 'Chinese (Traditional, Taiwan)',
    langEn: 'English',
  }
};

function detectLang(){
  const saved = localStorage.getItem(LS_KEY);
  if (saved) return saved;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  const low = (nav||'').toLowerCase();
  if (low.startsWith('zh')){
    if (low.includes('hant') || low.includes('tw') || low.includes('hk') || low.includes('mo')) return 'zh-Hant';
    return 'zh-Hans';
  }
  return 'en';
}

export function initI18n(){
  LANG = detectLang();
}

export function setLang(newLang){
  LANG = newLang;
  if (newLang==='auto'){
    localStorage.removeItem(LS_KEY);
  }else{
    localStorage.setItem(LS_KEY, newLang);
  }
  applyI18n();
}

export function onLangChange(sel){
  sel.addEventListener('change', ()=>{
    setLang(sel.value);
  });
}

export function t(key, vars){
  const d = dict[LANG==='auto'? detectLang() : LANG] || dict['en'];
  const val = d[key];
  if (typeof val === 'function') return val(vars||{});
  return val || key;
}

export function applyI18n(){
  // Buttons and labels by id if present
  const elTitle = document.querySelector('h1');
  if (elTitle) elTitle.textContent = t('title');
  const badge = document.querySelector('.badge');
  if (badge) {
    const text = badge.textContent;
    const parts = text.split('：');
    const suffix = parts.length>1? parts.slice(1).join('：') : text;
    badge.textContent = `${t('moduleLabel')}：${suffix}`;
  }
  const search = document.getElementById('search');
  if (search) search.placeholder = t('searchPlaceholder');
  const loadingTxt = document.querySelector('#loading span');
  if (loadingTxt) loadingTxt.textContent = t('loading');
  const selAll = document.getElementById('selectAll'); if (selAll) selAll.textContent = t('selectAll');
  const deselAll = document.getElementById('deselectAll'); if (deselAll) deselAll.textContent = t('deselectAll');
  const refresh = document.getElementById('refresh'); if (refresh) refresh.textContent = t('refresh');
  const save = document.getElementById('save'); if (save) save.textContent = t('save');
  // Empty state can be updated during render() via t('emptyList')
  // Title tag
  const headTitle = document.querySelector('title'); if (headTitle) headTitle.textContent = `${t('title')} · enable-hdr-oneplus13-webui`;
  // Language selector (labels set in index.html options)
  const count = document.getElementById('count'); if (count && count.textContent) { /* will be updated by counter */ }
}
