import { openDB, getUserLimits, saveUserLimits, clearAllData, startAutoSync, stopAutoSync } from '../utils/indexedDB.js';

const API_URL = "https://api.leadbaseai.in/data";

let currentPage = 1;
const perPage = 10;
const maxPagesPerSession = 10;

let selectedRows = [];
let dailyLimit = 10;
let extraLimit = 5;
let totalRowCount = 0;
let selectedCountry = null;
let autoSyncInterval = null;

const SESSION_KEY = "leadbase_pages";
const SESSION_TIME_KEY = "leadbase_last_reset";

function resetSessionIfExpired() {
  const now = Date.now();
  const last = sessionStorage.getItem(SESSION_TIME_KEY);
  if (!last || now - parseInt(last) > 6 * 60 * 60 * 1000) {
    sessionStorage.setItem(SESSION_TIME_KEY, now.toString());
    sessionStorage.setItem(SESSION_KEY, "0");
  }
}

function incrementPageView() {
  const used = parseInt(sessionStorage.getItem(SESSION_KEY)) || 0;
  if (used >= maxPagesPerSession) return false;
  sessionStorage.setItem(SESSION_KEY, (used + 1).toString());
  return true;
}

async function loadPage(page, country) {
  if (!incrementPageView()) {
    alert("⛔ You’ve hit the session limit of 10 pages. Try again in 6 hours.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}?page=${page}&country=${country}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const rows = json.data || [];
    totalRowCount = json.total || 0;

    updateRowCount();
    renderTable(rows);
    document.getElementById("pageInfo").innerText = `Page ${page} - ${country}`;
  } catch (err) {
    console.error('Load page error:', err);
    alert(`Error loading data: ${err.message}. Please try again or contact support.`);
  }
}

function updateRowCount() {
  const h2 = document.querySelector("#data-for-you h2");
  if (!h2.dataset.originalText) h2.dataset.originalText = h2.innerText;
  h2.innerText = `${h2.dataset.originalText.split("(")[0].trim()} (Total: ${totalRowCount})`;
}

function renderTable(rows) {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const [id, name, phone, email, bio, facebookLink] = row;
    const rowData = {
      Name: name,
      Phone: phone,
      Email: email,
      Bio: bio,
      "Facebook Link": facebookLink
    };

    const isRowSelected = selectedRows.some(r => r.Email === rowData.Email);

    tr.innerHTML = `
      <td><input type="checkbox" data-email="${rowData.Email}" ${isRowSelected ? 'checked' : ''}></td>
      <td>${name}</td>
      <td>${phone}</td>
      <td>${email}</td>
      <td>${bio}</td>
      <td><a href="${facebookLink}" target="_blank">Link</a></td>
    `;

    if (isRowSelected) {
      tr.classList.add("selected");
    }

    const checkbox = tr.querySelector('input[type="checkbox"]');
    checkbox.addEventListener("change", (event) => {
      const checked = event.target.checked;
      if (checked) {
        selectedRows.push(rowData);
        tr.classList.add("selected");
      } else {
        selectedRows = selectedRows.filter(r => r.Email !== rowData.Email);
        tr.classList.remove("selected");
      }
    });

    tr.addEventListener("click", (event) => {
      if (event.target.type === 'checkbox') return;

      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    tbody.appendChild(tr);
  });
}

async function handleDownload() {
  const totalAllowed = dailyLimit + extraLimit;

  if (selectedRows.length === 0) {
    alert("⚠️ Please select at least one row.");
    return;
  }

  if (selectedRows.length > totalAllowed) {
    alert(`❌ Limit exceeded! You can only download ${totalAllowed} more rows.`);
    return;
  }

  const headers = ["Name", "Phone", "Email", "Bio", "Facebook Link"];
  const ws = XLSX.utils.json_to_sheet(selectedRows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `selected_data_${selectedCountry}.xlsx`);

  const used = selectedRows.length;
  if (used <= dailyLimit) {
    dailyLimit -= used;
  } else {
    const excess = used - dailyLimit;
    dailyLimit = 0;
    extraLimit = Math.max(0, extraLimit - excess);
  }

  // Update userData in IndexedDB and localStorage
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  userData.daily_limit = dailyLimit;
  userData.extra_limit = extraLimit;
  userData.lastUpdated = new Date().toISOString();

  // Save to both IndexedDB and localStorage
  const saved = await saveUserLimits(userData);
  if (saved) {
    localStorage.setItem('userData', JSON.stringify(userData));
    console.log('✅ User limits updated in IndexedDB and localStorage');
  } else {
    console.warn('⚠️ Failed to save to IndexedDB, using localStorage only');
    localStorage.setItem('userData', JSON.stringify(userData));
  }

  // Immediately sync the updated limits to the server
  syncLimitsToServer(userData);

  selectedRows = [];
  alert(`✅ Downloaded ${used} rows. Remaining limit: ${dailyLimit + extraLimit}`);
}

function showCountrySelection() {
  document.getElementById("country-selection").style.display = "block";
  document.getElementById("data-container").style.display = "none";
  document.getElementById("backToCountries").style.display = "none";
  document.querySelector(".footer-controls").style.display = "none";
}

function showDataTable() {
  document.getElementById("country-selection").style.display = "none";
  document.getElementById("data-container").style.display = "block";
  document.getElementById("backToCountries").style.display = "block";
  document.querySelector(".footer-controls").style.display = "flex";
}

document.addEventListener("DOMContentLoaded", async () => {
  await openDB(); // Ensure IndexedDB is open

  // Initialize limits from userData in IndexedDB
  const localUserData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (!localUserData.email || !localUserData.ip) {
    alert('Please log in to access the data dashboard.');
    setTimeout(() => window.location.href = '../login/index.html', 2000);
    return;
  }

  const userDataFromDB = await getUserLimits(localUserData.email, localUserData.ip);
  if (userDataFromDB) {
    dailyLimit = userDataFromDB.daily_limit !== undefined ? userDataFromDB.daily_limit : 100;
    extraLimit = userDataFromDB.extra_limit !== undefined ? userDataFromDB.extra_limit : 0;
    // Update localStorage with data from IndexedDB
    localStorage.setItem('userData', JSON.stringify(userDataFromDB));
  } else {
    // If no data in IndexedDB, use localStorage (which might be default or from previous session)
    dailyLimit = localUserData.daily_limit !== undefined ? localUserData.daily_limit : 100;
    extraLimit = localUserData.extra_limit !== undefined ? localUserData.extra_limit : 0;
  }

  // Start auto-sync to keep data consistent across tabs
  const currentUserData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (currentUserData.email && currentUserData.ip) {
    autoSyncInterval = await startAutoSync(currentUserData.email, currentUserData.ip);

    // Listen for data updates from other tabs
    window.addEventListener('userDataUpdated', (event) => {
      const updatedData = event.detail;
      dailyLimit = updatedData.daily_limit !== undefined ? updatedData.daily_limit : dailyLimit;
      extraLimit = updatedData.extra_limit !== undefined ? updatedData.extra_limit : extraLimit;
      console.log('📱 Data updated from another tab:', { dailyLimit, extraLimit });
    });
  }

  resetSessionIfExpired();

  const countryButtons = document.querySelectorAll(".country-btn");
  countryButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCountry = button.dataset.country;
      currentPage = 1;
      loadPage(currentPage, selectedCountry);
      showDataTable();
    });
  });

  document.getElementById("nextPage").addEventListener("click", () => {
    currentPage++;
    loadPage(currentPage, selectedCountry);
  });

  document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadPage(currentPage, selectedCountry);
    }
  });

  document.getElementById("backToCountries").addEventListener("click", () => {
    selectedCountry = null;
    currentPage = 1;
    selectedRows = [];
    showCountrySelection();
  });

  document.getElementById("downloadBtn").addEventListener("click", handleDownload);

  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("selectstart", e => e.preventDefault());

  // Save user data when the page is about to be closed/refreshed
  window.addEventListener('beforeunload', () => {
    // Stop auto-sync
    if (autoSyncInterval) {
      stopAutoSync(autoSyncInterval);
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.email && userData.ip) {
      // Use sendBeacon for reliable data sending during page unload
      const data = JSON.stringify({
        email: userData.email,
        ip: userData.ip,
        daily_limit: userData.daily_limit,
        extra_limit: userData.extra_limit
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_URL.replace('/data', '')}/update-user-limits`, data);
      }
    }
  });

  showCountrySelection();
});

// Function to sync limits to server immediately after download
async function syncLimitsToServer(userData) {
  try {
    const response = await fetch(`${API_URL.replace('/data', '')}/update-user-limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        ip: userData.ip,
        daily_limit: userData.daily_limit,
        extra_limit: userData.extra_limit
      })
    });

    if (!response.ok) {
      console.warn('Failed to sync user limits to server');
    }
  } catch (error) {
    console.warn('Error syncing user limits:', error);
  }
}

// Function to send user data to server on logout
async function sendLogoutData(userData) {
  try {
    const response = await fetch(`${API_URL.replace('/data', '')}/update-user-limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        ip: userData.ip,
        daily_limit: userData.daily_limit,
        extra_limit: userData.extra_limit
      })
    });

    if (!response.ok) {
      console.warn('Failed to sync user data to server');
    }
  } catch (error) {
    console.warn('Error syncing user data:', error);
  }
}

// Function to clear storage
async function clearStorage() {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (userData.email && userData.ip) {
    await clearAllData(userData.email, userData.ip);
  } else {
    localStorage.removeItem('userData');
    sessionStorage.clear();
  }
}

// Handle logout button click
const logoutButton = document.querySelector('a[href="../index.html"]');
if (logoutButton) {
  logoutButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent immediate navigation
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    await sendLogoutData(userData); // Send user data to server
    await clearStorage(); // Clear localStorage, sessionStorage, and IndexedDB
    window.location.href = '../index.html'; // Redirect to index.html
  });
}
