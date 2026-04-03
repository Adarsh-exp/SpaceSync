function ownerGuard(rootId) {
  const user = getUser();
  if (!user || user.role !== "owner") {
    const root = document.getElementById(rootId);
    if (root) {
      root.innerHTML = `
        <div class="empty-state">
          <h2 class="section-title">Owner Access Only</h2>
          <p class="mt-1">Log in with an owner account to use these tools.</p>
          <a class="btn btn-primary mt-2" href="../index.html">Go Home</a>
        </div>`;
    }
    return null;
  }
  return user;
}

function renderOwnerNav(activePath) {
  const navVersion = "20260403e";
  return `
    <div class="owner-subnav">
      <a href="slot-calendar.html?v=${navVersion}" class="${activePath === "slot-calendar" ? "active" : ""}">Slot Calendar</a>
      <a href="bookings.html?v=${navVersion}" class="${activePath === "bookings" ? "active" : ""}">Bookings</a>
      <a href="earnings.html?v=${navVersion}" class="${activePath === "earnings" ? "active" : ""}">Earnings</a>
      <a href="reviews.html?v=${navVersion}" class="${activePath === "reviews" ? "active" : ""}">Reviews</a>
      <a href="notifications.html?v=${navVersion}" class="${activePath === "notifications" ? "active" : ""}">Notifications</a>
      <a href="profile.html?v=${navVersion}" class="${activePath === "profile" ? "active" : ""}">Profile</a>
      <a href="update-listing.html?v=${navVersion}" class="${activePath === "update-listing" ? "active" : ""}">Update Listing</a>
    </div>`;
}

async function ownerFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = data?.detail || data?.message || (typeof data === "string" ? data : "Request failed");
    throw new Error(message);
  }
  return data;
}

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status.replaceAll("_", " ")}</span>`;
}

function timeAgo(value) {
  const then = new Date(value);
  const seconds = Math.max(1, Math.floor((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function iconForNotification(type) {
  const icons = {
    booking_request: "RQ",
    booking_confirmed: "OK",
    booking_cancelled: "CX",
    new_review: "RV",
    payout_processed: "PY",
  };
  return icons[type] || "NT";
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
