document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generateBtn");
  const refLinkInput = document.getElementById("refLink");
  const copyBtn = document.getElementById("copyBtn");

  generateBtn.addEventListener("click", async () => {
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const { ip } = await ipRes.json();
      const sanitizedIP = ip.replace(/\./g, "");
      const link = `https://leadbaseai.in/login.html?referal=${sanitizedIP}`;
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
      clearStorage(); // Clear localStorage and sessionStorage
      window.location.href = '../index.html'; // Redirect to index.html
    });
  }
});
