const status = document.querySelector("#status"),
  buttons = [...document.querySelectorAll("button")];
async function start(walk) {
  buttons.forEach((b) => (b.disabled = true));
  status.textContent =
    "Collecte en cours dans votre onglet X. A.D s’ouvrira avec les références à examiner.";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      walk,
    });
    if (!result.ok) throw Error(result.error);
    status.textContent = `${result.prepared} publication(s) préparée(s). Confirmez l’enregistrement dans A.D.${result.limited ? " Le passage a atteint sa limite ; un autre passage est possible sans recréer les références déjà enregistrées." : ""}`;
  } catch (e) {
    status.textContent = e.message;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
document
  .querySelector("#visible")
  .addEventListener("click", () => void start(false));
document
  .querySelector("#history")
  .addEventListener("click", () => void start(true));

document.querySelector("#import-x").addEventListener("click", () => chrome.runtime.openOptionsPage());
