// main.js — CSP-compliant login/auth logic for PuddleJumper
(function () {
  // Unified token key
  const TOKEN_KEY = 'pj_token';
  let isAuthenticated = false;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getStoredToken() {
    return getCookie(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  async function checkAuth() {
    const token = getStoredToken();
    if (!token) {
      isAuthenticated = false;
      showAuthGate();
      return;
    }
    try {
      const res = await fetch("/api/me", {
        headers: { "Authorization": "Bearer " + token },
        credentials: 'include'
      });
      if (res.ok) {
        isAuthenticated = true;
        hideAuthGate();
      } else {
        isAuthenticated = false;
        localStorage.removeItem(TOKEN_KEY);
        showAuthGate();
      }
    } catch (e) {
      isAuthenticated = false;
      console.error('Auth check failed', e);
      showAuthGate();
    }
  }

  function showAuthGate() {
    const gate = document.getElementById("auth-gate");
    const main = document.getElementById("main-content");
    if (!gate || !main) return;
    gate.style.display = "block";
    gate.setAttribute("aria-hidden", "false");
    main.style.display = "none";
    // Focus management
    const firstFocusable = gate.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    firstFocusable && firstFocusable.focus();
    gate.addEventListener('keydown', trapFocus);
  }

  function hideAuthGate() {
    const gate = document.getElementById("auth-gate");
    const main = document.getElementById("main-content");
    if (!gate || !main) return;
    gate.style.display = "none";
    gate.setAttribute("aria-hidden", "true");
    main.style.display = "block";
    main.focus();
    gate.removeEventListener('keydown', trapFocus);
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const gate = document.getElementById('auth-gate');
    const focusables = Array.from(gate.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const gate = document.getElementById('auth-gate');
      if (gate && gate.style.display !== 'none') hideAuthGate();
    }
  });

  window.addEventListener('DOMContentLoaded', function () {
    // JWT paste auth (demo/ephemeral)
    var authSubmit = document.getElementById('authSubmit');
    var authClear = document.getElementById('authClear');
    var signInBtn = document.getElementById('signInBtn');
    var adminPanelBtn = document.getElementById('adminPanelBtn');

    if (authSubmit) {
      authSubmit.addEventListener('click', function () {
        var jwt = document.getElementById('jwtInput').value.trim();
        if (!jwt) return;
        localStorage.setItem(TOKEN_KEY, jwt);
        hideAuthGate();
        checkAuth();
      });
    }
    if (authClear) {
      authClear.addEventListener('click', function () {
        document.getElementById('jwtInput').value = '';
        localStorage.removeItem(TOKEN_KEY);
      });
    }
    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        showAuthGate();
      });
    }
    if (adminPanelBtn) {
      adminPanelBtn.addEventListener('click', async function () {
        const token = getStoredToken();
        if (!token) {
          showAuthGate();
          return;
        }
        try {
          const res = await fetch("/api/me", {
            headers: { "Authorization": "Bearer " + token },
            credentials: 'include'
          });
          if (res.ok) {
            window.location.href = "/pj/admin";
          } else {
            showAuthGate();
          }
        } catch (e) {
          showAuthGate();
        }
      });
    }
    checkAuth();
  });
})();
