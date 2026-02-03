import { getConfig } from "./config.js";

function ensureMsalLoaded() {
  // eslint-disable-next-line no-undef
  if (!window.msal || !window.msal.PublicClientApplication) {
    throw new Error("MSAL not loaded. Check the msal-browser script tag in index.html.");
  }
}

export function getSignedInEmail(account) {
  if (!account) return null;
  const email = (account.username || account.idTokenClaims?.preferred_username || account.idTokenClaims?.email || "").trim();
  return email || null;
}

export function isAllowedAccount(account, allowedEmails) {
  const email = (getSignedInEmail(account) || "").toLowerCase();
  const set = new Set((allowedEmails || []).map((x) => String(x).toLowerCase()));
  return set.has(email);
}

export function createAuth() {
  ensureMsalLoaded();
  const cfg = getConfig();

  const msalConfig = {
    auth: {
      clientId: cfg.msal.clientId,
      authority: `https://login.microsoftonline.com/${cfg.msal.tenantId}`,
      redirectUri: cfg.msal.redirectUri,
      postLogoutRedirectUri: cfg.msal.postLogoutRedirectUri || cfg.msal.redirectUri,
      navigateToLoginRequestUrl: false
    },
    cache: {
      cacheLocation: cfg.msal.cacheLocation || "sessionStorage",
      storeAuthStateInCookie: false
    }
  };

  // eslint-disable-next-line no-undef
  const instance = new window.msal.PublicClientApplication(msalConfig);

  async function init() {
    let result = null;
    try {
      result = await instance.handleRedirectPromise();
    } catch (err) {
      console.warn("handleRedirectPromise failed", err);
    }

    if (result?.account) instance.setActiveAccount(result.account);

    const active = instance.getActiveAccount();
    if (!active) {
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) instance.setActiveAccount(accounts[0]);
    }

    return { redirectResult: result || null };
  }

  function getAccount() {
    return instance.getActiveAccount();
  }

  async function login() {
    await instance.loginRedirect({
      scopes: cfg.graph.scopes,
      prompt: "select_account"
    });
  }

  async function logout() {
    await instance.logoutRedirect();
  }

  async function acquireToken(scopes = cfg.graph.scopes) {
    const account = getAccount();
    if (!account) throw new Error("Not signed in");

    try {
      return await instance.acquireTokenSilent({ scopes, account });
    } catch (err) {
      // eslint-disable-next-line no-undef
      const interactionRequired = window.msal.InteractionRequiredAuthError && err instanceof window.msal.InteractionRequiredAuthError;
      if (interactionRequired) {
        await instance.acquireTokenRedirect({ scopes, account });
        return null; // redirecting
      }
      throw err;
    }
  }

  return {
    instance,
    init,
    login,
    logout,
    getAccount,
    acquireToken
  };
}
