import { asRecord, asStringArray, asTrimmedString, parseJsonFromEnv } from "./config.js";

export type DemoMemberTemplate = {
  id: string;
  label: string;
  description: string;
  name: string;
  username: string;
  email: string;
  role: "admin" | "member" | "viewer";
  toolAccess: string[] | null;
  mustChangePassword: boolean;
};

const DEFAULT_DEMO_MEMBER_TEMPLATES: DemoMemberTemplate[] = [
  {
    id: "sutton-manager",
    label: "Sutton Town Manager",
    description: "Town Manager demo account restricted to the Sutton environment.",
    name: "Sutton Town Manager",
    username: "AC3",
    email: "a.cyganiewicz@town.sutton.ma.us",
    role: "member",
    toolAccess: ["casespaces", "vault", "workspace"],
    mustChangePassword: false,
  },
  {
    id: "n8-demo",
    label: "N8 Demo Operator",
    description: "Internal operator account for fast demo setup and review.",
    name: "N8 Demo Operator",
    username: "N8",
    email: "nboudreauma@gmail.com",
    role: "admin",
    toolAccess: null,
    mustChangePassword: false,
  },
];

function normalizeTemplate(value: unknown): DemoMemberTemplate | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asTrimmedString(record.id);
  const label = asTrimmedString(record.label);
  const description = asTrimmedString(record.description);
  const name = asTrimmedString(record.name);
  const username = asTrimmedString(record.username);
  const email = asTrimmedString(record.email);
  const role = record.role === "admin" || record.role === "member" || record.role === "viewer"
    ? record.role
    : null;

  if (!id || !label || !description || !name || !username || !email || !role) {
    return null;
  }

  const toolAccess = record.toolAccess === null
    ? null
    : Array.isArray(record.toolAccess)
      ? asStringArray(record.toolAccess)
      : [];

  return {
    id,
    label,
    description,
    name,
    username,
    email,
    role,
    toolAccess,
    mustChangePassword: record.mustChangePassword === true,
  };
}

export function resolveDemoMemberTemplates(): DemoMemberTemplate[] {
  const configured = parseJsonFromEnv("PJ_DEMO_MEMBER_TEMPLATES_JSON");
  if (!Array.isArray(configured)) {
    return DEFAULT_DEMO_MEMBER_TEMPLATES;
  }

  const normalized = configured
    .map(normalizeTemplate)
    .filter((template): template is DemoMemberTemplate => template !== null);

  return normalized.length > 0 ? normalized : DEFAULT_DEMO_MEMBER_TEMPLATES;
}
