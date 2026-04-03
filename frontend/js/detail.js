const spaceId = new URLSearchParams(window.location.search).get("id");
if (!spaceId) window.location.href = "listing.html";

let space = null;
let selectedSlot = "";
let selectedDate = new Date().toISOString().split("T")[0];
let surgeData = null;
let editingReviewId = null;
let currentReviews = [];

function getWhatsAppLink(phone, spaceName) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const target = digits.length === 10 ? `91${digits}` : digits;
  const text = encodeURIComponent(`Hi, I want to enquire about ${spaceName} on SpaceSync.`);
  return `https://wa.me/${target}?text=${text}`;
}

function getMlSlotFromTime(startTime) {
  if (!startTime) return "evening";
  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function getTimeRangeSelection() {
  const start = document.getElementById("booking-start-time")?.value;
  const end = document.getElementById("booking-end-time")?.value;
  if (!start || !end) return null;

  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  const startMinutes = (sH * 60) + sM;
  const endMinutes = (eH * 60) + eM;

  if (endMinutes <= startMinutes) return null;
  const diff = endMinutes - startMinutes;
  if (diff % 60 !== 0) return null;

  return {
    start,
    end,
    durationHours: diff / 60,
    slotLabel: `${start}-${end}`,
    mlSlot: getMlSlotFromTime(start),
  };
}

function getDefaultBookingTimes() {
  const opening = space?.opening_time || "09:00";
  const closing = space?.closing_time || "22:00";
  const [openHour, openMinute] = opening.split(":").map(Number);
  const [closeHour, closeMinute] = closing.split(":").map(Number);
  const closingMinutes = (closeHour * 60) + closeMinute;
  const defaultEndMinutes = Math.min((openHour * 60) + openMinute + 60, closingMinutes);
  const endHour = String(Math.floor(defaultEndMinutes / 60)).padStart(2, "0");
  const endMinute = String(defaultEndMinutes % 60).padStart(2, "0");

  return {
    opening,
    closing,
    defaultStart: opening,
    defaultEnd: `${endHour}:${endMinute}`,
  };
}

async function loadSpace() {
  try {
    const res = await fetch(`${API_BASE}/spaces/${spaceId}`);
    if (!res.ok) throw new Error("Space not found");
    space = await res.json();
    renderDetail();
    loadReviews();
    loadRecommendations();
  } catch (e) {
    document.getElementById("detail-root").innerHTML = `<div style="text-align:center;padding:4rem;color:var(--muted);"><div style="font-size:3rem;margin-bottom:1rem;">:(</div><p>${e.message}</p><a href="listing.html" class="btn btn-primary mt-2">Back to listings</a></div>`;
  }
}

function renderDetail() {
  const owner = space.owner || null;
  const viewer = getUser();
  const hasCoords = Number.isFinite(space.lat) && Number.isFinite(space.lng);
  const ownerPhone = owner?.business_phone || "";
  const ownerBusinessName = owner?.business_name || owner?.name || "Not available";
  const whatsappHref = ownerPhone ? getWhatsAppLink(ownerPhone, space.name) : "#";
  const icons = { cricket: "[Cricket]", party_hall: "[Party Hall]", parking: "[Parking]" };
  const bookingWindow = getDefaultBookingTimes();
  const openingTime = space.opening_time || "09:00";
  const closingTime = space.closing_time || "22:00";
  const imgEl = space.image_url
    ? `<img src="${space.image_url}" alt="${space.name}" style="width:100%;height:360px;object-fit:cover;border-radius:14px;" />`
    : `<div style="width:100%;height:360px;border-radius:14px;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;font-size:2rem;border:1px solid var(--border);">${icons[space.type] || "[Space]"}</div>`;

  const amenities = (space.amenities || "").split(",").filter(a => a.trim()).map(a =>
    `<span class="amenity-chip">${a.trim()}</span>`).join("");

  document.getElementById("detail-root").innerHTML = `
    <div style="margin-bottom:1rem;"><a href="listing.html" style="color:var(--muted);text-decoration:none;font-size:0.88rem;">Back to listings</a></div>
    <div class="detail-layout">
      <div>
        ${imgEl}
        <div class="flex items-center gap-1 mt-2">
          ${typeBadge(space.type)}
          ${starsHTML(space.rating)}
          <span class="text-muted text-sm">${space.total_bookings || 0} bookings</span>
        </div>
        <h1 class="space-title">${space.name}</h1>
        <p class="text-muted">Location: ${space.city}${space.area ? ", " + space.area : ""}</p>
        <p class="text-muted" style="margin-top:0.35rem;">Service hours: ${openingTime} to ${closingTime}</p>

        ${amenities ? `<div style="margin-top:1rem;"><h3 style="font-family:var(--font-head);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:0.5rem;">Amenities</h3><div>${amenities}</div></div>` : ""}

        <div style="margin-top:1rem;">
          <h3 style="font-family:var(--font-head);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:0.5rem;">Location Map</h3>
          ${hasCoords
            ? `<div id="map"></div>`
            : `<div style="height:220px;border:1px dashed var(--border);border-radius:12px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.9rem;padding:1rem;text-align:center;">Map location not added yet by owner</div>`
          }
        </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-top:1rem;">
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:0.9rem;">
            <div style="font-family:var(--font-head);font-size:0.82rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:0.45rem;">Owner Contact</div>
            <div style="font-size:0.92rem;font-weight:600;">${ownerBusinessName}</div>
            ${owner?.business_name ? `<div class="text-xs text-muted mt-1">Owner: ${owner.name}</div>` : ""}
            <div class="text-sm text-muted">${owner ? owner.email : "Owner email not available"}</div>
            ${ownerPhone ? `<div class="text-sm text-muted">Phone: ${ownerPhone}</div>` : `<div class="text-sm text-muted">Phone not added yet</div>`}
            ${owner?.city ? `<div class="text-xs text-muted mt-1">City: ${owner.city}</div>` : ""}
            <div class="contact-actions">
              ${ownerPhone ? `<a href="tel:${ownerPhone}" class="btn btn-primary btn-sm">Call</a>` : ""}
              ${ownerPhone ? `<a href="${whatsappHref}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm">WhatsApp</a>` : ""}
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleEnquiryBox()">Send Enquiry</button>
            </div>
            <div id="enquiry-box" class="enquiry-box hidden">
              ${isLoggedIn()
                ? `<div class="form-group"><label>Your message</label><textarea id="enquiry-message" placeholder="Hi, I want to know more about availability, pricing, or timings."></textarea></div><button type="button" class="btn btn-primary btn-sm" onclick="sendSpaceEnquiry()">Send</button>`
                : `<div class="text-sm text-muted"><a href="#" onclick="showLogin()" style="color:var(--accent2);">Login</a> to send an enquiry</div>`
              }
            </div>
          </div>
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:0.9rem;">
            <div style="font-family:var(--font-head);font-size:0.82rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:0.45rem;">Your Contact</div>
            ${viewer
              ? `<div style="font-size:0.92rem;font-weight:600;">${viewer.name}</div><div class="text-sm text-muted">${viewer.email}</div>${viewer.city ? `<div class="text-xs text-muted mt-1">City: ${viewer.city}</div>` : ""}`
              : `<div class="text-sm text-muted"><a href="#" onclick="showLogin()" style="color:var(--accent2);">Login</a> to view your contact details</div>`
            }
          </div>
        </div>

        <div class="recs-section">
          <h2 class="section-title" style="font-size:1.3rem;">You might also like</h2>
          <div class="grid-3 mt-2" id="recs-grid"><div class="text-muted text-sm">Loading recommendations...</div></div>
        </div>

        <div class="reviews-section">
          <h2 class="section-title" style="font-size:1.3rem;">Reviews</h2>
          <div id="reviews-list" class="mt-2"></div>

          ${isLoggedIn() ? `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;margin-top:1rem;">
            <h3 class="owner-review-form-title" style="font-family:var(--font-head);font-weight:700;margin-bottom:1rem;">Leave a Review</h3>
            <div class="form-group">
              <label>Rating</label>
              <select id="review-rating">
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Average</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Terrible</option>
              </select>
            </div>
            <div class="form-group">
              <label>Comment</label>
              <textarea id="review-comment" placeholder="Share your experience..."></textarea>
            </div>
            <button class="btn btn-primary owner-review-submit" onclick="submitReview()">Submit Review</button>
          </div>` : `<p class="text-muted text-sm mt-2"><a href="#" onclick="showLogin()" style="color:var(--accent2);">Login</a> to leave a review</p>`}
        </div>
      </div>

      <div>
        <div class="book-card">
          <div style="font-family:var(--font-head);font-weight:700;font-size:1.1rem;">Book This Space</div>
          <div class="price-display">
            <span class="price-big" id="dynamic-price">Rs ${space.base_price}</span>
            <span class="price-sub">/hr</span>
            <span id="surge-indicator"></span>
          </div>

          <div class="avail-section" id="avail-section" style="display:none;">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-head">Slot demand</span>
              <span class="text-sm text-accent" id="avail-msg"></span>
            </div>
            <div class="fill-meter"><div class="fill-meter-bar" id="avail-bar" style="width:0%;"></div></div>
          </div>

          <div class="form-group mt-2">
            <label>Date</label>
            <input type="date" id="booking-date" value="${selectedDate}" onchange="onDateChange()" />
          </div>

          <div class="form-group">
            <label>Start Time</label>
            <input type="time" id="booking-start-time" step="3600" value="${bookingWindow.defaultStart}" min="${bookingWindow.opening}" max="${bookingWindow.closing}" onchange="onTimeChange()" />
          </div>

          <div class="form-group">
            <label>End Time</label>
            <input type="time" id="booking-end-time" step="3600" value="${bookingWindow.defaultEnd}" min="${bookingWindow.opening}" max="${bookingWindow.closing}" onchange="onTimeChange()" />
          </div>

          <p class="text-muted text-xs" style="margin-top:-0.25rem;margin-bottom:0.9rem;">Bookings are allowed only between ${openingTime} and ${closingTime}</p>

          <div style="background:var(--bg-raised);border-radius:8px;padding:0.9rem;margin-bottom:1rem;" id="price-breakdown"></div>

          <button class="btn btn-primary btn-full btn-lg" onclick="initiateBooking()">Book Now</button>
          <p class="razorpay-note">Powered by Razorpay - Secure payment</p>
        </div>
      </div>
    </div>
  `;

  if (hasCoords) {
    setTimeout(() => {
      const map = L.map("map").setView([space.lat, space.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OpenStreetMap" }).addTo(map);
      L.marker([space.lat, space.lng]).addTo(map).bindPopup(`<b>${space.name}</b><br>${space.city}`).openPopup();
    }, 100);
  }

  updatePriceBreakdown();
  onTimeChange();
}

function onDateChange() {
  selectedDate = document.getElementById("booking-date").value;
  if (getTimeRangeSelection()) fetchMLData();
}

function onTimeChange() {
  const startInput = document.getElementById("booking-start-time");
  const endInput = document.getElementById("booking-end-time");
  if (space?.opening_time && space?.closing_time && startInput && endInput) {
    startInput.min = space.opening_time;
    startInput.max = space.closing_time;
    endInput.min = space.opening_time;
    endInput.max = space.closing_time;
  }

  const selection = getTimeRangeSelection();
  selectedSlot = selection ? selection.slotLabel : "";
  fetchMLData();
}

async function fetchMLData() {
  const selection = getTimeRangeSelection();
  if (!selection || !selectedDate) {
    updatePriceBreakdown();
    return;
  }

  selectedSlot = selection.slotLabel;
  try {
    const [surgeRes, availRes] = await Promise.all([
      fetch(`${API_BASE}/ml/surge-price/${spaceId}?date=${selectedDate}&slot_time=${selection.mlSlot}`),
      fetch(`${API_BASE}/ml/availability/${spaceId}?date=${selectedDate}&slot_time=${selection.mlSlot}`),
    ]);

    if (surgeRes.ok) {
      surgeData = await surgeRes.json();
      const priceEl = document.getElementById("dynamic-price");
      const surgeEl = document.getElementById("surge-indicator");
      const total = surgeData.dynamic_price * selection.durationHours;
      if (priceEl) priceEl.textContent = `Rs ${total.toFixed(0)}`;
      if (surgeEl && surgeData.surge_multiplier > 1.05) {
        surgeEl.innerHTML = `<span class="badge badge-surge">Surge ${surgeData.surge_multiplier}x</span>`;
      } else if (surgeEl) {
        surgeEl.innerHTML = "";
      }
    }

    if (availRes.ok) {
      const avail = await availRes.json();
      const sec = document.getElementById("avail-section");
      const bar = document.getElementById("avail-bar");
      const msg = document.getElementById("avail-msg");
      if (sec) sec.style.display = "block";
      if (bar) bar.style.width = avail.fill_probability + "%";
      if (msg) msg.textContent = avail.message;
    }

    updatePriceBreakdown();
  } catch {
    updatePriceBreakdown();
  }
}

function updatePrice() { fetchMLData(); }

function updatePriceBreakdown() {
  const el = document.getElementById("price-breakdown");
  if (!el || !space) return;

  const selection = getTimeRangeSelection();
  const dur = selection ? selection.durationHours : 1;
  const surge = surgeData ? surgeData.surge_multiplier : 1.0;
  const baseTotal = space.base_price * dur;
  const surgeTotal = baseTotal * surge;

  el.innerHTML = `
    <div class="flex justify-between text-sm mb-1"><span class="text-muted">Base price</span><span>Rs ${space.base_price} x ${dur}hr</span></div>
    ${selection ? `<div class="flex justify-between text-sm mb-1"><span class="text-muted">Selected time</span><span>${selection.slotLabel}</span></div>` : `<div class="flex justify-between text-sm mb-1"><span class="text-muted">Selected time</span><span>Pick start/end time</span></div>`}
    ${surge > 1.05 ? `<div class="flex justify-between text-sm mb-1"><span class="text-muted">Surge (${surge}x)</span><span class="text-accent">+Rs ${(surgeTotal - baseTotal).toFixed(0)}</span></div>` : ""}
    <hr class="divider" style="margin:0.5rem 0;" />
    <div class="flex justify-between font-head"><span>Total</span><span>Rs ${surgeTotal.toFixed(0)}</span></div>
  `;
}

async function initiateBooking() {
  if (!isLoggedIn()) { showLogin(); return; }

  const selection = getTimeRangeSelection();
  if (!selection) { toast("Choose a valid start and end time", "error"); return; }
  if (space?.opening_time && space?.closing_time) {
    if (selection.start < space.opening_time || selection.end > space.closing_time) {
      toast(`Bookings are allowed only between ${space.opening_time} and ${space.closing_time}`, "error");
      return;
    }
  }
  selectedSlot = selection.slotLabel;

  if (!selectedDate) { toast("Please select a date", "error"); return; }

  const dur = selection.durationHours;
  const price = surgeData ? surgeData.dynamic_price * dur : space.base_price * dur;

  const RAZORPAY_KEY = "rzp_test_placeholder";
  if (typeof Razorpay === "undefined") {
    confirmBooking(null, price, dur);
    return;
  }

  const options = {
    key: RAZORPAY_KEY,
    amount: Math.round(price * 100),
    currency: "INR",
    name: "SpaceSync",
    description: `${space.name} - ${selectedSlot}`,
    handler: function(response) {
      confirmBooking(response.razorpay_payment_id, price, dur);
    },
    prefill: { name: getUser()?.name, email: getUser()?.email },
    theme: { color: "#f97316" },
  };

  new Razorpay(options).open();
}

async function confirmBooking(paymentId, price, dur) {
  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        space_id: parseInt(spaceId, 10),
        slot_date: selectedDate,
        slot_time: selectedSlot,
        duration_hours: dur,
        payment_id: paymentId,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Booking failed");

    toast(`Booking confirmed! ID #${data.id}`);

    try {
      const ws = new WebSocket(`${getWebSocketBase()}/ws/slots/${spaceId}`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "book", slot_date: selectedDate, slot_time: selectedSlot, status: "booked" }));
        setTimeout(() => ws.close(), 500);
      };
    } catch {}
  } catch (e) {
    toast(e.message, "error");
  }
}

function toggleEnquiryBox() {
  const box = document.getElementById("enquiry-box");
  if (!box) return;
  box.classList.toggle("hidden");
}

async function sendSpaceEnquiry() {
  if (!isLoggedIn()) {
    showLogin();
    return;
  }

  const message = document.getElementById("enquiry-message")?.value.trim();
  if (!message) {
    toast("Please enter your enquiry message", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/spaces/${spaceId}/enquiry`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send enquiry");

    toast("Enquiry sent");
    document.getElementById("enquiry-message").value = "";
    document.getElementById("enquiry-box")?.classList.add("hidden");
  } catch (error) {
    toast(error.message || "Failed to send enquiry", "error");
  }
}

async function loadReviews() {
  try {
    const res = await fetch(`${API_BASE}/reviews/space/${spaceId}`);
    const reviews = await res.json();
    currentReviews = reviews;
    const el = document.getElementById("reviews-list");
    const viewer = getUser();
    if (!el) return;
    if (reviews.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm">No reviews yet. Be the first!</p>`;
      return;
    }
    el.innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-header">
          <div class="flex items-center gap-1">
            <span style="font-weight:600;font-size:0.9rem;">User #${r.user_id}</span>
            ${sentimentBadge(r.sentiment)}
          </div>
          <div class="flex items-center gap-1">
            <span class="text-muted text-xs">${formatDate(r.created_at)}</span>
            ${viewer && viewer.id === r.user_id ? `<button class="btn btn-ghost btn-sm" onclick="startEditReview(${r.id})">Edit</button><button class="btn btn-secondary btn-sm" onclick="deleteReview(${r.id})">Delete</button>` : ""}
          </div>
        </div>
        <div class="stars">${"*".repeat(r.rating)}<span class="stars-muted">${"*".repeat(5-r.rating)}</span></div>
        ${r.comment ? `<p style="margin-top:0.4rem;font-size:0.9rem;color:var(--text);">${r.comment}</p>` : ""}
        ${r.reply_text ? `<div style="margin-top:0.6rem;padding:0.7rem;border:1px solid var(--border);border-radius:10px;background:var(--bg-raised);"><div class="text-xs text-muted">Owner reply</div><div style="margin-top:0.25rem;">${r.reply_text}</div></div>` : ""}
        ${viewer && viewer.id === r.user_id ? `
          <div id="review-edit-box-${r.id}" class="hidden" style="margin-top:0.8rem;padding:0.9rem;border:1px solid var(--border);border-radius:12px;background:var(--bg-raised);">
            <div class="form-group">
              <label>Rating</label>
              <select id="review-edit-rating-${r.id}">
                <option value="5" ${r.rating === 5 ? "selected" : ""}>5 - Excellent</option>
                <option value="4" ${r.rating === 4 ? "selected" : ""}>4 - Good</option>
                <option value="3" ${r.rating === 3 ? "selected" : ""}>3 - Average</option>
                <option value="2" ${r.rating === 2 ? "selected" : ""}>2 - Poor</option>
                <option value="1" ${r.rating === 1 ? "selected" : ""}>1 - Terrible</option>
              </select>
            </div>
            <div class="form-group">
              <label>Comment</label>
              <textarea id="review-edit-comment-${r.id}" placeholder="Update your review...">${r.comment || ""}</textarea>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-primary btn-sm" onclick="saveReviewEdit(${r.id})">Save</button>
              <button class="btn btn-ghost btn-sm" onclick="cancelEditReview(${r.id})">Cancel</button>
            </div>
          </div>` : ""}
      </div>`).join("");
  } catch {}
}

async function submitReview() {
  const rating = document.getElementById("review-rating")?.value;
  const comment = document.getElementById("review-comment")?.value.trim();
  try {
    const isEditing = !!editingReviewId;
    const res = await fetch(`${API_BASE}/reviews${isEditing ? `/${editingReviewId}` : ""}`, {
      method: isEditing ? "PUT" : "POST",
      headers: authHeaders(),
      body: JSON.stringify(
        isEditing
          ? { rating: parseInt(rating, 10), comment }
          : { space_id: parseInt(spaceId, 10), rating: parseInt(rating, 10), comment }
      ),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Review failed");
    toast(isEditing ? "Review updated" : "Review submitted");
    editingReviewId = null;
    const title = document.querySelector(".reviews-section .owner-review-form-title");
    const button = document.querySelector(".reviews-section .owner-review-submit");
    if (title) title.textContent = "Leave a Review";
    if (button) button.textContent = "Submit Review";
    document.getElementById("review-rating").value = "5";
    document.getElementById("review-comment").value = "";
    loadReviews();
  } catch (e) {
    toast(e.message, "error");
  }
}

function startEditReview(reviewId) {
  const review = currentReviews.find(item => item.id === reviewId);
  if (!review) {
    toast("Review not found", "error");
    return;
  }
  editingReviewId = reviewId;
  document.querySelectorAll('[id^="review-edit-box-"]').forEach(node => node.classList.add("hidden"));
  const box = document.getElementById(`review-edit-box-${reviewId}`);
  const ratingInput = document.getElementById(`review-edit-rating-${reviewId}`);
  const commentInput = document.getElementById(`review-edit-comment-${reviewId}`);
  if (ratingInput) ratingInput.value = String(review.rating);
  if (commentInput) commentInput.value = review.comment || "";
  box?.classList.remove("hidden");
  box?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEditReview(reviewId) {
  if (editingReviewId === reviewId) editingReviewId = null;
  document.getElementById(`review-edit-box-${reviewId}`)?.classList.add("hidden");
}

async function saveReviewEdit(reviewId) {
  const rating = document.getElementById(`review-edit-rating-${reviewId}`)?.value;
  const comment = document.getElementById(`review-edit-comment-${reviewId}`)?.value.trim();
  try {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ rating: parseInt(rating, 10), comment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update review");
    editingReviewId = null;
    toast("Review updated");
    loadReviews();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deleteReview(reviewId) {
  try {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to delete review");
    if (editingReviewId === reviewId) editingReviewId = null;
    toast("Review deleted");
    loadReviews();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadRecommendations() {
  if (!isLoggedIn()) {
    const el = document.getElementById("recs-grid");
    if (el) el.innerHTML = `<p class="text-muted text-sm" style="grid-column:1/-1"><a href="#" onclick="showLogin()" style="color:var(--accent2);">Login</a> to see personalised recommendations</p>`;
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/ml/recommend`, { headers: authHeaders() });
    const recs = await res.json();
    const el = document.getElementById("recs-grid");
    if (!el) return;
    const filtered = recs.filter(r => r.id !== parseInt(spaceId, 10)).slice(0, 3);
    if (filtered.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm" style="grid-column:1/-1">No recommendations yet.</p>`;
      return;
    }

    el.innerHTML = filtered.map(r => `
      <a href="detail.html?id=${r.id}" style="text-decoration:none;color:inherit;">
        <div class="card">
          <div class="card-img-placeholder">${r.type}</div>
          <div class="card-body">
            ${typeBadge(r.type)}
            <div class="card-title mt-1">${r.name}</div>
            <div class="text-muted text-sm">${r.city}</div>
            <div class="flex items-center justify-between mt-2">
              <span class="price price-normal">Rs ${r.base_price}<span class="price-sub">/hr</span></span>
              ${starsHTML(r.rating)}
            </div>
          </div>
        </div>
      </a>`).join("");
  } catch {}
}

loadSpace();
