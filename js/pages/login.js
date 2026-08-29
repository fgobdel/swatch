(async function () {
  // Already signed in on this browser? Skip straight to the board.
  if (getSession()) {
    window.location.href = "board.html";
    return;
  }

  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const secretGroup = document.getElementById("secret-group");
  const secretLabel = document.getElementById("secret-label");
  const secretInput = document.getElementById("secret");
  const errorEl = document.getElementById("username-error");
  const submitBtn = document.getElementById("login-submit");
  const backLink = document.getElementById("back-link");
  const hint = document.getElementById("login-hint");

  // step 1 = just entered a username, haven't checked it yet
  // step 2 = we know whether it's new or existing, secret word field is showing
  let step = 1;
  let mode = null; // "create" | "signin" | "claim" (existing account with no secret word set yet)
  let existingProfile = null;

  function showError(message) {
    if (message) {
      errorEl.textContent = "⚠ " + message;
      errorEl.style.display = "flex";
    } else {
      errorEl.style.display = "none";
    }
  }

  function resetToStep1() {
    step = 1;
    mode = null;
    existingProfile = null;
    secretGroup.style.display = "none";
    secretInput.value = "";
    usernameInput.disabled = false;
    submitBtn.textContent = "Continue";
    showError(null);
    hint.innerHTML = "No password — just a username and a short secret word only you know.<br>First time? We'll help you set one up.";
    usernameInput.focus();
  }

  backLink.addEventListener("click", (e) => {
    e.preventDefault();
    resetToStep1();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (step === 1) {
      const username = usernameInput.value.trim().toLowerCase();
      if (!username) {
        showError("Enter a username to continue.");
        return;
      }
      showError(null);
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking…";
      try {
        const profile = await getProfileByUsername(username);
        if (!profile) {
          mode = "create";
          secretLabel.textContent = "Create a secret word";
          secretInput.placeholder = "something only you'd know";
          hint.innerHTML = "This is new — pick a short secret word. You'll type this same username + secret word to get back in on any device.";
        } else if (!profile.secret_word) {
          // legacy account from before secret words existed — let them set one now
          mode = "claim";
          existingProfile = profile;
          secretLabel.textContent = "Set a secret word for this account";
          secretInput.placeholder = "something only you'd know";
          hint.innerHTML = "This username doesn't have a secret word yet — set one now so you can sign back in later.";
        } else {
          mode = "signin";
          existingProfile = profile;
          secretLabel.textContent = "Secret word";
          secretInput.placeholder = "";
          hint.innerHTML = "Welcome back — enter your secret word.";
        }
        usernameInput.disabled = true;
        secretGroup.style.display = "block";
        step = 2;
        submitBtn.textContent = mode === "signin" ? "Sign In" : "Create Account";
        secretInput.focus();
      } catch (err) {
        console.error(err);
        showError("Something went wrong connecting to the server. Try again.");
      } finally {
        submitBtn.disabled = false;
      }
      return;
    }

    // step 2
    const secret = secretInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    if (!secret) {
      showError("Enter a secret word to continue.");
      return;
    }
    showError(null);
    submitBtn.disabled = true;
    submitBtn.textContent = "Working…";

    try {
      if (mode === "create") {
        const profile = await createProfile(username, secret);
        setSession(profile);
        window.location.href = "board.html";
      } else if (mode === "claim") {
        const profile = await setSecretWord(existingProfile.id, secret);
        setSession(profile);
        window.location.href = "board.html";
      } else {
        if (secret !== existingProfile.secret_word) {
          showError("That secret word doesn't match — try again.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Sign In";
          return;
        }
        setSession(existingProfile);
        window.location.href = "board.html";
      }
    } catch (err) {
      console.error(err);
      showError("Something went wrong connecting to the server. Try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "signin" ? "Sign In" : "Create Account";
    }
  });
})();
