// A reusable crop modal: pick where in a photo to keep, inside a
// fixed-aspect frame, with drag-to-pan (any direction), a zoom
// slider, and a tilt slider. Zoom and tilt are independent — tilting
// doesn't change how zoomed in you are. If a tilt + low zoom combo
// leaves a corner of the frame uncovered, it just shows a soft
// background there rather than a hard edge.
//
// Usage (a freshly picked file):
//   const blob = await openCropTool({ file, aspect: 3/5, title: "Left Thumb" });
// Usage (an existing photo already saved somewhere, e.g. the board):
//   const blob = await openCropTool({ imageUrl, aspect: 3/5, title: "Left Thumb" });
//   if (blob) { ...upload blob... }   // null means the user cancelled

function openCropTool({ file, imageUrl, aspect, title }) {
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
            <input type="range" class="crop-zoom" min="20" max="600" value="100">
            <span>🔍+</span>
          </div>
          <div class="crop-controls">
            <span>↺</span>
            <input type="range" class="crop-tilt" min="-180" max="180" value="0">
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
    let coverScale = 1; // scale at which the unrotated image just covers the frame — the zoom slider's 100% point
    let scale = 1;
    let rotation = 0; // degrees
    let panX = 0; // image center offset from canvas center, in canvas px
    let panY = 0;

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
      ctx.fillStyle = "#fbe6ee"; // soft pink so an exposed corner (extreme tilt + zoomed out) never looks broken
      ctx.fillRect(0, 0, OUT_W, OUT_H);
      ctx.save();
      ctx.translate(OUT_W / 2 + panX, OUT_H / 2 + panY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale);
      ctx.restore();
    }

    function applyZoom(percent) {
      scale = coverScale * (percent / 100);
      clampPan();
      draw();
    }

    function applyTilt(deg) {
      rotation = deg;
      tiltValueEl.textContent = `Tilt: ${deg}°`;
      clampPan();
      draw();
    }

    img.onload = () => {
      coverScale = Math.max(OUT_W / img.width, OUT_H / img.height);
      scale = coverScale;
      panX = 0;
      panY = 0;
      draw();
    };

    if (imageUrl) {
      img.crossOrigin = "anonymous"; // needed so the canvas can export a photo loaded from a URL
      img.src = imageUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

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
