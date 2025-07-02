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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ip })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch affiliate data');
    }

    if (result.emailExists && result.ipExists) {
      return {
        affiliates: parseInt(result.user.affiliate) || 0,
        daily_limit: result.user.daily_limit || 100,
        extra_limit: result.user.extra_limit || 0
      };
    } else {
      throw new Error('User not found');
    }
  } catch (err) {
    console.error('Fetch affiliate error:', err);
    showError('Failed to fetch data. Using cached values.');
    return null;
  }
}

function showError(message) {
  const el = document.getElementById('error-message');
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  if (!userData.email || !userData.ip) {
    showError('Please log in to access the dashboard.');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }

  // Update username display from localStorage
  document.getElementById('username').textContent = userData.name || 'User';

  // Fetch data from server once per session if needed
  const shouldFetch = resetFetchIfExpired();
  if (shouldFetch) {
    const fetchedData = await fetchAffiliate(userData.email, userData.ip);
    if (fetchedData !== null) {
      userData.affiliates = fetchedData.affiliates;

      // Only update limits if the server values are higher (indicating a limit increase)
      // Preserve locally stored reduced limits
      const currentDailyLimit = userData.daily_limit !== undefined ? userData.daily_limit : 100;
      const currentExtraLimit = userData.extra_limit !== undefined ? userData.extra_limit : 0;

      userData.daily_limit = Math.max(currentDailyLimit, fetchedData.daily_limit);
      userData.extra_limit = Math.max(currentExtraLimit, fetchedData.extra_limit);

      localStorage.setItem('userData', JSON.stringify(userData));
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  }

  // Update dashboard with values from localStorage
  document.getElementById('daily-limit').textContent = userData.daily_limit !== undefined ? userData.daily_limit : 100;
  document.getElementById('extra-limit').textContent = userData.extra_limit !== undefined ? userData.extra_limit : 0;
  document.getElementById('total-affiliates').textContent = userData.affiliates !== undefined ? userData.affiliates : 0;

  // Save user data when the page is about to be closed/refreshed
  window.addEventListener('beforeunload', () => {
    const currentUserData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (currentUserData.email && currentUserData.ip) {
      const data = JSON.stringify({
        email: currentUserData.email,
        ip: currentUserData.ip,
        daily_limit: currentUserData.daily_limit,
        extra_limit: currentUserData.extra_limit
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_URL}/update-user-limits`, data);
      }
    }
  });
});

// Function to send user data to server on logout
async function sendLogoutData(userData) {
  try {
    const response = await fetch(`${API_URL}/update-user-limits`, {
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
function clearStorage() {
  localStorage.removeItem('userData');
  sessionStorage.clear();
}

// Handle logout button click
const logoutButton = document.querySelector('a[href="../index.html"]');
if (logoutButton) {
  logoutButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent immediate navigation
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    await sendLogoutData(userData); // Send user data to server
    clearStorage(); // Clear localStorage and sessionStorage
    window.location.href = '../index.html'; // Redirect to index.html
  });
}
