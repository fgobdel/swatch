(async function () {
  const session = requireLogin();
  if (!session) return;
  paintUserChip();

  const params = new URLSearchParams(window.location.search);
  const setId = params.get("id");
  if (!setId) {
    window.location.href = "sets.html";
    return;
  }

  const loading = document.getElementById("detail-loading");
  const content = document.getElementById("detail-content");
  const nameInput = document.getElementById("set-name");
  const filledCountEl = document.getElementById("filled-count");
  const notesInput = document.getElementById("set-notes");
  const favBtn = document.getElementById("fav-btn");
  const leftRow = document.getElementById("left-row");
  const rightRow = document.getElementById("right-row");
  const deleteModal = document.getElementById("delete-modal");
  const deleteTargetName = document.getElementById("delete-target-name");

  let set = null;
  let saveTimer = null;

  function debounceSave(fn, delay = 600) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(fn, delay);
  }

  function slotFor(key) {
    return set.set_slots.find((s) => s.finger_key === key);
  }

  function renderRow(container, keys) {
    container.innerHTML = keys
      .map((key) => {
        const slot = slotFor(key);
        const filled = slot && slot.image_path;
        return `
        <div class="finger-slot">
          <div class="slot-label">${FINGER_LABELS[key]}</div>
          <label class="slot-frame ${filled ? "" : "empty"}" data-key="${key}">
            ${
              filled
                ? `<img class="ph" src="${publicUrlFor(slot.image_path)}" style="height:100%;" alt="">
                   <div class="slot-overlay"><span>Change photo</span></div>`
                : `<span class="plus">+</span>`
            }
            <input type="file" accept="image/*" data-key="${key}" style="display:none;">
          </label>
          <input type="text" class="slot-note" data-key="${key}" placeholder="note for this nail…" value="${(slot && slot.note) ? escapeAttr(slot.note) : ""}">
        </div>`;
      })
      .join("");

    container.querySelectorAll('input[type=file]').forEach((input) => {
      input.addEventListener("change", () => handleSlotUpload(input.dataset.key, input.files[0]));
    });
    container.querySelectorAll(".slot-note").forEach((input) => {
      input.addEventListener("input", () => {
        debounceSave(async () => {
          try {
            await updateSlot(setId, input.dataset.key, { note: input.value });
          } catch (err) {
            console.error(err);
          }
        });
      });
    });
  }

  function escapeAttr(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML.replace(/"/g, "&quot;");
  }

  function render() {
    document.title = `Swatch — ${set.name}`;
    nameInput.value = set.name;
    notesInput.value = set.notes || "";
    const filled = set.set_slots.filter((s) => s.image_path).length;
    filledCountEl.textContent = `${filled}/10 nails filled`;
    favBtn.textContent = set.is_favorite ? "★" : "☆";
    favBtn.classList.toggle("active", set.is_favorite);
    deleteTargetName.textContent = set.name;

    renderRow(leftRow, FINGER_KEYS.slice(0, 5));
    renderRow(rightRow, FINGER_KEYS.slice(5, 10));
  }

  async function handleSlotUpload(fingerKey, file) {
    if (!file) return;
    const frame = document.querySelector(`.slot-frame[data-key="${fingerKey}"]`);
    if (frame) frame.style.opacity = "0.5";
    try {
      const path = await setSlotImageFromFile(session.id, setId, fingerKey, file);
      // Uploading straight to a finger slot also saves it to the board, per spec.
      await addBoardImageFromPath(session.id, path);
      set = await getSet(setId);
      render();
    } catch (err) {
      console.error(err);
      alert("Upload failed — check your connection and try again.");
      if (frame) frame.style.opacity = "1";
    }
  }

  async function load() {
    try {
      set = await getSet(setId);
      loading.style.display = "none";
      content.style.display = "block";
      render();
    } catch (err) {
      console.error(err);
      loading.textContent = "Couldn't find that set, or you're offline. Go back and try again.";
    }
  }

  nameInput.addEventListener("input", () => {
    debounceSave(async () => {
      try {
        await updateSet(setId, { name: nameInput.value.trim() || "Untitled Set" });
      } catch (err) {
        console.error(err);
      }
    });
  });

  notesInput.addEventListener("input", () => {
    debounceSave(async () => {
      try {
        await updateSet(setId, { notes: notesInput.value });
      } catch (err) {
        console.error(err);
      }
    });
  });

  favBtn.addEventListener("click", async () => {
    set.is_favorite = !set.is_favorite;
    favBtn.textContent = set.is_favorite ? "★" : "☆";
    favBtn.classList.toggle("active", set.is_favorite);
    try {
      await toggleFavorite(setId, set.is_favorite);
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById("duplicate-btn").addEventListener("click", async () => {
    const newName = prompt("Name for the duplicated set:", `${set.name} (copy)`);
    if (!newName) return;
    try {
      const newSet = await duplicateSet(set, newName);
      window.location.href = `set-detail.html?id=${newSet.id}`;
    } catch (err) {
      console.error(err);
      alert("Couldn't duplicate this set — check your connection and try again.");
    }
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    alert("Export-as-image is coming in the next round of building — hang tight!");
  });

  document.getElementById("delete-btn").addEventListener("click", () => {
    deleteModal.style.display = "flex";
  });
  document.getElementById("delete-cancel").addEventListener("click", () => {
    deleteModal.style.display = "none";
  });
  document.getElementById("delete-confirm").addEventListener("click", async () => {
    deleteModal.style.display = "none";
    try {
      await deleteSet(set);
      window.location.href = "sets.html";
    } catch (err) {
      console.error(err);
      alert("Couldn't delete this set — check your connection and try again.");
    }
  });

  load();
})();
