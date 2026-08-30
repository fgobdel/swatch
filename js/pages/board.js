(async function () {
  const session = requireLogin();
  if (!session) return;
  paintUserChip();

  const masonry = document.getElementById("masonry");
  const loading = document.getElementById("board-loading");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("board-count");
  const fileInput = document.getElementById("file-input");
  const saveStatus = document.getElementById("save-status");
  const deleteModal = document.getElementById("delete-modal");

  let images = [];
  let pendingDeleteId = null;
  let sortable = null;

  function showSaving(text) {
    saveStatus.textContent = text || "Saving…";
    saveStatus.style.display = "block";
  }
  function hideSaving() {
    saveStatus.style.display = "none";
  }

  function render() {
    loading.style.display = "none";
    if (images.length === 0) {
      masonry.style.display = "none";
      emptyState.style.display = "block";
      countEl.textContent = "";
      return;
    }
    emptyState.style.display = "none";
    masonry.style.display = "block";
    countEl.textContent = `${images.length} saved design${images.length === 1 ? "" : "s"} · drag to reorder`;

    masonry.innerHTML = images
      .map(
        (img) => `
        <div class="pin" data-id="${img.id}">
          <img class="ph" src="${publicUrlFor(img.image_path)}" alt="">
          <div class="pin-overlay">
            <span class="drag-handle">⠿</span>
            <span class="pin-actions">
              <button class="icon-btn delete-btn" data-id="${img.id}" title="Delete">🗑</button>
            </span>
          </div>
        </div>`
      )
      .join("");

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingDeleteId = btn.dataset.id;
        deleteModal.style.display = "flex";
      });
    });

    if (sortable) sortable.destroy();
    sortable = Sortable.create(masonry, {
      animation: 150,
      handle: ".drag-handle",
      onEnd: async () => {
        const orderedIds = [...masonry.children].map((el) => el.dataset.id);
        images.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
        showSaving("Saving new order…");
        try {
          await reorderBoardImages(orderedIds);
        } catch (err) {
          console.error(err);
          alert("Couldn't save the new order: " + (err.message || "unknown error"));
        } finally {
          hideSaving();
        }
      },
    });
  }

  async function load() {
    try {
      images = await listBoardImages(session.id);
      render();
    } catch (err) {
      console.error(err);
      loading.textContent = "Couldn't load your board. Check your connection and refresh.";
    }
  }

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (!files.length) return;

    for (const file of files) {
      try {
        const blob = await openCropTool({ file, aspect: 4 / 5 });
        if (!blob) continue; // user cancelled that one
        showSaving("Uploading…");
        const row = await addBoardImageFromBlob(session.id, blob);
        images.push(row);
        render();
      } catch (err) {
        console.error(err);
        alert("Upload failed: " + (err.message || "unknown error") + "\n\nCheck your connection and try again.");
      } finally {
        hideSaving();
      }
    }
  });

  document.getElementById("delete-cancel").addEventListener("click", () => {
    pendingDeleteId = null;
    deleteModal.style.display = "none";
  });

  document.getElementById("delete-confirm").addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    const image = images.find((i) => i.id === pendingDeleteId);
    deleteModal.style.display = "none";
    if (!image) return;
    showSaving("Deleting…");
    try {
      await deleteBoardImage(image);
      images = images.filter((i) => i.id !== image.id);
      render();
    } catch (err) {
      console.error(err);
      alert("Couldn't delete that image: " + (err.message || "unknown error"));
    } finally {
      hideSaving();
      pendingDeleteId = null;
    }
  });

  load();
})();
