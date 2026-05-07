(function () {
  "use strict";

  var flowSections = [
    { label: "Connections", href: "#flow-connections" },
    { label: "Threads", href: "#flow-threads" },
    { label: "Pressure", href: "#flow-pressure-summary" },
    { label: "Dependencies", href: "#flow-thread-detail" },
    { label: "Compliance", href: "#flow-compliance" },
    { label: "Weekly Reset", href: "#flow-weekly-reset" },
    { label: "AI Runtime", href: "#flow-connections" }
  ];

  var sourceSections = ["Notes", "Reminders", "Claude", "Drive", "M365"];
  var governanceSections = ["VAULT Alignment", "PuddleJumper Handoff"];

  var connections = [
    {
      id: "notes",
      name: "Apple Notes",
      role: "Thread registry",
      status: "live",
      note: "Manual write boundary preserved."
    },
    {
      id: "reminders",
      name: "Apple Reminders",
      role: "Action queue",
      status: "live",
      note: "Active reminders stay mapped to thread pressure."
    },
    {
      id: "claude",
      name: "Claude",
      role: "AI runtime",
      status: "live",
      note: "Drafting, continuity, and pressure read support."
    },
    {
      id: "drive",
      name: "Google Drive",
      role: "Working storage",
      status: "live",
      note: "Working artifacts and draft outputs."
    },
    {
      id: "m365",
      name: "Microsoft 365",
      role: "Governed storage",
      status: "partial",
      note: "Governed storage is active with partial sync."
    },
    {
      id: "puddlejumper",
      name: "PuddleJumper",
      role: "Governance handoff",
      status: "offline",
      note: "Phase 2 handoff for governed routing."
    },
    {
      id: "vault",
      name: "VAULT",
      role: "Governance framework",
      status: "mapped",
      note: "Mapped to continuity, proof, and authority."
    },
    {
      id: "logicos",
      name: "LogicOS",
      role: "Host environment",
      status: "native",
      note: "Flow lives here as an operating track."
    }
  ];

  var flowPath = [
    { name: "Notes", detail: "threads" },
    { name: "Reminders", detail: "actions" },
    { name: "Flow", detail: "pressure protocol" },
    { name: "Claude", detail: "AI runtime" },
    { name: "Drive / M365", detail: "storage" }
  ];

  var weeklyReset = [
    "Process Inbox",
    "Update Dependencies",
    "Update Pressure States",
    "Update Compliance Watch",
    "Review Reminders",
    "Review Archived-Active",
    "Update Allie Shared Projects",
    "Run Pressure Read Prompt"
  ];

  var vaultAlignment = [
    { left: "Thread", right: "Record container" },
    { left: "Pressure state", right: "Integrity state" },
    { left: "Dependencies", right: "Accountability chain" },
    { left: "Compliance Watch", right: "Continuity module" },
    { left: "Weekly reset", right: "Audit cycle" },
    { left: "Mismatch detection", right: "SEAL integrity check" }
  ];

  var threads = [
    {
      id: "sutton",
      name: "Sutton",
      folder: "Active Clients",
      status: "Diagnostic underway",
      pressure: "blocked",
      next: "Follow up Austin",
      dependencySummary: "2 blocking · 1 resolved",
      dependencies: [
        { state: "wait", owner: "Austin", item: "Board schedule access" },
        { state: "wait", owner: "Clerk", item: "PRR log access" },
        { state: "resolved", owner: "IT", item: "IT inventory" }
      ],
      compliance: [
        { name: "Diagnostic delivery", date: "May 15", tag: "GOV" },
        { name: "Invoice Phase 1", date: "Apr 30", tag: "PL" }
      ],
      stateCheck: "2 unresolved dependencies → BLOCKED is correct."
    },
    {
      id: "phillipston",
      name: "Phillipston",
      folder: "Active Clients",
      status: "Launch assembly in progress",
      pressure: "building",
      next: "Assemble DNS launch thread",
      dependencySummary: "1 blocking",
      dependencies: [
        { state: "wait", owner: "Vendor", item: "DNS launch approval" }
      ],
      compliance: [
        { name: "Phillipston DNS launch", date: "Apr 15", tag: "GOV" }
      ],
      stateCheck: "One live blocker keeps this thread in BUILDING."
    },
    {
      id: "westminster",
      name: "Westminster",
      folder: "Active Clients",
      status: "Grant support moving cleanly",
      pressure: "flowing",
      next: "Prepare LOI packet",
      dependencySummary: "—",
      dependencies: [],
      compliance: [
        { name: "Westminster MBI LOI", date: "Jun 1", tag: "GOV" }
      ],
      stateCheck: "No unresolved dependencies → FLOWING is correct."
    },
    {
      id: "logicos",
      name: "LogicOS",
      folder: "PublicLogic",
      status: "Environment updates underway",
      pressure: "building",
      next: "Resolve Flow shell follow-ons",
      dependencySummary: "1 blocking",
      dependencies: [
        { state: "wait", owner: "Design", item: "Environment chrome review" }
      ],
      compliance: [],
      stateCheck: "Shared environment work is still collecting dependencies."
    },
    {
      id: "vault",
      name: "VAULT",
      folder: "PublicLogic",
      status: "Governance model mapped",
      pressure: "flowing",
      next: "Keep alignment notes current",
      dependencySummary: "—",
      dependencies: [],
      compliance: [],
      stateCheck: "Alignment is current, so FLOWING is correct."
    },
    {
      id: "pl-ops",
      name: "PL Ops",
      folder: "PublicLogic",
      status: "Reference thread retained",
      pressure: "archivedActive",
      next: "Review on weekly reset",
      dependencySummary: "—",
      dependencies: [],
      compliance: [],
      stateCheck: "The thread is inactive but intentionally retained for continuity."
    }
  ];

  var state = {
    selectedThreadId: "sutton"
  };

  var sectionNav = document.getElementById("flow-shell-nav");
  var sourceNav = document.getElementById("flow-sources-nav");
  var governanceNav = document.getElementById("flow-governance-nav");
  var connectionsGrid = document.getElementById("flowConnectionsGrid");
  var flowPathNode = document.getElementById("flowPath");
  var threadsList = document.getElementById("flowThreadsList");
  var pressureGrid = document.getElementById("flowPressureGrid");
  var threadDetailName = document.getElementById("threadDetailName");
  var threadDetailPressure = document.getElementById("threadDetailPressure");
  var threadDetailBody = document.getElementById("threadDetailBody");
  var complianceList = document.getElementById("flowComplianceList");
  var weeklyResetList = document.getElementById("flowWeeklyResetList");
  var vaultAlignmentList = document.getElementById("flowVaultAlignmentList");
  var statusBar = document.getElementById("flow-status-bar");
  var threadCount = document.getElementById("flowThreadCount");
  var dependencyCount = document.getElementById("flowDependencyCount");

  var pjDrawer = document.getElementById("pjDrawer");
  var pjDrawerToggle = document.getElementById("pjDrawerToggle");
  var closeDrawerBtn = document.getElementById("closeDrawerBtn");
  var drawerPill = document.getElementById("drawerPill");
  var gapList = document.getElementById("gapList");
  var gapEmpty = document.getElementById("gapEmpty");

  function pressureLabel(stateValue) {
    return {
      flowing: "⬤ Flowing",
      building: "◆ Building",
      blocked: "■ Blocked",
      venting: "▲ Venting",
      archivedActive: "◈ Archived-Active"
    }[stateValue] || stateValue;
  }

  function pressureClass(stateValue) {
    return String(stateValue)
      .replace(/[A-Z]/g, function (letter) { return "-" + letter.toLowerCase(); })
      .replace(/^-/, "");
  }

  function selectedThread() {
    return threads.find(function (thread) {
      return thread.id === state.selectedThreadId;
    }) || threads[0];
  }

  function openDrawer() {
    pjDrawer.hidden = false;
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    pjDrawer.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  function unresolvedDependencies(thread) {
    return thread.dependencies.filter(function (dependency) {
      return dependency.state !== "resolved";
    });
  }

  function allComplianceItems() {
    return threads.flatMap(function (thread) {
      return thread.compliance.map(function (item) {
        return {
          thread: thread.name,
          name: item.name,
          date: item.date,
          tag: item.tag
        };
      });
    });
  }

  function renderNavGroup(node, items, className) {
    node.innerHTML = "";
    items.forEach(function (item) {
      var tag = document.createElement("a");
      tag.className = className;
      tag.href = item.href || "#";
      tag.textContent = item.label || item;
      node.appendChild(tag);
    });
  }

  function renderConnections() {
    connectionsGrid.innerHTML = "";
    connections.forEach(function (connection) {
      var card = document.createElement("article");
      card.className = "connection-card";
      card.innerHTML = [
        "<div class=\"connection-card__top\">",
        "  <div>",
        "    <p class=\"connection-label\">Role</p>",
        "    <strong>" + connection.name + "</strong>",
        "  </div>",
        "  <span class=\"connection-status connection-status--" + connection.status + "\">" + connection.status.charAt(0).toUpperCase() + connection.status.slice(1) + "</span>",
        "</div>",
        "<p class=\"connection-role\">" + connection.role + "</p>",
        "<p class=\"connection-note\">" + connection.note + "</p>"
      ].join("");
      connectionsGrid.appendChild(card);
    });
  }

  function renderFlowPath() {
    flowPathNode.innerHTML = "";
    flowPath.forEach(function (step) {
      var node = document.createElement("article");
      node.className = "path-step";
      node.innerHTML = [
        "<p class=\"meta-label\">Flow Path</p>",
        "<strong>" + step.name + "</strong>",
        "<span>" + step.detail + "</span>"
      ].join("");
      flowPathNode.appendChild(node);
    });
  }

  function renderThreads() {
    threadsList.innerHTML = "";
    threads.forEach(function (thread) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "thread-card" + (thread.id === state.selectedThreadId ? " is-active" : "");
      card.innerHTML = [
        "<div class=\"thread-card__top\">",
        "  <div>",
        "    <p class=\"meta-label\">" + thread.folder + "</p>",
        "    <strong>" + thread.name + "</strong>",
        "  </div>",
        "  <span class=\"pressure-badge pressure-badge--" + pressureClass(thread.pressure) + "\">" + pressureLabel(thread.pressure) + "</span>",
        "</div>",
        "<p>" + thread.status + "</p>",
        "<div class=\"thread-card__meta\"><span>" + thread.dependencySummary + "</span><span>NEXT: " + thread.next + "</span></div>"
      ].join("");
      card.addEventListener("click", function () {
        state.selectedThreadId = thread.id;
        render();
      });
      threadsList.appendChild(card);
    });
  }

  function renderPressureSummary() {
    var counts = {
      flowing: 0,
      building: 0,
      blocked: 0,
      venting: 0,
      archivedActive: 0
    };

    threads.forEach(function (thread) {
      counts[thread.pressure] += 1;
    });

    pressureGrid.innerHTML = "";
    Object.keys(counts).forEach(function (key) {
      var card = document.createElement("article");
      card.className = "pressure-card pressure-card--" + pressureClass(key);
      card.innerHTML = [
        "<p class=\"meta-label\">" + pressureLabel(key) + "</p>",
        "<strong>" + counts[key] + "</strong>"
      ].join("");
      pressureGrid.appendChild(card);
    });
  }

  function renderThreadDetail() {
    var thread = selectedThread();
    var unresolved = unresolvedDependencies(thread);

    threadDetailName.textContent = thread.name;
    threadDetailPressure.className = "pressure-badge pressure-badge--" + pressureClass(thread.pressure);
    threadDetailPressure.textContent = pressureLabel(thread.pressure);

    var dependenciesMarkup = thread.dependencies.length
      ? "<ul class=\"dependency-list\">" + thread.dependencies.map(function (dependency) {
          var stateLabel = dependency.state === "resolved" ? "[RESOLVED]" : "[WAIT: " + dependency.owner + "]";
          return "<li>" + stateLabel + " " + dependency.item + "</li>";
        }).join("") + "</ul>"
      : "<p>No open dependencies are tracked on this thread.</p>";

    var complianceMarkup = thread.compliance.length
      ? "<div class=\"watch-list\">" + thread.compliance.map(function (item) {
          return [
            "<article class=\"watch-row\">",
            "  <div class=\"watch-meta\">",
            "    <strong>" + item.name + "</strong>",
            "    <p>" + item.date + "</p>",
            "  </div>",
            "  <span class=\"tag-badge tag-badge--" + item.tag.toLowerCase() + "\">[" + item.tag + "]</span>",
            "</article>"
          ].join("");
        }).join("") + "</div>"
      : "<p>No compliance anchors are attached to this thread.</p>";

    threadDetailBody.innerHTML = [
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">Client</p>",
      "  <p class=\"detail-value\">" + thread.name + "</p>",
      "</div>",
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">Status</p>",
      "  <p class=\"detail-value\">" + thread.status + "</p>",
      "</div>",
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">Next</p>",
      "  <p class=\"detail-value\">" + thread.next + (unresolved[0] ? " → [WAIT: " + unresolved[0].owner + "]" : "") + "</p>",
      "</div>",
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">Dependencies</p>",
      dependenciesMarkup,
      "</div>",
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">Compliance Watch</p>",
      complianceMarkup,
      "</div>",
      "<div class=\"detail-block\">",
      "  <p class=\"detail-key\">State Check</p>",
      "  <p>" + thread.stateCheck + "</p>",
      "</div>"
    ].join("");
  }

  function renderCompliance() {
    complianceList.innerHTML = "";
    allComplianceItems().forEach(function (item) {
      var row = document.createElement("article");
      row.className = "watch-row";
      row.innerHTML = [
        "<div class=\"watch-meta\">",
        "  <strong>" + item.name + "</strong>",
        "  <p>" + item.thread + "</p>",
        "</div>",
        "<div class=\"watch-meta\">",
        "  <span class=\"watch-date\">" + item.date + "</span>",
        "  <span class=\"tag-badge tag-badge--" + item.tag.toLowerCase() + "\">[" + item.tag + "]</span>",
        "</div>"
      ].join("");
      complianceList.appendChild(row);
    });
  }

  function renderWeeklyReset() {
    weeklyResetList.innerHTML = "";
    weeklyReset.forEach(function (step) {
      var item = document.createElement("li");
      item.textContent = step;
      weeklyResetList.appendChild(item);
    });
  }

  function renderVaultAlignment() {
    vaultAlignmentList.innerHTML = "";
    vaultAlignment.forEach(function (item) {
      var row = document.createElement("article");
      row.className = "alignment-row";
      row.innerHTML = [
        "<div class=\"alignment-meta\">",
        "  <p class=\"detail-key\">" + item.left + "</p>",
        "  <strong>" + item.right + "</strong>",
        "</div>"
      ].join("");
      vaultAlignmentList.appendChild(row);
    });
  }

  function renderStatusBar() {
    var thread = selectedThread();
    statusBar.innerHTML = [
      "<div class=\"status-bar__copy\">",
      "  <span class=\"status-text\">Flow keeps active work visible before pressure becomes failure.</span>",
      "</div>",
      "<div class=\"status-bar__meta\">",
      "  <span class=\"status-chip\">Selected: " + thread.name + "</span>",
      "  <span class=\"status-chip\">Pressure: " + pressureLabel(thread.pressure) + "</span>",
      "  <span class=\"status-chip\">Sources: 5 configured · 1 offline</span>",
      "</div>"
    ].join("");
  }

  function renderDrawer() {
    var thread = selectedThread();
    var blockers = unresolvedDependencies(thread).map(function (dependency) {
      return "[WAIT: " + dependency.owner + "] " + dependency.item;
    });

    gapList.innerHTML = "";
    gapEmpty.hidden = blockers.length !== 0;
    blockers.forEach(function (gap) {
      var item = document.createElement("li");
      item.textContent = gap;
      gapList.appendChild(item);
    });
  }

  function renderCounts() {
    threadCount.textContent = String(threads.length);
    dependencyCount.textContent = String(
      threads.reduce(function (total, thread) {
        return total + unresolvedDependencies(thread).length;
      }, 0)
    );
  }

  function render() {
    renderNavGroup(sectionNav, flowSections, "sidebar-link");
    renderNavGroup(sourceNav, sourceSections, "sidebar-chip");
    renderNavGroup(governanceNav, governanceSections, "sidebar-chip");
    renderConnections();
    renderFlowPath();
    renderThreads();
    renderPressureSummary();
    renderThreadDetail();
    renderCompliance();
    renderWeeklyReset();
    renderVaultAlignment();
    renderStatusBar();
    renderDrawer();
    renderCounts();
  }

  pjDrawerToggle.addEventListener("click", openDrawer);
  closeDrawerBtn.addEventListener("click", closeDrawer);
  pjDrawer.addEventListener("click", function (event) {
    if (event.target && event.target.dataset.closeDrawer === "true") {
      closeDrawer();
    }
  });

  render();
})();
