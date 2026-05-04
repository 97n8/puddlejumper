// main.js — landing page auth and route handling for PuddleJumper
(function () {
  "use strict";

  var TOKEN_KEY = "pj_token";
  var lastFocusedElement = null;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function getStoredToken() {
    return getCookie(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  function getAuthGate() {
    return document.getElementById("auth-gate");
  }

  function getStatusPill() {
    return document.getElementById("authState");
  }

  function setAuthState(state, text) {
    var pill = getStatusPill();
    if (!pill) return;
    pill.dataset.state = state;
    pill.textContent = text;
  }

  function isGateOpen() {
    var gate = getAuthGate();
    return Boolean(gate && !gate.hasAttribute("hidden"));
  }

  function showAuthGate() {
    var gate = getAuthGate();
    if (!gate) return;

    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    gate.removeAttribute("hidden");
    gate.setAttribute("aria-hidden", "false");
    document.body.classList.add("auth-open");

    var focusables = gate.querySelectorAll("a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])");
    if (focusables.length) {
      focusables[0].focus();
    }
  }

  function hideAuthGate() {
    var gate = getAuthGate();
    if (!gate) return;

    gate.setAttribute("hidden", "");
    gate.setAttribute("aria-hidden", "true");
    document.body.classList.remove("auth-open");

    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  function trapFocus(event) {
    if (!isGateOpen() || event.key !== "Tab") return;

    var gate = getAuthGate();
    var focusables = Array.from(gate.querySelectorAll("a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])"));
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function checkAuth() {
    var token = getStoredToken();
    if (!token) {
      setAuthState("public", "Public mode");
      return false;
    }

    try {
      var response = await fetch("/api/me", {
        headers: { Authorization: "Bearer " + token },
        credentials: "include"
      });

      if (response.ok) {
        setAuthState("ready", "Backend session ready");
        return true;
      }

      localStorage.removeItem(TOKEN_KEY);
      setAuthState("public", "Public mode");
      return false;
    } catch (_error) {
      setAuthState("public", "Public mode");
      return false;
    }
  }

  async function handleAdminOpen() {
    var isAuthed = await checkAuth();
    if (isAuthed) {
      window.location.href = "/pj/admin";
      return;
    }
    showAuthGate();
  }

  function handleJwtSubmit() {
    var jwtInput = document.getElementById("jwtInput");
    if (!jwtInput) return;

    var token = jwtInput.value.trim();
    if (!token) return;

    localStorage.setItem(TOKEN_KEY, token);
    setAuthState("ready", "Checking backend session…");
    hideAuthGate();
    checkAuth();
  }

  function handleJwtClear() {
    var jwtInput = document.getElementById("jwtInput");
    if (jwtInput) {
      jwtInput.value = "";
    }
    localStorage.removeItem(TOKEN_KEY);
    setAuthState("public", "Public mode");
  }

  window.addEventListener("DOMContentLoaded", function () {
    var signInBtn = document.getElementById("signInBtn");
    var routeSignInBtn = document.getElementById("routeSignInBtn");
    var routePrimarySignInBtn = document.getElementById("routePrimarySignInBtn");
    var adminPanelBtn = document.getElementById("adminPanelBtn");
    var authSubmit = document.getElementById("authSubmit");
    var authClear = document.getElementById("authClear");
    var authClose = document.getElementById("authClose");
    var gate = getAuthGate();

    if (signInBtn) {
      signInBtn.addEventListener("click", showAuthGate);
    }

    if (routeSignInBtn) {
      routeSignInBtn.addEventListener("click", showAuthGate);
    }

    if (routePrimarySignInBtn) {
      routePrimarySignInBtn.addEventListener("click", showAuthGate);
    }

    if (adminPanelBtn) {
      adminPanelBtn.addEventListener("click", handleAdminOpen);
    }

    if (authSubmit) {
      authSubmit.addEventListener("click", handleJwtSubmit);
    }

    if (authClear) {
      authClear.addEventListener("click", handleJwtClear);
    }

    if (authClose) {
      authClose.addEventListener("click", hideAuthGate);
    }

    if (gate) {
      gate.addEventListener("click", function (event) {
        var target = event.target;
        if (target instanceof HTMLElement && target.dataset.authClose === "true") {
          hideAuthGate();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isGateOpen()) {
        hideAuthGate();
        return;
      }
      trapFocus(event);
    });

    checkAuth();
  });
})();
