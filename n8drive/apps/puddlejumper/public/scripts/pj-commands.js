/**
 * pj-commands.js — Mock "Quick Commands" panel for the PJ landing page.
 * CSP-compliant: loaded via external <script src>, no inline JS.
 *
 * Uses an IIFE + event delegation so the script works even if the DOM
 * is not fully parsed when the file loads (deferred by default).
 */
(function () {
  'use strict';

  /** Mock command definitions */
  var COMMANDS = [
    {
      id: 'summarize-dashboard',
      label: 'Summarize Dashboard',
      icon: '📊',
      description: 'Generate a summary of current governance metrics.',
    },
  ];

  /**
   * Build the command-panel DOM and append it to the container element.
   * @param {HTMLElement} container
   */
  function renderCommandPanel(container) {
    var panel = document.createElement('div');
    panel.className = 'command-panel';
    panel.setAttribute('data-test', 'command-panel');

    var heading = document.createElement('h3');
    heading.textContent = 'Quick Commands';
    panel.appendChild(heading);

    COMMANDS.forEach(function (cmd) {
      var card = document.createElement('button');
      card.className = 'command-card';
      card.setAttribute('data-command', cmd.id);
      card.setAttribute('data-test', 'command-card');
      card.type = 'button';

      var icon = document.createElement('span');
      icon.className = 'command-icon';
      icon.textContent = cmd.icon;

      var label = document.createElement('span');
      label.className = 'command-label';
      label.textContent = cmd.label;

      var desc = document.createElement('span');
      desc.className = 'command-desc';
      desc.textContent = cmd.description;

      card.appendChild(icon);
      card.appendChild(label);
      card.appendChild(desc);
      panel.appendChild(card);
    });

    container.appendChild(panel);
  }

  /** Handle command card clicks via event delegation */
  function handleClick(event) {
    var card = event.target.closest('.command-card');
    if (!card) return;

    var commandId = card.getAttribute('data-command');
    if (!commandId) return;

    // Show loading state
    card.classList.add('command-loading');
    card.disabled = true;

    // Simulate async work, then reset
    setTimeout(function () {
      card.classList.remove('command-loading');
      card.disabled = false;
    }, 1200);
  }

  /** Initialise once the DOM is ready */
  function init() {
    var container = document.querySelector('.container');
    if (!container) return;

    renderCommandPanel(container);
    container.addEventListener('click', handleClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
