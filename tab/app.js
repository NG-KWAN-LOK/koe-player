// === State ===
let apiKey = null;
let voices = {};
let currentLines = [];
let currentAssignmentId = null;
let audioCache = {};
let currentAudio = null;
let sidebarOpen = true;

// === DOM refs ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(['encryptedApiKey', 'voices']);
  voices = stored.voices || {};

  if (!stored.encryptedApiKey) {
    $('#pin-message').textContent = '請先在 Popup 設定 API Key';
    $('#pin-message').classList.add('error');
    $('#pin-input').style.display = 'none';
    $('#pin-submit').style.display = 'none';
    return;
  }

  // PIN submit
  $('#pin-submit').addEventListener('click', () => unlockWithPin());
  $('#pin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockWithPin();
  });
});

async function unlockWithPin() {
  const pin = $('#pin-input').value;
  if (pin.length !== 4) {
    showPinError('PIN 必須是 4 位數');
    return;
  }

  try {
    const stored = await chrome.storage.local.get('encryptedApiKey');
    apiKey = await CryptoHelper.decrypt(pin, stored.encryptedApiKey);
    $('#pin-screen').style.display = 'none';
    $('#app').style.display = 'flex';
    $('#app').style.flexDirection = 'column';
    initApp();
  } catch {
    showPinError('PIN 錯誤，請重試');
    $('#pin-input').value = '';
    $('#pin-input').focus();
  }
}

function showPinError(msg) {
  $('#pin-message').textContent = msg;
  $('#pin-message').classList.add('error');
}

// === App Init ===
async function initApp() {
  // Player
  initPlayer();

  // Sidebar toggle
  $('#sidebar-toggle').addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    $('#sidebar').classList.toggle('collapsed', !sidebarOpen);
  });

  // Load JSON
  $('#load-btn').addEventListener('click', loadJson);

  // New assignment
  $('#new-btn').addEventListener('click', newAssignment);

  // Export / Import
  $('#export-btn').addEventListener('click', exportData);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);

  // Download all
  $('#download-all-btn').addEventListener('click', downloadAll);

  // Save assignment
  $('#save-assignment-btn').addEventListener('click', saveAssignment);

  // Toggle script
  $('#toggle-script-btn').addEventListener('click', toggleScript);

  // Load saved assignments
  await refreshSidebar();
}

// === JSON Loading ===
function loadJson() {
  const raw = $('#json-input').value.trim();
  if (!raw) { toast('請貼上 JSON', true); return; }

  try {
    const data = JSON.parse(raw);
    if (!data.lines || !Array.isArray(data.lines)) {
      toast('JSON 格式錯誤：需要 { "lines": [...] }', true);
      return;
    }
    currentLines = data.lines;
    currentAssignmentId = null;
    audioCache = {};
    renderLines();
    toast('已載入 ' + currentLines.length + ' 句');
  } catch (e) {
    toast('JSON 解析失敗：' + e.message, true);
  }
}

function renderLines() {
  const container = $('#lines');
  container.innerHTML = '';

  currentLines.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML = `
      <span class="line-id">${esc(line.id)}</span>
      <span class="line-status" data-line-id="${esc(line.id)}">${audioCache[line.id] ? '●' : ''}</span>
      <div class="line-actions">
        <button class="play-btn" data-idx="${i}" title="試聽">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg>
        </button>
        <button class="download-btn" data-idx="${i}" title="下載">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 11v3h12v-3M8 2v8M5 7l3 3 3-3"/></svg>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  // Update status for cached items
  updateCacheStatus();

  // Bind play/download
  container.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => playLine(parseInt(btn.dataset.idx)));
  });
  container.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadLine(parseInt(btn.dataset.idx)));
  });

  $('#input-section').style.display = 'none';
  $('#line-section').style.display = 'block';
  $('#script-view').classList.remove('open');
  $('.chevron').classList.remove('open');
  renderScriptView();
}

function updateCacheStatus() {
  currentLines.forEach(line => {
    const el = $(`.line-status[data-line-id="${CSS.escape(line.id)}"]`);
    if (el) {
      if (audioCache[line.id]) {
        el.textContent = '●';
        el.classList.add('cached');
        el.title = '已快取';
      } else {
        el.textContent = '';
        el.classList.remove('cached');
        el.title = '';
      }
    }
  });
}

// === TTS API ===
async function synthesize(line) {
  // Check cache
  if (audioCache[line.id]) return audioCache[line.id];

  const voiceKey = `${line.lang}-${line.gender}`;
  const voiceName = voices[voiceKey] || (line.gender === 'F' ? 'Achernar' : 'Algieba');
  const fullVoiceName = `${line.lang}-Chirp3-HD-${voiceName}`;

  const resp = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: line.text },
        voice: { languageCode: line.lang, name: fullVoiceName },
        audioConfig: { audioEncoding: 'LINEAR16' }
      })
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 錯誤 ${resp.status}`);
  }

  const data = await resp.json();
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/wav' });

  // Cache in memory
  audioCache[line.id] = blob;

  // Cache in IndexedDB if saved
  if (currentAssignmentId) {
    DB.updateAudio(currentAssignmentId, line.id, blob).catch(() => {});
  }

  updateCacheStatus();
  return blob;
}

// === Player ===
const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg>';
const ICON_PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>';
let currentPlayingIdx = null;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeedIdx = 2; // default 1x

function initPlayer() {
  const audio = $('#player-audio');

  $('#player-speed').addEventListener('click', () => {
    currentSpeedIdx = (currentSpeedIdx + 1) % SPEED_OPTIONS.length;
    const speed = SPEED_OPTIONS[currentSpeedIdx];
    $('#player-speed').textContent = speed + 'x';
    audio.playbackRate = speed;
  });

  audio.addEventListener('ended', () => {
    $$('.play-btn.playing').forEach(b => {
      b.classList.remove('playing');
      b.innerHTML = ICON_PLAY;
    });
    currentPlayingIdx = null;
  });
}

function stopPlayer() {
  const audio = $('#player-audio');
  audio.pause();
  audio.removeAttribute('src');
  $$('.play-btn.playing').forEach(b => {
    b.classList.remove('playing');
    b.innerHTML = ICON_PLAY;
  });
  $('#player-bar').classList.remove('active');
  currentPlayingIdx = null;
}

async function playLine(idx) {
  const line = currentLines[idx];
  const btn = $(`.play-btn[data-idx="${idx}"]`);
  const audio = $('#player-audio');

  // Stop current
  stopPlayer();

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    const blob = await synthesize(line);
    const url = URL.createObjectURL(blob);
    currentPlayingIdx = idx;

    btn.classList.add('playing');
    btn.innerHTML = ICON_PAUSE;
    btn.disabled = false;

    // Show player bar
    $('#player-label').textContent = line.id;
    $('#player-bar').classList.add('active');

    audio.src = url;
    audio.playbackRate = SPEED_OPTIONS[currentSpeedIdx];
    audio.play();
  } catch (e) {
    toast('播放失敗：' + e.message, true);
    btn.disabled = false;
    btn.innerHTML = ICON_PLAY;
  }
}

// === Download ===
async function downloadLine(idx) {
  const line = currentLines[idx];
  const btn = $(`.download-btn[data-idx="${idx}"]`);

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    const blob = await synthesize(line);
    triggerDownload(blob, `${line.id}.wav`);
  } catch (e) {
    toast('下載失敗：' + e.message, true);
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 11v3h12v-3M8 2v8M5 7l3 3 3-3"/></svg>';
}

async function downloadAll() {
  const btn = $('#download-all-btn');
  btn.disabled = true;
  const total = currentLines.length;

  for (let i = 0; i < total; i++) {
    btn.textContent = `下載中 ${i + 1}/${total}...`;
    try {
      const blob = await synthesize(currentLines[i]);
      triggerDownload(blob, `${currentLines[i].id}.wav`);
      // Small delay between downloads to avoid browser blocking
      if (i < total - 1) await sleep(300);
    } catch (e) {
      toast(`${currentLines[i].id} 下載失敗：${e.message}`, true);
    }
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 11v3h12v-3M8 2v8M5 7l3 3 3-3"/></svg> 全部下載`;
  toast('全部下載完成');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// === Save Assignment ===
async function saveAssignment() {
  if (!currentLines.length) { toast('沒有可儲存的作業', true); return; }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} 作業`;

  try {
    const id = await DB.saveAssignment(name, { lines: currentLines });
    currentAssignmentId = id;

    // Save cached audio
    for (const [lineId, blob] of Object.entries(audioCache)) {
      await DB.updateAudio(id, lineId, blob);
    }

    await refreshSidebar();
    highlightAssignment(id);
    toast('已儲存「' + name + '」');
  } catch (e) {
    toast('儲存失敗：' + e.message, true);
  }
}

// === Sidebar ===
async function refreshSidebar() {
  const list = await DB.listAssignments();
  const container = $('#assignment-list');
  container.innerHTML = '';

  list.forEach(a => {
    const item = document.createElement('div');
    item.className = 'assignment-item' + (a.id === currentAssignmentId ? ' active' : '');
    item.dataset.id = a.id;
    item.innerHTML = `
      <span class="name">${esc(a.name)}</span>
      <button class="delete-btn" title="刪除">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M9 4v7a1 1 0 01-1 1H6a1 1 0 01-1-1V4"/>
        </svg>
      </button>
    `;

    item.querySelector('.name').addEventListener('click', () => loadAssignment(a.id));
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteAssignment(a.id, a.name);
    });

    container.appendChild(item);
  });
}

function highlightAssignment(id) {
  $$('.assignment-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });
}

async function loadAssignment(id) {
  try {
    const a = await DB.getAssignment(id);
    if (!a) { toast('作業不存在', true); return; }

    currentLines = a.script.lines;
    currentAssignmentId = id;
    audioCache = {};

    // Load cached audio blobs
    for (const [lineId, blob] of Object.entries(a.audio)) {
      if (blob instanceof Blob) audioCache[lineId] = blob;
    }

    renderLines();
    highlightAssignment(id);
    toast('已載入「' + a.name + '」');
  } catch (e) {
    toast('載入失敗：' + e.message, true);
  }
}

async function deleteAssignment(id, name) {
  if (!confirm(`確定刪除「${name}」？`)) return;

  try {
    await DB.deleteAssignment(id);
    if (currentAssignmentId === id) {
      newAssignment();
    }
    await refreshSidebar();
    toast('已刪除');
  } catch (e) {
    toast('刪除失敗：' + e.message, true);
  }
}

function newAssignment() {
  currentLines = [];
  currentAssignmentId = null;
  audioCache = {};
  $('#input-section').style.display = 'block';
  $('#line-section').style.display = 'none';
  $('#json-input').value = '';
  highlightAssignment(null);
}

// === Script View ===
function toggleScript() {
  const view = $('#script-view');
  const chevron = $('.chevron');
  const isOpen = view.classList.toggle('open');
  chevron.classList.toggle('open', isOpen);
  $('#toggle-script-btn').childNodes[0].textContent = isOpen ? '隱藏 Script ' : '顯示 Script ';
}

function renderScriptView() {
  const container = $('#script-view');
  container.innerHTML = '';

  currentLines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'script-line';
    div.innerHTML = `
      <span class="tag tag-id">${esc(line.id)}</span>
      <span class="tag tag-lang">${esc(line.lang)}/${esc(line.gender)}</span>
      ${esc(line.text)}
    `;
    container.appendChild(div);
  });
}

// === Export / Import ===
async function exportData() {
  try {
    const stored = await chrome.storage.local.get('voices');
    const assignments = await DB.exportAll();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      voices: stored.voices || {},
      assignments
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'koe-player-backup.json');
    toast('已匯出 ' + assignments.length + ' 份作業');
  } catch (e) {
    toast('匯出失敗：' + e.message, true);
  }
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.assignments || !Array.isArray(data.assignments)) {
      toast('檔案格式錯誤', true);
      return;
    }

    // Restore voice settings
    if (data.voices) {
      await chrome.storage.local.set({ voices: data.voices });
      voices = data.voices;
    }

    await DB.importAll(data.assignments);
    await refreshSidebar();
    toast('已匯入 ' + data.assignments.length + ' 份作業');
  } catch (e) {
    toast('匯入失敗：' + e.message, true);
  }

  // Reset file input
  e.target.value = '';
}

// === Utils ===
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { el.className = 'toast'; }, 2500);
}
