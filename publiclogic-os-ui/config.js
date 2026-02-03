// PublicLogic OS config (no secrets). Safe to ship.
//
// Fill in the missing values (clientId, tenantId, allowedEmails).
// Your URLs given in chat are already wired:
// - https://www.publiclogic.org/HMLP/
// - https://publiclogic978.sharepoint.com/sites/PL
window.PUBLICLOGIC_OS_CONFIG = {
  envName: "prod",
  msal: {
    clientId: "",
    tenantId: "",
    redirectUri: "https://www.publiclogic.org/HMLP/",
    postLogoutRedirectUri: "https://www.publiclogic.org/HMLP/",
    cacheLocation: "sessionStorage"
  },
  access: {
    allowedEmails: []
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
    people: []
  },
  tools: [
    { title: "Outlook Mail", url: "https://outlook.office.com/mail/" },
    { title: "Outlook Calendar", url: "https://outlook.office.com/calendar/" },
    { title: "Microsoft Teams", url: "https://teams.microsoft.com/" },
    { title: "SharePoint PL Site", url: "https://publiclogic978.sharepoint.com/sites/PL" }
  ]
};
