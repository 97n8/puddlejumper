const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "db.json");
const RULES_PATH = path.join(ROOT, "config", "routing_rules.json");
const TAXONOMY_PATH = path.join(ROOT, "config", "taxonomy.json");
const MUNICIPALITIES_PATH = path.join(ROOT, "config", "municipalities.json");
const USERS_PATH = path.join(ROOT, "config", "users.json");
const BUSINESS_HOURS_PATH = path.join(ROOT, "config", "business_hours.json");
const PUBLIC_DIR = path.join(ROOT, "public");

const ROLE_PERMS = {
  Chamber_Admin: ["view_all", "edit_all", "view_audit", "route", "assign", "close", "config"],
  Chamber_Staff: ["view_all", "edit_assigned", "route", "assign", "close"],
  Municipal_Liaison: ["view_municipal", "edit_municipal", "respond"],
  Partner_Vendor: ["view_assigned", "edit_assigned"],
  Read_Only_Auditor: ["view_all", "view_audit"],
  Public_Requestor: ["public"]
};

const STATE_MACHINE = {
  NEW: ["TRIAGE"],
  TRIAGE: ["ROUTED"],
  ROUTED: ["IN_PROGRESS", "WAITING_ON_REQUESTOR", "WAITING_ON_EXTERNAL"],
  IN_PROGRESS: ["WAITING_ON_REQUESTOR", "WAITING_ON_EXTERNAL", "RESOLVED_PENDING_CONFIRMATION", "CLOSED"],
  WAITING_ON_REQUESTOR: ["IN_PROGRESS", "CLOSED"],
  WAITING_ON_EXTERNAL: ["IN_PROGRESS", "CLOSED"],
  RESOLVED_PENDING_CONFIRMATION: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["REOPENED"],
  REOPENED: ["TRIAGE", "ROUTED", "IN_PROGRESS"]
};

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getDb() {
  if (!fs.existsSync(DATA_PATH)) {
    return { meta: { sequenceByYear: {} }, cases: [], events: [], comms: [], tasks: [] };
  }
  return readJson(DATA_PATH);
}

function saveDb(db) {
  writeJson(DATA_PATH, db);
}

function getConfig() {
  return {
    rules: readJson(RULES_PATH),
    taxonomy: readJson(TAXONOMY_PATH),
    municipalities: readJson(MUNICIPALITIES_PATH),
    users: readJson(USERS_PATH),
    businessHours: readJson(BUSINESS_HOURS_PATH)
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve(null);
      try {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          resolve(JSON.parse(raw));
        } else {
          resolve(raw);
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function getRole(req) {
  return req.headers["x-role"] || "Public_Requestor";
}

function getUserId(req) {
  return req.headers["x-user-id"] || null;
}

function getUser(req, config) {
  const userId = getUserId(req);
  if (!userId) return null;
  return config.users.find((user) => user.user_id === userId) || null;
}

function hasPerm(role, perm) {
  return (ROLE_PERMS[role] || []).includes(perm);
}

function canViewCase(role, user, caseRecord) {
  if (hasPerm(role, "view_all")) return true;
  if (role === "Municipal_Liaison") {
    return caseRecord.assigned_team === `Municipality: ${user?.municipality}` ||
      caseRecord.municipality_affiliation === user?.municipality;
  }
  if (role === "Partner_Vendor") {
    return caseRecord.assigned_team === user?.team || caseRecord.assigned_owner_user_id === user?.user_id;
  }
  return false;
}

function canEditCase(role, user, caseRecord) {
  if (hasPerm(role, "edit_all")) return true;
  if (role === "Chamber_Staff") return true;
  if (role === "Municipal_Liaison") {
    return caseRecord.assigned_team === `Municipality: ${user?.municipality}` ||
      caseRecord.municipality_affiliation === user?.municipality;
  }
  if (role === "Partner_Vendor") {
    return caseRecord.assigned_team === user?.team || caseRecord.assigned_owner_user_id === user?.user_id;
  }
  return false;
}

function logEvent(db, payload) {
  const event = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor_type: payload.actor_type || "system",
    actor_user_id: payload.actor_user_id || null,
    visibility: payload.visibility || "internal",
    ...payload
  };
  db.events.push(event);
  return event;
}

function createTask(db, caseRecord, title, assignedTo, actor) {
  const task = {
    task_id: crypto.randomUUID(),
    case_id: caseRecord.case_id,
    title,
    assigned_to: assignedTo,
    due_at: null,
    status: "open",
    created_by: actor.actor_user_id,
    created_at: new Date().toISOString()
  };
  db.tasks.push(task);
  logEvent(db, {
    case_id: caseRecord.case_id,
    event_type: "TASK_CREATED",
    before: null,
    after: { task_id: task.task_id, title: task.title },
    actor_type: actor.actor_type,
    actor_user_id: actor.actor_user_id,
    notes: "Task created by escalation logic.",
    visibility: "internal"
  });
  return task;
}

function generateCaseRef(db) {
  const year = new Date().getFullYear();
  const current = db.meta.sequenceByYear[String(year)] || 0;
  const next = current + 1;
  db.meta.sequenceByYear[String(year)] = next;
  return `CC-${year}-${String(next).padStart(4, "0")}`;
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isHoliday(date, holidays) {
  const iso = date.toISOString().slice(0, 10);
  return holidays.includes(iso);
}

function isBusinessDay(date, config) {
  const day = date.getDay();
  if (!config.workdays.includes(day)) return false;
  if (isHoliday(date, config.holidays)) return false;
  return true;
}

function addBusinessHours(start, hours, config) {
  const startMinutes = parseTimeToMinutes(config.start);
  const endMinutes = parseTimeToMinutes(config.end);
  let remaining = hours * 60;
  let current = new Date(start);

  while (remaining > 0) {
    if (!isBusinessDay(current, config)) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const minutesToday = endMinutes - startMinutes;
    const currentMinutes = current.getHours() * 60 + current.getMinutes();
    const effectiveStart = Math.max(currentMinutes, startMinutes);
    const available = endMinutes - effectiveStart;

    if (available <= 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    if (remaining <= available) {
      const finalMinutes = effectiveStart + remaining;
      current.setHours(Math.floor(finalMinutes / 60), finalMinutes % 60, 0, 0);
      remaining = 0;
      break;
    }

    remaining -= available;
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return current;
}

function computeSlaDue(intakeTimestamp, slaTier, businessConfig) {
  const start = new Date(intakeTimestamp);
  if (slaTier === "same_day") {
    const endMinutes = parseTimeToMinutes(businessConfig.end);
    const due = new Date(start);
    due.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    if (due < start) {
      return addBusinessHours(start, 8, businessConfig);
    }
    return due;
  }

  const hours = slaTier === "2_business_days" ? 16 : 40;
  return addBusinessHours(start, hours, businessConfig);
}

function computeSlaStatus(caseRecord, businessConfig, thresholdRatio = 0.2) {
  if (caseRecord.sla_pause_reason) return "paused";
  const now = new Date();
  const due = new Date(caseRecord.sla_due_at);
  if (now > due) return "breached";

  const start = new Date(caseRecord.intake_timestamp);
  const total = due - start;
  const remaining = due - now;
  if (remaining / total <= thresholdRatio) return "at_risk";
  return "on_track";
}

function ensureSlaStatus(db, caseRecord, actor, config) {
  const businessConfig = readJson(BUSINESS_HOURS_PATH);
  const computed = computeSlaStatus(caseRecord, businessConfig);
  if (computed !== caseRecord.sla_status) {
    const before = { sla_status: caseRecord.sla_status };
    caseRecord.sla_status = computed;
    if (computed === "breached") {
      caseRecord.breach_timestamp = new Date().toISOString();
      logEvent(db, {
        case_id: caseRecord.case_id,
        event_type: "SLA_BREACHED",
        before,
        after: { sla_status: computed },
        actor_type: actor.actor_type,
        actor_user_id: actor.actor_user_id,
        notes: "SLA breached based on computed due time.",
        visibility: "internal"
      });

      const adminUser = config?.users?.find((user) => user.role === "Chamber_Admin");
      caseRecord.handoff_target = "Chamber_Admin";
      logEvent(db, {
        case_id: caseRecord.case_id,
        event_type: "ESCALATED",
        before: null,
        after: { handoff_target: caseRecord.handoff_target },
        actor_type: "system",
        actor_user_id: null,
        notes: "Auto-escalated due to SLA breach.",
        visibility: "internal"
      });

      const existing = db.tasks.find(
        (task) => task.case_id === caseRecord.case_id && task.title === "SLA Breach Escalation" && task.status === "open"
      );
      if (!existing && adminUser) {
        createTask(db, caseRecord, "SLA Breach Escalation", adminUser.user_id, actor);
      }
    } else if (computed === "at_risk") {
      logEvent(db, {
        case_id: caseRecord.case_id,
        event_type: "SLA_AT_RISK",
        before,
        after: { sla_status: computed },
        actor_type: actor.actor_type,
        actor_user_id: actor.actor_user_id,
        notes: "SLA at risk based on remaining time threshold.",
        visibility: "internal"
      });
    }
  }
}

function renderTemplate(template, data) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    return data[trimmed] ?? "";
  });
}

function ruleMatches(rule, caseRecord) {
  if (!rule.enabled) return false;
  const logic = rule.logic || "AND";
  const checks = rule.conditions.map((condition) => {
    const value = caseRecord[condition.field];
    if (condition.operator === "eq") return value === condition.value;
    if (condition.operator === "in") return Array.isArray(condition.value) && condition.value.includes(value);
    if (condition.operator === "contains") return typeof value === "string" && value.toLowerCase().includes(String(condition.value).toLowerCase());
    if (condition.operator === "exists") return value !== null && value !== undefined && value !== "";
    return false;
  });
  return logic === "OR" ? checks.some(Boolean) : checks.every(Boolean);
}

function applyRouting(caseRecord, rules) {
  const sorted = [...rules.rules].sort((a, b) => a.priority - b.priority || a.rule_id.localeCompare(b.rule_id));
  for (const rule of sorted) {
    if (!ruleMatches(rule, caseRecord)) continue;
    const actions = rule.actions || {};
    const applied = {
      assigned_team: renderTemplate(actions.assigned_team || caseRecord.assigned_team || "", caseRecord),
      assigned_owner_user_id: actions.assigned_owner_user_id || caseRecord.assigned_owner_user_id || null,
      sla_tier: actions.sla_tier || caseRecord.sla_tier,
      routing_profile: actions.routing_profile || caseRecord.routing_profile
    };
    return {
      match: rule,
      applied
    };
  }

  return {
    match: null,
    applied: {
      assigned_team: rules.default.assigned_team,
      assigned_owner_user_id: null,
      sla_tier: rules.default.sla_tier,
      routing_profile: rules.default.routing_profile
    }
  };
}

function mapPublicStatus(state) {
  switch (state) {
    case "NEW":
      return "Received";
    case "TRIAGE":
      return "In Review";
    case "ROUTED":
      return "Assigned";
    case "IN_PROGRESS":
      return "In Progress";
    case "WAITING_ON_REQUESTOR":
      return "Waiting on You";
    case "WAITING_ON_EXTERNAL":
      return "In Progress";
    case "RESOLVED_PENDING_CONFIRMATION":
      return "In Progress";
    case "CLOSED":
      return "Closed";
    case "REOPENED":
      return "In Review";
    default:
      return "Received";
  }
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url).pathname;
  const safePath = parsed === "/" ? "/index.html" : parsed;
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname.startsWith("/api/")) {
      const db = getDb();
      const config = getConfig();
      const role = getRole(req);
      const user = getUser(req, config);
      const actor = { actor_type: role === "Public_Requestor" ? "system" : "user", actor_user_id: user?.user_id || null };

      if (parsed.pathname === "/api/config" && req.method === "GET") {
        if (!hasPerm(role, "config") && !hasPerm(role, "view_all")) {
          return sendError(res, 403, "Not authorized.");
        }
        return sendJson(res, 200, config);
      }

      if (parsed.pathname === "/api/cases" && req.method === "GET") {
        let cases = db.cases.filter((caseRecord) => canViewCase(role, user, caseRecord));

        cases.forEach((caseRecord) => ensureSlaStatus(db, caseRecord, actor, config));
        saveDb(db);

        const { state, assigned_team, municipality, queue } = parsed.query;
        if (state) {
          cases = cases.filter((caseRecord) => caseRecord.state === state);
        }
        if (assigned_team) {
          cases = cases.filter((caseRecord) => caseRecord.assigned_team === assigned_team);
        }
        if (municipality) {
          cases = cases.filter((caseRecord) => caseRecord.municipality_affiliation === municipality);
        }
        if (queue === "triage") {
          cases = cases.filter((caseRecord) => caseRecord.state === "TRIAGE");
        }
        if (queue === "at_risk") {
          cases = cases.filter((caseRecord) => caseRecord.sla_status === "at_risk");
        }
        if (queue === "breached") {
          cases = cases.filter((caseRecord) => caseRecord.sla_status === "breached");
        }

        return sendJson(res, 200, cases);
      }

      if (parsed.pathname === "/api/cases" && req.method === "POST") {
        if (!hasPerm(role, "edit_all") && !hasPerm(role, "edit_assigned") && role !== "Public_Requestor") {
          return sendError(res, 403, "Not authorized.");
        }

        const body = (await parseBody(req)) || {};
        const businessConfig = config.businessHours;
        const caseRecord = {
          case_id: crypto.randomUUID(),
          case_ref: generateCaseRef(db),
          intake_channel: body.intake_channel || "web form",
          intake_timestamp: body.intake_timestamp || new Date().toISOString(),
          requestor_type: body.requestor_type || "unknown",
          requestor_name: body.requestor_name || "",
          requestor_org: body.requestor_org || null,
          requestor_email: body.requestor_email || "",
          requestor_phone: body.requestor_phone || "",
          preferred_contact_method: body.preferred_contact_method || "email",
          contact_consent: Boolean(body.contact_consent),
          municipality_affiliation: body.municipality_affiliation || null,
          subject: body.subject || "",
          description: body.description || "",
          attachments: body.attachments || [],
          tags: body.tags || [],
          category: body.category || null,
          sub_category: body.sub_category || null,
          classification_confidence: body.classification_confidence || 0,
          knowledge_base_matches: body.knowledge_base_matches || [],
          routing_profile: null,
          assigned_team: null,
          assigned_owner_user_id: null,
          secondary_owner_user_id: null,
          handoff_target: null,
          assignment_timestamp: null,
          state: "TRIAGE",
          priority: body.priority || "normal",
          complexity: body.complexity || "standard",
          next_action_required: true,
          next_action_due_at: null,
          resolution_summary: null,
          resolution_type: null,
          closed_timestamp: null,
          reopen_count: 0,
          sla_tier: body.sla_tier || "2_business_days",
          sla_due_at: null,
          sla_status: "on_track",
          sla_pause_reason: null,
          breach_timestamp: null
        };

        caseRecord.sla_due_at = computeSlaDue(caseRecord.intake_timestamp, caseRecord.sla_tier, businessConfig).toISOString();

        db.cases.push(caseRecord);
        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "CASE_CREATED",
          before: null,
          after: { state: "NEW" },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Case created.",
          visibility: "public-safe"
        });

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "STATE_CHANGED",
          before: { state: "NEW" },
          after: { state: "TRIAGE" },
          actor_type: "system",
          actor_user_id: null,
          notes: "Auto-transition to TRIAGE.",
          visibility: "internal"
        });

        if (caseRecord.category || caseRecord.sub_category) {
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "CLASSIFIED",
            before: { category: null, sub_category: null },
            after: { category: caseRecord.category, sub_category: caseRecord.sub_category },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "Initial classification captured on intake.",
            visibility: "internal"
          });
        }

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "SLA_SET",
          before: null,
          after: { sla_tier: caseRecord.sla_tier, sla_due_at: caseRecord.sla_due_at },
          actor_type: "system",
          actor_user_id: null,
          notes: "SLA due computed on intake.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 201, caseRecord);
      }

      if (parsed.pathname.startsWith("/api/cases/") && req.method === "GET") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId || c.case_ref === caseId);
        if (!caseRecord || !canViewCase(role, user, caseRecord)) {
          return sendError(res, 404, "Case not found.");
        }
        ensureSlaStatus(db, caseRecord, actor, config);
        saveDb(db);
        const payload = {
          ...caseRecord,
          events: db.events.filter((event) => event.case_id === caseRecord.case_id),
          comms: db.comms.filter((comm) => comm.case_id === caseRecord.case_id),
          tasks: db.tasks.filter((task) => task.case_id === caseRecord.case_id)
        };
        return sendJson(res, 200, payload);
      }

      if (parsed.pathname.startsWith("/api/cases/") && req.method === "PATCH") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const body = (await parseBody(req)) || {};
        const before = { ...caseRecord };

        const allowed = [
          "category",
          "sub_category",
          "classification_confidence",
          "tags",
          "subject",
          "description",
          "municipality_affiliation",
          "priority",
          "complexity",
          "knowledge_base_matches",
          "next_action_required",
          "next_action_due_at"
        ];

        allowed.forEach((field) => {
          if (field in body) caseRecord[field] = body[field];
        });

        const classificationChanged = before.category !== caseRecord.category || before.sub_category !== caseRecord.sub_category;

        if (classificationChanged) {
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "CLASSIFIED",
            before: { category: before.category, sub_category: before.sub_category },
            after: { category: caseRecord.category, sub_category: caseRecord.sub_category },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "Classification updated.",
            visibility: "internal"
          });
        }

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "CASE_UPDATED",
          before,
          after: caseRecord,
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Case updated.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 200, caseRecord);
      }

      if (parsed.pathname.endsWith("/route") && req.method === "POST") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const routing = applyRouting(caseRecord, config.rules);
        const before = {
          assigned_team: caseRecord.assigned_team,
          assigned_owner_user_id: caseRecord.assigned_owner_user_id,
          sla_tier: caseRecord.sla_tier,
          routing_profile: caseRecord.routing_profile
        };

        caseRecord.assigned_team = routing.applied.assigned_team;
        caseRecord.assigned_owner_user_id = routing.applied.assigned_owner_user_id;
        caseRecord.sla_tier = routing.applied.sla_tier;
        caseRecord.routing_profile = routing.applied.routing_profile;
        caseRecord.assignment_timestamp = new Date().toISOString();
        const priorState = caseRecord.state;
        caseRecord.state = "ROUTED";
        caseRecord.sla_due_at = computeSlaDue(caseRecord.intake_timestamp, caseRecord.sla_tier, config.businessHours).toISOString();

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "ROUTED",
          before,
          after: {
            assigned_team: caseRecord.assigned_team,
            sla_tier: caseRecord.sla_tier,
            routing_profile: caseRecord.routing_profile,
            rule_id: routing.match ? routing.match.rule_id : "DEFAULT",
            ruleset_id: config.rules.ruleset_id,
            ruleset_version: config.rules.version
          },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: routing.match ? renderTemplate(routing.match.explanation_template, caseRecord) : "Default routing applied.",
          visibility: "internal"
        });

        if (before.sla_tier !== caseRecord.sla_tier) {
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "SLA_SET",
            before: { sla_tier: before.sla_tier, sla_due_at: caseRecord.sla_due_at },
            after: { sla_tier: caseRecord.sla_tier, sla_due_at: caseRecord.sla_due_at },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "SLA recalculated during routing.",
            visibility: "internal"
          });
        }

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "ASSIGNED",
          before: { assigned_owner_user_id: before.assigned_owner_user_id },
          after: { assigned_owner_user_id: caseRecord.assigned_owner_user_id },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Assignment updated during routing.",
          visibility: "internal"
        });

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "STATE_CHANGED",
          before: { state: priorState },
          after: { state: caseRecord.state },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "State transitioned during routing.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 200, caseRecord);
      }

      if (parsed.pathname.endsWith("/assign") && req.method === "POST") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }

        const body = (await parseBody(req)) || {};
        const before = { assigned_owner_user_id: caseRecord.assigned_owner_user_id, assigned_team: caseRecord.assigned_team };
        caseRecord.assigned_owner_user_id = body.assigned_owner_user_id || caseRecord.assigned_owner_user_id;
        caseRecord.assigned_team = body.assigned_team || caseRecord.assigned_team;
        caseRecord.assignment_timestamp = new Date().toISOString();

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: before.assigned_owner_user_id ? "REASSIGNED" : "ASSIGNED",
          before,
          after: { assigned_owner_user_id: caseRecord.assigned_owner_user_id, assigned_team: caseRecord.assigned_team },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Assignment updated.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 200, caseRecord);
      }

      if (parsed.pathname.endsWith("/transition") && req.method === "POST") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const body = (await parseBody(req)) || {};
        const nextState = body.state;
        if (!STATE_MACHINE[caseRecord.state]?.includes(nextState)) {
          return sendError(res, 400, `Invalid transition from ${caseRecord.state} to ${nextState}.`);
        }

        if (caseRecord.state === "TRIAGE" && nextState === "ROUTED") {
          if (!caseRecord.category || !caseRecord.assigned_team) {
            return sendError(res, 400, "Classification and assignment required before routing.");
          }
        }

        if (caseRecord.state === "ROUTED" && nextState === "IN_PROGRESS") {
          if (!caseRecord.assigned_owner_user_id) {
            return sendError(res, 400, "Owner acknowledgement required before moving to IN_PROGRESS.");
          }
        }

        const before = { state: caseRecord.state };
        caseRecord.state = nextState;

        if (nextState.startsWith("WAITING")) {
          if (!body.sla_pause_reason) {
            return sendError(res, 400, "SLA pause reason required.");
          }
          caseRecord.sla_pause_reason = body.sla_pause_reason;
          caseRecord.sla_status = "paused";
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "SLA_PAUSED",
            before: { sla_status: before.sla_status },
            after: { sla_status: "paused", sla_pause_reason: body.sla_pause_reason },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "SLA paused.",
            visibility: "internal"
          });
        } else if (caseRecord.sla_pause_reason) {
          caseRecord.sla_pause_reason = null;
          caseRecord.sla_status = "on_track";
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "SLA_RESUMED",
            before: { sla_status: "paused" },
            after: { sla_status: caseRecord.sla_status },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "SLA resumed.",
            visibility: "internal"
          });
        }

        if (nextState === "CLOSED") {
          if (!body.resolution_summary || !body.resolution_type) {
            return sendError(res, 400, "Resolution summary and type required to close.");
          }
          caseRecord.resolution_summary = body.resolution_summary;
          caseRecord.resolution_type = body.resolution_type;
          caseRecord.closed_timestamp = new Date().toISOString();
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "CASE_CLOSED",
            before: null,
            after: { resolution_type: caseRecord.resolution_type },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "Case closed.",
            visibility: "public-safe"
          });
        }

        if (nextState === "REOPENED") {
          caseRecord.reopen_count += 1;
          logEvent(db, {
            case_id: caseRecord.case_id,
            event_type: "CASE_REOPENED",
            before: null,
            after: { reopen_count: caseRecord.reopen_count },
            actor_type: actor.actor_type,
            actor_user_id: actor.actor_user_id,
            notes: "Case reopened via inbound requestor update.",
            visibility: "public-safe"
          });
        }

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "STATE_CHANGED",
          before,
          after: { state: nextState },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "State transition.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 200, caseRecord);
      }

      if (parsed.pathname.endsWith("/comm") && req.method === "POST") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const body = (await parseBody(req)) || {};
        const comm = {
          comm_id: crypto.randomUUID(),
          case_id: caseRecord.case_id,
          direction: body.direction || "outbound",
          channel: body.channel || "email",
          from: body.from || "",
          to: body.to || "",
          subject: body.subject || caseRecord.subject,
          body: body.body || "",
          timestamp: new Date().toISOString(),
          attachments: body.attachments || [],
          public_safe: Boolean(body.public_safe)
        };
        db.comms.push(comm);

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: comm.direction === "inbound" ? "COMM_INBOUND_LOGGED" : "COMM_OUTBOUND_SENT",
          before: null,
          after: { channel: comm.channel },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Communication logged.",
          visibility: comm.public_safe ? "public-safe" : "internal"
        });

        saveDb(db);
        return sendJson(res, 201, comm);
      }

      if (parsed.pathname.endsWith("/tasks") && req.method === "POST") {
        const caseId = parsed.pathname.split("/")[3];
        const caseRecord = db.cases.find((c) => c.case_id === caseId);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const body = (await parseBody(req)) || {};
        const task = {
          task_id: crypto.randomUUID(),
          case_id: caseRecord.case_id,
          title: body.title || "New Task",
          assigned_to: body.assigned_to || actor.actor_user_id,
          due_at: body.due_at || null,
          status: "open",
          created_by: actor.actor_user_id,
          created_at: new Date().toISOString()
        };
        db.tasks.push(task);

        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: "TASK_CREATED",
          before: null,
          after: { task_id: task.task_id, title: task.title },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Task created.",
          visibility: "internal"
        });

        saveDb(db);
        return sendJson(res, 201, task);
      }

      if (parsed.pathname.startsWith("/api/tasks/") && req.method === "PATCH") {
        const taskId = parsed.pathname.split("/")[3];
        const task = db.tasks.find((t) => t.task_id === taskId);
        if (!task) return sendError(res, 404, "Task not found.");
        const caseRecord = db.cases.find((c) => c.case_id === task.case_id);
        if (!caseRecord || !canEditCase(role, user, caseRecord)) {
          return sendError(res, 403, "Not authorized.");
        }
        const body = (await parseBody(req)) || {};
        const before = { status: task.status };
        if (body.status) task.status = body.status;
        logEvent(db, {
          case_id: caseRecord.case_id,
          event_type: body.status === "done" ? "TASK_COMPLETED" : "CASE_UPDATED",
          before,
          after: { status: task.status },
          actor_type: actor.actor_type,
          actor_user_id: actor.actor_user_id,
          notes: "Task updated.",
          visibility: "internal"
        });
        saveDb(db);
        return sendJson(res, 200, task);
      }

      if (parsed.pathname === "/api/public/status" && req.method === "GET") {
        const { case_ref, verify } = parsed.query;
        const caseRecord = db.cases.find((c) => c.case_ref === case_ref);
        if (!caseRecord) return sendError(res, 404, "Case not found.");
        const matches = [caseRecord.requestor_email, caseRecord.requestor_phone].includes(verify);
        if (!matches) return sendError(res, 403, "Verification failed.");
        const payload = {
          case_ref: caseRecord.case_ref,
          status: mapPublicStatus(caseRecord.state),
          last_updated: caseRecord.assignment_timestamp || caseRecord.intake_timestamp
        };
        return sendJson(res, 200, payload);
      }

      return sendError(res, 404, "Not found.");
    }

    if (serveStatic(req, res)) return;
    sendError(res, 404, "Not found.");
  } catch (err) {
    console.error(err);
    sendError(res, 500, "Server error.");
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Chamber Connect running at http://localhost:${PORT}`);
});
