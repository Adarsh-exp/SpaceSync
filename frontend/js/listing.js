let allSpaces = [];
let filteredSpaces = [];
let filterType = "";

const TYPE_ICONS = {
  cricket: "C",
  party_hall: "H",
  parking: "P",
};

function getNameInput() {
  return document.getElementById("filter-name-inline");
}

const urlParams = new URLSearchParams(window.location.search);

function bootFiltersFromUrl() {
  const nameInput = getNameInput();
  if (urlParams.get("name") && nameInput) nameInput.value = urlParams.get("name");
  if (urlParams.get("city")) document.getElementById("filter-city").value = urlParams.get("city");
  if (urlParams.get("type")) {
    filterType = urlParams.get("type");
    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.type === filterType);
    });
  }
}

async function loadSpaces() {
  const params = new URLSearchParams();
  const nameInput = getNameInput();
  const name = nameInput ? nameInput.value.trim() : "";
  const city = document.getElementById("filter-city").value;
  const min = document.getElementById("filter-min").value;
  const max = document.getElementById("filter-max").value;

  if (name) params.set("name", name);
  if (filterType) params.set("type", filterType);
  if (city) params.set("city", city);
  if (min) params.set("budget_min", min);
  if (max) params.set("budget_max", max);

  document.getElementById("results-list").innerHTML = Array(3).fill(`
    <div class="browse-skeleton">
      <div class="skeleton" style="min-height:200px;"></div>
      <div style="padding:1.2rem;display:grid;gap:0.8rem;">
        <div class="skeleton" style="height:16px;width:50%;"></div>
        <div class="skeleton" style="height:12px;width:72%;"></div>
        <div class="skeleton" style="height:12px;width:42%;"></div>
        <div class="skeleton" style="height:12px;width:84%;"></div>
      </div>
    </div>`).join("");

  try {
    const res = await fetch(`${API_BASE}/spaces?${params}`);
    allSpaces = await res.json();
    applyCurrentFilters();
  } catch {
    document.getElementById("results-list").innerHTML = `<p class="text-muted">Could not load spaces. Is the API running?</p>`;
    document.getElementById("results-count").textContent = "0 spaces";
  }
}

function applyCurrentFilters() {
  const minRating = parseFloat(document.getElementById("filter-rating").value || 0);
  filteredSpaces = allSpaces.filter(space => (space.rating || 0) >= minRating);
  renderSpaces(filteredSpaces);
}

function renderSpaces(spaces) {
  document.getElementById("results-count").textContent = `${spaces.length} space${spaces.length !== 1 ? "s" : ""} found`;
  if (!spaces.length) {
    document.getElementById("results-list").innerHTML = `
      <div class="browse-empty">
        <div class="browse-empty-icon">0</div>
        <p>No spaces match your filters.</p>
      </div>`;
    return;
  }

  Promise.all(spaces.map(spaceRow)).then(cards => {
    document.getElementById("results-list").innerHTML = cards.join("");
    enrichWithML(spaces);
  });
}

async function spaceRow(space) {
  const imgEl = space.image_url
    ? `<img src="${space.image_url}" style="width:100%;height:100%;object-fit:cover;" alt="${space.name}" />`
    : `<span>${TYPE_ICONS[space.type] || "S"}</span>`;

  return `
    <a href="detail.html?id=${space.id}" class="space-card">
      <div class="space-card-img">${imgEl}</div>
      <div class="space-card-body">
        <div>
          <div class="space-card-head">
            <div>
              <div class="flex items-center gap-1 mb-1">
                ${typeBadge(space.type)}
                ${space.rating >= 4.5 ? '<span class="badge" style="background:rgba(251,191,36,0.12);color:#fbbf24;border-color:rgba(251,191,36,0.3);">Top Rated</span>' : ""}
              </div>
              <div class="card-title">${space.name}</div>
              <div class="space-card-sub">${space.city}${space.area ? ", " + space.area : ""}</div>
            </div>
            <div class="text-xs text-muted">${space.total_bookings || 0}+ bookings</div>
          </div>
          <div class="space-card-meta mt-2">
            <span class="space-meta-pill">Open ${space.opening_time || "09:00"} to ${space.closing_time || "22:00"}</span>
            <span class="space-meta-pill">${space.rating ? `${Number(space.rating).toFixed(1)} rating` : "New listing"}</span>
          </div>
          ${space.amenities ? `<div style="margin-top:0.65rem;">${space.amenities.split(",").slice(0, 4).map(item => `<span class="amenity-chip">${item.trim()}</span>`).join("")}</div>` : ""}
        </div>
        <div class="flex items-center justify-between mt-2">
          <div>
            <div class="flex items-center gap-1">
              <span class="price price-normal">Rs ${space.base_price}</span>
              <span class="price-sub">/hr</span>
              <span id="surge-${space.id}"></span>
            </div>
            <div class="avail-wrap">
              <div class="avail-label"><span>Availability</span><span id="avail-pct-${space.id}">-</span></div>
              <div class="fill-meter"><div class="fill-meter-bar" id="avail-bar-${space.id}" style="width:0%"></div></div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            ${starsHTML(space.rating)}
            <span class="text-xs text-muted">(${space.total_bookings || 0})</span>
          </div>
        </div>
      </div>
    </a>`;
}

async function enrichWithML(spaces) {
  const today = new Date().toISOString().split("T")[0];
  const slot = "evening";
  for (const space of spaces.slice(0, 6)) {
    try {
      const [surgeRes, availRes] = await Promise.all([
        fetch(`${API_BASE}/ml/surge-price/${space.id}?date=${today}&slot_time=${slot}`),
        fetch(`${API_BASE}/ml/availability/${space.id}?date=${today}&slot_time=${slot}`),
      ]);
      if (surgeRes.ok) {
        const surge = await surgeRes.json();
        const el = document.getElementById(`surge-${space.id}`);
        if (el && surge.surge_multiplier > 1.05) {
          el.innerHTML = `<span class="surge-pill">Surge ${surge.surge_multiplier}x</span>`;
        }
      }
      if (availRes.ok) {
        const avail = await availRes.json();
        const bar = document.getElementById(`avail-bar-${space.id}`);
        const pct = document.getElementById(`avail-pct-${space.id}`);
        if (bar) bar.style.width = `${avail.fill_probability}%`;
        if (pct) pct.textContent = `${avail.fill_probability}% full`;
      }
    } catch {}
  }
}

function setType(btn, type) {
  filterType = type;
  document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  applyFilters();
}

function applyFilters() {
  loadSpaces();
}

function syncNameSearch(value) {
  const nameInput = getNameInput();
  if (nameInput && nameInput.value !== value) {
    nameInput.value = value;
  }
  applyFilters();
}

function clearFilters() {
  filterType = "";
  if (getNameInput()) getNameInput().value = "";
  document.getElementById("filter-city").value = "";
  document.getElementById("filter-min").value = "";
  document.getElementById("filter-max").value = "";
  document.getElementById("filter-rating").value = "0";
  document.querySelectorAll(".type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === ""));
  loadSpaces();
}

function sortSpaces() {
  const sort = document.getElementById("sort-select").value;
  const sorted = [...filteredSpaces.length ? filteredSpaces : allSpaces];
  if (sort === "price_asc") sorted.sort((a, b) => a.base_price - b.base_price);
  if (sort === "price_desc") sorted.sort((a, b) => b.base_price - a.base_price);
  if (sort === "rating") sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sort === "popular") sorted.sort((a, b) => (b.total_bookings || 0) - (a.total_bookings || 0));
  renderSpaces(sorted);
}

function createOwnerListingUI() {
  return;
}

function syncOwnerListingUI() {
  return;
}

window.createOwnerListingUI = createOwnerListingUI;
window.syncOwnerListingUI = syncOwnerListingUI;
bootFiltersFromUrl();
loadSpaces();
