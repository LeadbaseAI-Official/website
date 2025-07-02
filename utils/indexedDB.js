const DB_NAME = "LeadbaseDB";
const STORE_NAME = "UserLimits";
let db = null;

// Open or create IndexedDB
export async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "email" });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

// Save or update user limits
export async function saveUserLimits(userData) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(userData);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Get user limits and auto-reset if day has changed
export async function getUserLimits(email) {
  if (!db) await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(email);

    request.onsuccess = async () => {
      const data = request.result;

      if (data) {
        const today = new Date().toISOString().split("T")[0];

        if (data.last_reset_date !== today) {
          // Reset daily limits if a new day has started
          data.daily_limit = 100;
          data.extra_limit = 0;
          data.last_reset_date = today;

          try {
            await saveUserLimits(data);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        } else {
          resolve(data);
        }
      } else {
        resolve(null); // no data found
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// Clear all data for the user
export async function clearAllData(email) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(email);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
