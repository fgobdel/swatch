(async function () {
  // Already signed in on this browser? Skip straight to the board.
  if (getSession()) {
    window.location.href = "board.html";
    return;
  }

  const form = document.getElementById("login-form");
  const input = document.getElementById("username");
  const errorEl = document.getElementById("username-error");
  const submitBtn = document.getElementById("login-submit");

  function showError(message) {
    if (message) {
      errorEl.textContent = "⚠ " + message;
      errorEl.style.display = "flex";
      input.classList.add("input-error");
    } else {
      errorEl.style.display = "none";
      input.classList.remove("input-error");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = input.value.trim().toLowerCase();

    if (!username) {
      showError("Enter a username to continue.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Checking…";
    showError(null);

    try {
      const taken = await isUsernameTaken(username);
      if (taken) {
        showError("That username is already taken — try another.");
        return;
      }
      const profile = await createProfile(username);
      setSession(profile);
      window.location.href = "board.html";
    } catch (err) {
      console.error(err);
      showError("Something went wrong connecting to the server. Try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Continue";
    }
  });
})();
