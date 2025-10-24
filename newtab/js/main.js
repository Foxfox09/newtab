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
    if (!db) { return reject('DB not initialized'); }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    if (!db) { return reject('DB not initialized'); }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbClear() {
    return new Promise((resolve, reject) => {
        if (!db) { return reject('DB not initialized'); }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/* команди */
const COMMANDS = [
  {key:'//bg', short:'Встановити фон (URL або файл)', desc:'//bg <URL> — встановлює фон з URL (jpg, png, mp4). Якщо URL не вказано, відкриється вибір файлу.'},
  {key:'//addicon', short:'Додати іконку сайту', desc:'//addicon <URL_сайту> — додає іконку-посилання на сайт (напр., //addicon google.com).'},
  {key:'//save', short:'Примусово зберегти', desc:'////save — примусово зберігає поточні налаштування (зазвичай не потрібно).'},
  {key:'//clear', short:'Очистити', desc:'//clear — очищує фон і елементи.'}
//   togglecmd (D)
];

const state = { bgType:null, bgData:null, items:[], selectedCmdIndex: -1, currentDisplayedSuggestions: [] }; // Додано selectedCmdIndex та currentDisplayedSuggestions
const bgImg = document.getElementById('bgImg');
const bgVideo = document.getElementById('bgVideo');
const board = document.getElementById('board');
const fileInput = document.getElementById('fileInput');
const query = document.getElementById('query');
const cmdList = document.getElementById('cmdList');
const cmdModal = document.getElementById('cmdModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const closeModal = document.getElementById('closeModal');

/* збереження/загрузка в/з IndexedDB */
async function loadState(){
  try{
    const savedState = await dbGet('search_state');
    if(!savedState) return;
    
    Object.assign(state, savedState);
    applyBackground();
    renderBoard();
  }catch(e){console.warn('Не вдалося завантажити стан з DB', e)}
}

async function saveState(){
  try{
    await dbSet('search_state', state);
  }catch(e){
    console.error('Не вдалося зберегти стан:', e);
  }
}


function applyBackground(){
  let src = state.bgData;
  if (state.bgData instanceof File) {
    src = URL.createObjectURL(state.bgData);
  }

  if(state.bgType==='image'){
    bgVideo.style.display='none'; if(!bgVideo.paused) bgVideo.pause();
    bgImg.src = src; bgImg.style.display='block';
  } else if(state.bgType==='video'){
    bgImg.style.display='none';
    bgVideo.src = src; bgVideo.style.display='block'; bgVideo.play();
  } else {
    bgImg.style.display='none'; bgVideo.style.display='none';
  }
}

/* cmdList */
function updateCmdSelection(){
  const nodes = Array.from(cmdList.children);
  nodes.forEach(n=> n.classList.remove('selected'));
  if(state.selectedCmdIndex >= 0 && nodes[state.selectedCmdIndex]){
    nodes[state.selectedCmdIndex].classList.add('selected');
    nodes[state.selectedCmdIndex].scrollIntoView({block:'nearest'});
  }
}

/* modal */
function showCmdModal(c){
  modalTitle.textContent = c.key;
  modalDesc.textContent = c.desc;
  cmdModal.style.display = 'block';
}
closeModal.addEventListener('click', ()=> cmdModal.style.display='none');
 
/* command parser */
function parseCommand(raw){
  if(!raw) return null;
  const trimmed = raw.trim();
  const isCmd = trimmed.startsWith('//') || trimmed.startsWith('/');
  if(!isCmd) return null;
  const parts = trimmed.replace(/^\/+/, '//').split(/\s+/);
  const cmd = parts[0].toLowerCase();
  return {cmd, parts};
}
 
document.getElementById('run').addEventListener('click', ()=>runCmd(query.value));
query.addEventListener('keydown', e=>{ 
  if(e.key==='Enter' && !e.defaultPrevented && cmdList.style.display === 'none') { // Запускаємо пошук, якщо список підказок не відображається
    runCmd(query.value);
  }
});
 
// Підказки для пошуку 
const baseHints = [

];

let suggestTimer = null;
let suggestAbort = null;

async function fetchGoogleSuggestions(q) {
  if (!q) return [];
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { signal: suggestAbort ? suggestAbort.signal : undefined });
    const data = await res.json();
    return Array.isArray(data[1]) ? data[1] : [];
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.warn('Google suggest error', err);
    return [];
  }
}

query.addEventListener('input', () => {
  const raw = query.value;
  const q = raw.trim().toLowerCase();

  // Команди 
  if (q.startsWith('//') || q.startsWith('/')) {
    
    const commandFilter = q.replace(/^\/+/, '').toLowerCase();
    const combinedSuggestions = [];
    COMMANDS.filter(c => (c.key + ' ' + c.short + ' ' + c.desc).toLowerCase().includes(commandFilter))
            .forEach(c => combinedSuggestions.push({ type: 'command', text: `${c.key} ${c.short}`, rawCommand: c }));

    
    if (!combinedSuggestions.length) {
      cmdList.style.display = 'none';
      state.currentDisplayedSuggestions = [];
      state.selectedCmdIndex = -1;
      return;
    }

    const uniqueSuggestions = combinedSuggestions; 
    cmdList.innerHTML = uniqueSuggestions.map((item, index) => {
      return `<div class="cmd-item" data-index="${index}" data-text="${item.text}" data-type="${item.type}">⚙️ ${item.text}</div>`;
    }).join('');
    state.currentDisplayedSuggestions = uniqueSuggestions;
    state.selectedCmdIndex = -1;
    const qr = query.getBoundingClientRect();
    cmdList.style.left = `${qr.left}px`;
    cmdList.style.top = `${qr.bottom + 4}px`;
    cmdList.style.width = `${qr.width}px`;
    cmdList.style.display = 'flex';
    return;
  }


  if (!q) {
    cmdList.style.display = 'none';
    state.currentDisplayedSuggestions = [];
    state.selectedCmdIndex = -1;
    return;
  }

 
  clearTimeout(suggestTimer);
  if (suggestAbort) {
    try { suggestAbort.abort(); } catch(e){}
    suggestAbort = null;
  }

  suggestTimer = setTimeout(async () => {
    suggestAbort = new AbortController();
    // локальна історія
    const history = getHistory().filter(h => h.toLowerCase().includes(q));
    // fetch Google suggestions 
    const hints = await fetchGoogleSuggestions(q) || [];
    const filteredHints = hints.filter(h => h.toLowerCase().includes(q));

    // комбінуємо: історія + google hints + базові підказки
    const combined = [
      ...history.map(h => ({ type: 'history', text: h })),
      ...filteredHints.map(h => ({ type: 'hint', text: h })),
      ...baseHints.filter(h => h.toLowerCase().includes(q)).map(h => ({ type: 'hint', text: h }))
    ];

    // remove duplicates
    const seen = new Set();
    const unique = combined.filter(item => {
      if (seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    });

    if (!unique.length) {
      cmdList.style.display = 'none';
      state.currentDisplayedSuggestions = [];
      state.selectedCmdIndex = -1;
      return;
    }

    cmdList.innerHTML = unique.map((item, index) => {
      const icon = item.type === 'history' ? '🕓' : '🔍';
      return `<div class="cmd-item" data-index="${index}" data-text="${item.text}" data-type="${item.type}">${icon} ${item.text}</div>`;
    }).join('');

    state.currentDisplayedSuggestions = unique;
    state.selectedCmdIndex = -1;
    const qr = query.getBoundingClientRect();
    cmdList.style.left = `${qr.left}px`;
    cmdList.style.top = `${qr.bottom + 4}px`;
    cmdList.style.width = `${qr.width}px`;
    cmdList.style.display = 'flex';
  }, 200);
});


// Вибір підказки
cmdList.addEventListener('click', e => {
  const itemEl = e.target.closest('.cmd-item');
  if (!itemEl) return;

  const selectedText = itemEl.dataset.text;
  const selectedType = itemEl.dataset.type;
  const selectedIndex = parseInt(itemEl.dataset.index);
  const selectedSuggestion = state.currentDisplayedSuggestions[selectedIndex];

  if (selectedType === 'command' && selectedSuggestion.rawCommand) {
    query.value = selectedSuggestion.rawCommand.key + ' ';
  } else {
    query.value = selectedText;
  }
  
  cmdList.style.display = 'none';
  query.focus();
  // Запускаємо подію input, щоб оновити/очистити підказки, якщо потрібно
  query.dispatchEvent(new Event('input', { bubbles: true }));
});

query.addEventListener('keydown', e=>{
  const currentSuggestions = state.currentDisplayedSuggestions || [];
  const max = currentSuggestions.length;

  if(!(cmdList.style.display !== 'none' && max > 0)) return; 
  
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    if(e.key === 'ArrowDown') state.selectedCmdIndex = Math.min(max-1, (state.selectedCmdIndex || -1) + 1);
    else state.selectedCmdIndex = Math.max(0, (state.selectedCmdIndex || 0) - 1);
    updateCmdSelection();
  } else if(e.key === 'Enter' || e.key === 'Tab'){
    if(state.selectedCmdIndex >= 0 && currentSuggestions[state.selectedCmdIndex]){
      e.preventDefault();
      const selectedSuggestion = currentSuggestions[state.selectedCmdIndex];
      if (selectedSuggestion.type === 'command' && selectedSuggestion.rawCommand) {
        query.value = selectedSuggestion.rawCommand.key + ' ';
      } else {
        query.value = selectedSuggestion.text;
      }
      cmdList.style.display = 'none';
      query.focus();
      query.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Enter') {
      
      document.getElementById('run').click();
    }
  } else if(e.key === 'Escape'){
    cmdList.style.display = 'none'; // Приховуємо список
    state.selectedCmdIndex = -1; // Скидаємо вибір
  }
});

document.addEventListener('click', (ev)=>{
  if(!ev.target.closest('.search-wrap') && !ev.target.closest('#cmdList') && !ev.target.closest('#hint')){
    cmdList.style.display = 'none'; // Приховуємо список підказок
    state.selectedCmdIndex = -1; // Скидаємо вибір
  }
});

document.getElementById('hint').addEventListener('click', ()=>{
  query.value = '//';
  query.focus();
  query.dispatchEvent(new Event('input', { bubbles: true }));
});
 
/* command execution */
function runCmd(raw){
  const parsed = parseCommand(raw);

  if(!parsed){
    if (raw.trim()) {
        const q = encodeURIComponent(raw);
        saveSearch(raw.trim()); // Зберігаємо пошуковий запит
        window.open('https://www.google.com/search?q='+q,'_self'); // _self для розширень
    }
  } else {
    const parts = parsed.parts;
    const cmd = parsed.cmd;

    if(cmd==='//bg'){
      const url = parts[1];
      if(!url){
        fileInput.click();
      } else {
        state.bgType = url.toLowerCase().endsWith('.mp4') ? 'video' : 'image';
        state.bgData = url;
        applyBackground();
        saveState();
      }
    } else if(cmd==='//addicon'){
      let domain = parts[1];
      if(!domain){ alert('Вкажіть URL сайту після //addicon'); }
      else {
        let linkUrl = domain.startsWith('http') ? domain : 'https://' + domain;
        let cleanDomain = new URL(linkUrl).hostname;
        const iconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
        const it = {type:'icon', linkUrl, iconUrl, id:Date.now()};
        state.items.push(it);
        renderBoard();
        saveState();
      }
    } else if(cmd==='//save'){
      saveState();
      alert('Налаштування примусово збережено!');
    } else if(cmd==='//clear'){
      state.bgType=null; state.bgData=null; applyBackground();
      state.items=[];
      renderBoard();
      dbClear();
      localStorage.removeItem(SEARCH_KEY); // Очищаємо історію пошуку
      localStorage.removeItem(SITE_KEY); // Очищаємо часті сайти
    } else {
      alert('Невідома команда.');
    }
  }

  query.value = '';
  cmdList.style.display = 'none'; // Приховуємо підказки після виконання команди/пошуку
  query.dispatchEvent(new Event('input', { bubbles: true })); // Запускаємо input, щоб очистити підказки
}

/* file input handling */
fileInput.addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  
  if(f.type.startsWith('video')) { 
    state.bgType='video'; 
  } else { 
    state.bgType='image'; 
  }
  state.bgData = f;
  
  applyBackground();
  saveState();
});

/* Icon rendering */
function createItemDOM(it){
  if (it.type !== 'icon') return;

  const el = document.createElement('div');
  el.className = 'icon-wrapper';
  el.dataset.id = it.id;
  el.dataset.link = it.linkUrl;

  const img = document.createElement('img');
  img.src = it.iconUrl;
  img.alt = 'icon';

  el.appendChild(img);
  board.appendChild(el);
}

function renderBoard() {
    board.innerHTML = '';
    state.items.forEach(it => createItemDOM(it));
}

/* Click handling for icons with "ignore click if dragging" logic */
let isDragging = false;
board.addEventListener('click', e => {
    const wrapper = e.target.closest('.icon-wrapper');
    if (!wrapper) return;
    if (isDragging) {
      e.stopImmediatePropagation();
      return;
    }
    if (wrapper.dataset.link) {
        recordSite(wrapper.dataset.link); // Записуємо клік на іконці
        window.open(wrapper.dataset.link, '_blank');
    }
});

/* Initialize Sortable.js AFTER DOM + Sortable script loaded */
function initSortable() {
  if (typeof Sortable === 'undefined') {
    console.error('Sortable не знайдено. Переконайтесь, що Sortable.min.js підключено.');
    return;
  }

  new Sortable(board, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      group: 'shared',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: function () {
        isDragging = true;
      },
      onEnd: function (evt) {
        const newOrderIds = [...board.children].map(el => parseInt(el.dataset.id));
        state.items.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        saveState();
        setTimeout(() => { isDragging = false; }, 50);
        console.log('Sortable.js drag ended. New order:', newOrderIds);
      },
      onChoose: function () {}
  });

  console.log('Sortable.js initialized successfully.');
}

// Пам’ять пошуку (localStorage) (інтегровано) 
const SEARCH_KEY = 'search_history';
function getHistory() {
  return JSON.parse(localStorage.getItem(SEARCH_KEY) || '[]');
}
function saveSearch(q) {
  if (!q) return;
  let history = getHistory();
  if (!history.includes(q)) history.unshift(q);
  if (history.length > 20) history = history.slice(0, 20);
  localStorage.setItem(SEARCH_KEY, JSON.stringify(history));
}

// Часто відкриваємі сайти (localStorage) (інтегровано)
const SITE_KEY = 'frequent_sites';

function recordSite(url) {
  let sites = JSON.parse(localStorage.getItem(SITE_KEY) || '{}');
  sites[url] = (sites[url] || 0) + 1;
  localStorage.setItem(SITE_KEY, JSON.stringify(sites));
}

function renderFrequentSites() {
  let sites = JSON.parse(localStorage.getItem(SITE_KEY) || '{}');
  const topSites = Object.entries(sites)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8);
  
  if (topSites.length > 0) {
    console.log('Найчастіше відвідувані сайти:', topSites);
  }
}


/* init */
initDB().then(() => {
    loadState();
    // loadSearchHistory() 
    // renderFrequentSites(); 
    setTimeout(initSortable, 80);
});

const resizeObserver = new ResizeObserver(() => {
    if (cmdList.style.display !== 'none') {
        const queryRect = query.getBoundingClientRect();
        cmdList.style.left = `${queryRect.left}px`;
        cmdList.style.top = `${queryRect.bottom + 4}px`;
        cmdList.style.width = `${queryRect.width}px`;
    }
});
resizeObserver.observe(query);