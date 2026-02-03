export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k === "dataset") {
      for (const [dk, dv] of Object.entries(v || {})) node.dataset[dk] = String(dv);
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === null || v === undefined) {
      // skip
    } else if (k === "html") {
      node.innerHTML = String(v);
    } else {
      node.setAttribute(k, String(v));
    }
  }

  const flat = Array.isArray(children) ? children : [children];
  for (const ch of flat) {
    if (ch === null || ch === undefined || ch === false) continue;
    if (typeof ch === "string" || typeof ch === "number") node.appendChild(document.createTextNode(String(ch)));
    else node.appendChild(ch);
  }

  return node;
}

export function fragment(children = []) {
  const frag = document.createDocumentFragment();
  for (const ch of children) {
    if (ch === null || ch === undefined || ch === false) continue;
    if (typeof ch === "string" || typeof ch === "number") frag.appendChild(document.createTextNode(String(ch)));
    else frag.appendChild(ch);
  }
  return frag;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
