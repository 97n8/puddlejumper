const form = document.getElementById("lookupForm");
const result = document.getElementById("result");
const backButton = document.getElementById("backButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const params = new URLSearchParams(data).toString();
  try {
    const response = await fetch(`/api/public/status?${params}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Lookup failed");
    }
    result.hidden = false;
    result.innerHTML = `
      <strong>${payload.case_ref}</strong>
      <p>Status: ${payload.status}</p>
      <p>Last updated: ${new Date(payload.last_updated).toLocaleString()}</p>
    `;
  } catch (err) {
    result.hidden = false;
    result.innerHTML = `<strong>Lookup failed</strong><p>${err.message}</p>`;
  }
});

backButton.addEventListener("click", () => {
  window.location.href = "/";
});
