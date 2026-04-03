async function initOwnerProfile() {
  const user = ownerGuard("owner-profile-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const [profile, payouts] = await Promise.all([
    ownerFetch("/owner/profile"),
    ownerFetch("/owner/payouts"),
  ]);

  document.getElementById("owner-profile-root").innerHTML = `
    <div class="owner-header"><div><h1 class="section-title">Business Profile</h1><p class="section-sub">Update your business information, contact details, payout settings, and password.</p></div></div>
    ${renderOwnerNav("profile")}
    <div class="profile-grid">
      <div class="owner-panel">
        <div class="chart-title">Business Info</div>
        <div class="form-group"><label>Business name</label><input id="profile-business-name" value="${profile.business_name || ""}" /></div>
        <div class="form-group"><label>Business mobile number</label><input id="profile-phone" placeholder="e.g. 9876543210" value="${profile.phone || ""}" /></div>
        <div class="form-group"><label>Owner email</label><input value="${user.email || ""}" disabled /></div>
        <div class="form-group"><label>City</label><input id="profile-city" value="${profile.city || ""}" /></div>
        <div class="form-group"><label>GST number</label><input id="profile-gst" value="${profile.gst_number || ""}" /></div>
        <div class="owner-card-meta">This mobile number is shown to users for calls and WhatsApp.</div>
      </div>
      <div class="owner-panel">
        <div class="chart-title">Payout Settings</div>
        <div class="form-group"><label>Bank account</label><input id="profile-bank" value="${profile.bank_account || ""}" /></div>
        <div class="form-group"><label>UPI ID</label><input id="profile-upi" value="${profile.upi_id || ""}" /></div>
        <div class="form-group"><label>Payout frequency</label><select id="profile-frequency"><option value="weekly" ${profile.payout_frequency === "weekly" ? "selected" : ""}>Weekly</option><option value="monthly" ${profile.payout_frequency === "monthly" ? "selected" : ""}>Monthly</option></select></div>
        <div class="owner-card-meta">Total earned: ${formatMoney(profile.total_earned)}</div>
      </div>
    </div>
    <div class="owner-panel mt-2">
      <div class="chart-title">Public Contact Preview</div>
      <div class="profile-grid">
        <div>
          <div class="text-muted text-sm">Business name</div>
          <div style="font-weight:600;margin-top:0.2rem;">${profile.business_name || "Not added yet"}</div>
        </div>
        <div>
          <div class="text-muted text-sm">Business mobile</div>
          <div style="font-weight:600;margin-top:0.2rem;">${profile.phone || "Not added yet"}</div>
        </div>
      </div>
      <div class="mt-2 text-sm text-muted">Users will use this information for call, WhatsApp, and enquiry actions on your space detail page.</div>
    </div>
    <div class="owner-panel mt-2">
      <div class="chart-title">Change Password</div>
      <div class="profile-grid">
        <div class="form-group"><label>Old password</label><input type="password" id="profile-old-password" /></div>
        <div class="form-group"><label>New password</label><input type="password" id="profile-new-password" /></div>
      </div>
      <div class="form-group"><label>Confirm password</label><input type="password" id="profile-confirm-password" /></div>
      <button class="btn btn-primary" onclick="saveOwnerProfile()">Save Business Info</button>
    </div>
    <div class="owner-panel mt-2">
      <div class="chart-title">Payout History</div>
      ${payouts.length ? `<div class="table-scroll"><table><thead><tr><th>Amount</th><th>Period</th><th>Status</th><th>Processed</th></tr></thead><tbody>${payouts.map(item => `<tr><td>${formatMoney(item.amount)}</td><td>${item.period_start} to ${item.period_end}</td><td>${statusBadge(item.status)}</td><td>${item.processed_at || "-"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state">No payout history yet.</div>`}
    </div>`;
}

async function saveOwnerProfile() {
  try {
    const phone = document.getElementById("profile-phone").value.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (phone && phoneDigits.length < 10) {
      toast("Business mobile number must have at least 10 digits", "error");
      return;
    }

    await ownerFetch("/owner/profile", {
      method: "PUT",
      body: JSON.stringify({
        business_name: document.getElementById("profile-business-name").value,
        phone,
        city: document.getElementById("profile-city").value,
        gst_number: document.getElementById("profile-gst").value,
        bank_account: document.getElementById("profile-bank").value,
        upi_id: document.getElementById("profile-upi").value,
        payout_frequency: document.getElementById("profile-frequency").value,
        old_password: document.getElementById("profile-old-password").value || null,
        new_password: document.getElementById("profile-new-password").value || null,
        confirm_password: document.getElementById("profile-confirm-password").value || null,
      }),
    });
    toast("Business profile updated");
    initOwnerProfile();
  } catch (error) {
    toast(error.message, "error");
  }
}

initOwnerProfile();
