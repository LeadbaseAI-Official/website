import { getUserLimits, clearAllData } from "../utils/indexedDB.js";

document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generateBtn");
  const logoutBtn = document.getElementById("logoutLink");

  generateBtn.addEventListener("click", async () => {
    const userData = await getUserLimits();

    if (!userData?.email || !userData?.ip) {
      alert("Please log in again to access your affiliate link.");
      window.location.href = "../index.html";
      return;
    }

    const encoded = encodeURIComponent(userData.email);
    const link = `https://leadbaseai.in/login.html?affiliate=${encoded}`;
    document.getElementById("refLink").value = link;
  });

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await clearAllData();
    window.location.href = "../index.html";
  });
});
