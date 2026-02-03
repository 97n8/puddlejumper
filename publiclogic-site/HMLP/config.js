// PublicLogic OS config (no secrets). Safe to ship.
//
// Fill in the missing values (clientId, tenantId).
// Your URLs given in chat are already wired:
// - https://www.publiclogic.org/HMLP/
// - https://publiclogic978.sharepoint.com/sites/PL
window.PUBLICLOGIC_OS_CONFIG = {
  envName: "prod",
  msal: {
    clientId: "1b53d140-0779-4a64-943c-a11ba19ec0ce",
    tenantId: "12879dad-927b-419b-8a2e-fda32e1732be",
    redirectUri: "https://www.publiclogic.org/HMLP/",
    postLogoutRedirectUri: "https://www.publiclogic.org/HMLP/",
    cacheLocation: "sessionStorage"
  },
  access: {
    // NOTE: Assuming Allie's email is allie@publiclogic.org (confirm if different).
    allowedEmails: ["nate@publiclogic.org", "allie@publiclogic.org"]
  },
  graph: {
    scopes: ["User.Read", "Calendars.Read", "Calendars.Read.Shared", "Sites.ReadWrite.All"]
  },
  sharepoint: {
    hostname: "publiclogic978.sharepoint.com",
    sitePath: "/sites/PL",
    lists: {
      tasks: "OS Tasks",
      pipeline: "OS Pipeline",
      projects: "OS Projects",
      scorecard: "OS Scorecard",
      decisions: "OS Decisions"
    }
  },
  team: {
    people: [
      { name: "Nate", email: "nate@publiclogic.org" },
      { name: "Allie", email: "allie@publiclogic.org" }
    ]
  },
  tools: [
    { title: "Outlook Mail", url: "https://outlook.office.com/mail/" },
    { title: "Outlook Calendar", url: "https://outlook.office.com/calendar/" },
    { title: "Microsoft Teams", url: "https://teams.microsoft.com/" },
    { title: "SharePoint PL Site", url: "https://publiclogic978.sharepoint.com/sites/PL" }
  ]
};
