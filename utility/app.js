// app.js
class IndexedDBCRUD {
  constructor(dbName, storeName, keyPath, version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.keyPath = keyPath;
    this.version = version;
    this.db = null;
    this.isInitialized = false;
  }

  async init(indexes = []) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve(true);
      };

      request.onupgradeneeded = () => {
        this.db = request.result;
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          const store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath });
          indexes.forEach(index => {
            store.createIndex(index.name, index.name, { unique: index.unique || false });
          });
        }
      };
    });
  }

  _checkInit() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  async create(data) {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      const request = store.add(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async read(key) {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async readAll() {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async update(key, updates) {
    this._checkInit();
    return new Promise(async (resolve, reject) => {
      try {
        const existing = await this.read(key);
        const updatedData = existing
          ? { ...existing, ...updates, updatedAt: new Date().toISOString() }
          : { ...updates, [this.keyPath]: key, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(updatedData);
        request.onsuccess = () => resolve(updatedData);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(key) {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async filter(filterFn) {
    const all = await this.readAll();
    return all.filter(filterFn);
  }
}

class UserManager {
  constructor() {
    this.db = new IndexedDBCRUD('UserDatabase', 'users', 'email');
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.db.init([
        { name: 'name', unique: false },
        { name: 'verified', unique: false },
        { name: 'ref_source', unique: false }
      ]);
      this.initialized = true;
    }
  }

  async saveUser(userData) {
    await this.init();
    const existing = await this.db.read(userData.email);
    if (existing) return await this.db.update(userData.email, userData);
    return await this.db.create(userData);
  }

  async set(userData) {
    return await this.saveUser(userData);
  }

  async getUserByEmail(email) {
    await this.init();
    return await this.db.read(email);
  }

  async get() {
    await this.init();
    const users = await this.db.readAll();
    return users.length > 0 ? users[0] : null;
  }

  async clearAllUsers() {
    await this.init();
    return await this.db.clear();
  }
}

export { IndexedDBCRUD, UserManager };
export const userManager = new UserManager();
