  import { userManager } from "../utility/app.js";

  const API_URL = "https://api.leadbaseai.in/data";

  let currentPage = 1;
  let selectedRows = [];
  let totalRowCount = 0;
  let selectedCountry = null;

  let dailyLimit = 0;
  let extraLimit = 0;

  const SESSION_KEY = "leadbase_pages";
  const SESSION_TIME_KEY = "leadbase_last_reset";

  function resetSessionIfExpired() {
    const now = Date.now();
    const last = parseInt(sessionStorage.getItem(SESSION_TIME_KEY)) || 0;
    if (!last || now - last > 6 * 60 * 60 * 1000) {
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
      alert("⛔ You've hit the session limit of 10 pages. Try again in 6 hours.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}?page=${page}&country=${country}`);
      const json = await res.json();
      const rows = json.data || [];
      totalRowCount = json.total || 0;

      updateRowCount();
      renderTable(rows);
      document.getElementById("pageInfo").innerText = `Page ${page} - ${country}`;
    } catch (err) {
      console.error("Load page error:", err);
      alert(`Error loading data: ${err.message}`);
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

    // ✅ Reverse the rows so latest entries come first
    rows.reverse().forEach((row, index) => {
      const [name, email, phone, bio, facebookLink] = row;

      const rowData = {
        Name: name,
        Email: email,
        Phone: phone,
        Bio: bio,
        "Facebook Link": facebookLink
      };

      const tr = document.createElement("tr");
      let isSelected = false;

      tr.innerHTML = `
        <td><input type="checkbox" data-index="${index}"></td>
        <td>${name}</td>
        <td>${email}</td>
        <td>${phone}</td>
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


  async function handleDownload() {
    const allowed = dailyLimit + extraLimit;

    if (selectedRows.length === 0) {
      alert("⚠️ Please select at least one row.");
      return;
    }

    if (selectedRows.length > allowed) {
      alert(`❌ Limit exceeded! You can only download ${allowed} more rows.`);
      return;
    }

    // Create and trigger download
    const headers = ["Name", "Phone", "Email", "Bio", "Facebook Link"];
    const csv = [
      headers.join(","),
      ...selectedRows.map(row => headers.map(h => `"${(row[h] || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `selected_data_${selectedCountry}.csv`;
    link.click();

    // Deduct and persist limits
    const used = selectedRows.length;
    if (used <= dailyLimit) {
      dailyLimit -= used;
    } else {
      const excess = used - dailyLimit;
      dailyLimit = 0;
      extraLimit = Math.max(0, extraLimit - excess);
    }

    // Update user in IndexedDB
    const user = await userManager.get();
    user.daily_limit = dailyLimit;
    user.extra_limit = extraLimit;
    await userManager.set(user);

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

  async function initializeLimits(user) {
    // Check if user is new (doesn't have limit properties set)
    if (!user.hasOwnProperty('daily_limit') || !user.hasOwnProperty('extra_limit')) {
      // New user - set default limits
      dailyLimit = 10;
      extraLimit = 5;
      user.daily_limit = dailyLimit;
      user.extra_limit = extraLimit;
      await userManager.set(user);
    } else {
      // Existing user - load persisted limits (even if 0)
      dailyLimit = user.daily_limit;
      extraLimit = user.extra_limit;
    }
  }

  // === MAIN ENTRY POINT ===
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await userManager.get();

    if (!user?.email || !user?.ip || !user?.verified) {
      alert("Please log in first.");
      return window.location.href = "index.html";
    }

    // Initialize limits based on user status (new vs existing)
    await initializeLimits(user);

    resetSessionIfExpired();

    // === UI Events ===
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
      selectedRows = [];
      showCountrySelection();
    });

    document.getElementById("downloadBtn").addEventListener("click", handleDownload);

    document.addEventListener("contextmenu", e => e.preventDefault());
    document.addEventListener("selectstart", e => e.preventDefault());

    showCountrySelection(); // Initial screen
  });

  // === LOGOUT ===
  const logoutButton = document.querySelector('a[href="index.html"]');
  if (logoutButton) {
    logoutButton.addEventListener("click", async (e) => {
      e.preventDefault();
      await userManager.clearAllUsers();
      window.location.href = "index.html";
    });
  }