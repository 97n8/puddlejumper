import { getConfig } from "./config.js";
import { graphGet, graphPost, graphPatch } from "./graph.js";

function encodeODataStringLiteral(s) {
  // OData single quotes are escaped by doubling.
  return String(s).replace(/'/g, "''");
}

export function createSharePointClient(auth) {
  const cfg = getConfig();
  const cache = {
    site: null,
    listsByName: new Map()
  };

  async function getSite() {
    if (cache.site) return cache.site;

    const hostname = cfg.sharepoint.hostname;
    const sitePath = cfg.sharepoint.sitePath;

    // Path-based addressing.
    const site = await graphGet(auth, `/sites/${hostname}:${sitePath}`);
    cache.site = site;
    return site;
  }

  async function getListByDisplayName(displayName) {
    if (cache.listsByName.has(displayName)) return cache.listsByName.get(displayName);

    const site = await getSite();
    const safe = encodeODataStringLiteral(displayName);

    const res = await graphGet(auth, `/sites/${site.id}/lists?$filter=displayName eq '${safe}'`);
    const list = res?.value?.[0];
    if (!list) throw new Error(`SharePoint list not found: ${displayName}`);

    cache.listsByName.set(displayName, list);
    return list;
  }

  async function listItems(displayName, { selectFields = [], top = 200 } = {}) {
    const site = await getSite();
    const list = await getListByDisplayName(displayName);

    const select = selectFields.length > 0 ? `($select=${selectFields.map(encodeURIComponent).join(",")})` : "";
    const expand = select ? `fields${select}` : "fields";

    const res = await graphGet(auth, `/sites/${site.id}/lists/${list.id}/items?$expand=${expand}&$top=${top}`);

    const items = (res?.value || []).map((it) => ({
      itemId: it.id,
      webUrl: it.webUrl,
      ...(it.fields || {})
    }));

    return items;
  }

  async function createItem(displayName, fields) {
    const site = await getSite();
    const list = await getListByDisplayName(displayName);

    const body = { fields };
    const res = await graphPost(auth, `/sites/${site.id}/lists/${list.id}/items`, body);
    return res;
  }

  async function updateItemFields(displayName, itemId, fields) {
    const site = await getSite();
    const list = await getListByDisplayName(displayName);
    await graphPatch(auth, `/sites/${site.id}/lists/${list.id}/items/${itemId}/fields`, fields);
  }

  return {
    getSite,
    listItems,
    createItem,
    updateItemFields
  };
}
