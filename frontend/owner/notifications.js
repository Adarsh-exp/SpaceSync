async function initOwnerNotifications() {
  const user = ownerGuard("owner-notifications-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const [notifications, settings] = await Promise.all([
    ownerFetch("/owner/notifications"),
    ownerFetch("/owner/notifications/settings"),
  ]);
  const types = ["booking_request", "booking_confirmed", "booking_cancelled", "new_review", "payout_processed"];

  document.getElementById("owner-notifications-root").innerHTML = `
    <div class="owner-header">
      <div><h1 class="section-title">Notifications</h1><p class="section-sub">Track owner activity and tune delivery preferences.</p></div>
      <button class="btn btn-primary" onclick="markAllNotificationsRead()">Mark all read</button>
    </div>
    ${renderOwnerNav("notifications")}
    <div class="owner-stack">
      <div class="owner-panel">
        ${notifications.length ? notifications.map(item => `
          <div class="notification-item ${item.is_read ? "" : "unread"}">
            <div class="notification-icon">${iconForNotification(item.type)}</div>
            <div><div>${item.message}</div><div class="owner-card-meta">${timeAgo(item.created_at)}</div></div>
            <button class="btn btn-secondary btn-sm" onclick="markNotificationRead(${item.id})">Read</button>
          </div>`).join("") : `<div class="empty-state">No notifications yet.</div>`}
      </div>
      <div class="owner-panel">
        <div class="chart-title">Settings</div>
        <div class="settings-grid">
          ${types.map(type => `
            <div class="settings-row">
              <div>${type.replaceAll("_", " ")}</div>
              <label class="toggle-line"><input type="checkbox" data-email-type="${type}" ${settings.email_types.includes(type) ? "checked" : ""} /> Email</label>
              <label class="toggle-line"><input type="checkbox" data-app-type="${type}" ${settings.in_app_types.includes(type) ? "checked" : ""} /> In-app</label>
            </div>`).join("")}
          <div class="settings-row">
            <div>Quiet hours</div>
            <input id="quiet-hours-start" type="time" value="${settings.quiet_hours_start || ""}" />
            <input id="quiet-hours-end" type="time" value="${settings.quiet_hours_end || ""}" />
          </div>
          <button class="btn btn-primary" onclick="saveNotificationSettings()">Save settings</button>
        </div>
      </div>
    </div>`;
}

async function markAllNotificationsRead() {
  await ownerFetch("/owner/notifications/read-all", { method: "PATCH" });
  toast("Marked all as read");
  initOwnerNotifications();
}

async function markNotificationRead(id) {
  await ownerFetch(`/owner/notifications/${id}/read`, { method: "PATCH" });
  toast("Notification marked as read");
  initOwnerNotifications();
}

async function saveNotificationSettings() {
  const emailTypes = [...document.querySelectorAll("[data-email-type]:checked")].map(node => node.dataset.emailType);
  const inAppTypes = [...document.querySelectorAll("[data-app-type]:checked")].map(node => node.dataset.appType);
  await ownerFetch("/owner/notifications/settings", {
    method: "PATCH",
    body: JSON.stringify({
      email_types: emailTypes,
      in_app_types: inAppTypes,
      quiet_hours_start: document.getElementById("quiet-hours-start").value || null,
      quiet_hours_end: document.getElementById("quiet-hours-end").value || null,
    }),
  });
  toast("Notification settings updated");
}

initOwnerNotifications();
