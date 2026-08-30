// Builds the printable "export" image for a set: a hidden DOM node
// styled exactly like the approved mockup, rasterized to a PNG via
// html2canvas, then downloaded.

function escapeHtmlExport(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function buildExportCard(set) {
  const slotFor = (key) => set.set_slots.find((s) => s.finger_key === key);

  function fingerCard(key, label) {
    const slot = slotFor(key);
    const hasPhoto = slot && slot.image_path;
    const photoHtml = hasPhoto
      ? `<img src="${publicUrlFor(slot.image_path)}" crossorigin="anonymous">`
      : "";
    const noteHtml = slot && slot.note ? `<div class="export-finger-note">${escapeHtmlExport(slot.note)}</div>` : "";
    return `
      <div class="export-finger-card">
        <div class="export-finger-photo">${photoHtml}</div>
        <div class="export-finger-name">${label}</div>
        ${noteHtml}
      </div>`;
  }

  const leftKeys = [["left_thumb", "Thumb"], ["left_index", "Index"], ["left_middle", "Middle"], ["left_ring", "Ring"], ["left_pinky", "Pinky"]];
  const rightKeys = [["right_thumb", "Thumb"], ["right_index", "Index"], ["right_middle", "Middle"], ["right_ring", "Ring"], ["right_pinky", "Pinky"]];

  const card = document.createElement("div");
  card.className = "export-card";
  card.innerHTML = `
    <div class="export-header">
      <div class="set-name">${escapeHtmlExport(set.name)}</div>
      ${set.notes ? `<div class="notes">${escapeHtmlExport(set.notes)}</div>` : ""}
    </div>
    <div class="export-hands-wrap">
      <div>
        <div class="export-hand-title">Left Hand</div>
        <div class="export-finger-row">${leftKeys.map(([k, l]) => fingerCard(k, l)).join("")}</div>
      </div>
      <div>
        <div class="export-hand-title">Right Hand</div>
        <div class="export-finger-row">${rightKeys.map(([k, l]) => fingerCard(k, l)).join("")}</div>
      </div>
    </div>
    <div class="export-footer">Swatch</div>
  `;
  document.body.appendChild(card);
  return card;
}

async function waitForImages(container) {
  const imgs = [...container.querySelectorAll("img")];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // don't block the whole export on one bad photo
        })
    )
  );
}

async function exportSetAsImage(set) {
  const card = buildExportCard(set);
  try {
    await waitForImages(card);
    const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${set.name.replace(/[^a-z0-9\- ]/gi, "").trim() || "swatch-set"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    card.remove();
  }
}
