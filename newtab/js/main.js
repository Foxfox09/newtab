/* IndexedDB Helper */
const DB_NAME = 'SearchPageDB';
const STORE_NAME = 'StateStore';
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = event => {
      db = event.target.result;
      resolve(db);
    };
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

function dbGet(key) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbClear() {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* команди */
const COMMANDS = [
  {key:'//bg', short:'Встановити фон (URL або файл)', desc:'//bg <URL або Enter для файлу> — Вкажіть URL або натисніть Enter для вибору файлу.'},
  {key:'//addicon', short:'Додати іконку сайту', desc:'//addicon <URL_сайту> — додає іконку-посилання на сайт (напр., //addicon google.com).'},
  {key:'//save', short:'Примусово зберегти', desc:'//save — примусово зберігає поточні налаштування.'},
  {key:'//clear', short:'Очистити', desc:'//clear — очищує фон і елементи.'},
  {key:'//style', short:'Змінити стиль', desc:'//style <1|2> — змінює візуальний стиль сторінки.'},
  {key:'//textcolor', short:'Встановити кольір тексту', desc:'//textcolor <hex або назва> — напр., //textcolor #000000 або //textcolor red'},
  {key:'//setsearch', short:'Встановити пошук за замовчуванням', desc:'//setsearch <keyword|url_template> — приклад: //setsearch google або //setsearch https://duckduckgo.com/?q=%s'},
  {key:'//togglebutton', short:'Показати/сховати кнопку', desc:'//togglebutton <on|off> — вмикає або вимикає кнопку "Виконати".'}
];

const state = {
  bgType: null,
  bgData: null,
  items: [],
  style: '1',
  selectedCmdIndex: -1,
  currentDisplayedSuggestions: [],
  inputColorMode: 'dark',
  customInputColor: null,
  searchEngineName: 'google',
  searchEngineTemplate: 'https://www.google.com/search?q=%s',
  currentInlineSuggestion: null,
  isButtonVisible: true
};

const bgImg = document.getElementById('bgImg');
const bgVideo = document.getElementById('bgVideo');
const board = document.getElementById('board');
const fileInput = document.getElementById('fileInput');
const query = document.getElementById('query');
const queryGhost = document.getElementById('query-ghost');
const cmdList = document.getElementById('cmdList');
const cmdModal = document.getElementById('cmdModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const closeModal = document.getElementById('closeModal');
const updateNotification = document.getElementById('update-notification');
const closeUpdatePopup = document.getElementById('close-update-popup');

/* збереження/загрузка */
async function loadState(){
  try{
    const savedState = await dbGet('search_state');
    if(!savedState) return;
    Object.assign(state, savedState);
    applyBackground();
    renderBoard();
    applyStyle();
    applyButtonVisibility(); // Додано
  }catch(e){console.warn('Не вдалося завантажити стан з DB', e)}
}

async function saveState(){
  try{ await dbSet('search_state', state); }
  catch(e){ console.error('Не вдалося зберегти стан:', e); }
}

function setInputColor(isDarkBg){
  if(isDarkBg){
    document.documentElement.style.setProperty('--input-color','#ffffff');
    document.documentElement.style.setProperty('--input-placeholder','rgba(255,255,255,0.75)');
  } else {
    document.documentElement.style.setProperty('--input-color','#111111');
    document.documentElement.style.setProperty('--input-placeholder','rgba(0,0,0,0.55)');
  }
}

// Додано: Функція для керування видимістю кнопки
function applyButtonVisibility() {
  const runButton = document.getElementById('run');
  if (runButton) {
    runButton.style.display = state.isButtonVisible ? 'inline-flex' : 'none';
  }
}

function applyStyle() {
  if (state.style === '2') {
    document.body.classList.add('style-2');
  } else {
    document.body.classList.remove('style-2');
  }
}

function applyBackground(){
  let src = state.bgData;
  if (state.bgData instanceof File) src = URL.createObjectURL(state.bgData);

  if(state.bgType==='image'){
    bgVideo.style.display='none';
    bgImg.src = src; bgImg.style.display='block';
  } else if(state.bgType==='video'){
    bgImg.style.display='none';
    bgVideo.src = src; bgVideo.style.display='block'; bgVideo.play();
  } else {
    bgImg.style.display='none'; bgVideo.style.display='none';
  }
}

function updateCmdSelection(){
  const nodes = Array.from(cmdList.children);
  nodes.forEach(n=> n.classList.remove('selected'));
  if(state.selectedCmdIndex >= 0 && nodes[state.selectedCmdIndex]){
    nodes[state.selectedCmdIndex].classList.add('selected');
    nodes[state.selectedCmdIndex].scrollIntoView({block:'nearest'});
  }
}

function parseCommand(raw){
  if(!raw) return null;
  const trimmed = raw.trim();
  if(!trimmed.startsWith('//')) return null;
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  return {cmd, parts};
}

document.getElementById('run').addEventListener('click', ()=>runCmd(query.value));

/* Флаг, щоб уникнути подвійного виконання Enter */
let _handlingEnter = false;

query.addEventListener('keydown', e => {
  const currentSuggestions = state.currentDisplayedSuggestions || [];
  const max = currentSuggestions.length;

  // === Обробка inline-підказки (Google) ===
  if (state.currentInlineSuggestion) {
    if (e.key === 'Enter') {
      // Якщо ми вже обробляємо Enter — нічого не робимо повторно
      if (_handlingEnter) return;
      _handlingEnter = true;
      e.preventDefault();
      // Виконуємо запит (inline suggestion)
      runCmd(state.currentInlineSuggestion);
      setTimeout(() => { _handlingEnter = false; }, 60);
      return;
    }
    if (e.key === 'Tab' || e.key === 'ArrowRight') {
      e.preventDefault();
      query.value = state.currentInlineSuggestion;
      state.currentInlineSuggestion = null;
      queryGhost.value = '';
      hideSuggestions();
      return;
    }
    if (e.key === 'Escape') {
      state.currentInlineSuggestion = null;
      queryGhost.value = '';
      return;
    }
  }

  // === Якщо список команд відкритий ===
  if (cmdList.style.display !== 'none' && max > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (state.selectedCmdIndex === -1) state.selectedCmdIndex = 0;
      else if (e.key === 'ArrowDown') state.selectedCmdIndex = (state.selectedCmdIndex + 1) % max;
      else if (e.key === 'ArrowUp') state.selectedCmdIndex = (state.selectedCmdIndex - 1 + max) % max;
      updateCmdSelection();
    } else if (e.key === 'Tab') {
      // TAB — підставляє текст, не виконує
      e.preventDefault();
      if (state.selectedCmdIndex < 0 && currentSuggestions.length > 0) {
        state.selectedCmdIndex = 0; // якщо нічого не виділено — підставляємо перший
      }
      // підставити (але не виконувати)
      const sug = state.currentDisplayedSuggestions[state.selectedCmdIndex];
      if (sug) {
        if (sug.type === 'command' && sug.rawCommand) {
          query.value = sug.rawCommand.key + ' ';
        } else {
          query.value = sug.text;
        }
      }
      hideSuggestions();
      query.focus();
    } else if (e.key === 'Enter') {
      // ENTER — виконує дію. Виконуємо завжди над виділеним або першим елементом.
      // Уникаємо подвійного виконання
      if (_handlingEnter) return;
      _handlingEnter = true;
      e.preventDefault();

      if (state.selectedCmdIndex < 0 && currentSuggestions.length > 0) {
        state.selectedCmdIndex = 0; // якщо нічого не виділено — обираємо перший
        updateCmdSelection();
      }
      selectCurrentSuggestion();
      setTimeout(() => { _handlingEnter = false; }, 60);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
    return;
  }

  // === Enter для звичайного пошуку або команди (коли список не відкритий) ===
  if (e.key === 'Enter') {
    if (_handlingEnter) return;
    _handlingEnter = true;
    e.preventDefault();
    const raw = query.value.trim();
    if (raw) {
      runCmd(raw);
    }
    setTimeout(() => { _handlingEnter = false; }, 60);
  }
});

/* Підказки */
const baseHints = [];
let suggestTimer = null;
let suggestAbort = null;

async function fetchGoogleSuggestions(q){
  if(!q) return [];
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
  try{
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data[1]) ? data[1] : [];
  }catch{ return []; }
}

query.addEventListener('input', () => {
  clearTimeout(suggestTimer);

  const rawValue = query.value;
  const q = rawValue.trim().toLowerCase();

  if (!q.startsWith('//')) {
    queryGhost.value = '';
  }

  if (q.startsWith('//')) {
    state.currentInlineSuggestion = null;

    const parts = rawValue.trim().split(/\s+/);
    const commandKey = parts[0].toLowerCase();
    const potentialCommand = COMMANDS.find(c => c.key === commandKey);

    if (potentialCommand && rawValue.endsWith(' ')) {
      cmdList.style.display = 'none';
      const match = potentialCommand.desc.match(/<([^>]+)>/);
      const placeholder = match ? match[1] : '';
      queryGhost.value = rawValue + placeholder;
      return;
    } else {
      queryGhost.value = '';
    }

    const filter = q.substring(2);
    const suggestions = COMMANDS.filter(c => (c.key.substring(2) + ' ' + c.short).toLowerCase().includes(filter))
      .map(c => ({type:'command', text:`${c.key} ${c.short}`, rawCommand:c}));

    if (!suggestions.length){ cmdList.style.display='none'; return; }

    cmdList.innerHTML = suggestions.map((item,i)=>`<div class="cmd-item" data-index="${i}">${item.text}</div>`).join('');
    state.currentDisplayedSuggestions = suggestions;
    state.selectedCmdIndex = -1;
    repositionCmdList();
    cmdList.style.display = 'flex';
    return;
  }

  if(!q){
    cmdList.style.display='none';
    state.currentInlineSuggestion = null;
    queryGhost.value = '';
    return;
  }

  suggestTimer=setTimeout(async()=>{
    const hints = await fetchGoogleSuggestions(q);
    const unique = [...new Set(hints)];

    state.currentInlineSuggestion = null;
    queryGhost.value = '';

    if(!unique.length){ cmdList.style.display='none'; return; }

    const topSuggestion = unique[0];
    // Зберігаємо регістр користувача у фантомному тексті
    if (topSuggestion && topSuggestion.toLowerCase().startsWith(q) && topSuggestion.length > q.length) {
      state.currentInlineSuggestion = topSuggestion;
      const remainingPart = topSuggestion.slice(q.length);
      queryGhost.value = rawValue + remainingPart;
    }

    cmdList.innerHTML = unique.map((h,i)=>`<div class="cmd-item" data-index="${i}"><img src="img/search_icon.png" class="suggestion-icon" alt="">${h}</div>`).join('');
    state.currentDisplayedSuggestions = unique.map(h=>({type:'hint',text:h}));
    state.selectedCmdIndex=-1;
    repositionCmdList();
    cmdList.style.display='flex';
  },200);
});

cmdList.addEventListener('click', e=>{
  const itemEl = e.target.closest('.cmd-item');
  if(!itemEl) return;
  state.selectedCmdIndex=parseInt(itemEl.dataset.index);
  selectCurrentSuggestion();
});

document.addEventListener('click', (e) => {
  const isClickInsideSearch = e.target.closest('.search-wrap');
  const isClickInsideSuggestions = e.target.closest('#cmdList');

  if (!isClickInsideSearch && !isClickInsideSuggestions) {
    hideSuggestions();
  }
});

function hideSuggestions() {
  cmdList.style.display = 'none';
  state.selectedCmdIndex = -1;
  state.currentDisplayedSuggestions = [];
}

function selectCurrentSuggestion() {
  if (state.selectedCmdIndex < 0 || state.selectedCmdIndex >= state.currentDisplayedSuggestions.length) {
    return;
  }

  const suggestion = state.currentDisplayedSuggestions[state.selectedCmdIndex];
  hideSuggestions();

  if (suggestion.type === 'command') {
    const command = suggestion.rawCommand;
    if (command.desc.includes('<')) {
      query.value = command.key + ' ';
      query.focus();
      query.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      runCmd(command.key);
    }
  } else {
    runCmd(suggestion.text);
  }
}

function runCmd(raw) {
  const parsed = parseCommand(raw);
  hideSuggestions();
  state.currentInlineSuggestion = null;
  queryGhost.value = '';

  if (!parsed) {
    if (raw.trim()) {
      saveSearch(raw.trim());
      window.open(buildSearchUrl(raw.trim()), '_self');
    }
    query.value = '';
    return;
  }

  const parts = parsed.parts;
  const cmd = parsed.cmd;
  let executed = true;

  if (cmd === '//bg') {
    const url = parts[1];
    if (!url) { fileInput.click(); }
    else {
      state.bgType = url.toLowerCase().endsWith('.mp4') ? 'video' : 'image';
      state.bgData = url; applyBackground(); saveState();
    }
  } else if (cmd === '//addicon') {
    let domain = parts[1];
    if (!domain) { alert('Вкажіть URL сайту після //addicon'); executed = false; }
    else {
      const linkUrl = domain.startsWith('http') ? domain : 'https://' + domain;
      const cleanDomain = new URL(linkUrl).hostname;
      const iconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
      const it = { type: 'icon', linkUrl, iconUrl, id: Date.now() };
      state.items.push(it); renderBoard(); saveState();
    }
  } else if (cmd === '//save') { saveState(); alert('Збережено!'); }
  else if (cmd === '//clear') {
    state.bgType = null; state.bgData = null; applyBackground(); state.items = []; renderBoard(); dbClear();
  } else if (cmd === '//style') {
    const styleNum = parts[1];
    if (styleNum === '1' || styleNum === '2') {
      state.style = styleNum;
      applyStyle();
      saveState();
      alert(`Стиль змінено на: ${styleNum}`);
    } else {
      alert('Використання: //style 1 або //style 2');
      executed = false;
    }
  } else if (cmd === '//togglebutton') {
    const arg = parts[1];
    if (arg === 'on') {
        state.isButtonVisible = true;
        alert('Кнопку "Виконати" увімкнено.');
    } else if (arg === 'off') {
        state.isButtonVisible = false;
        alert('Кнопку "Виконати" вимкнено.');
    } else {
        alert('Використання: //togglebutton on або //togglebutton off');
        executed = false;
    }
    if (executed) {
        applyButtonVisibility();
        saveState();
    }
  } else {
    alert('Невідома команда');
    executed = false;
  }

  if (executed) {
    query.value = '';
  }
}

/* Іконки */
function createItemDOM(it){
  if(it.type!=='icon') return;
  const el=document.createElement('div');
  el.className='icon-wrapper'; el.dataset.id=it.id; el.dataset.link=it.linkUrl;

  const img=document.createElement('img'); img.src=it.iconUrl;
  const del=document.createElement('button'); del.className='delete-btn'; del.innerText='✕';
  del.addEventListener('click',e=>{
    e.stopPropagation();
    state.items=state.items.filter(x=>x.id!==it.id);
    renderBoard(); saveState();
  });

  el.appendChild(img); el.appendChild(del); board.appendChild(el);
}

function renderBoard(){
  board.innerHTML=''; state.items.forEach(it=>createItemDOM(it));
}

let isDragging=false;
board.addEventListener('click', e=>{
  const wrapper=e.target.closest('.icon-wrapper');
  if(!wrapper||isDragging) return;
  if(wrapper.dataset.link){
    recordSite(wrapper.dataset.link);
    window.open(wrapper.dataset.link,'_self');
  }
});

function initSortable(){
  if(typeof Sortable==='undefined') return;
  new Sortable(board,{
    animation:150,
    ghostClass:'sortable-ghost',
    onStart:()=>isDragging=true,
    onEnd:evt=>{
      const newOrder=[...board.children].map(el=>parseInt(el.dataset.id));
      state.items.sort((a,b)=>newOrder.indexOf(a.id)-newOrder.indexOf(b.id));
      saveState(); setTimeout(()=>isDragging=false,50);
    }
  });
}

/* Історія */
const SEARCH_KEY='search_history';
function getHistory(){ return JSON.parse(localStorage.getItem(SEARCH_KEY)||'[]'); }
function saveSearch(q){
  if(!q) return;
  let h=getHistory();
  if(!h.includes(q)) h.unshift(q);
  if(h.length>20) h=h.slice(0,20);
  localStorage.setItem(SEARCH_KEY,JSON.stringify(h));
}

/* Запис відвідуваних сайтів */
const SITE_KEY = 'frequent_sites';
function recordSite(url) {
  let sites = JSON.parse(localStorage.getItem(SITE_KEY) || '{}');
  sites[url] = (sites[url] || 0) + 1;
  localStorage.setItem(SITE_KEY, JSON.stringify(sites));
}

/* Ініціалізація */
initDB().then(()=>{ 
  loadState(); 
  setTimeout(initSortable,80); 
  checkForUpdates(); 
});

function buildSearchUrl(q){
  const tmpl=(state.searchEngineTemplate||'').trim();
  const encoded=encodeURIComponent(q||'');

  if(!tmpl) return `https://www.google.com/search?q=${encoded}`;
  if(tmpl.includes('%s')) return tmpl.replace(/%s/g,encoded);
  return tmpl + (tmpl.includes('?')?'&':'?')+'q='+encoded;
}

/* Update Checker */
function isNewerVersion(remote, local) {
  const remoteParts = String(remote || '0').split('.').map(v => parseInt(v, 10) || 0);
  const localParts = String(local || '0').split('.').map(v => parseInt(v, 10) || 0);
  const len = Math.max(remoteParts.length, localParts.length);

  for (let i = 0; i < len; i++) {
    const r = remoteParts[i] || 0;
    const l = localParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

async function checkForUpdates() {
  console.log("Перевірка оновлень...");
  try {
    const repoUrl = 'https://raw.githubusercontent.com/Foxfox09/newtab/main/newtab/manifest.json';
    const response = await fetch(repoUrl, { cache: 'no-store' });
    if (!response.ok) {
      console.error(`Помилка перевірки оновлень: статус ${response.status}`);
      return;
    }

    const remoteManifest = await response.json();
    const remoteVersion = remoteManifest.version;
    const localVersion = chrome.runtime.getManifest().version;

    console.log(`Локальна версія: ${localVersion}`);
    console.log(`Віддалена версія: ${remoteVersion}`);

    if (isNewerVersion(remoteVersion, localVersion)) {
      console.log("Знайдено нову версію! Показую вікно.");
      if (updateNotification) {
        updateNotification.classList.remove('hidden');
        updateNotification.style.opacity = '1';
        updateNotification.style.transform = 'translateY(0)';
        updateNotification.style.pointerEvents = 'auto'; 
      }
    } else {
      console.log("У вас остання версія.");
    }
  } catch (error) {
    console.warn('Перевірка оновлень не вдалася:', error);
  }
}

if (closeUpdatePopup) {
  closeUpdatePopup.addEventListener('click', () => {
    if (updateNotification) {
      updateNotification.classList.add('hidden');
    }
  });
}

function repositionCmdList() {
    if (cmdList.style.display !== 'none') {
        const queryRect = query.getBoundingClientRect();
        cmdList.style.left = `${queryRect.left}px`;
        cmdList.style.top = `${queryRect.bottom + 4}px`;
        cmdList.style.width = `${queryRect.width}px`;
    }
}

const resizeObserver = new ResizeObserver(repositionCmdList);
resizeObserver.observe(query);

window.addEventListener('resize', repositionCmdList);

query.addEventListener('blur', () => {
  setTimeout(() => {
    if (!query.contains(document.activeElement) && !cmdList.contains(document.activeElement)) {
      hideSuggestions();
    }
  }, 150);
});

