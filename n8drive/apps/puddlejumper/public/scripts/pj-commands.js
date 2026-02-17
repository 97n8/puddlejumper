/**
 * PJ Commands — mock command handlers for the PuddleJumper command panel.
 *
 * Uses IIFE + event delegation so no global namespace pollution occurs.
 * Each command card triggers a loading state, then resolves with a result.
 */
(function () {
  "use strict";

  /** Simulate an async operation with a short delay. */
  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Handle the "Summarize Dashboard" command.
   * Shows a loading indicator, then replaces it with a summary card.
   */
  async function summarizeDashboard(card) {
    var output = card.querySelector(".command-output");
    if (!output) {
      output = document.createElement("div");
      output.className = "command-output";
      card.appendChild(output);
    }

    output.setAttribute("aria-live", "polite");
    output.innerHTML =
      '<div class="command-loading"><span class="spinner" aria-hidden="true"></span> Generating summary\u2026</div>';

    await delay(1200);

    output.innerHTML = [
      '<div class="command-result">',
      "  <strong>Dashboard Summary</strong>",
      "  <ul>",
      "    <li>Approval chains active: <b>3</b></li>",
      "    <li>Pending reviews: <b>2</b></li>",
      "    <li>System health: <b>OK</b></li>",
      "  </ul>",
      "</div>",
    ].join("\n");
  }

  /** Registry of command handlers keyed by data-cmd attribute value. */
  var commands = {
    "summarize-dashboard": summarizeDashboard,
  };

  /** Delegated click handler on the command panel container. */
  var panel = document.querySelector(".command-panel");
  if (panel) {
    panel.addEventListener("click", function (e) {
      var btn = e.target.closest(".command-btn[data-cmd]");
      if (!btn) return;

      var cmd = btn.getAttribute("data-cmd");
      var handler = commands[cmd];
      if (!handler) return;

      var card = btn.closest(".command-card") || btn;
      handler(card).catch(function (err) {
        console.error("PJ command error:", err);
      });
    });
  }
})();
