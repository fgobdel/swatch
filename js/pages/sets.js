(async function () {
  const session = requireLogin();
  if (!session) return;
  paintUserChip();

  const loading = document.getElementById("sets-loading");
  const list = document.getElementById("sets-list");
  const emptyState = document.getElementById("empty-state");

  function fingerThumbs(slots) {
    // first up-to-4 filled slots, in finger order, for the little thumbnail collage
    const filled = FINGER_KEYS.map((key) => slots.find((s) => s.finger_key === key))
      .filter((s) => s && s.image_path)
      .slice(0, 4);
    while (filled.length < 4) filled.push(null);
    return filled
      .map((s) =>
        s
          ? `<img src="${publicUrlFor(s.image_path)}" alt="">`
          : `<div style="background:var(--pink-soft);"></div>`
      )
      .join("");
  }

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.round(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  async function load() {
    try {
      const sets = await listSets(session.id);
      loading.style.display = "none";

      if (sets.length === 0) {
        emptyState.style.display = "block";
        list.style.display = "none";
        return;
      }

      emptyState.style.display = "none";
      list.style.display = "grid";
      list.innerHTML = sets
        .map((set) => {
          const filledCount = set.set_slots.filter((s) => s.image_path).length;
          return `
          <a href="set-detail.html?id=${set.id}" class="card set-card">
            <div class="set-thumb">${fingerThumbs(set.set_slots)}</div>
            <div class="set-card-body">
              <h3>${escapeHtml(set.name)}</h3>
              <div class="note">${escapeHtml(set.notes || "No notes yet")}</div>
              <div class="set-meta">
                <span class="chip">${filledCount}/10 filled</span>
                <span>· edited ${timeAgo(set.updated_at)}</span>
              </div>
            </div>
            <button class="star-btn ${set.is_favorite ? "active" : ""}" data-id="${set.id}" data-fav="${set.is_favorite}">${set.is_favorite ? "★" : "☆"}</button>
          </a>`;
        })
        .join("");

      document.querySelectorAll(".star-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const newFav = btn.dataset.fav !== "true";
          btn.textContent = newFav ? "★" : "☆";
          btn.classList.toggle("active", newFav);
          btn.dataset.fav = String(newFav);
          try {
            await toggleFavorite(btn.dataset.id, newFav);
            load(); // re-sort so favorites float to the top
          } catch (err) {
            console.error(err);
          }
        });
      });
    } catch (err) {
      console.error(err);
      loading.textContent = "Couldn't load your sets. Check your connection and refresh.";
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  load();
})();
