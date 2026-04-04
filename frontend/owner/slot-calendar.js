async function initOwnerSlotCalendar() {
  const user = ownerGuard("owner-slot-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const spaces = await ownerFetch("/spaces", { headers: authHeaders() }).catch(() => []);
  const mySpaces = spaces.filter(space => space.owner_id === user.id);
  const monthValue = new Date().toISOString().slice(0, 7);

  const root = document.getElementById("owner-slot-root");
  root.innerHTML = `
    <div class="owner-header">
      <div><h1 class="section-title">Slot Calendar</h1><p class="section-sub">See availability, bookings, and owner blocks by month.</p></div>
    </div>
    ${renderOwnerNav("slot-calendar")}
    <div class="owner-panel">
      <div class="owner-toolbar">
        <div class="owner-filters">
          <select id="slot-space-select">${mySpaces.map(space => `<option value="${space.id}">${space.name}</option>`).join("")}</select>
          <input id="slot-month-input" type="month" value="${monthValue}" />
        </div>
        <div class="flex gap-1">
          <span class="status-badge status-available">Available</span>
          <span class="status-badge status-pending">Partial</span>
          <span class="status-badge status-blocked">Full</span>
        </div>
      </div>
      <div id="slot-calendar-grid" class="owner-calendar"></div>
      <div id="slot-breakdown-panel" class="owner-panel mt-2 hidden"></div>
    </div>`;

  document.getElementById("slot-space-select").addEventListener("change", loadCalendar);
  document.getElementById("slot-month-input").addEventListener("change", loadCalendar);
  await loadCalendar();
}

async function loadCalendar() {
  const spaceId = document.getElementById("slot-space-select").value;
  const month = document.getElementById("slot-month-input").value;
  const grid = document.getElementById("slot-calendar-grid");
  grid.innerHTML = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<div class="calendar-head">${day}</div>`).join("") + `<div class="empty-state" style="grid-column:1/-1;"><div class="spinner"></div></div>`;

  const data = await ownerFetch(`/owner/slots/${spaceId}/calendar?month=${month}`);
  const firstDay = new Date(`${month}-01`).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(`<div class="calendar-cell empty"></div>`);

  for (const item of data.days) {
    const css = item.status === "fully_available" ? "available" : item.status === "partially_booked" ? "partial" : "full";
    const d = item.date;
    cells.push(`
      <button class="calendar-cell ${css}" data-date="${d}">
        <div class="calendar-date">${new Date(d).getDate()}</div>
        <div class="calendar-meta">${item.confirmed_count} booked</div>
        <div class="calendar-meta">${item.blocked_count} blocked</div>
      </button>`);
  }

  grid.innerHTML = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<div class="calendar-head">${day}</div>`).join("") + cells.join("");
  grid.querySelectorAll("[data-date]").forEach(cell => cell.addEventListener("click", () => loadBreakdown(cell.dataset.date)));
}

async function loadBreakdown(dateValue) {
  const spaceId = document.getElementById("slot-space-select").value;
  const panel = document.getElementById("slot-breakdown-panel");
  const data = await ownerFetch(`/owner/slots/${spaceId}/${dateValue}`);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="owner-toolbar">
      <div><div class="owner-card-title">Slot breakdown for ${dateValue}</div><div class="owner-card-meta">Block or unblock morning, afternoon, evening, or night.</div></div>
    </div>
    <div class="slot-list">
      ${data.slots.map(slot => `
        <div class="slot-row">
          <div class="slot-info">
            <div class="slot-name">${slot.slot_time}</div>
            <div class="owner-card-meta">${slot.booked_by_name || slot.reason || "Open for booking"}</div>
            <div class="owner-card-meta">${slot.price ? formatMoney(slot.price) : ""}</div>
          </div>
          <div class="slot-actions">
            ${statusBadge(slot.booking_status || slot.status)}
            ${renderSlotActionButton(slot, dateValue)}
          </div>
        </div>`).join("")}
    </div>`;
}

function renderSlotActionButton(slot, dateValue) {
  if (slot.status === "blocked") {
    return `<button class="btn btn-ghost btn-sm owner-slot-btn owner-slot-btn-unblock" onclick="toggleBlock('${dateValue}','${slot.slot_time}', false)">Unblock Slot</button>`;
  }
  if (slot.status === "available") {
    return `<button class="btn btn-primary btn-sm owner-slot-btn" onclick="toggleBlock('${dateValue}','${slot.slot_time}', true)">Block Slot</button>`;
  }
  return `<button class="btn btn-secondary btn-sm owner-slot-btn" disabled>${slot.status === "pending" ? "Pending booking" : "Already booked"}</button>`;
}

async function toggleBlock(dateValue, slotTime, shouldBlock) {
  const spaceId = document.getElementById("slot-space-select").value;
  try {
    if (shouldBlock) {
      const reason = window.prompt(`Reason for blocking ${slotTime}?`, "Owner blocked");
      if (reason === null) return;
      await ownerFetch(`/owner/slots/${spaceId}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked_date: dateValue, slot_time: slotTime, reason: reason.trim() || "Owner blocked" }),
      });
      toast("Slot blocked");
    } else {
      await ownerFetch(`/owner/slots/${spaceId}/unblock`, {
        method: "POST",
        body: JSON.stringify({ blocked_date: dateValue, slot_time: slotTime }),
      });
      toast("Slot unblocked");
    }
    await loadCalendar();
    await loadBreakdown(dateValue);
  } catch (error) {
    toast(error.message, "error");
  }
}

initOwnerSlotCalendar();
