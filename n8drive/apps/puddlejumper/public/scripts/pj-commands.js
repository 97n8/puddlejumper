/* pj-commands.js — Mock command handlers for PJ landing page.
 * Loaded externally (CSP-compliant: no inline scripts).
 * Adds a "Summarize Dashboard" button below the actions section
 * and handles the click with a simulated loading→result flow.
 */
(function () {
  "use strict";

  // Wait for DOM to be ready
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    var actions = document.querySelector(".actions");
    if (!actions) return;

    // Create command panel section
    var panel = document.createElement("div");
    panel.className = "command-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Quick commands");

    panel.innerHTML =
      '<h3 class="command-panel-title">Quick Commands</h3>' +
      '<button type="button" class="btn command-btn" data-cmd="summarize-dashboard">' +
      "📊 Summarize Dashboard" +
      "</button>" +
      '<div id="command-result" class="command-result" aria-live="polite"></div>';

    actions.parentNode.insertBefore(panel, actions.nextSibling);

    // Attach handler via event delegation
    panel.addEventListener("click", function (e) {
      var btn = e.target.closest(".command-btn[data-cmd]");
      if (!btn) return;

      var cmd = btn.getAttribute("data-cmd");
      if (cmd === "summarize-dashboard") {
        handleSummarizeDashboard(btn);
      }
    });
  }

  function handleSummarizeDashboard(btn) {
    var result = document.getElementById("command-result");
    if (!result) return;

    // Disable button during execution
    btn.disabled = true;
    btn.textContent = "⏳ Summarizing…";

    // Show loading state
    result.innerHTML =
      '<div class="command-loading">' +
      '<div class="command-loading-text">Generating dashboard summary…</div>' +
      "</div>";

    // Simulate async operation
    setTimeout(function () {
      result.innerHTML =
        '<div class="command-card">' +
        '<div class="command-card-title">Dashboard Summary</div>' +
        "<ul>" +
        "<li>3 approval chains active, 2 pending review</li>" +
        "<li>All dispatchers operational (GitHub, Webhook, Slack)</li>" +
        "<li>12 governance actions processed in last 24h</li>" +
        "</ul>" +
        "</div>";

      // Re-enable button
      btn.disabled = false;
      btn.textContent = "📊 Summarize Dashboard";
    }, 800);
  }
})();
