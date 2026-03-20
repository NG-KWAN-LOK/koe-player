const VOICES_FEMALE = [
  'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina', 'Elara', 'Erinome',
  'Eudora', 'Gacrux', 'Kore', 'Laomedeia', 'Leda', 'Pulcherrima', 'Vindemiatrix'
];
const VOICES_MALE = [
  'Achelous', 'Algieba', 'Alsephina', 'Charon', 'Diacria', 'Fenrir', 'Iapetus', 'Narvi',
  'Orus', 'Puck', 'Rasalgethi', 'Sadachbia', 'Schedar', 'Sulafat', 'Tyche',
  'Umbriel', 'Zephyr'
];

function populateSelect(id, voices, defaultVoice) {
  const sel = document.getElementById(id);
  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (v === defaultVoice) opt.selected = true;
    sel.appendChild(opt);
  });
}

function showStatus(msg, isError) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  populateSelect('voice-ja-F', VOICES_FEMALE, 'Achernar');
  populateSelect('voice-ja-M', VOICES_MALE, 'Algieba');
  populateSelect('voice-yue-F', VOICES_FEMALE, 'Achernar');
  populateSelect('voice-yue-M', VOICES_MALE, 'Charon');

  // Load saved voice settings
  const stored = await chrome.storage.local.get(['voices', 'encryptedApiKey']);
  if (stored.voices) {
    if (stored.voices['ja-JP-F']) document.getElementById('voice-ja-F').value = stored.voices['ja-JP-F'];
    if (stored.voices['ja-JP-M']) document.getElementById('voice-ja-M').value = stored.voices['ja-JP-M'];
    if (stored.voices['yue-HK-F']) document.getElementById('voice-yue-F').value = stored.voices['yue-HK-F'];
    if (stored.voices['yue-HK-M']) document.getElementById('voice-yue-M').value = stored.voices['yue-HK-M'];
  }
  if (stored.encryptedApiKey) {
    document.getElementById('apikey-label').textContent = 'API Key（已設定，輸入新值可更新）';
    document.getElementById('apikey').placeholder = '留空保持不變';
  }

  // Save
  document.getElementById('save-btn').addEventListener('click', async () => {
    const pin = document.getElementById('pin').value;
    const apikey = document.getElementById('apikey').value;

    if (apikey && !pin) {
      showStatus('設定 API Key 需要輸入 PIN', true);
      return;
    }
    if (pin && pin.length !== 4) {
      showStatus('PIN 必須是 4 位數', true);
      return;
    }

    const voices = {
      'ja-JP-F': document.getElementById('voice-ja-F').value,
      'ja-JP-M': document.getElementById('voice-ja-M').value,
      'yue-HK-F': document.getElementById('voice-yue-F').value,
      'yue-HK-M': document.getElementById('voice-yue-M').value
    };

    const data = { voices };

    if (apikey && pin) {
      try {
        data.encryptedApiKey = await CryptoHelper.encrypt(pin, apikey);
      } catch (e) {
        showStatus('加密失敗', true);
        return;
      }
    }

    await chrome.storage.local.set(data);
    showStatus('已儲存');
    document.getElementById('pin').value = '';
    document.getElementById('apikey').value = '';
    if (data.encryptedApiKey) {
      document.getElementById('apikey-label').textContent = 'API Key（已設定，輸入新值可更新）';
      document.getElementById('apikey').placeholder = '留空保持不變';
    }
  });

  // Open Dashboard
  document.getElementById('open-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab/index.html') });
  });
});
