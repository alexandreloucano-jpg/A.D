export async function marketRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  let csrf = "";
  if (body !== undefined) {
    const session = await fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!session.ok) throw Error("Connectez-vous à A.D pour poursuivre.");
    csrf = (await session.json()).csrf;
  }
  const r = await fetch("/api/market" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined
        ? {}
        : { "content-type": "application/json", "x-ad-csrf": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error(
      "Service marché indisponible. Les données locales restent conservées.",
    );
  const b = await r.json();
  if (!r.ok) {
    const messages: Record<string, string> = {
      owner_session_required: "Connexion propriétaire requise.",
      owner_session_expired: "Session expirée : reconnectez-vous.",
      market_disabled: "Radar non activé sur ce serveur.",
      market_scan_disabled: "Collecte non activée.",
      rate_limited: "Un scan est autorisé toutes les 15 minutes.",
      market_scan_busy: "Un scan est déjà en cours.",
      market_rejection_reason_required: "Indiquez le motif du refus.",
    };
    throw Error(
      (messages[b.error] ||
        "Opération refusée ; réessayez après actualisation.") +
        (b.requestId ? " · diagnostic " + b.requestId : ""),
    );
  }
  return b as T;
}
