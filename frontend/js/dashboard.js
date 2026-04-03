// dashboard.js
async function initDashboard() {
  const user = getUser();

  // Auth guard
  if (!user || user.role !== "admin") {
    document.getElementById("dash-root").innerHTML = `
      <div class="access-denied">
        <div style="font-size:3.5rem;margin-bottom:1rem;">🔒</div>
        <h2 class="section-title" style="font-size:1.5rem;">Admin Access Only</h2>
        <p class="text-muted mt-1">You need an admin account to view this page.</p>
        <a href="index.html" class="btn btn-primary mt-2">← Go Home</a>
      </div>`;
    return;
  }

  // Update nav user
  const navUser = document.getElementById("nav-user");
  if (navUser) navUser.textContent = `👤 ${user.name}`;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  try {
    const res = await fetch(`${API_BASE}/admin/analytics`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Could not fetch analytics");
    const data = await res.json();
    renderDashboard(data);
  } catch(e) {
    document.getElementById("dash-root").innerHTML = `
      <div class="access-denied">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
        <p class="text-muted">${e.message}. Is the API running?</p>
        <button class="btn btn-primary mt-2" onclick="initDashboard()">Retry</button>
      </div>`;
  }
}

function renderDashboard(data) {
  const root = document.getElementById("dash-root");

  // Revenue trend data (use real or generate demo)
  const revData = data.revenue_over_time.length > 0
    ? data.revenue_over_time
    : generateDemoRevenue();

  // Type breakdown
  const typeData = data.type_breakdown.length > 0
    ? data.type_breakdown
    : [{ type: "cricket", count: 42 }, { type: "party_hall", count: 28 }, { type: "parking", count: 15 }];

  // Peak hours
  const peakData = data.peak_hours.length > 0
    ? data.peak_hours
    : [{ slot: "morning", count: 18 }, { slot: "afternoon", count: 31 }, { slot: "evening", count: 67 }, { slot: "night", count: 24 }];

  const maxPeak = Math.max(...peakData.map(p => p.count), 1);

  root.innerHTML = `
    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1 class="section-title">Analytics Dashboard</h1>
        <p class="text-muted text-sm">Live overview · SpaceSync India</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge" style="background:rgba(16,185,129,0.15);color:var(--accent3);border:1px solid rgba(16,185,129,0.3);">● Live</span>
        <button class="btn btn-secondary btn-sm" onclick="initDashboard()">↻ Refresh</button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="stats-row">
      <div class="stat-card orange">
        <div class="stat-icon">🏟️</div>
        <div class="stat-value">${data.total_bookings.toLocaleString()}</div>
        <div class="stat-label">Total Bookings</div>
        <div class="stat-delta">↑ All time confirmed</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">💰</div>
        <div class="stat-value">₹${formatRevenue(data.total_revenue)}</div>
        <div class="stat-label">Total Revenue</div>
        <div class="stat-delta">↑ Confirmed bookings</div>
      </div>
      <div class="stat-card indigo">
        <div class="stat-icon">📍</div>
        <div class="stat-value">${typeData.reduce((a,t) => a + t.count, 0)}</div>
        <div class="stat-label">Active Spaces</div>
        <div class="stat-delta">Across 3 categories</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⭐</div>
        <div class="stat-value">${data.total_bookings > 0 ? (data.total_revenue / data.total_bookings).toFixed(0) : '—'}</div>
        <div class="stat-label">Avg Booking Value</div>
        <div class="stat-delta">₹ per confirmed booking</div>
      </div>
    </div>

    <!-- Revenue Chart + Type Pie -->
    <div class="charts-row">
      <div class="chart-wrap">
        <div class="chart-header">
          <span class="chart-title">Revenue Over Time</span>
          <span class="text-muted text-xs">Last 30 days</span>
        </div>
        <canvas id="revenue-chart" height="200"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-header">
          <span class="chart-title">Bookings by Space Type</span>
        </div>
        <canvas id="type-chart" height="200"></canvas>
      </div>
    </div>

    <!-- Peak Hours Heatmap + Bar -->
    <div class="charts-row-3">
      <div class="chart-wrap">
        <div class="chart-header">
          <span class="chart-title">Bookings by Time Slot</span>
          <span class="text-muted text-xs">All confirmed</span>
        </div>
        <canvas id="peak-chart" height="160"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-header">
          <span class="chart-title">Peak Hours Heatmap</span>
        </div>
        <div class="heatmap-grid">
          ${peakData.map(p => {
            const intensity = p.count / maxPeak;
            const bg = `rgba(249,115,22,${0.1 + intensity * 0.7})`;
            return `
              <div class="heatmap-cell" style="background:${bg};border-color:rgba(249,115,22,${intensity*0.4});">
                <div class="slot-name">${p.slot}</div>
                <div class="slot-count">${p.count}</div>
              </div>`;
          }).join("")}
        </div>
      </div>
    </div>

    <!-- Recent Bookings Table -->
    <div class="chart-wrap">
      <div class="chart-header">
        <span class="chart-title">Recent Bookings</span>
        <a href="#" class="text-muted text-xs">View all →</a>
      </div>
      <div class="table-wrap" style="border:none;">
        ${data.recent_bookings.length === 0 ? `<p class="text-muted text-sm p-2">No bookings yet.</p>` : `
        <table>
          <thead>
            <tr>
              <th>#ID</th>
              <th>User</th>
              <th>Space</th>
              <th>Date</th>
              <th>Slot</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.recent_bookings.map(b => `
              <tr>
                <td class="text-muted text-sm">#${b.id}</td>
                <td>User #${b.user_id}</td>
                <td>Space #${b.space_id}</td>
                <td class="text-sm">${b.slot_date}</td>
                <td><span class="badge badge-neutral">${b.slot_time}</span></td>
                <td class="font-head" style="color:var(--accent3);">₹${b.price_paid.toLocaleString()}</td>
                <td><span class="status-pill status-${b.status}">${b.status}</span></td>
              </tr>`).join("")}
          </tbody>
        </table>`}
      </div>
    </div>
  `;

  // Draw charts after DOM is ready
  setTimeout(() => {
    drawRevenueChart(revData);
    drawTypeChart(typeData);
    drawPeakChart(peakData);
  }, 50);
}

// ── Chart renderers ───────────────────────────────────────────────────────────

function drawRevenueChart(data) {
  const ctx = document.getElementById("revenue-chart")?.getContext("2d");
  if (!ctx) return;

  const labels = data.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  });
  const values = data.map(d => d.revenue);

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Revenue (₹)",
        data: values,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#f97316",
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#12121a",
          borderColor: "#2a2a3d",
          borderWidth: 1,
          titleColor: "#e8e8f0",
          bodyColor: "#6b6b8a",
          callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString()}` },
        },
      },
      scales: {
        x: { grid: { color: "#1a1a26" }, ticks: { color: "#6b6b8a", font: { size: 10 } } },
        y: { grid: { color: "#1a1a26" }, ticks: { color: "#6b6b8a", font: { size: 10 }, callback: v => "₹" + v.toLocaleString() } },
      },
    },
  });
}

function drawTypeChart(data) {
  const ctx = document.getElementById("type-chart")?.getContext("2d");
  if (!ctx) return;

  const labelMap = { cricket: "Cricket", party_hall: "Party Hall", parking: "Parking" };
  const colorMap = { cricket: "#10b981", party_hall: "#6366f1", parking: "#f97316" };

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map(d => labelMap[d.type] || d.type),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: data.map(d => colorMap[d.type] || "#6b6b8a"),
        borderColor: "#0a0a0f",
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#6b6b8a", font: { size: 11 }, padding: 14, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: "#12121a",
          borderColor: "#2a2a3d",
          borderWidth: 1,
          titleColor: "#e8e8f0",
          bodyColor: "#6b6b8a",
        },
      },
    },
  });
}

function drawPeakChart(data) {
  const ctx = document.getElementById("peak-chart")?.getContext("2d");
  if (!ctx) return;

  const labelMap = { morning: "🌅 Morning", afternoon: "☀️ Afternoon", evening: "🌆 Evening", night: "🌙 Night" };
  const colors = ["#6366f1", "#f97316", "#f97316", "#6366f1"];

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => labelMap[d.slot] || d.slot),
      datasets: [{
        label: "Bookings",
        data: data.map(d => d.count),
        backgroundColor: data.map((d, i) => {
          const max = Math.max(...data.map(x => x.count));
          return d.count === max ? "#f97316" : "rgba(99,102,241,0.6)";
        }),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#12121a",
          borderColor: "#2a2a3d",
          borderWidth: 1,
          titleColor: "#e8e8f0",
          bodyColor: "#6b6b8a",
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#6b6b8a", font: { size: 11 } } },
        y: { grid: { color: "#1a1a26" }, ticks: { color: "#6b6b8a", font: { size: 10 } } },
      },
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRevenue(n) {
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000)   return (n / 1000).toFixed(1) + "K";
  return n.toFixed(0);
}

function generateDemoRevenue() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split("T")[0],
      revenue: Math.round(2000 + Math.random() * 8000 + (29 - i) * 120),
    });
  }
  return days;
}

// Init on load
initDashboard();
