const DB = {
  dbName: 'KoePlayerDB',
  version: 1,

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('assignments')) {
          const store = db.createObjectStore('assignments', { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveAssignment(name, script) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readwrite');
      const store = tx.objectStore('assignments');
      const request = store.add({ name, createdAt: new Date().toISOString(), script, audio: {} });
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => db.close();
    });
  },

  async updateAudio(assignmentId, lineId, blob) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readwrite');
      const store = tx.objectStore('assignments');
      const getReq = store.get(assignmentId);
      getReq.onsuccess = () => {
        const a = getReq.result;
        if (!a) { reject(new Error('Not found')); return; }
        a.audio[lineId] = blob;
        store.put(a);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAssignment(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readonly');
      const request = tx.objectStore('assignments').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  },

  async listAssignments() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readonly');
      const index = tx.objectStore('assignments').index('createdAt');
      const list = [];
      const req = index.openCursor(null, 'prev');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { id, name, createdAt } = cursor.value;
          list.push({ id, name, createdAt });
          cursor.continue();
        } else {
          resolve(list);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },

  async deleteAssignment(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readwrite');
      tx.objectStore('assignments').delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  },

  async exportAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readonly');
      const req = tx.objectStore('assignments').getAll();
      req.onsuccess = async () => {
        const assignments = req.result;
        for (const a of assignments) {
          const encoded = {};
          for (const [lineId, blob] of Object.entries(a.audio)) {
            encoded[lineId] = await blobToBase64(blob);
          }
          a.audio = encoded;
        }
        resolve(assignments);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  },

  async importAll(assignments) {
    const existing = await this.listAssignments();
    const keys = new Set(existing.map(a => a.name + '|' + a.createdAt));
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readwrite');
      const store = tx.objectStore('assignments');
      for (const a of assignments) {
        if (keys.has(a.name + '|' + a.createdAt)) continue;
        const audio = {};
        for (const [lineId, b64] of Object.entries(a.audio)) {
          audio[lineId] = base64ToBlob(b64);
        }
        const { id, ...rest } = a;
        store.add({ ...rest, audio });
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }
};

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
