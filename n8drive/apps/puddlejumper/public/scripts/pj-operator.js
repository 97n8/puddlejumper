(function () {
  "use strict";

  var filterOrder = ["LogicOS", "PuddleJumper", "LogicCommons", "Vault", "Municipal"];
  var selectedFilters = new Set();

  var items = [
    {
      id: "queue-governance-window",
      name: "Approve governed dispatch window",
      product: "PuddleJumper",
      track: "Governance",
      lifecycle: "Review",
      status: "Pending",
      owner: "Operations",
      lane: "queue",
      governanceReady: false,
      gaps: ["Approval routing is still open for this dispatch window."],
      summary: "A governed action is waiting for review before dispatch can proceed.",
      why: "This is the control-plane checkpoint that keeps action and authority separate.",
      next: "Resolve the approval routing gap before release tries to move."
    },
    {
      id: "queue-municipal-intake",
      name: "Municipal records intake triage",
      product: "Municipal",
      track: "Municipal",
      lifecycle: "Intake",
      status: "Active",
      owner: "Clerk queue",
      lane: "queue",
      governanceReady: false,
      gaps: ["Municipal intake has not been normalized into a release-ready package."],
      summary: "A public-records request is waiting for initial intake and routing.",
      why: "Municipal remains a first-class track but should sit naturally inside the ecosystem shell.",
      next: "Normalize the request, assign the owner, and move it into Review."
    },
    {
      id: "queue-vault-evidence",
      name: "Workspace access policy evidence",
      product: "Vault",
      track: "Platform",
      lifecycle: "Lock",
      status: "Locked",
      owner: "Compliance",
      lane: "queue",
      governanceReady: true,
      gaps: [],
      summary: "Evidence is ready to be preserved for a completed operator decision.",
      why: "Vault should appear where trust, policy, and audit context matter without taking over the shell.",
      next: "Preserve the evidence trail and keep the audit posture visible."
    },
    {
      id: "queue-commons-pattern",
      name: "Repository pattern handoff",
      product: "LogicCommons",
      track: "Commons",
      lifecycle: "Review",
      status: "Pending",
      owner: "Template desk",
      lane: "queue",
      governanceReady: false,
      gaps: ["Shared pattern review is not complete."],
      summary: "A reusable governance primitive needs review before it becomes shared context.",
      why: "LogicCommons gives the ecosystem reusable operational structure instead of isolated one-off flows.",
      next: "Confirm the shared pattern and move it toward Action."
    },
    {
      id: "work-logicos-workspace",
      name: "Operator workspace readiness",
      product: "LogicOS",
      track: "Platform",
      lifecycle: "Action",
      status: "Active",
      owner: "Operator workspace",
      lane: "work",
      governanceReady: false,
      gaps: ["Workspace handoff to release is not yet locked."],
      summary: "LogicOS needs a synchronized handoff from the shell for active operator work.",
      why: "LogicOS is the front-stage workspace and should feel connected to control-plane decisions.",
      next: "Keep the workspace synced while PJ resolves the release blockers."
    },
    {
      id: "work-release-candidate",
      name: "Author to Wild release candidate",
      product: "PuddleJumper",
      track: "Governance",
      lifecycle: "Lock",
      status: "Ready",
      owner: "Release desk",
      lane: "work",
      governanceReady: true,
      gaps: [],
      summary: "A sample release candidate with no open governance gaps once People validation is complete.",
      why: "This item demonstrates the front-end release path without requiring backend APIs.",
      next: "Complete the People phase, then release and seal from the shell."
    }
  ];

  var state = {
    selectedId: "work-release-candidate",
    releaseArtifacts: null,
    people: {
      owner: "",
      audience: "",
      peopleChecked: false,
      authorityChecked: false,
      fallbackChecked: false
    }
  };

  var filterChips = document.getElementById("filterChips");
  var queueTableBody = document.getElementById("queueTableBody");
  var queueEmpty = document.getElementById("queueEmpty");
  var workList = document.getElementById("workList");
  var workEmpty = document.getElementById("workEmpty");
  var clearFilters = document.getElementById("clearFilters");

  var queueCount = document.getElementById("queueCount");
  var workCount = document.getElementById("workCount");
  var releasePosture = document.getElementById("releasePosture");
  var sealDigest = document.getElementById("sealDigest");

  var detailEmpty = document.getElementById("detailEmpty");
  var detailContent = document.getElementById("detailContent");
  var detailName = document.getElementById("detailName");
  var detailStatus = document.getElementById("detailStatus");
  var detailProduct = document.getElementById("detailProduct");
  var detailTrack = document.getElementById("detailTrack");
  var detailLifecycle = document.getElementById("detailLifecycle");
  var detailOwner = document.getElementById("detailOwner");
  var detailSummary = document.getElementById("detailSummary");
  var detailWhy = document.getElementById("detailWhy");
  var detailNext = document.getElementById("detailNext");
  var detailGapList = document.getElementById("detailGapList");
  var detailGapEmpty = document.getElementById("detailGapEmpty");

  var normalizeSelected = document.getElementById("normalizeSelected");
  var peopleReadyValue = document.getElementById("peopleReadyValue");
  var governanceReadyValue = document.getElementById("governanceReadyValue");
  var pjClearValue = document.getElementById("pjClearValue");
  var logicGapList = document.getElementById("logicGapList");
  var releaseButton = document.getElementById("releaseButton");
  var releaseMessage = document.getElementById("releaseMessage");
  var wildEmpty = document.getElementById("wildEmpty");
  var wildDownloads = document.getElementById("wildDownloads");

  var ownerInput = document.getElementById("ownerInput");
  var audienceInput = document.getElementById("audienceInput");
  var normalizedIntent = document.getElementById("normalizedIntent");
  var validationPeople = document.getElementById("validationPeople");
  var validationAuthority = document.getElementById("validationAuthority");
  var validationFallback = document.getElementById("validationFallback");

  var pjDrawer = document.getElementById("pjDrawer");
  var pjDrawerToggle = document.getElementById("pjDrawerToggle");
  var closeDrawerBtn = document.getElementById("closeDrawerBtn");
  var drawerPill = document.getElementById("drawerPill");
  var gapList = document.getElementById("gapList");
  var gapEmpty = document.getElementById("gapEmpty");

  function statusClass(status) {
    return String(status).toLowerCase().replace(/\s+/g, "_");
  }

  function makeChip(label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.textContent = label;
    button.dataset.filter = label;
    button.addEventListener("click", function () {
      if (selectedFilters.has(label)) {
        selectedFilters.delete(label);
      } else {
        selectedFilters.add(label);
      }
      render();
    });
    return button;
  }

  function getFilteredItems() {
    if (!selectedFilters.size) return items.slice();
    return items.filter(function (item) {
      return selectedFilters.has(item.product) || selectedFilters.has(item.track);
    });
  }

  function getSelectedItem() {
    var visible = getFilteredItems();
    var found = visible.find(function (item) {
      return item.id === state.selectedId;
    });
    return found || visible[0] || null;
  }

  function computePeopleGaps() {
    var gaps = [];

    if (!state.people.owner.trim()) gaps.push("Add the accountable owner in People.");
    if (!state.people.audience.trim()) gaps.push("Describe the affected people before release.");
    if (!state.people.peopleChecked) gaps.push("Confirm the people boundary.");
    if (!state.people.authorityChecked) gaps.push("Confirm the authority path.");
    if (!state.people.fallbackChecked) gaps.push("Document the fallback path.");

    return gaps;
  }

  function computeGovernanceGaps(item) {
    if (!item) return ["Select a release candidate before sealing."];
    return item.gaps.slice();
  }

  function computeReleaseGaps(item) {
    return computePeopleGaps().concat(computeGovernanceGaps(item));
  }

  function isPeopleReady() {
    return computePeopleGaps().length === 0;
  }

  function isGovernanceReady(item) {
    return computeGovernanceGaps(item).length === 0;
  }

  function isPJClear(item) {
    return computeReleaseGaps(item).length === 0;
  }

  function openDrawer() {
    pjDrawer.hidden = false;
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    pjDrawer.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  function setSelected(item) {
    if (!item) return;
    state.selectedId = item.id;
    render();
  }

  function buildManifest(item) {
    return {
      shell: "PublicLogic Operator Shell",
      selectedItem: {
        id: item.id,
        name: item.name,
        product: item.product,
        track: item.track,
        lifecycle: item.lifecycle,
        status: item.status
      },
      people: {
        owner: state.people.owner.trim(),
        audience: state.people.audience.trim(),
        peopleChecked: state.people.peopleChecked,
        authorityChecked: state.people.authorityChecked,
        fallbackChecked: state.people.fallbackChecked
      },
      normalizedIntent: normalizedIntent.value.trim(),
      createdAt: new Date().toISOString(),
      source: "front-end-static"
    };
  }

  function createBundle(manifest) {
    return {
      manifest: manifest,
      release: {
        posture: "front-end-generated",
        lifecycle: manifest.selectedItem.lifecycle,
        track: manifest.selectedItem.track
      }
    };
  }

  function writeChainAnchor(bundle, digestHex) {
    return {
      anchorId: "front-end-anchor-" + digestHex.slice(0, 12),
      state: "placeholder",
      summary: "Chain anchor is not persisted yet.",
      selectedItem: bundle.manifest.selectedItem.id
    };
  }

  function issueReaderToken(bundle, digestHex) {
    var token = "reader-" + digestHex.slice(0, 16);
    var tokenUrl = new URL("operator.html", window.location.href);
    tokenUrl.hash = "reader-token=" + token;
    tokenUrl.searchParams.set("item", bundle.manifest.selectedItem.id);

    return {
      token: token,
      url: tokenUrl.toString()
    };
  }

  function hexFromBuffer(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunks = [];
    bytes.forEach(function (byte) {
      chunks.push(byte.toString(16).padStart(2, "0"));
    });
    return chunks.join("");
  }

  function createBlobUrl(content, type) {
    return URL.createObjectURL(new Blob([content], { type: type }));
  }

  async function sealAndRelease() {
    var item = getSelectedItem();
    if (!item || !isPJClear(item)) return;

    var manifest = buildManifest(item);
    var bundle = createBundle(manifest);
    var payload = JSON.stringify(bundle, null, 2);
    var digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    var digestHex = hexFromBuffer(digestBuffer);
    var anchor = writeChainAnchor(bundle, digestHex);
    var reader = issueReaderToken(bundle, digestHex);

    manifest.seal = {
      algorithm: "SHA-256",
      digest: digestHex
    };
    manifest.chainAnchor = anchor;
    manifest.readerToken = reader.token;

    var verifyHtml = [
      "<!DOCTYPE html>",
      "<html lang=\"en\">",
      "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>PublicLogic Verify</title></head>",
      "<body style=\"font-family: system-ui, sans-serif; padding: 24px; background: #09090b; color: #fafafa;\">",
      "<h1>PublicLogic Verify</h1>",
      "<p>This static verify page was generated in the browser.</p>",
      "<pre style=\"white-space: pre-wrap; word-break: break-word;\">" + JSON.stringify({
        selectedItem: manifest.selectedItem,
        digest: digestHex,
        token: reader.token,
        anchor: anchor
      }, null, 2).replace(/[<>&]/g, function (char) {
        return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char];
      }) + "</pre>",
      "</body>",
      "</html>"
    ].join("");

    state.releaseArtifacts = [
      {
        name: "bundle.json",
        description: "Static release bundle for the current selection.",
        url: createBlobUrl(JSON.stringify(bundle, null, 2), "application/json")
      },
      {
        name: "manifest.json",
        description: "Front-end generated manifest with the SHA-256 seal.",
        url: createBlobUrl(JSON.stringify(manifest, null, 2), "application/json")
      },
      {
        name: "token-url.txt",
        description: "Static reader token URL for front-end testing.",
        url: createBlobUrl(reader.url + "\n", "text/plain")
      },
      {
        name: "verify.html",
        description: "Standalone verify page generated in the browser.",
        url: createBlobUrl(verifyHtml, "text/html")
      }
    ];

    sealDigest.textContent = digestHex.slice(0, 12) + "…";
    render();
  }

  function renderDrawer(item) {
    var releaseGaps = computeReleaseGaps(item);
    var clear = releaseGaps.length === 0;

    drawerPill.className = "pj-pill " + (clear ? "pj-pill--clear" : "pj-pill--blocked");
    drawerPill.textContent = clear ? "PJ clear" : "PJ blocked";

    gapList.innerHTML = "";
    gapEmpty.hidden = !clear;
    releaseGaps.forEach(function (gap) {
      var li = document.createElement("li");
      li.textContent = gap;
      gapList.appendChild(li);
    });
  }

  function renderDetail(item) {
    if (!item) {
      detailContent.hidden = true;
      detailEmpty.hidden = false;
      return;
    }

    detailContent.hidden = false;
    detailEmpty.hidden = true;

    detailName.textContent = item.name;
    detailStatus.className = "status-badge " + statusClass(item.status);
    detailStatus.textContent = item.status;
    detailProduct.textContent = item.product;
    detailTrack.textContent = item.track;
    detailLifecycle.textContent = item.lifecycle;
    detailOwner.textContent = item.owner;
    detailSummary.textContent = item.summary;
    detailWhy.textContent = item.why;
    detailNext.textContent = item.next;

    detailGapList.innerHTML = "";
    var governanceGaps = computeGovernanceGaps(item);
    detailGapEmpty.hidden = governanceGaps.length !== 0;
    governanceGaps.forEach(function (gap) {
      var li = document.createElement("li");
      li.textContent = gap;
      detailGapList.appendChild(li);
    });

    document.querySelectorAll(".lifecycle-step").forEach(function (step) {
      step.classList.toggle("is-active", step.dataset.lifecycle === item.lifecycle);
    });

    normalizeSelected.textContent = item.name + " — " + item.product + " / " + item.track;
  }

  function renderQueue(visibleItems) {
    var queueItems = visibleItems.filter(function (item) {
      return item.lane === "queue";
    });

    queueTableBody.innerHTML = "";
    queueEmpty.hidden = queueItems.length > 0;
    queueCount.textContent = String(queueItems.length);

    queueItems.forEach(function (item) {
      var row = document.createElement("tr");
      row.innerHTML = [
        "<td><button class=\"row-button\" type=\"button\"><strong>" + item.name + "</strong><span>" + item.summary + "</span></button></td>",
        "<td><span class=\"status-chip\" data-state=\"ready\">" + item.product + "</span></td>",
        "<td>" + item.track + "</td>",
        "<td>" + item.lifecycle + "</td>",
        "<td><span class=\"status-badge " + statusClass(item.status) + "\">" + item.status + "</span></td>"
      ].join("");
      row.querySelector(".row-button").addEventListener("click", function () {
        setSelected(item);
      });
      queueTableBody.appendChild(row);
    });
  }

  function renderWork(visibleItems) {
    var workItems = visibleItems.filter(function (item) {
      return item.lane === "work";
    });

    workList.innerHTML = "";
    workEmpty.hidden = workItems.length > 0;
    workCount.textContent = String(workItems.length);

    workItems.forEach(function (item) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "work-card";
      card.innerHTML = [
        "<div class=\"work-card__top\"><div><span class=\"quick-tile__label\">" + item.product + "</span><strong>" + item.name + "</strong></div><span class=\"status-badge " + statusClass(item.status) + "\">" + item.status + "</span></div>",
        "<p>" + item.summary + "</p>",
        "<div class=\"work-card__meta\"><span>" + item.track + "</span><span>" + item.lifecycle + "</span><span>" + item.owner + "</span></div>"
      ].join("");
      card.addEventListener("click", function () {
        setSelected(item);
      });
      workList.appendChild(card);
    });
  }

  function renderLogic(item) {
    var peopleReady = isPeopleReady();
    var governanceReady = isGovernanceReady(item);
    var pjClear = isPJClear(item);
    var blockers = computeReleaseGaps(item);

    peopleReadyValue.textContent = peopleReady ? "Yes" : "No";
    governanceReadyValue.textContent = governanceReady ? "Yes" : "No";
    pjClearValue.textContent = pjClear ? "Yes" : "No";
    releasePosture.textContent = pjClear ? "Clear" : "Blocked";

    logicGapList.innerHTML = "";
    blockers.forEach(function (gap) {
      var li = document.createElement("li");
      li.textContent = gap;
      logicGapList.appendChild(li);
    });

    releaseButton.disabled = !pjClear;
    releaseButton.textContent = pjClear ? "Release + Seal" : "Release blocked by PJ";
    releaseMessage.textContent = pjClear
      ? "PJ is clear. Release and seal can proceed entirely in the browser."
      : "Complete People and remove governance gaps before release.";

    pjDrawerToggle.className = "pj-pill " + (pjClear ? "pj-pill--clear" : "pj-pill--blocked");
    pjDrawerToggle.textContent = pjClear ? "PJ clear" : "PJ blocked";
  }

  function renderDownloads() {
    wildDownloads.innerHTML = "";
    var artifacts = state.releaseArtifacts;
    var hasArtifacts = Array.isArray(artifacts) && artifacts.length > 0;
    wildDownloads.hidden = !hasArtifacts;
    wildEmpty.hidden = hasArtifacts;

    if (!hasArtifacts) return;

    artifacts.forEach(function (artifact) {
      var link = document.createElement("a");
      link.href = artifact.url;
      link.download = artifact.name;
      link.innerHTML = "<strong>" + artifact.name + "</strong><br><span class=\"meta-copy\">" + artifact.description + "</span>";
      wildDownloads.appendChild(link);
    });
  }

  function render() {
    filterChips.querySelectorAll(".filter-chip").forEach(function (chip) {
      chip.classList.toggle("is-active", selectedFilters.has(chip.dataset.filter));
    });

    var visibleItems = getFilteredItems();
    var selected = getSelectedItem();
    if (selected) state.selectedId = selected.id;

    renderQueue(visibleItems);
    renderWork(visibleItems);
    renderDetail(selected);
    renderLogic(selected);
    renderDrawer(selected);
    renderDownloads();
  }

  clearFilters.addEventListener("click", function () {
    selectedFilters.clear();
    render();
  });

  pjDrawerToggle.addEventListener("click", openDrawer);
  closeDrawerBtn.addEventListener("click", closeDrawer);
  pjDrawer.addEventListener("click", function (event) {
    if (event.target && event.target.dataset.closeDrawer === "true") {
      closeDrawer();
    }
  });

  ownerInput.addEventListener("input", function () {
    state.people.owner = ownerInput.value;
    render();
  });
  audienceInput.addEventListener("input", function () {
    state.people.audience = audienceInput.value;
    render();
  });
  validationPeople.addEventListener("change", function () {
    state.people.peopleChecked = validationPeople.checked;
    render();
  });
  validationAuthority.addEventListener("change", function () {
    state.people.authorityChecked = validationAuthority.checked;
    render();
  });
  validationFallback.addEventListener("change", function () {
    state.people.fallbackChecked = validationFallback.checked;
    render();
  });

  releaseButton.addEventListener("click", function () {
    sealAndRelease().catch(function (error) {
      releaseMessage.textContent = "Seal failed in the browser: " + error.message;
    });
  });

  filterOrder.forEach(function (label) {
    filterChips.appendChild(makeChip(label));
  });

  normalizedIntent.value = "Normalize the selected operator item into a governed package before release.";
  ownerInput.value = state.people.owner;
  audienceInput.value = state.people.audience;
  render();
})();
