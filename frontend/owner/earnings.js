async function initOwnerEarnings() {
  const user = ownerGuard("owner-earnings-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const [summary, chart, peakHours, perSpace] = await Promise.all([
    ownerFetch("/owner/earnings/summary"),
    ownerFetch("/owner/earnings/chart?days=30"),
    ownerFetch("/owner/analytics/peak-hours"),
    ownerFetch("/owner/analytics/per-space"),
  ]);

  const strongestSpace = [...perSpace].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];

  const root = document.getElementById("owner-earnings-root");
  root.innerHTML = `
    <div class="earnings-hero">
      <div class="earnings-banner">
        <div class="earnings-kicker">Owner dashboard</div>
        <h1 class="section-title">Earnings & Analytics</h1>
        <p class="section-sub">Track your revenue, understand when people book, and keep a sharper view of how each space is performing.</p>
      </div>
      <div class="earnings-highlight">
        <div class="earnings-highlight-label">Top performing space</div>
        <div class="earnings-highlight-value">${strongestSpace ? strongestSpace.space_name : "No data yet"}</div>
        <div class="earnings-highlight-copy">${strongestSpace ? `${formatMoney(strongestSpace.revenue)} earned so far with ${strongestSpace.total_bookings} bookings.` : "Your revenue highlights will show up here once bookings start coming in."}</div>
      </div>
    </div>
    ${renderOwnerNav("earnings")}
    <div class="earnings-stats">
      <div class="earnings-stat-card">
        <div class="earnings-stat-label">This week</div>
        <div class="earnings-stat-value">${formatMoney(summary.this_week)}</div>
        <div class="earnings-stat-note">Recent earnings from current week bookings.</div>
      </div>
      <div class="earnings-stat-card">
        <div class="earnings-stat-label">This month</div>
        <div class="earnings-stat-value">${formatMoney(summary.this_month)}</div>
        <div class="earnings-stat-note">A quick view of monthly revenue movement.</div>
      </div>
      <div class="earnings-stat-card">
        <div class="earnings-stat-label">All time</div>
        <div class="earnings-stat-value">${formatMoney(summary.all_time)}</div>
        <div class="earnings-stat-note">Total revenue generated across your spaces.</div>
      </div>
      <div class="earnings-stat-card">
        <div class="earnings-stat-label">Pending payout</div>
        <div class="earnings-stat-value">${formatMoney(summary.pending_payout)}</div>
        <div class="earnings-stat-note">Amount waiting to be processed to you.</div>
      </div>
    </div>
    <div class="earnings-panel mt-2">
      <div class="earnings-panel-header">
        <div>
          <div class="chart-title">Revenue by Day</div>
          <div class="earnings-panel-copy">A simple 30-day view of how your earnings are moving.</div>
        </div>
      </div>
      <canvas id="owner-revenue-chart" height="140"></canvas>
    </div>
    <div class="earnings-panel mt-2">
      <div class="earnings-panel-header">
        <div>
          <div class="chart-title">Peak Hours Heatmap</div>
          <div class="earnings-panel-copy">See which weekday and hour combinations get the most booking activity.</div>
        </div>
      </div>
      <div id="heatmap-root"></div>
    </div>
    <div class="earnings-panel mt-2">
      <div class="earnings-panel-header">
        <div>
          <div class="chart-title">Per Space Breakdown</div>
          <div class="earnings-panel-copy">A cleaner summary of how each of your spaces is contributing.</div>
        </div>
      </div>
      <div class="earnings-space-grid">${perSpace.map(card => `
        <div class="earnings-space-card">
          <div class="earnings-space-head">
            <div>
              <div class="owner-card-title">${card.space_name}</div>
              <div class="earnings-space-type">${card.space_type}</div>
            </div>
            <div class="earnings-space-revenue">${formatMoney(card.revenue)}</div>
          </div>
          <div class="earnings-space-metrics">
            <div class="earnings-space-metric"><span>Bookings</span><span>${card.total_bookings}</span></div>
            <div class="earnings-space-metric"><span>Avg rating</span><span>${card.avg_rating}</span></div>
            <div class="earnings-space-metric"><span>Occupancy</span><span>${card.occupancy_rate}%</span></div>
            <div class="earnings-space-metric"><span>Most booked slot</span><span>${card.most_booked_slot}</span></div>
          </div>
        </div>`).join("")}</div>
    </div>`;

  drawOwnerRevenueChart(chart);
  renderHeatmap(peakHours);
}

function drawOwnerRevenueChart(points) {
  new Chart(document.getElementById("owner-revenue-chart"), {
    type: "line",
    data: { labels: points.map(p => p.date.slice(5)), datasets: [{ data: points.map(p => p.revenue), borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)", fill: true, tension: 0.35 }] },
    options: { plugins: { legend: { display: false } } },
  });
}

function renderHeatmap(points) {
  const counts = {};
  for (const point of points) counts[`${point.weekday}-${point.hour}`] = point.count;
  const max = Math.max(1, ...points.map(point => point.count));
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const root = document.getElementById("heatmap-root");
  root.innerHTML = `
    <div class="heatmap-grid-7x24">
      ${dayNames.map((day, dayIndex) => `
        <div class="heatmap-day">${day}</div>
        ${Array.from({ length: 24 }, (_, hour) => {
          const value = counts[`${dayIndex}-${hour}`] || 0;
          const alpha = value ? (0.12 + (value / max) * 0.72) : 0.06;
          return `<div class="heatmap-hour" title="${day} ${hour}:00 · ${value} bookings" style="background:rgba(249,115,22,${alpha})"></div>`;
        }).join("")}
      `).join("")}
    </div>`;
}

initOwnerEarnings();