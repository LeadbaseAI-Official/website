// IndexedDB utility for LeadBaseAI
// This handles persistent storage of user data across browser sessions

const DB_NAME = 'LeadBaseAI_DB';
const DB_VERSION = 1;
const STORE_NAME = 'userData';

let db = null;

// Open IndexedDB connection
export async function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('IndexedDB opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use composite key: email + ip combination
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'userKey' });
        store.createIndex('email', 'email', { unique: true });
        store.createIndex('ip', 'ip', { unique: true });
        store.createIndex('emailIp', ['email', 'ip'], { unique: true });
        console.log('IndexedDB object store created with composite key');
      }
    };
  });
}

// Save user limits to IndexedDB
export async function saveUserLimits(userData) {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Create composite key from email and ip
    const userKey = `${userData.email}|${userData.ip}`;

    const userRecord = {
      userKey: userKey,
      email: userData.email,
      ip: userData.ip,
      name: userData.name,
      phone: userData.phone,
      daily_limit: userData.daily_limit,
      extra_limit: userData.extra_limit,
      affiliates: userData.affiliates,
      verified: userData.verified,
      lastUpdated: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(userRecord);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('User data saved to IndexedDB:', userRecord);
    return true;
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
    return false;
  }
}

// Get user limits from IndexedDB using email and ip
export async function getUserLimits(email, ip) {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    // Create composite key
    const userKey = `${email}|${ip}`;

    const userData = await new Promise((resolve, reject) => {
      const request = store.get(userKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (userData) {
      console.log('User data retrieved from IndexedDB:', userData);
      return userData;
    } else {
      console.log('No user data found in IndexedDB for:', email, ip);
      return null;
    }
  } catch (error) {
    console.error('Error retrieving from IndexedDB:', error);
    return null;
  }
}

// Get user by email only (for cases where we need to check email uniqueness)
export async function getUserByEmail(email) {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('email');

    const userData = await new Promise((resolve, reject) => {
      const request = index.get(email);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (userData) {
      console.log('User found by email in IndexedDB:', userData);
      return userData;
    } else {
      console.log('No user found by email in IndexedDB for:', email);
      return null;
    }
  } catch (error) {
    console.error('Error retrieving user by email from IndexedDB:', error);
    return null;
  }
}

// Get user by IP only (for cases where we need to check IP uniqueness)
export async function getUserByIP(ip) {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('ip');

    const userData = await new Promise((resolve, reject) => {
      const request = index.get(ip);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (userData) {
      console.log('User found by IP in IndexedDB:', userData);
      return userData;
    } else {
      console.log('No user found by IP in IndexedDB for:', ip);
      return null;
    }
  } catch (error) {
    console.error('Error retrieving user by IP from IndexedDB:', error);
    return null;
  }
}

// Delete user data from IndexedDB
export async function deleteUserLimits(email, ip) {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Create composite key
    const userKey = `${email}|${ip}`;

    await new Promise((resolve, reject) => {
      const request = store.delete(userKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('User data deleted from IndexedDB for:', email, ip);
    return true;
  } catch (error) {
    console.error('Error deleting from IndexedDB:', error);
    return false;
  }
}

// Get all user data (for debugging)
export async function getAllUserData() {
  try {
    await openDB();

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('All user data from IndexedDB:', allData);
    return allData;
  } catch (error) {
    console.error('Error getting all data from IndexedDB:', error);
    return [];
  }
}

// Sync localStorage with IndexedDB
export async function syncWithIndexedDB(userData) {
  if (!userData || !userData.email) {
    console.warn('Invalid user data for IndexedDB sync');
    return false;
  }

  // Save to IndexedDB
  const saved = await saveUserLimits(userData);

  if (saved) {
    // Update localStorage with the same data
    localStorage.setItem('userData', JSON.stringify(userData));
    console.log('Data synced between IndexedDB and localStorage');
  }

  return saved;
}

// Load user data from IndexedDB to localStorage
export async function loadFromIndexedDB(email, ip) {
  const userData = await getUserLimits(email, ip);

  if (userData) {
    localStorage.setItem('userData', JSON.stringify(userData));
    console.log('User data loaded from IndexedDB to localStorage');
    return userData;
  }

  return null;
}

// Clear all data (for logout)
export async function clearAllData(email, ip) {
  try {
    // Clear IndexedDB
    if (email && ip) {
      await deleteUserLimits(email, ip);
    }

    // Clear localStorage
    localStorage.removeItem('userData');

    // Clear sessionStorage
    sessionStorage.clear();

    console.log('All user data cleared');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

// Auto-sync function to keep data consistent across tabs
export async function startAutoSync(email, ip, intervalMs = 30000) {
  if (!email || !ip) return null;

  const syncInterval = setInterval(async () => {
    try {
      const localData = JSON.parse(localStorage.getItem('userData') || '{}');
      const indexedDBData = await getUserLimits(email, ip);

      if (indexedDBData && localData) {
        // Compare timestamps to see which is more recent
        const localTime = new Date(localData.lastUpdated || 0).getTime();
        const dbTime = new Date(indexedDBData.lastUpdated || 0).getTime();

        if (dbTime > localTime) {
          // IndexedDB has newer data, update localStorage
          localStorage.setItem('userData', JSON.stringify(indexedDBData));
          console.log('🔄 Auto-synced newer data from IndexedDB to localStorage');

          // Trigger a custom event to notify other parts of the app
          window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: indexedDBData
          }));
        }
      }
    } catch (error) {
      console.warn('Auto-sync error:', error);
    }
  }, intervalMs);

  console.log(`🔄 Auto-sync started for ${email}|${ip} (every ${intervalMs/1000}s)`);
  return syncInterval;
}

// Stop auto-sync
export function stopAutoSync(syncInterval) {
  if (syncInterval) {
    clearInterval(syncInterval);
    console.log('🛑 Auto-sync stopped');
  }
}

// Check if email or IP already exists (for validation during registration/login)
export async function checkUserExists(email, ip) {
  try {
    await openDB();

    const emailExists = await getUserByEmail(email);
    const ipExists = await getUserByIP(ip);

    return {
      emailExists: !!emailExists,
      ipExists: !!ipExists,
      emailUser: emailExists,
      ipUser: ipExists,
      canLogin: !!emailExists && !!ipExists && emailExists.userKey === ipExists.userKey
    };
  } catch (error) {
    console.error('Error checking user existence:', error);
    return {
      emailExists: false,
      ipExists: false,
      emailUser: null,
      ipUser: null,
      canLogin: false
    };
  }
}
