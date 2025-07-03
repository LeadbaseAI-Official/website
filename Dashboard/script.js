import { UserManager } from "../utility/app.js";

const API_URL = "https://api.leadbaseai.in";
const SESSION_KEY = "leadbase_user_fetch";
const SESSION_TIME_KEY = "leadbase_last_fetch";

// Resets session every 6 hours
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

// Fetch limits + affiliates from server
async function fetchUserLimits(email, ip) {
  try {
    const response = await fetch(`${API_URL}/check-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ip }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to fetch");

    if (result.emailExists && result.ipExists && result.user) {
      return {
        daily_limit: parseInt(result.user.daily_limit) || 100,
        extra_limit: parseInt(result.user.extra_limit) || 0,
        affiliates: parseInt(result.user.affiliate) || 0,
        name: result.user.name || "",
      };
    }

    throw new Error("User not found");
  } catch (err) {
    console.error("⚠️ Failed to fetch user limits:", err.message);
    return null;
  }
}

// Show error on page
function showError(message) {
  const el = document.getElementById("error-message");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

// MAIN: Run when page loads
document.addEventListener("DOMContentLoaded", async () => {
  await UserManager.init();

  const localUser = await UserManager.get();
  if (!localUser?.email || !localUser?.ip) {
    showError("Please log in to access the dashboard.");
    setTimeout(() => (window.location.href = "index.html"), 2000);
    return;
  }

  document.getElementById("username").textContent = localUser.name || "User";

  const shouldFetch = resetFetchIfExpired();
  if (shouldFetch) {
    const fresh = await fetchUserLimits(localUser.email, localUser.ip);
    if (fresh) {
      const updatedUser = { ...localUser, ...fresh };
      await UserManager.set(updatedUser);
    }
  }

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
      clearStorage(); // Clears IndexedDB/session
      window.location.href = "index.html";
    });
  }
});
