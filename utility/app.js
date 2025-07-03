
class IndexedDBCRUD {
  constructor(dbName, storeName, keyPath, version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.keyPath = keyPath;
    this.version = version;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database
   * @param {Array} indexes - Optional indexes to create [{name: 'fieldName', unique: false}]
   * @returns {Promise<boolean>}
   */
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
        
        // Create object store if it doesn't exist
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          const store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath });
          
          // Create indexes if provided
          indexes.forEach(index => {
            store.createIndex(index.name, index.name, { unique: index.unique || false });
          });
          
          console.log(`🔄 Created object store: ${this.storeName}`);
        }
      };
    });
  }

  /**
   * Check if database is initialized
   * @private
   */
  _checkInit() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  /**
   * Create/Insert a new record
   * @param {Object} data - Data to insert
   * @returns {Promise<any>}
   */
  async create(data) {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      // Add timestamp
      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      
      const request = store.add(data);
      
      request.onsuccess = () => {
        console.log(`✅ Record created:`, data[this.keyPath]);
        resolve(data);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to create record:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Read a single record by key
   * @param {any} key - Primary key value
   * @returns {Promise<Object|null>}
   */
  async read(key) {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to read record:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Read all records
   * @returns {Promise<Array>}
   */
  async readAll() {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to read all records:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update a record (creates if doesn't exist)
   * @param {any} key - Primary key value
   * @param {Object} updates - Data to update
   * @returns {Promise<Object>}
   */
  async update(key, updates) {
    this._checkInit();
    
    return new Promise(async (resolve, reject) => {
      try {
        // Get existing record
        const existing = await this.read(key);
        
        if (!existing) {
          // If record doesn't exist, create it
          updates[this.keyPath] = key;
          const newRecord = await this.create(updates);
          resolve(newRecord);
          return;
        }
        
        // Merge updates with existing data
        const updatedData = { ...existing, ...updates };
        updatedData.updatedAt = new Date().toISOString();
        
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(updatedData);
        
        request.onsuccess = () => {
          console.log(`✅ Record updated:`, key);
          resolve(updatedData);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to update record:`, request.error);
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Delete a record
   * @param {any} key - Primary key value
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        console.log(`✅ Record deleted:`, key);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to delete record:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all records
   * @returns {Promise<boolean>}
   */
  async clear() {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log(`✅ All records cleared from ${this.storeName}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to clear records:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Count total records
   * @returns {Promise<number>}
   */
  async count() {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.count();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to count records:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Search records by index
   * @param {string} indexName - Name of the index
   * @param {any} value - Value to search for
   * @returns {Promise<Array>}
   */
  async searchByIndex(indexName, value) {
    this._checkInit();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        console.error(`❌ Failed to search by index:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Filter records with a custom function
   * @param {Function} filterFn - Function to filter records
   * @returns {Promise<Array>}
   */
  async filter(filterFn) {
    const allRecords = await this.readAll();
    return allRecords.filter(filterFn);
  }

  /**
   * Export all data as JSON
   * @returns {Promise<string>}
   */
  async exportData() {
    const data = await this.readAll();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from JSON
   * @param {string} jsonData - JSON string to import
   * @param {boolean} clearFirst - Whether to clear existing data first
   * @returns {Promise<number>} Number of records imported
   */
  async importData(jsonData, clearFirst = false) {
    try {
      const data = JSON.parse(jsonData);
      
      if (clearFirst) {
        await this.clear();
      }
      
      let imported = 0;
      for (const record of data) {
        try {
          await this.create(record);
          imported++;
        } catch (error) {
          console.warn(`⚠️ Failed to import record:`, record, error.message);
        }
      }
      
      console.log(`✅ Imported ${imported} records`);
      return imported;
    } catch (error) {
      console.error(`❌ Failed to import data:`, error);
      throw error;
    }
  }

  /**
   * Get database info
   * @returns {Object}
   */
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

// ==================== USAGE EXAMPLES ====================

// Example 1: Simple User Management
async function userManagementExample() {
  console.log('📚 User Management Example');
  
  // Initialize database
  const userDB = new IndexedDBCRUD('UserDatabase', 'users', 'email');
  await userDB.init([
    { name: 'name', unique: false },
    { name: 'verified', unique: false }
  ]);
  
  // Create users
  await userDB.create({
    email: 'john@example.com',
    name: 'John Doe',
    ip: '192.168.1.1',
    phone: '123-456-7890',
    daily_limit: 1000,
    extra_limit: 500,
    verified: true,
    ref_source: 'google',
    affiliates: 0
  });
  
  await userDB.create({
    email: 'jane@example.com',
    name: 'Jane Smith',
    ip: '192.168.1.2',
    phone: '098-765-4321',
    daily_limit: 1500,
    extra_limit: 200,
    verified: false,
    ref_source: 'facebook',
    affiliates: 3
  });
  
  // Read all users
  const users = await userDB.readAll();
  console.log('All users:', users);
  
  // Update user
  await userDB.update('jane@example.com', { verified: true, affiliates: 5 });
  
  // Search verified users
  const verifiedUsers = await userDB.filter(user => user.verified);
  console.log('Verified users:', verifiedUsers);
  
  // Get count
  const count = await userDB.count();
  console.log('Total users:', count);
}

// Example 2: Generic Data Storage
async function genericDataExample() {
  console.log('📚 Generic Data Example');
  
  // Products database
  const productDB = new IndexedDBCRUD('ShopDatabase', 'products', 'id');
  await productDB.init([
    { name: 'category', unique: false },
    { name: 'price', unique: false }
  ]);
  
  // Add products
  await productDB.create({
    id: 'prod-001',
    name: 'Laptop',
    category: 'Electronics',
    price: 999.99,
    stock: 10
  });
  
  await productDB.create({
    id: 'prod-002',
    name: 'Mouse',
    category: 'Electronics',
    price: 29.99,
    stock: 50
  });
  
  // Find products by category
  const electronics = await productDB.searchByIndex('category', 'Electronics');
  console.log('Electronics:', electronics);
  
  // Export data
  const exportedData = await productDB.exportData();
  console.log('Exported data:', exportedData);
}

// Example 3: Your Original User System (Drop-in replacement)
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
    try {
      const user = {
        ...userData,
        affiliates: userData.affiliates || 0
      };
      
      const existing = await this.db.read(user.email);
      if (existing) {
        return await this.db.update(user.email, user);
      } else {
        return await this.db.create(user);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
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
}

// ==================== QUICK START ====================

// Uncomment to run examples
// userManagementExample();
// genericDataExample();

// Export the class for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IndexedDBCRUD, UserManager };
}

// For browser usage, attach to window
if (typeof window !== 'undefined') {
  window.IndexedDBCRUD = IndexedDBCRUD;
  window.UserManager = UserManager;
}

console.log('🚀 IndexedDB CRUD Library loaded! Ready to use.');
export const UserManager = new UserManager();
