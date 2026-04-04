// ── SpaceSync Shared JS ──────────────────────────────────────────────────────
const runtimeApiBase =
  window.__API_BASE__ ||
  localStorage.getItem("ss_api_base") ||
  document.querySelector('meta[name="api-base"]')?.content ||
  "http://localhost:8001";

const API_BASE = window.API_BASE = runtimeApiBase.replace(/\/$/, "");

function getWebSocketBase() {
  if (window.__WS_BASE__) return window.__WS_BASE__.replace(/\/$/, "");
  const fromStorage = localStorage.getItem("ss_ws_base");
  if (fromStorage) return fromStorage.replace(/\/$/, "");
  const configured = API_BASE.replace(/^http/, "ws");
  return configured.replace(/\/$/, "");
}

window.getWebSocketBase = getWebSocketBase;

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getToken()    { return localStorage.getItem("ss_token"); }
function getUser()     { try { return JSON.parse(localStorage.getItem("ss_user")); } catch { return null; } }
function setAuth(token, user) {
  localStorage.setItem("ss_token", token);
  localStorage.setItem("ss_user", JSON.stringify(user));
}
function clearAuth()   { localStorage.removeItem("ss_token"); localStorage.removeItem("ss_user"); }
function isLoggedIn()  { return !!getToken(); }

function authHeaders() {
  const t = getToken();
  return t ? { "Authorization": `Bearer ${t}`, "Content-Type": "application/json" }
           : { "Content-Type": "application/json" };
}

function parseApiError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length) {
    return data.detail.map(item => item.msg || fallback).join(", ");
  }
  return fallback;
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " error" : type === "info" ? " info" : ""}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function getHomeHref() {
  return window.location.pathname.includes("/owner/") ? "../index.html" : "index.html";
}

function getLogoutRedirectHref() {
  return getHomeHref();
}

function ensureHomeLink() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return;

  let homeLink = document.getElementById("nav-home");
  if (!homeLink) {
    homeLink = document.createElement("a");
    homeLink.id = "nav-home";
    homeLink.textContent = "Home";
    navLinks.prepend(homeLink);
  }

  homeLink.href = getHomeHref();
}

function ensureMobileNavToggle() {
  const nav = document.querySelector("nav");
  const navLinks = document.querySelector(".nav-links");
  if (!nav || !navLinks) return;

  const setToggleState = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "×" : "☰";
  };

  let toggle = document.getElementById("nav-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = "nav-toggle";
    toggle.className = "nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";
    nav.insertBefore(toggle, navLinks);
  }

  if (!toggle.dataset.bound) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("nav-open");
      setToggleState(isOpen);
    });

    navLinks.addEventListener("click", (event) => {
      if (!event.target.closest("a")) return;
      nav.classList.remove("nav-open");
      setToggleState(false);
    });

    toggle.dataset.bound = "true";
  }

  setToggleState(nav.classList.contains("nav-open"));
}

function ensureProfileLink() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return null;

  let profileLink = document.getElementById("nav-profile");
  if (!profileLink) {
    profileLink = document.createElement("a");
    profileLink.id = "nav-profile";
    profileLink.textContent = "Profile";
    const logoutBtn = document.getElementById("nav-logout");
    if (logoutBtn) {
      navLinks.insertBefore(profileLink, logoutBtn);
    } else {
      navLinks.appendChild(profileLink);
    }
  }
  return profileLink;
}

function setActiveNavLink() {
  const path = window.location.pathname.toLowerCase();
  const homeLink = document.getElementById("nav-home");
  const browseLink = document.querySelector('.nav-links a[href="listing.html"]');
  const dashLink = document.getElementById("nav-dashboard");
  const profileLink = document.getElementById("nav-profile");

  document.querySelectorAll(".nav-links a").forEach(link => link.classList.remove("active"));

  if (path.endsWith("/index.html") || path === "/" || path.endsWith("/frontend") || path.endsWith("/frontend/")) {
    homeLink?.classList.add("active");
    return;
  }

  if (path.includes("/listing.html")) {
    browseLink?.classList.add("active");
    return;
  }

  if (path.includes("/user-profile.html")) {
    profileLink?.classList.add("active");
    return;
  }

  if (path.includes("/dashboard.html") || path.includes("/owner/")) {
    dashLink?.classList.add("active");
  }
}

// ── Nav state ────────────────────────────────────────────────────────────────
function updateNav() {
  ensureHomeLink();
  ensureMobileNavToggle();
  const profileLink = ensureProfileLink();
  const user = getUser();
  const loginBtn    = document.getElementById("nav-login-btn");
  const registerBtn = document.getElementById("nav-register-btn");
  const logoutBtn   = document.getElementById("nav-logout");
  const userSpan    = document.getElementById("nav-user");
  const dashLink    = document.getElementById("nav-dashboard");

  if (user) {
    loginBtn?.classList.add("hidden");
    registerBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
    if (userSpan) { userSpan.textContent = `Hi, ${user.name.split(" ")[0]}`; userSpan.classList.remove("hidden"); }
    if (dashLink && user.role === "admin") { dashLink.href = "dashboard.html"; dashLink.textContent = "Dashboard"; dashLink.classList.remove("hidden"); }
    if (dashLink && user.role === "owner") { dashLink.href = "owner/earnings.html"; dashLink.textContent = "Owner"; dashLink.classList.remove("hidden"); }
    if (profileLink && user.role === "user") { profileLink.href = "user-profile.html"; profileLink.classList.remove("hidden"); }
    if (profileLink && user.role !== "user") { profileLink.classList.add("hidden"); }
  } else {
    loginBtn?.classList.remove("hidden");
    registerBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
    userSpan?.classList.add("hidden");
    dashLink?.classList.add("hidden");
    profileLink?.classList.add("hidden");
  }

  if (typeof window.syncOwnerListingUI === "function") {
    window.syncOwnerListingUI();
  }

  setActiveNavLink();
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function showLogin()    { closeModals(); document.getElementById("login-modal")?.classList.remove("hidden"); }
function showRegister() { closeModals(); document.getElementById("register-modal")?.classList.remove("hidden"); }
function closeModals()  {
  document.getElementById("login-modal")?.classList.add("hidden");
  document.getElementById("register-modal")?.classList.add("hidden");
}

// ── Auth actions ──────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-password")?.value;
  if (!email || !password) { toast("Fill in all fields", "error"); return; }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseApiError(data, "Login failed"));
    setAuth(data.access_token, data.user);
    closeModals();
    updateNav();
    if (typeof window.createOwnerListingUI === "function") window.createOwnerListingUI();
    toast(`Welcome back, ${data.user.name.split(" ")[0]}! 👋`);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function doRegister() {
  const name     = document.getElementById("reg-name")?.value.trim();
  const email    = document.getElementById("reg-email")?.value.trim();
  const password = document.getElementById("reg-password")?.value;
  const city     = document.getElementById("reg-city")?.value;
  const role     = document.getElementById("reg-role")?.value || "user";

  if (!name || !email || !password) { toast("Fill in all required fields", "error"); return; }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, city, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseApiError(data, "Registration failed"));
    setAuth(data.access_token, data.user);
    closeModals();
    updateNav();
    if (typeof window.createOwnerListingUI === "function") window.createOwnerListingUI();
    toast(`Account created! Welcome, ${data.user.name.split(" ")[0]} 🚀`);
  } catch (e) {
    toast(e.message, "error");
  }
}

function doLogout() {
  clearAuth();
  updateNav();
  toast("Logged out");
  window.location.href = getLogoutRedirectHref();
}

// ── Bind nav buttons ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateNav();
  document.getElementById("nav-login-btn")?.addEventListener("click", e => { e.preventDefault(); showLogin(); });
  document.getElementById("nav-register-btn")?.addEventListener("click", e => { e.preventDefault(); showRegister(); });
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  // Close modal on overlay click
  document.querySelectorAll(".modal-overlay").forEach(el => {
    el.addEventListener("click", e => { if (e.target === el) closeModals(); });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function starsHTML(rating, max = 5) {
  const r = Math.round(rating || 0);
  return `<span class="stars">${"★".repeat(r)}</span><span class="stars-muted">${"★".repeat(max - r)}</span>`;
}

function typeBadge(type) {
  const map = { cricket: "badge-cricket", party_hall: "badge-party", parking: "badge-parking" };
  const icons = { cricket: "🏏", party_hall: "🎉", parking: "🅿️" };
  return `<span class="badge ${map[type] || ''}">${icons[type] || ""} ${(type||"").replace("_"," ")}</span>`;
}

function sentimentBadge(s) {
  const map = { positive: "🟢", negative: "🔴", neutral: "⚪" };
  return `<span class="badge badge-${s}">${map[s]||""} ${s}</span>`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}

function fmtCurrency(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}
