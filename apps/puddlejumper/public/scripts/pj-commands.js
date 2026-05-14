/**
 * pj-commands.js — CSP-compliant mock Quick Commands for the PJ landing page.
 * Uses an IIFE + scoped event delegation on .command-panel.
 */
(function () {
  "use strict";

  var panel = document.querySelector(".command-panel");
  if (!panel) return;

  panel.addEventListener("click", function (e) {
    var btn = e.target.closest(".command-btn");
    if (!btn) return;

    var card = btn.closest(".command-card");
    if (!card) return;

    var result = card.querySelector(".command-result");
    var loading = card.querySelector(".command-loading");
    if (!result || !loading) return;

    // Show loading state
    btn.disabled = true;
    loading.style.display = "block";
    result.style.display = "none";

    // Simulate async command execution
    setTimeout(function () {
      loading.style.display = "none";
      result.style.display = "block";
      result.textContent = "Summary: 4 policies active, 2 pending review, 0 violations.";
      btn.disabled = false;
    }, 800);
  });
})();
