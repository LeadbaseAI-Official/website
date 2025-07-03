const API_URL = "https://api.leadbaseai.in";
const loadingOverlay = document.getElementById('loadingOverlay');

// Correct import: import the instance, not the class
import { userManager } from '../utility/app.js'; // ✅ FIXED

function showLoading() {
  if (loadingOverlay) loadingOverlay.classList.add('visible');
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove('visible');
}

function showError(message) {
  const el = document.getElementById('error-message');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  } else {
    alert(message); // Fallback
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await userManager.init();

    // Auto-login flow
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();
    const allUsers = await userManager.loadUsers();

    const existingUser = allUsers.find(u => u.ip === ip && u.verified === true);
    if (existingUser) {
      console.log("✅ Auto-redirecting verified user:", existingUser.email);
      window.location.href = '../Dashboard/index.html';
      return;
    }
  } catch (e) {
    console.warn("⚠️ Auto-login check failed:", e.message);
  }

  // Attach login form handler
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', handleLogin);
  } else {
    console.error("❌ Login form not found");
  }
});

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!email || !name || !phone) return showError('Please fill in all fields.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Please enter a valid email address.');
  if (!/^\+?\d{10,15}$/.test(phone)) {
    hideLoading();
    return showError('Please enter a valid phone number.');
  }

  showLoading();

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();

    const response = await fetch(`${API_URL}/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ip })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to check user');

    if (result.emailExists && result.ipExists) {
      const row = result.user || {};
      const userData = {
        email,
        ip,
        name: row.name || name,
        phone: row.phone || phone,
        verified: true,
        daily_limit: parseInt(row.daily_limit) || 100,
        extra_limit: parseInt(row.extra_limit) || 0,
        affiliates: parseInt(row.affiliate) || 0
      };
      await userManager.saveUser(userData);
      window.location.href = '../Dashboard/index.html';
    } else if (result.ipExists && !result.emailExists) {
      showError('Your one account already exists, please login with that.');
    } else {
      const userData = {
        email,
        ip,
        name,
        phone,
        verified: false,
        daily_limit: 100,
        extra_limit: 0,
        affiliates: 0
      };
      await userManager.saveUser(userData);
      window.location.href = '../quiz/index.html';
    }
  } catch (err) {
    console.error('Login error:', err);
    showError('Something went wrong. Please try again.');
  } finally {
    hideLoading();
  }
}
