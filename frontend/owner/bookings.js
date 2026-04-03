let bookingTab = "pending";

async function initOwnerBookings() {
  const user = ownerGuard("owner-bookings-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const spaces = (await ownerFetch("/spaces", { headers: authHeaders() }).catch(() => [])).filter(space => space.owner_id === user.id);
  const root = document.getElementById("owner-bookings-root");
  root.innerHTML = `
    <div class="owner-header">
      <div><h1 class="section-title">Bookings</h1><p class="section-sub">Approve requests, review history, and export filtered CSV files.</p></div>
      <button class="btn btn-primary" id="export-bookings-btn">Export CSV</button>
    </div>
    ${renderOwnerNav("bookings")}
    <div class="tabs">
      <button class="tab active" data-tab="pending">Pending</button>
      <button class="tab" data-tab="all">All Bookings</button>
    </div>
    <div class="owner-panel">
      <div class="owner-filters">
        <select id="booking-space-filter"><option value="">All Spaces</option>${spaces.map(space => `<option value="${space.id}">${space.name}</option>`).join("")}</select>
        <input id="booking-from-filter" type="date" />
        <input id="booking-to-filter" type="date" />
        <select id="booking-status-filter">
          <option value="">Any Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div id="owner-bookings-content" class="owner-stack mt-2"></div>
    </div>`;

  root.querySelectorAll("[data-tab]").forEach(tab => tab.addEventListener("click", () => switchBookingTab(tab.dataset.tab)));
  document.getElementById("booking-space-filter").addEventListener("change", loadOwnerBookings);
  document.getElementById("booking-from-filter").addEventListener("change", loadOwnerBookings);
  document.getElementById("booking-to-filter").addEventListener("change", loadOwnerBookings);
  document.getElementById("booking-status-filter").addEventListener("change", loadOwnerBookings);
  document.getElementById("export-bookings-btn").addEventListener("click", exportBookingsCsv);
  await loadOwnerBookings();
}

function switchBookingTab(tab) {
  bookingTab = tab;
  document.querySelectorAll("[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
  loadOwnerBookings();
}

async function loadOwnerBookings() {
  const content = document.getElementById("owner-bookings-content");
  content.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    if (bookingTab === "pending") {
      const items = await ownerFetch("/owner/bookings/pending");
      content.innerHTML = items.length ? items.map(renderPendingCard).join("") : `<div class="empty-state">No pending booking requests right now.</div>`;
    } else {
      const params = new URLSearchParams();
      const spaceId = document.getElementById("booking-space-filter").value;
      const from = document.getElementById("booking-from-filter").value;
      const to = document.getElementById("booking-to-filter").value;
      const status = document.getElementById("booking-status-filter").value;
      if (spaceId) params.set("space_id", spaceId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      const items = await ownerFetch(`/owner/bookings/all?${params.toString()}`);
      content.innerHTML = items.length ? renderBookingsTable(items) : `<div class="empty-state">No bookings match these filters.</div>`;
    }
  } catch (error) {
    content.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

function renderPendingCard(item) {
  const expires = item.request_expires_at ? new Date(item.request_expires_at) : null;
  const minutes = expires ? Math.max(0, Math.floor((expires.getTime() - Date.now()) / 60000)) : 0;
  return `
    <div class="owner-card pending-card">
      <div class="owner-toolbar">
        <div>
          <div class="owner-card-title">${item.space_name}</div>
          <div class="owner-card-meta">${item.user_name} · ${item.user_email}</div>
        </div>
        ${statusBadge(item.status)}
      </div>
      <div class="owner-card-meta">${item.slot_date} · ${item.slot_time} · ${formatMoney(item.price_paid)}</div>
      <div class="countdown">${minutes} minutes left to review</div>
      <div class="flex gap-1">
        <button class="btn btn-primary btn-sm" onclick="decideBooking(${item.id}, 'approve')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="decideBooking(${item.id}, 'reject')">Reject</button>
      </div>
    </div>`;
}

function renderBookingsTable(items) {
  return `
    <div class="table-scroll">
      <table>
        <thead><tr><th>Booking</th><th>User</th><th>Space</th><th>Date</th><th>Slot</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map(item => `<tr><td>#${item.id}</td><td>${item.user_name}</td><td>${item.space_name}</td><td>${item.slot_date}</td><td>${item.slot_time}</td><td>${formatMoney(item.price_paid)}</td><td>${statusBadge(item.status)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function decideBooking(id, decision) {
  try {
    await ownerFetch(`/owner/bookings/${id}/${decision}`, { method: "PATCH", body: JSON.stringify({ reason: "" }) });
    toast(`Booking ${decision}d`);
    await loadOwnerBookings();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function exportBookingsCsv() {
  try {
    const params = new URLSearchParams();
    const spaceId = document.getElementById("booking-space-filter").value;
    const from = document.getElementById("booking-from-filter").value;
    const to = document.getElementById("booking-to-filter").value;
    if (spaceId) params.set("space_id", spaceId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`${API_BASE}/owner/bookings/export?${params.toString()}`, { headers: authHeaders() });
    const csvText = await res.text();
    if (!res.ok) throw new Error(csvText || "Export failed");
    downloadCsv("owner-bookings.csv", csvText);
    toast("CSV exported");
  } catch (error) {
    toast(error.message, "error");
  }
}

initOwnerBookings();
