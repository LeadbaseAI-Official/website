const API_URL = "https://api.leadbaseai.in/data";

let currentPage = 1;
const perPage = 10;
const maxPagesPerSession = 10;
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

    let isSelected = false;
    tr.innerHTML = `
      <td><input type="checkbox" data-index="${index}"></td>
      <td>${name}</td>
      <td>${phone}</td>
      <td>${email}</td>
      <td>${bio}</td>
      <td><a href="${facebookLink}" target="_blank">Link</a></td>
    `;

    tr.addEventListener("click", () => {
      isSelected = !isSelected;
      tr.classList.toggle("selected", isSelected);
      tr.querySelector("input").checked = isSelected;

      if (isSelected) {
        selectedRows.push(rowData);
      } else {
        selectedRows = selectedRows.filter(r => r.Email !== rowData.Email);
      }
    });

    tbody.appendChild(tr);
  });
}

function handleDownload() {
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
  const csv = [
    headers.join(","),
    ...selectedRows.map(row =>
      headers.map(h => `"${(row[h] || "").replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `selected_data_${selectedCountry}.csv`;
  link.click();

  const used = selectedRows.length;
  if (used <= dailyLimit) {
    dailyLimit -= used;
  } else {
    const excess = used - dailyLimit;
    dailyLimit = 0;
    extraLimit = Math.max(0, extraLimit - excess);
  }

  // Update userData in localStorage
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  userData.daily_limit = dailyLimit;
  userData.extra_limit = extraLimit;
  localStorage.setItem('userData', JSON.stringify(userData));

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

document.addEventListener("DOMContentLoaded", () => {
  // Initialize limits from userData in localStorage
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (!userData.email || !userData.ip) {
    alert('Please log in to access the data dashboard.');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }
  dailyLimit = userData.daily_limit !== undefined ? userData.daily_limit : 10;
  extraLimit = userData.extra_limit !== undefined ? userData.extra_limit : 5;

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

  showCountrySelection();
});

  // Handle logout button click
  const logoutButton = document.querySelector('a[href="index.html"]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault(); // Prevent immediate navigation
      await sendLogoutData(userData); // Send user data to server
      clearStorage(); // Clear localStorage and sessionStorage
      window.location.href = 'index.html'; // Redirect to index.html
    });
  };