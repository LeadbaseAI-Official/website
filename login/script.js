const API_URL = "https://api.leadbaseai.in";
const loadingOverlay = document.getElementById('loadingOverlay');

function showLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('visible');
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('visible');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) form.addEventListener('submit', handleLogin);

  const params = new URLSearchParams(window.location.search);
  const referal = params.get("referal");
  if (referal) localStorage.setItem("ref_source", referal);
});

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!email || !name || !phone) return showError('Please fill in all fields.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Please enter a valid email address.');
  if (!/^\+?\d{10,15}$/.test(phone)) {
    hideLoading(); // Hide loading if validation fails
    return showError('Please enter a valid phone number.');
  }

  showLoading(); // Show loading spinner

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();

    const response = await fetch(`${API_URL}/check-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, ip })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to check user');
    }

    if (result.emailExists && result.ipExists) {
      const row = result.user || {};
      const existingUserData = JSON.parse(localStorage.getItem('userData')) || {};

      // Prioritize locally stored limits if they exist and are lower (indicating usage)
      const serverDailyLimit = parseInt(row.daily_limit) || 100;
      const serverExtraLimit = parseInt(row.extra_limit) || 0;
      const localDailyLimit = existingUserData.daily_limit;
      const localExtraLimit = existingUserData.extra_limit;

      const userData = {
        email,
        ip,
        name: row.name || name,
        phone: row.phone || phone,
        verified: true,
        daily_limit: (localDailyLimit !== undefined && localDailyLimit <= serverDailyLimit) ? localDailyLimit : serverDailyLimit,
        extra_limit: (localExtraLimit !== undefined && localExtraLimit <= serverExtraLimit) ? localExtraLimit : serverExtraLimit,
        affiliates: parseInt(row.affiliate) || (existingUserData.affiliates ?? 0)
      };
      localStorage.setItem('userData', JSON.stringify(userData));
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
        daily_limit: (JSON.parse(localStorage.getItem('userData'))?.daily_limit ?? 100),
        extra_limit: (JSON.parse(localStorage.getItem('userData'))?.extra_limit ?? 0),
        affiliates: (JSON.parse(localStorage.getItem('userData'))?.affiliates ?? 0),
        ref_source: localStorage.getItem("ref_source") || null // Store ref_source
      };
      localStorage.setItem('userData', JSON.stringify(userData));
      window.location.href = '../quiz/index.html';
    }
  } catch (err) {
    console.error('Login error:', err);
    showError('Something went wrong. Please try again.');
  } finally {
    hideLoading(); // Ensure loading spinner is hidden
  }
}

function showError(message) {
  const el = document.getElementById('error-message');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}
