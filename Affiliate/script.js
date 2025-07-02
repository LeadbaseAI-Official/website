import { openDB, saveUserLimits, clearAllData } from '../utils/indexedDB.js';

document.addEventListener("DOMContentLoaded", async () => {
  await openDB(); // Ensure IndexedDB is open

  const generateBtn = document.getElementById("generateBtn");
  const refLinkInput = document.getElementById("refLink");
  const copyBtn = document.getElementById("copyBtn");

  generateBtn.addEventListener("click", async () => {
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const { ip } = await ipRes.json();
      const sanitizedIP = ip.replace(/\./g, "");
      const link = `https://leadbaseai.in/login?referal=${sanitizedIP}`;
      refLinkInput.value = link;
    } catch (error) {
      console.error("Error generating affiliate link:", error);
      alert("Failed to generate affiliate link. Please try again.");
    }
  });

  copyBtn.addEventListener("click", () => {
    refLinkInput.select();
    refLinkInput.setSelectionRange(0, 99999); // For mobile devices
    document.execCommand("copy");
    alert("Affiliate link copied to clipboard!");
  });

  // Handle logout button click
  const logoutButton = document.querySelector('a[href="../index.html"]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault(); // Prevent immediate navigation
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      await sendLogoutData(userData); // Send user data to server
      await clearStorage(); // Clear localStorage and IndexedDB
      window.location.href = '../index.html'; // Redirect to index.html
    });
  }
});

// Function to send user data to server on logout
async function sendLogoutData(userData) {
  try {
    await saveUserLimits(userData); // Save current state to IndexedDB before logout
    const response = await fetch('https://api.leadbaseai.in/update-user-limits', {
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
    await clearAllData(userData.email, userData.ip); // Clear all data from IndexedDB
  } else {
    localStorage.removeItem('userData');
    sessionStorage.clear();
  }
}
