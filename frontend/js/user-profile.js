async function loadUserProfile() {
  const user = getUser();
  const root = document.getElementById("user-profile-root");
  if (!user || user.role !== "user") {
    root.innerHTML = `
      <div class="empty-state">
        <h2 class="section-title">User Profile</h2>
        <p class="mt-1">Log in with a user account to update your information.</p>
        <a class="btn btn-primary mt-2" href="index.html">Go Home</a>
      </div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    const profile = await res.json();
    if (!res.ok) throw new Error(profile.detail || "Failed to load profile");

    root.innerHTML = `
      <div class="user-profile-shell">
        <div class="user-profile-hero">
          <section class="user-profile-banner">
            <div class="user-profile-kicker">Account Center</div>
            <h1 class="user-profile-title">My Profile</h1>
          </section>
          <aside class="user-profile-summary">
            <div>
              <div class="user-profile-summary-label">Account Type</div>
              <div class="user-profile-summary-value">User</div>
            </div>
            <div>
              <div class="user-profile-summary-label">Signed In As</div>
              <div style="font-weight:600;">${profile.email || ""}</div>
            </div>
            <div class="user-profile-badge">Live account details</div>
          </aside>
        </div>
        <div class="user-profile-layout">
          <section class="user-profile-card">
            <div class="user-profile-card-title">Personal Info</div>
            <div class="user-profile-field-grid">
              <div class="form-group"><label>Name</label><input id="user-profile-name" value="${profile.name || ""}" /></div>
              <div class="form-group"><label>City</label><input id="user-profile-city" value="${profile.city || ""}" /></div>
            </div>
            <div class="form-group"><label>Email</label><input value="${profile.email || ""}" disabled /></div>
            <div class="user-profile-actions">
              <button class="btn btn-primary" onclick="saveUserProfile('info')">Save Info</button>
            </div>
          </section>
          <section class="user-profile-card">
            <div class="user-profile-card-title">Change Password</div>
            <div class="user-profile-field-grid">
              <div class="form-group"><label>Old password</label><input type="password" id="user-profile-old-password" /></div>
              <div class="form-group"><label>New password</label><input type="password" id="user-profile-new-password" /></div>
            </div>
            <div class="form-group"><label>Confirm password</label><input type="password" id="user-profile-confirm-password" /></div>
            <div class="user-profile-actions">
              <button class="btn btn-primary" onclick="saveUserProfile('password')">Update Password</button>
            </div>
          </section>
        </div>
      </div>
      `;
  } catch (error) {
    root.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function saveUserProfile(mode = "all") {
  const payload = {
    name: document.getElementById("user-profile-name").value.trim(),
    city: document.getElementById("user-profile-city").value.trim(),
    old_password: document.getElementById("user-profile-old-password").value || null,
    new_password: document.getElementById("user-profile-new-password").value || null,
    confirm_password: document.getElementById("user-profile-confirm-password").value || null,
  };

  if (mode === "info") {
    payload.old_password = null;
    payload.new_password = null;
    payload.confirm_password = null;
  }

  if (mode === "password") {
    payload.name = undefined;
    payload.city = undefined;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update profile");

    setAuth(getToken(), data);
    updateNav();
    toast(mode === "password" ? "Password updated" : "Profile updated");
    loadUserProfile();
  } catch (error) {
    toast(error.message, "error");
  }
}

loadUserProfile();
