import { el } from "./dom.js";

export function pill(text, kind = "") {
  const cls = ["pill", kind ? `pill--${kind}` : ""].filter(Boolean).join(" ");
  return el("span", { class: cls }, [text]);
}

export function button(label, { variant = "", onClick = null, title = null, type = "button" } = {}) {
  const cls = ["btn", variant ? `btn--${variant}` : ""].filter(Boolean).join(" ");
  return el("button", { class: cls, type, ...(title ? { title } : {}), ...(onClick ? { onclick: onClick } : {}) }, [label]);
}

export function showModal({ title, body, actions = [] }) {
  const backdrop = el("div", { class: "modal__backdrop", onclick: (e) => {
    if (e.target === backdrop) close();
  } });

  const modal = el("div", { class: "modal" });
  const top = el("div", { class: "modal__top" }, [
    el("div", { class: "modal__title" }, [title || "" ]),
    button("Close", { onClick: () => close() })
  ]);

  const bodyWrap = el("div", { class: "modal__body" }, [body]);

  modal.appendChild(top);
  modal.appendChild(bodyWrap);

  if (actions.length > 0) {
    const footer = el("div", { class: "modal__body" }, [
      el("div", { class: "split" }, actions.map((a) => button(a.label, { variant: a.variant || "", onClick: a.onClick })))
    ]);
    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  return { close };
}
