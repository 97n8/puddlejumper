// PublicLogic OS config (no secrets). Safe to ship.
//
// Copy this file to config.js and fill values.
window.PUBLICLOGIC_OS_CONFIG = {
  envName: "local",
  msal: {
    // From Azure Portal -> Entra ID -> App registrations -> (Your app)
    clientId: "00000000-0000-0000-0000-000000000000",

    // Use your tenant GUID (recommended). You can also use "common" for multi-tenant, but that's usually not what you want.
    tenantId: "00000000-0000-0000-0000-000000000000",

    // Must be registered as a SPA Redirect URI in the app registration.
    // If you want the OS on publiclogic.org, use: https://www.publiclogic.org/HMLP/
    redirectUri: "https://www.publiclogic.org/HMLP/",
    postLogoutRedirectUri: "https://www.publiclogic.org/HMLP/",

    // sessionStorage is safest for shared machines.
    cacheLocation: "sessionStorage"
  },

  access: {
    // Keep the OS private. Anyone not in this list will be immediately signed out.
    allowedEmails: ["you@publiclogic.org", "allie@publiclogic.org"]
  },

  graph: {
    // Minimal set for the OS.
    // Note: Sites.ReadWrite.All requires admin consent.
    scopes: ["User.Read", "Calendars.Read", "Calendars.Read.Shared", "Sites.ReadWrite.All"]
  },

  sharepoint: {
    // From your SharePoint site URL: https://publiclogic978.sharepoint.com/sites/PL
    hostname: "publiclogic978.sharepoint.com",
    sitePath: "/sites/PL",

    // Display names of Microsoft Lists (SharePoint lists)
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
      { name: "You", email: "you@publiclogic.org" },
      { name: "Allie", email: "allie@publiclogic.org" }
    ]
  },

  tools: [
    { title: "Outlook Mail", url: "https://outlook.office.com/mail/" },
    { title: "Outlook Calendar", url: "https://outlook.office.com/calendar/" },
    { title: "Microsoft Teams", url: "https://teams.microsoft.com/" },
    { title: "SharePoint OS Site", url: "https://publiclogic978.sharepoint.com/sites/PL" }
  ]
};
