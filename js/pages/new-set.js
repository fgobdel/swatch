(async function () {
  const session = requireLogin();
  if (!session) return;
  paintUserChip();

  const form = document.getElementById("new-set-form");
  const nameInput = document.getElementById("setname");
  const notesInput = document.getElementById("setnotes");
  const submitBtn = document.getElementById("create-submit");
  const errorEl = document.getElementById("create-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      errorEl.textContent = "⚠ Give your set a name to continue.";
      errorEl.style.display = "block";
      return;
    }
    errorEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating…";
    try {
      const set = await createSet(session.id, name, notesInput.value.trim());
      window.location.href = `set-detail.html?id=${set.id}`;
    } catch (err) {
      console.error(err);
      errorEl.textContent = "⚠ Something went wrong — check your connection and try again.";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Set";
    }
  });
})();
