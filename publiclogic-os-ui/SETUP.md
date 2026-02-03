# PublicLogic OS Setup (Microsoft 365)

This OS is a static web app that signs in with Microsoft Entra ID and reads/writes shared data via Microsoft Graph.

## 1) Create an Entra ID App Registration
In Azure Portal:
- Microsoft Entra ID
- App registrations
- New registration

Recommended settings:
- Name: `PublicLogic OS`
- Supported account types: `Accounts in this organizational directory only (Single tenant)`

After creating the app:
- Record `Application (client) ID`
- Record `Directory (tenant) ID`

## 2) Configure Authentication (SPA)
In the app registration:
- Authentication
- Add a platform
- Single-page application

Add Redirect URIs (examples):
- `http://localhost:8000/`
- `https://os.publiclogic.org/`

Notes:
- Redirect URI must match exactly (including trailing slash).
- If you host at `https://www.publiclogic.org/os/`, your redirect URI should be `https://www.publiclogic.org/os/`.

## 3) Add Microsoft Graph API Permissions
In the app registration:
- API permissions
- Add a permission
- Microsoft Graph
- Delegated permissions

Add:
- `User.Read`
- `Calendars.Read`
- `Calendars.Read.Shared`
- `Sites.ReadWrite.All`

Then:
- Click `Grant admin consent` (recommended so you + Allie do not get stuck in consent prompts)

## 4) Create a SharePoint Site for the OS
You already have a SharePoint site you can use:
- `https://publiclogic978.sharepoint.com/sites/PL`

If you ever need to create a new site:
- Create site (Team site or Communication site)
- Keep the URL short and stable (this becomes part of the config)

## 5) Create Microsoft Lists (SharePoint Lists)
Create these lists in the OS SharePoint site (example: `https://publiclogic978.sharepoint.com/sites/PL`).

Important:
- Create columns with the exact names below (no spaces). Graph uses internal column names.
- Use `Single line of text` for `Owner` so we can store emails like `you@publiclogic.org`.

### List: OS Tasks
Columns:
- `Owner` (Single line of text)
- `Status` (Choice): `Backlog`, `This Week`, `Today`, `Blocked`, `Done`
- `DueDate` (Date)
- `Priority` (Choice): `P0`, `P1`, `P2`
- `Area` (Choice): `Ops`, `Sales`, `Delivery`, `Admin`
- `Notes` (Multiple lines of text)

### List: OS Pipeline
Columns:
- `ContactName` (Single line of text)
- `ContactEmail` (Single line of text)
- `Stage` (Choice): `Lead`, `Discovery`, `Proposal`, `Active`, `Closed Won`, `Closed Lost`
- `Owner` (Single line of text)
- `NextStep` (Single line of text)
- `NextDate` (Date)
- `Notes` (Multiple lines of text)

### List: OS Projects
Columns:
- `Client` (Single line of text)
- `Status` (Choice): `Active`, `Paused`, `Complete`
- `Owner` (Single line of text)
- `StartDate` (Date)
- `TargetDate` (Date)
- `Notes` (Multiple lines of text)

Optional lists (not required for the UI to work, but supported in config):
- `OS Scorecard`
- `OS Decisions`

## 6) Configure the App
In this folder:
- Copy `config.example.js` to `config.js`
- Fill in:
  - `msal.clientId`
  - `msal.tenantId`
  - `msal.redirectUri` (example: `https://www.publiclogic.org/HMLP/`)
  - `access.allowedEmails` (you + Allie)
  - `sharepoint.hostname` + `sharepoint.sitePath` (example: `publiclogic978.sharepoint.com` + `/sites/PL`)
  - `sharepoint.lists.*` display names

## 7) Share Calendars Between You and Allie
To make the Today page show both schedules:
- In Outlook (web)
- Share your calendar with the other person
- Ensure they can view details

## 8) Validate
After deployment/sign-in:
- Go to `Settings` in the OS
- Run `Connection Checks`
