import { UserManager } from "../utility/app.js";

const API_URL = "https://api.leadbaseai.in";
const SESSION_KEY = "leadbase_user_fetch";
const SESSION_TIME_KEY = "leadbase_last_fetch";

function resetFetchIfExpired() {
  const now = Date.now();
  const last = sessionStorage.getItem(SESSION_TIME_KEY);
  if (!last || now - parseInt(last) > 6 * 60 * 60 * 1000) {
    sessionStorage.setItem(SESSION_TIME_KEY, now.toString());
    sessionStorage.setItem(SESSION_KEY, "0");
    return true;
  }
  return false;
}

async function fetchAffiliate(email, ip) {
  try {
    const response = await fetch(`${API_URL}/check-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ip }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch affiliate data");
    }

    if (result.emailExists && result.ipExists) {
      return {
        affiliates: parseInt(result.user.affiliate) || 0,
        daily_limit: result.user.daily_limit || 100,
        extra_limit: result.user.extra_limit || 0,
      };
    } else {
      throw new Error("User not found");
    }
  } catch (err) {
    console.error("Fetch affiliate error:", err);
    showError("Failed to fetch data. Using cached values.");
    return null;
  }
}

function showError(message) {
  const el = document.getElementById("error-message");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const userData = await UserManager.get();

  if (!userData?.email || !userData?.ip) {
    showError("Please log in to access the dashboard.");
    setTimeout(() => (window.location.href = "index.html"), 2000);
    return;
  }

  document.getElementById("username").textContent = userData.name || "User";

  const shouldFetch = resetFetchIfExpired();
  if (shouldFetch) {
    const fetchedData = await fetchAffiliate(userData.email, userData.ip);
    if (fetchedData !== null) {
      userData.affiliates = fetchedData.affiliates;
      userData.daily_limit = fetchedData.daily_limit;
      userData.extra_limit = fetchedData.extra_limit;
      await UserManager.set(userData);
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  }

  // Load data from IndexedDB (whether updated or not)
  const finalUser = await UserManager.get();

  document.getElementById("daily-limit").textContent =
    finalUser.daily_limit ?? 100;
  document.getElementById("extra-limit").textContent =
    finalUser.extra_limit ?? 0;
  document.getElementById("total-affiliates").textContent =
    finalUser.affiliates ?? 0;

  // Logout handler
  const logoutButton = document.querySelector('a[href="index.html"]');
  if (logoutButton) {
    logoutButton.addEventListener("click", async (e) => {
      e.preventDefault();
      await sendLogoutData(finalUser);
      clearStorage(); // should also clear IndexedDB inside this
      window.location.href = "index.html";
    });
  }
});
