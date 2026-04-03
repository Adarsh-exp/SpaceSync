let ownerSpaces = [];
let editingSpaceId = null;

function ownerSpaceModalMarkup() {
  return `
    <div class="modal-overlay add-space-modal-shell hidden" id="owner-space-modal">
      <div class="modal add-space-modal-dialog">
        <div class="modal-title" id="owner-space-modal-title">Add Space</div>
        <div id="owner-space-image-preview-wrap" class="hidden" style="margin-bottom:1rem;">
          <div class="text-muted text-xs" style="margin-bottom:0.45rem;">Current Photo</div>
          <img id="owner-space-image-preview" alt="Space preview" style="width:100%;height:180px;object-fit:cover;border-radius:14px;border:1px solid var(--border);" />
        </div>
        <div class="form-group"><label>Name</label><input type="text" id="owner-space-name" placeholder="e.g. Turf Arena" /></div>
        <div class="form-group"><label>Type</label>
          <select id="owner-space-type">
            <option value="cricket">Cricket Ground</option>
            <option value="party_hall">Party Hall</option>
            <option value="parking">Parking</option>
          </select>
        </div>
        <div class="form-group"><label>City</label><input type="text" id="owner-space-city" placeholder="e.g. Pune" /></div>
        <div class="form-group"><label>Area</label><input type="text" id="owner-space-area" placeholder="e.g. Baner" /></div>
        <div class="form-group"><label>Base Price (Rs/hr)</label><input type="number" id="owner-space-price" min="1" placeholder="e.g. 700" /></div>
        <div class="form-group"><label>Opening Time</label><input type="time" id="owner-space-opening-time" value="09:00" /></div>
        <div class="form-group"><label>Closing Time</label><input type="time" id="owner-space-closing-time" value="22:00" /></div>
        <div class="form-group"><label>Latitude (optional)</label><input type="number" id="owner-space-lat" step="any" placeholder="e.g. 18.5590" /></div>
        <div class="form-group"><label>Longitude (optional)</label><input type="number" id="owner-space-lng" step="any" placeholder="e.g. 73.7868" /></div>
        <div class="form-group"><label>Amenities (comma separated)</label><input type="text" id="owner-space-amenities" placeholder="Lights, Parking, Washroom" /></div>
        <div class="form-group">
          <label>Listing Photo</label>
          <input type="file" id="owner-space-image" accept="image/*" />
        </div>
        <div class="space-owner-note">Business phone and contact details are managed from your profile page.</div>
        <div class="flex gap-1 mt-2" style="flex-wrap:wrap;">
          <button class="btn btn-primary btn-full" id="owner-space-save-btn">Create Listing</button>
          <a class="btn btn-secondary btn-full" href="profile.html">Update Contact</a>
        </div>
        <button class="btn btn-ghost btn-sm mt-2" id="owner-space-close-btn" style="width:100%;">Close</button>
      </div>
    </div>`;
}

function ensureOwnerSpaceModal() {
  if (document.getElementById("owner-space-modal")) return;
  document.body.insertAdjacentHTML("beforeend", ownerSpaceModalMarkup());
  const modal = document.getElementById("owner-space-modal");
  modal?.addEventListener("click", event => { if (event.target === modal) closeOwnerSpaceModal(); });
  document.getElementById("owner-space-close-btn")?.addEventListener("click", closeOwnerSpaceModal);
  document.getElementById("owner-space-save-btn")?.addEventListener("click", saveOwnerSpace);
}

function populateOwnerSpaceForm(space = null) {
  document.getElementById("owner-space-name").value = space?.name || "";
  document.getElementById("owner-space-type").value = space?.type || "cricket";
  document.getElementById("owner-space-city").value = space?.city || "";
  document.getElementById("owner-space-area").value = space?.area || "";
  document.getElementById("owner-space-price").value = space?.base_price || "";
  document.getElementById("owner-space-opening-time").value = space?.opening_time || "09:00";
  document.getElementById("owner-space-closing-time").value = space?.closing_time || "22:00";
  document.getElementById("owner-space-lat").value = space?.lat ?? "";
  document.getElementById("owner-space-lng").value = space?.lng ?? "";
  document.getElementById("owner-space-amenities").value = space?.amenities || "";
  document.getElementById("owner-space-image").value = "";
  const previewWrap = document.getElementById("owner-space-image-preview-wrap");
  const preview = document.getElementById("owner-space-image-preview");
  if (space?.image_url) {
    preview.src = space.image_url;
    previewWrap?.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    previewWrap?.classList.add("hidden");
  }
  document.getElementById("owner-space-modal-title").textContent = editingSpaceId ? "Update Space" : "Add Space";
  document.getElementById("owner-space-save-btn").textContent = editingSpaceId ? "Save Changes" : "Create Listing";
}

function openOwnerSpaceModal(spaceId = null) {
  editingSpaceId = spaceId;
  const space = spaceId ? ownerSpaces.find(item => item.id === spaceId) : null;
  populateOwnerSpaceForm(space || null);
  document.getElementById("owner-space-modal")?.classList.remove("hidden");
}

function closeOwnerSpaceModal() {
  document.getElementById("owner-space-modal")?.classList.add("hidden");
  editingSpaceId = null;
}

function renderOwnerSpaceCard(space) {
  return `
    <div class="owner-card">
      ${space.image_url ? `<img src="${space.image_url}" alt="${space.name}" style="width:100%;height:150px;object-fit:cover;border-radius:12px;border:1px solid var(--border);margin-bottom:0.9rem;" />` : ""}
      <div class="space-card-top">
        <div>
          <div class="owner-card-title">${space.name}</div>
          <div class="owner-card-meta">${space.city}${space.area ? `, ${space.area}` : ""}</div>
        </div>
        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="openOwnerSpaceModal(${space.id})">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="pickOwnerSpaceImage(${space.id})">${space.image_url ? "Change Photo" : "Upload Photo"}</button>
          <input type="file" id="owner-space-image-card-${space.id}" accept="image/*" class="hidden" onchange="uploadOwnerSpaceImageForCard(${space.id})" />
        </div>
      </div>
      <div class="mt-1">Type: ${space.type.replace("_", " ")}</div>
      <div>Price: ${formatMoney(space.base_price)}/hr</div>
      <div>Hours: ${space.opening_time || "09:00"} to ${space.closing_time || "22:00"}</div>
      <div>Bookings: ${space.total_bookings || 0}</div>
      <div class="text-sm text-muted mt-1">${space.amenities || "No amenities added yet"}</div>
      <div class="text-sm text-muted mt-1">${space.image_url ? "Photo visible to users" : "No photo uploaded yet"}</div>
    </div>`;
}

async function loadOwnerSpaces(user) {
  const res = await fetch(`${API_BASE}/spaces`);
  const spaces = await res.json();
  ownerSpaces = spaces.filter(space => space.owner_id === user.id);
  const list = document.getElementById("owner-space-list");
  if (!list) return;
  list.innerHTML = ownerSpaces.length
    ? ownerSpaces.map(renderOwnerSpaceCard).join("")
    : `<div class="empty-state">No spaces added yet. Use Add Space to create your first listing.</div>`;
}

async function saveOwnerSpace() {
  const imageFile = document.getElementById("owner-space-image").files?.[0] || null;
  const payload = {
    name: document.getElementById("owner-space-name").value.trim(),
    type: document.getElementById("owner-space-type").value,
    city: document.getElementById("owner-space-city").value.trim(),
    area: document.getElementById("owner-space-area").value.trim() || null,
    base_price: parseFloat(document.getElementById("owner-space-price").value || ""),
    opening_time: document.getElementById("owner-space-opening-time").value,
    closing_time: document.getElementById("owner-space-closing-time").value,
    amenities: document.getElementById("owner-space-amenities").value.trim(),
    lat: document.getElementById("owner-space-lat").value ? parseFloat(document.getElementById("owner-space-lat").value) : null,
    lng: document.getElementById("owner-space-lng").value ? parseFloat(document.getElementById("owner-space-lng").value) : null,
  };

  if (!payload.name || !payload.city || !payload.type || !Number.isFinite(payload.base_price) || payload.base_price <= 0) {
    toast("Name, type, city and valid price are required", "error");
    return;
  }
  if (!payload.opening_time || !payload.closing_time || payload.closing_time <= payload.opening_time) {
    toast("Closing time must be later than opening time", "error");
    return;
  }
  if ((document.getElementById("owner-space-lat").value && !Number.isFinite(payload.lat)) || (document.getElementById("owner-space-lng").value && !Number.isFinite(payload.lng))) {
    toast("Latitude and longitude must be valid numbers", "error");
    return;
  }

  try {
    const savedSpace = await ownerFetch(`/spaces${editingSpaceId ? `/${editingSpaceId}` : ""}`, {
      method: editingSpaceId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    if (imageFile) {
      await uploadOwnerSpaceImage(savedSpace.id, imageFile);
    }
    toast(editingSpaceId ? "Space updated" : "Space created");
    closeOwnerSpaceModal();
    const user = getUser();
    if (user) await loadOwnerSpaces(user);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function uploadOwnerSpaceImage(spaceId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/spaces/${spaceId}/images`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to upload image");
  }
  return data;
}

function pickOwnerSpaceImage(spaceId) {
  document.getElementById(`owner-space-image-card-${spaceId}`)?.click();
}

async function uploadOwnerSpaceImageForCard(spaceId) {
  const input = document.getElementById(`owner-space-image-card-${spaceId}`);
  const file = input?.files?.[0];
  if (!file) return;
  try {
    await uploadOwnerSpaceImage(spaceId, file);
    toast("Photo uploaded");
    const user = getUser();
    if (user) await loadOwnerSpaces(user);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (input) input.value = "";
  }
}

async function initOwnerTasks() {
  const user = ownerGuard("owner-tasks-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", event => { event.preventDefault(); doLogout(); });
  ensureOwnerSpaceModal();

  document.getElementById("owner-tasks-root").innerHTML = `
    <div class="owner-header">
      <div><h1 class="section-title">Update Listing</h1><p class="section-sub">Manage your listed spaces, timings, pricing, and listing details from one place.</p></div>
      <div class="owner-actions" style="display:flex;gap:0.6rem;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="openOwnerSpaceModal()">Add Space</button>
        <a class="btn btn-secondary" href="profile.html">Update Business Contact</a>
      </div>
    </div>
    ${renderOwnerNav("update-listing")}
    <div class="owner-panel">
      <div class="chart-title">Your Spaces</div>
      <div class="owner-grid-3" id="owner-space-list"></div>
    </div>`;

  await loadOwnerSpaces(user);
}

window.openOwnerSpaceModal = openOwnerSpaceModal;
window.pickOwnerSpaceImage = pickOwnerSpaceImage;
window.uploadOwnerSpaceImageForCard = uploadOwnerSpaceImageForCard;
initOwnerTasks();
