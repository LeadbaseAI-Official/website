const API_URL = "https://api.leadbaseai.in";
import { userManager } from '../utility/app.js';

const loadingOverlay = document.getElementById('loadingOverlay');

function showLoading() {
  if (loadingOverlay) loadingOverlay.classList.add('visible');
}
function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove('visible');
}
function showError(msg) {
  const el = document.getElementById('error-message');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  } else {
    alert(msg);
  }
}

async function getIP() {
  const res = await fetch('https://api.ipify.org?format=json');
  const data = await res.json();
  return data.ip;
}

async function autoLogin() {
  try {
    await userManager.init();
    const ip = await getIP();
    const users = await userManager.db.readAll();
    const verifiedUser = users.find(u => u.ip === ip && u.verified);

    if (verifiedUser) {
      console.log("✅ Auto-login: Redirecting user", verifiedUser.email);
      window.location.href = '../Dashboard/index.html';
      return true;
    }
  } catch (err) {
    console.warn("⚠️ Auto-login error:", err.message);
  }
  return false;
}

async function handleLogin(event) {
  event.preventDefault();
  showLoading();

  const email = document.getElementById('email').value.trim();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!email || !name || !phone) return showError('Please fill all fields.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Invalid email format.');
  if (!/^\+?\d{10,15}$/.test(phone)) return showError('Invalid phone number.');

  try {
    const ip = await getIP();
    const res = await fetch(`${API_URL}/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ip })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "User check failed");

    const row = result.user || {};
    const userData = {
      email,
      ip,
      name: row.name || name,
      phone: row.phone || phone,
      verified: result.emailExists && result.ipExists,
      daily_limit: parseInt(row.daily_limit) || 100,
      extra_limit: parseInt(row.extra_limit) || 0,
      affiliates: parseInt(row.affiliate) || 0
    };

    await userManager.saveUser(userData);

    if (userData.verified) {
      window.location.href = "../Dashboard/index.html";
    } else {
      window.location.href = "../quiz/index.html";
    }

  } catch (err) {
    console.error("❌ Login failed:", err);
    showError("Something went wrong. Please try again.");
  } finally {
    hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const loggedIn = await autoLogin();
  if (!loggedIn) {
    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', handleLogin);
    else console.error("❌ Login form not found");
  }
});
