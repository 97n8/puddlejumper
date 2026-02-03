export function getRoute() {
  const hash = window.location.hash || "#/";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart || "/";
  const query = new URLSearchParams(queryPart || "");
  return { path, query };
}

export function setRoute(path) {
  window.location.hash = `#${path}`;
}

export function onRouteChange(fn) {
  window.addEventListener("hashchange", fn);
}
