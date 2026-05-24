import { parseArgs } from "node:util";
import { signJwt } from "../packages/core/src/jwt.js";

const { values } = parseArgs({
  options: {
    sub: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "service" },
    tool: { type: "string", multiple: true },
    permission: { type: "string", multiple: true },
    "expires-in": { type: "string", default: "7d" },
    email: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: false,
});

if (values.help || !values.sub || !values.tool || values.tool.length === 0) {
  console.error(
    [
      "Usage:",
      "  pnpm mint:service-jwt --sub svc:pl-proxy --tool cs-mastersite --tool cs-rrc-michigan \\",
      "    --permission audit:tool:read --permission audit:tool:write [--expires-in 7d]",
      "",
      "Notes:",
      "  - Reads JWT_SECRET plus optional AUTH_ISSUER/AUTH_AUDIENCE from the environment.",
      "  - Emits a JSON object with the signed token and claims.",
    ].join("\n"),
  );
  process.exit(values.help ? 0 : 1);
}

const permissions = values.permission && values.permission.length > 0
  ? values.permission
  : ["audit:tool:read", "audit:tool:write"];

const claims = {
  sub: values.sub,
  ...(values.name ? { name: values.name } : {}),
  ...(values.email ? { email: values.email } : {}),
  role: values.role,
  permissions,
  toolIds: values.tool,
};

const token = await signJwt(claims, { expiresIn: values["expires-in"] });

process.stdout.write(
  `${JSON.stringify(
    {
      token,
      claims,
      expiresIn: values["expires-in"],
      issuer: process.env.AUTH_ISSUER ?? null,
      audience: process.env.AUTH_AUDIENCE ?? null,
    },
    null,
    2,
  )}\n`,
);
