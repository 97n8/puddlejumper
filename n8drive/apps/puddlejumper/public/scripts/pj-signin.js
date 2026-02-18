/* ── Portal Sign-In logic ─────────────────────────────────────
   Wires form → POST /api/login, SSO → OAuth providers,
   checks existing auth and redirects if already signed in.
   ──────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var form = document.getElementById("loginForm");
  var emailEl = document.getElementById("email");
  var passwordEl = document.getElementById("password");
  var togglePw = document.getElementById("togglePw");
  var eyeIcon = document.getElementById("eyeIcon");
  var togglePwText = document.getElementById("togglePwText");
  var signinBtn = document.getElementById("signinBtn");
  var errorEl = document.getElementById("formError");
  var successEl = document.getElementById("formSuccess");
  var toastEl = document.getElementById("toast");

  /* ── Helpers ─────────────────────────────────────────────── */
  function setBusy(busy) {
    signinBtn.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function showError(message) {
    document.getElementById("errorText").textContent = message;
    errorEl.dataset.show = "1";
    delete successEl.dataset.show;
  }

  function clearError() {
    delete errorEl.dataset.show;
  }

  function showSuccess(message) {
    document.getElementById("successText").textContent = message;
    successEl.dataset.show = "1";
    delete errorEl.dataset.show;
  }

  var toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.dataset.show = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      delete toastEl.dataset.show;
    }, 2400);
  }

  /* ── Auth check on load — redirect if already signed in ── */
  fetch("/api/me", { credentials: "include" })
    .then(function (res) {
      if (res.ok) {
        window.location.href = "/pj/admin";
      }
    })
    .catch(function () { /* not signed in, stay on page */ });

  /* ── Password visibility toggle ─────────────────────────── */
  togglePw.addEventListener("click", function () {
    var showing = passwordEl.type === "text";
    passwordEl.type = showing ? "password" : "text";
    togglePw.setAttribute("aria-pressed", showing ? "false" : "true");
    togglePw.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    togglePwText.textContent = showing ? "Show" : "Hide";
    eyeIcon.innerHTML = showing
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  });

  /* ── Form submit → POST /api/login ──────────────────────── */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    var email = emailEl.value.trim();
    var password = passwordEl.value;

    if (!email || !emailEl.checkValidity()) {
      showError("Enter a valid email address.");
      emailEl.focus();
      return;
    }

    if (!password || password.length < 8) {
      showError("Your password must be at least 8 characters.");
      passwordEl.focus();
      return;
    }

    setBusy(true);

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: email, password: password }),
    })
      .then(function (res) {
        if (res.ok) return res.json();
        return res.json().then(function (body) {
          throw new Error(body.error || "Invalid credentials");
        });
      })
      .then(function (data) {
        setBusy(false);
        showSuccess("Signed in as " + (data.user ? data.user.name : email) + " — redirecting…");
        setTimeout(function () {
          window.location.href = "/pj/admin";
        }, 600);
      })
      .catch(function (err) {
        setBusy(false);
        showError(err.message || "We couldn't sign you in. Check your email and password and try again.");
      });
  });
})();
