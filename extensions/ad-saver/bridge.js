// Isolated extension context: only a nonce travels in the URL. No bookmark
// contents, access tokens or cookies are placed in URLs or sent to X.
(() => {
  const nonce = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "capture",
  );
  if (!nonce) return;
  let delivered = false;
  async function deliver() {
    if (delivered) return;
    const data = await chrome.runtime
      .sendMessage({ type: "READ_CAPTURE", nonce })
      .catch(() => null);
    if (data?.ok) {
      window.postMessage(
        { type: "AD_SAVER_CAPTURE", nonce, items: data.items },
        location.origin,
      );
      delivered = true;
    }
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === "AD_SAVER_READY") {
      delivered = false;
      void deliver();
    }
    if (
      event.data?.type === "AD_SAVER_CAPTURE_SAVED" &&
      event.data.nonce === nonce
    )
      void chrome.runtime.sendMessage({ type: "CONFIRM_CAPTURE", nonce });
  });
  // A ready handshake avoids losing the payload before React mounts. The app
  // also restores its own pending copy after an owner login or page refresh.
  let attempts = 0;
  const timer = setInterval(() => {
    if (delivered || attempts++ > 15) {
      clearInterval(timer);
      return;
    }
    void deliver();
  }, 350);
})();
