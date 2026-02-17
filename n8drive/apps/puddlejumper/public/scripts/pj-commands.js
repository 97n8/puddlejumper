/**
 * pj-commands.js — Mock "Summarize Dashboard" command for PuddleJumper.
 * Loaded as an external script for CSP compliance (no inline scripts).
 */
(function () {
  "use strict";

  var COMMANDS = [
    {
      id: "summarize-dashboard",
      label: "Summarize Dashboard",
      description: "Generate a plain-language summary of current governance metrics.",
      icon: "📊",
    },
  ];

  function renderCommands(container) {
    COMMANDS.forEach(function (cmd) {
      var card = document.createElement("div");
      card.className = "command-card";
      card.setAttribute("data-command", cmd.id);

      card.innerHTML =
        '<span class="command-icon">' +
        cmd.icon +
        "</span>" +
        '<div class="command-info">' +
        '<strong class="command-label">' +
        cmd.label +
        "</strong>" +
        '<p class="command-desc">' +
        cmd.description +
        "</p>" +
        "</div>";

      card.addEventListener("click", function () {
        executeCommand(cmd, card);
      });

      container.appendChild(card);
    });
  }

  function executeCommand(cmd, card) {
    var existing = card.querySelector(".command-loading");
    if (existing) return;

    var loader = document.createElement("span");
    loader.className = "command-loading";
    loader.textContent = "Running…";
    card.appendChild(loader);

    setTimeout(function () {
      loader.textContent =
        "✅ 12 pending approvals · 3 dispatched today · 0 failures";
      loader.className = "command-result";
    }, 800);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var panel = document.getElementById("command-panel");
    if (panel) {
      renderCommands(panel);
    }
  });
})();
