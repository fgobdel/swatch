// A reusable crop modal: pick where in a photo to keep, inside a
// fixed-aspect frame, with drag-to-pan (any direction), a zoom
// slider, and a tilt slider. Used both for the board and for finger
// slots (with a tall 3:5 "nail shaped" frame there).
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
        <p>Drag the photo to reposition it, and use the sliders to zoom or straighten it.</p>
        <div class="crop-frame-outer">
          <div class="crop-canvas-wrap" style="aspect-ratio:${aspect};">
            <canvas class="crop-canvas"></canvas>
          </div>
          <div class="crop-controls">
            <span>🔍−</span>
            <input type="range" class="crop-zoom" min="0" max="100" value="0">
            <span>🔍+</span>
          </div>
          <div class="crop-controls">
            <span>↺</span>
            <input type="range" class="crop-tilt" min="-45" max="45" value="0">
            <span>↻</span>
          </div>
          <div class="crop-tilt-value">Tilt: 0°</div>
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
    const tiltSlider = overlay.querySelector(".crop-tilt");
    const tiltValueEl = overlay.querySelector(".crop-tilt-value");

    const img = new Image();
    let minScale = 1; // scale at which the (unrotated) image just covers the frame
    let scale = 1;
    let rotation = 0; // degrees
    let panX = 0; // image center offset from canvas center, in canvas px
    let panY = 0;

    // How much bigger than "just covers the frame" the image needs to be
    // drawn at a given rotation so rotating it never exposes a corner.
    function minScaleForRotation(deg) {
      const rad = (deg * Math.PI) / 180;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      const neededW = OUT_W * c + OUT_H * s;
      const neededH = OUT_W * s + OUT_H * c;
      return Math.max(neededW / img.width, neededH / img.height) * 1.02; // small safety margin
    }

    function clampPan() {
      const rad = (rotation * Math.PI) / 180;
      const c = Math.abs(Math.cos(rad));
      const s = Math.abs(Math.sin(rad));
      const hw = (img.width * scale) / 2;
      const hh = (img.height * scale) / 2;
      const projHalfW = hw * c + hh * s;
      const projHalfH = hw * s + hh * c;
      const maxPanX = Math.max(0, projHalfW - OUT_W / 2);
      const maxPanY = Math.max(0, projHalfH - OUT_H / 2);
      panX = Math.min(maxPanX, Math.max(-maxPanX, panX));
      panY = Math.min(maxPanY, Math.max(-maxPanY, panY));
    }

    function draw() {
      ctx.clearRect(0, 0, OUT_W, OUT_H);
      ctx.save();
      ctx.translate(OUT_W / 2 + panX, OUT_H / 2 + panY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale);
      ctx.restore();
    }

    function applyZoom(percent) {
      const base = minScaleForRotation(rotation);
      scale = base * (1 + (percent / 100) * 6); // up to 7x the "just covers" size
      clampPan();
      draw();
    }

    function applyTilt(deg) {
      rotation = deg;
      tiltValueEl.textContent = `Tilt: ${deg}°`;
      const minAtThisAngle = minScaleForRotation(deg);
      if (scale < minAtThisAngle) scale = minAtThisAngle; // never let a corner show
      clampPan();
      draw();
    }

    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        minScale = minScaleForRotation(0);
        scale = minScale;
        panX = 0;
        panY = 0;
        draw();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);

    zoomSlider.addEventListener("input", () => applyZoom(Number(zoomSlider.value)));
    tiltSlider.addEventListener("input", () => applyTilt(Number(tiltSlider.value)));

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
      panX += p.x - lastX;
      panY += p.y - lastY;
      lastX = p.x;
      lastY = p.y;
      clampPan();
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
