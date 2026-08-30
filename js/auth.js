// Very lightweight "session": we just remember the logged-in profile
// (id + username) in localStorage. No password, no token.

const SESSION_KEY = "swatch_session";

// Last-resort safety net: if something throws or a promise rejects
// anywhere and nothing else caught it, say so instead of failing
// silently (which is exactly what makes bugs feel like "nothing
// happened" instead of something we can actually fix).
window.addEventListener("error", (e) => {
  console.error("Unhandled error:", e.error || e.message);
  alert("Something went wrong: " + (e.message || "unknown error"));
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
  const msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
  alert("Something went wrong: " + msg);
});

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Call this at the top of every page except the login page.
// Redirects to login if nobody is signed in.
function requireLogin() {
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

// Fills in the little avatar/username chip in the top nav, and wires
// up a click-to-logout on it, if the page has one.
function paintUserChip() {
  const session = getSession();
  if (!session) return;
  const chip = document.querySelector(".user-chip");
  if (!chip) return;
  const avatar = chip.querySelector(".avatar");
  const nameEl = chip.querySelector(".user-chip-name");
  if (avatar) avatar.textContent = session.username[0].toUpperCase();
  if (nameEl) nameEl.textContent = session.username;
  chip.style.cursor = "pointer";
  chip.title = "Click to log out";
  chip.addEventListener("click", () => {
    if (confirm("Log out of Swatch?")) {
      clearSession();
      window.location.href = "index.html";
    }
  });
}
