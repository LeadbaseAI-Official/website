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

      request.onerror = () => {
        console.error(`❌ Failed to open database: ${this.dbName}`);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log(`✅ Database ${this.dbName} initialized`);
        resolve(true);
      };

      request.onupgradeneeded = () => {
        this.db = request.result;
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          const store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath });
          indexes.forEach(index => {
            store.createIndex(index.name, index.name, { unique: index.unique || false });
          });
          console.log(`🔄 Created object store: ${this.storeName}`);
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

  async count() {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async searchByIndex(indexName, value) {
    this._checkInit();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async filter(filterFn) {
    const allRecords = await this.readAll();
    return allRecords.filter(filterFn);
  }

  async exportData() {
    const data = await this.readAll();
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData, clearFirst = false) {
    const data = JSON.parse(jsonData);
    if (clearFirst) await this.clear();
    let count = 0;
    for (const record of data) {
      try {
        await this.create(record);
        count++;
      } catch (e) {
        console.warn('⚠️ Import error:', record, e);
      }
    }
    return count;
  }

  getInfo() {
    return {
      dbName: this.dbName,
      storeName: this.storeName,
      keyPath: this.keyPath,
      version: this.version,
      isInitialized: this.isInitialized
    };
  }
}

// === UserManager (Minimal, Exportable) ===
class UserManager {
  constructor() {
    this.db = new IndexedDBCRUD('UserDatabase', 'users', 'email');
  }

  async init() {
    await this.db.init([
      { name: 'name', unique: false },
      { name: 'verified', unique: false },
      { name: 'ref_source', unique: false }
    ]);
  }

  async saveUser(userData) {
    const user = { ...userData, affiliates: userData.affiliates || 0 };
    const existing = await this.db.read(user.email);
    if (existing) return await this.db.update(user.email, user);
    return await this.db.create(user);
  }

  async loadUsers() {
    return await this.db.readAll();
  }

  async deleteUser(email) {
    return await this.db.delete(email);
  }

  async clearAllUsers() {
    return await this.db.clear();
  }

  async getUserByEmail(email) {
    return await this.db.read(email);
  }

  async getVerifiedUsers() {
    return await this.db.filter(user => user.verified);
  }

  // Added to retrieve the current user, assuming it's the first one in the DB
  async get() {
    const users = await this.db.readAll();
    return users.length > 0 ? users[0] : null;
  }
}

// === Proper ES Module Export ===
export { IndexedDBCRUD, UserManager };
export const userManager = new UserManager();
// Minor change to force browser refresh (attempt 4)
