import { getUserLimits, saveUserLimits, openDB, clearAllData } from "../utils/indexedDB.js";

const API_URL = "https://api.leadbaseai.in/data";

let currentPage = 1;
let selectedRows = [];
let dailyLimit = 10;
let extraLimit = 5;
let totalRowCount = 0;
let selectedCountry = null;

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
  if (used >= 10) return false;
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
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const json = await res.json();
    const rows = json.data || [];
    totalRowCount = json.total || 0;

    updateRowCount();
    renderTable(rows);
    document.getElementById("pageInfo").innerText = `Page ${page} - ${country}`;
  } catch (err) {
    alert(`❌ Error loading data: ${err.message}`);
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

  rows.forEach(row => {
    const [id, name, phone, email, bio, facebookLink] = row;
    const rowData = { Name: name, Phone: phone, Email: email, Bio: bio, "Facebook Link": facebookLink };

    const isSelected = selectedRows.some(r => r.Email === email);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-email="${email}" ${isSelected ? 'checked' : ''}></td>
      <td>${name}</td>
      <td>${phone}</td>
      <td>${email}</td>
      <td>${bio}</td>
      <td><a href="${facebookLink}" target="_blank">Link</a></td>
    `;

    if (isSelected) tr.classList.add("selected");

    const checkbox = tr.querySelector('input[type="checkbox"]');
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedRows.push(rowData);
        tr.classList.add("selected");
      } else {
        selectedRows = selectedRows.filter(r => r.Email !== email);
        tr.classList.remove("selected");
      }
    });

    tr.addEventListener("click", (e) => {
      if (e.target.type !== "checkbox") {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      }
    });

    tbody.appendChild(tr);
  });
}

async function handleDownload() {
  const allowed = dailyLimit + extraLimit;
  if (selectedRows.length === 0) return alert("⚠️ Select at least one row.");
  if (selectedRows.length > allowed) return alert(`❌ Limit exceeded. Max: ${allowed}`);

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

  const userData = JSON.parse(localStorage.getItem("userData"));
  userData.daily_limit = dailyLimit;
  userData.extra_limit = extraLimit;

  await saveUserLimits(userData);

  selectedRows = [];
  alert(`✅ Downloaded ${used} rows. Remaining: ${dailyLimit + extraLimit}`);
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
  await openDB();

  const localUser = JSON.parse(localStorage.getItem("userData") || "{}");
  if (!localUser.email || !localUser.ip) {
    alert("Please log in.");
    return setTimeout(() => location.href = "../login/index.html", 2000);
  }

  const limits = await getUserLimits(localUser.email);
  if (limits) {
    dailyLimit = limits.daily_limit ?? 100;
    extraLimit = limits.extra_limit ?? 0;
  } else {
    dailyLimit = 100;
    extraLimit = 0;
    await saveUserLimits({
      email: localUser.email,
      daily_limit: dailyLimit,
      extra_limit: extraLimit,
      last_reset_date: new Date().toISOString().split("T")[0]
    });
  }

  resetSessionIfExpired();

  document.querySelectorAll(".country-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      selectedCountry = btn.dataset.country;
      currentPage = 1;
      loadPage(currentPage, selectedCountry);
      showDataTable();
    })
  );

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

  window.addEventListener("beforeunload", async () => {
    const userData = await getUserLimits(localUser.email);
    if (userData) {
      navigator.sendBeacon(`${API_URL.replace("/data", "")}/update-user-limits`, JSON.stringify(userData));
    }
  });

  showCountrySelection();
});

// Logout handler
const logoutButton = document.querySelector('a[href="../index.html"]');
if (logoutButton) {
  logoutButton.addEventListener("click", async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem("userData") || "{}");
    await fetch(`${API_URL.replace("/data", "")}/update-user-limits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, ip: user.ip, daily_limit: dailyLimit, extra_limit: extraLimit })
    });
    await clearAllData(user.email);
    localStorage.removeItem("userData");
    sessionStorage.clear();
    window.location.href = "../index.html";
  });
}
