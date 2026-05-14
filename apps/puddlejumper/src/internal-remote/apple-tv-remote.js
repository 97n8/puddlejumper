const ACTIONS = ["menu", "power", "up", "left", "center", "right", "down", "play"];

function bindPointerFeedback(button) {
  const onDown = () => button.classList.add("pressed");
  const onUp = () => button.classList.remove("pressed");

  button.addEventListener("pointerdown", onDown);
  button.addEventListener("pointerup", onUp);
  button.addEventListener("pointerleave", onUp);
  button.addEventListener("pointercancel", onUp);
}

export function attachAppleTvRemote(root, handlers) {
  if (!root) {
    throw new Error("Apple TV remote root element is required");
  }

  const buttons = new Map();

  ACTIONS.forEach((action) => {
    const button = root.querySelector(`[data-remote-action=\"${action}\"]`);
    if (!button) {
      return;
    }

    buttons.set(action, button);
    bindPointerFeedback(button);

    button.addEventListener("click", () => {
      const handler = handlers?.[action];
      if (typeof handler === "function") {
        handler();
      }
    });
  });

  function flash(action) {
    const button = buttons.get(action);
    if (!button) {
      return;
    }

    button.classList.add("active");
    window.setTimeout(() => button.classList.remove("active"), 140);
  }

  function destroy() {
    buttons.clear();
  }

  return { flash, destroy };
}
