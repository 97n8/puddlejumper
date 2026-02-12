# Chamber Connect (North Central Chamber of Commerce, MA)

This is a working prototype of the VAULT-governed Case Space system: intake, routing, SLA, audit, and staff UI with a public status portal. It runs as a single Node server with a JSON datastore.

## Run Locally

```bash
cd chamber-connect
npm start
```

Then open:
- http://localhost:8080 (staff UI)
- http://localhost:8080/portal.html (public status lookup)

## Notes
- Data is stored in `chamber-connect/data/db.json`.
- Routing rules live in `chamber-connect/config/routing_rules.json`.
- Business hours live in `chamber-connect/config/business_hours.json`.
- Municipalities and taxonomy live in `chamber-connect/config/municipalities.json` and `chamber-connect/config/taxonomy.json`.

## Roles (Prototype)
The UI simulates auth by sending headers:
- `X-Role`
- `X-User-Id`

Update `chamber-connect/config/users.json` to add or change users.
