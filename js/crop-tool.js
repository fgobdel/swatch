// A reusable crop modal: pick where in a photo to keep, inside a
// fixed-aspect frame, with drag-to-pan (any direction) and a zoom
// slider. Used both for the board and for finger slots (with a
// tall 3:5 "nail shaped" frame there).
//
// Usage:
//   const blob = await openCropTool({ file, aspect: 3/5, title: "Left Thumb" });
//   if (blob) { ...upload blob... }   // null means the user cancelled

function openCropTool({ file, aspect, title }) {
  return new Promise((resolve) => {
    // Internal canvas resolution (the actual exported image size).
    const OUT_W = 480;
    const OUT_H = Math.round(OUT_W / aspect);

    const overlay = document.createElement("div");
    overlay.className = "backdrop crop-overlay";
    overlay.innerHTML = `
      <div class="modal crop-modal">
        ${title ? `<div class="crop-target">Cropping for: ${title}</div>` : ""}
        <p>Drag the photo to reposition it, use the slider to zoom.</p>
        <div class="crop-frame-outer">
          <div class="crop-canvas-wrap" style="aspect-ratio:${aspect};">
            <canvas class="crop-canvas"></canvas>
          </div>
          <div class="crop-controls">
            <span>🔍−</span>
            <input type="range" class="crop-zoom" min="0" max="100" value="0">
            <span>🔍+</span>
          </div>
        </div>
        <div class="crop-footer">
          <button type="button" class="btn btn-secondary crop-cancel">Cancel</button>
          <button type="button" class="btn btn-primary crop-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector(".crop-canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    const zoomSlider = overlay.querySelector(".crop-zoom");

    const img = new Image();
    let minScale = 1;
    let scale = 1;
    let offsetX = 0; // top-left of the drawn image, in canvas px (<= 0)
    let offsetY = 0;

    function clampOffsets() {
      const drawnW = img.width * scale;
      const drawnH = img.height * scale;
      offsetX = Math.min(0, Math.max(OUT_W - drawnW, offsetX));
      offsetY = Math.min(0, Math.max(OUT_H - drawnH, offsetY));
    }

    function draw() {
      ctx.clearRect(0, 0, OUT_W, OUT_H);
      ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
    }

    function setZoom(percent) {
      const drawnCenterX = OUT_W / 2 - offsetX;
      const drawnCenterY = OUT_H / 2 - offsetY;
      const ratioX = drawnCenterX / (img.width * scale);
      const ratioY = drawnCenterY / (img.height * scale);

      scale = minScale * (1 + (percent / 100) * 2); // up to 3x cover
      offsetX = OUT_W / 2 - ratioX * img.width * scale;
      offsetY = OUT_H / 2 - ratioY * img.height * scale;
      clampOffsets();
      draw();
    }

    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        minScale = Math.max(OUT_W / img.width, OUT_H / img.height);
        scale = minScale;
        offsetX = (OUT_W - img.width * scale) / 2;
        offsetY = (OUT_H - img.height * scale) / 2;
        draw();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);

    zoomSlider.addEventListener("input", () => setZoom(Number(zoomSlider.value)));

    // Drag to pan — works for mouse and touch, in every direction.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function pointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      const scaleX = OUT_W / rect.width;
      const scaleY = OUT_H / rect.height;
      return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
    }

    function dragStart(e) {
      dragging = true;
      const p = pointerPos(e);
      lastX = p.x;
      lastY = p.y;
    }
    function dragMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const p = pointerPos(e);
      offsetX += p.x - lastX;
      offsetY += p.y - lastY;
      lastX = p.x;
      lastY = p.y;
      clampOffsets();
      draw();
    }
    function dragEnd() {
      dragging = false;
    }

    canvas.addEventListener("mousedown", dragStart);
    window.addEventListener("mousemove", dragMove);
    window.addEventListener("mouseup", dragEnd);
    canvas.addEventListener("touchstart", dragStart, { passive: true });
    canvas.addEventListener("touchmove", dragMove, { passive: false });
    canvas.addEventListener("touchend", dragEnd);

    function cleanup() {
      window.removeEventListener("mousemove", dragMove);
      window.removeEventListener("mouseup", dragEnd);
      overlay.remove();
    }

    overlay.querySelector(".crop-cancel").addEventListener("click", () => {
      cleanup();
      resolve(null);
    });
    overlay.querySelector(".crop-save").addEventListener("click", () => {
      canvas.toBlob(
        (blob) => {
          cleanup();
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  });
}
