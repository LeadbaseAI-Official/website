  // Handle logout button click
  const logoutButton = document.querySelector('a[href="index.html"]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault(); // Prevent immediate navigation
      await sendLogoutData(userData); // Send user data to server
      clearStorage(); // Clear localStorage and sessionStorage
      window.location.href = 'index.html'; // Redirect to index.html
    });
  }