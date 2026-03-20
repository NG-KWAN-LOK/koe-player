// Dev hot reload: polls extension files for changes
const POLL_INTERVAL = 1000;
let lastTimestamp = null;

async function checkForChanges() {
  try {
    const url = chrome.runtime.getURL('manifest.json');
    const resp = await fetch(url, { cache: 'no-store' });
    const text = await resp.text();
    const hash = text.length + '_' + text.slice(0, 100);
    if (lastTimestamp && lastTimestamp !== hash) {
      chrome.runtime.reload();
      return;
    }
    lastTimestamp = hash;
  } catch (e) {
    // ignore
  }
  setTimeout(checkForChanges, POLL_INTERVAL);
}

checkForChanges();
