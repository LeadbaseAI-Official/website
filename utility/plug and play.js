const manager = new UserManager();

async function boot() {
  await manager.init();

  await manager.saveUser({
    email: "aakash@leadbaseai.com",
    name: "Aakash",
    ip: "192.168.0.1",
    phone: "9999999999",
    verified: true,
    daily_limit: 100,
    extra_limit: 10
  });

  const verifiedUsers = await manager.getVerifiedUsers();
  console.log("Verified users:", verifiedUsers);
}

boot();
