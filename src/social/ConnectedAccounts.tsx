import { useEffect, useState } from "react";
import type { RemoteSaver } from "../remote-saver";
type Social = {
  configured: boolean;
  connected: boolean;
  username?: string;
  lastSyncAt?: string | null;
  enabled?: boolean;
  error?: string | null;
};
export function ConnectedAccounts({ remote }: { remote: RemoteSaver }) {
  const [x, setX] = useState<Social | null>(null),
    [instagram, setInstagram] = useState<Social | null>(null),
    [grok, setGrok] = useState<{ connected: boolean } | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    if (!remote.connected) {
      setX(null);
      setInstagram(null);
      setGrok(null);
      return;
    }
    const result = await Promise.allSettled([
      remote.reader<Social>("/api/x/status"),
      remote.reader<Social>("/api/instagram/status"),
      remote.reader<{ connected: boolean }>("/api/connections/grok"),
    ]);
    if (result[0].status === "fulfilled") setX(result[0].value);
    if (result[1].status === "fulfilled") setInstagram(result[1].value);
    if (result[2].status === "fulfilled") setGrok(result[2].value);
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [remote.connected]);
  async function action(service: "x" | "instagram", disconnect = false) {
    setBusy(service);
    setMessage("");
    try {
      const result = await remote.reader<{ url?: string; revoked?: boolean }>(
        `/api/${service}/${disconnect ? "disconnect" : "connect"}`,
        "POST",
        {},
      );
      if (result.url) {
        const url = new URL(result.url);
        const allowed =
          service === "x" ? "https://x.com" : "https://www.instagram.com";
        if (url.origin !== allowed) throw Error("Connexion refusée.");
        location.assign(url.href);
      } else {
        setMessage(
          result.revoked
            ? "Compte déconnecté. Vos références sont conservées."
            : "Compte déconnecté dans Saver. La révocation auprès du service n’a pas été confirmée.",
        );
        await load();
      }
    } catch {
      setMessage(
        "La connexion n’a pas abouti. Vos références sont conservées ; réessayez plus tard.",
      );
    } finally {
      setBusy("");
    }
  }
  async function openGrok() {
    setMessage("");
    try {
      await navigator.clipboard.writeText(
        "https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp",
      );
      setMessage(
        "Adresse de connexion copiée. Dans Grok, choisissez votre connecteur A.D ou ajoutez-le dans les connecteurs personnalisés. Les autorisations seront gérées automatiquement.",
      );
    } catch {
      setMessage(
        "La copie a été refusée par le navigateur. Utilisez le lien de connexion affiché dans Grok.",
      );
    }
  }
  return (
    <details className="connected-accounts">
      <summary>Mes connexions</summary>
      {!remote.connected ? (
        <p>
          <a className="primary" href="/api/auth/google/login">
            Se connecter avec Google
          </a>
        </p>
      ) : (
        <p>
          Votre compte A.D est connecté. Vos références sont sauvegardées
          automatiquement.
        </p>
      )}
      <section aria-label="Connexion X">
        <h4>X · {x?.connected ? "connecté" : "non connecté"}</h4>
        <p>
          Retrouvez automatiquement vos signets dans Saver après la connexion.
        </p>
        {!remote.connected ? (
          <p>Connectez-vous à A.D pour relier votre compte.</p>
        ) : !x ? (
          <p>Vérification en cours…</p>
        ) : !x.configured ? (
          <p>La connexion X n’est pas encore disponible.</p>
        ) : x.connected ? (
          <>
            {!x.enabled && <p>La synchronisation est en pause.</p>}
            <p>
              {x.lastSyncAt
                ? "Dernière synchronisation : " +
                  new Date(x.lastSyncAt).toLocaleString("fr-FR")
                : "Première synchronisation en cours."}
            </p>
            {x.error && (
              <p>
                La synchronisation sera réessayée automatiquement. Une nouvelle
                autorisation peut être nécessaire.
              </p>
            )}
            <button
              disabled={!!busy}
              onClick={async () => {
                setBusy("x");
                try {
                  await remote.reader("/api/x/automatic", "PUT", {
                    enabled: !x.enabled,
                  });
                  await remote.reader("/api/connections/sync", "POST", {});
                  await load();
                } catch {
                  setMessage(
                    "La modification n’a pas été confirmée. Réessayez.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              {x.enabled
                ? "Mettre la synchronisation en pause"
                : "Reprendre la synchronisation"}
            </button>
            <button disabled={!!busy} onClick={() => void action("x", true)}>
              Déconnecter X
            </button>
          </>
        ) : (
          <button disabled={!!busy} onClick={() => void action("x")}>
            Connecter X
          </button>
        )}
      </section>
      <section aria-label="Connexion Instagram">
        <h4>
          Instagram · {instagram?.connected ? "connecté" : "non connecté"}
        </h4>
        <p>
          Partagez une publication vers Saver depuis votre iPhone. L’import des
          publications enregistrées n’est pas disponible sur Instagram.
        </p>
        {remote.connected &&
          instagram?.configured &&
          (instagram.connected ? (
            <button
              disabled={!!busy}
              onClick={() => void action("instagram", true)}
            >
              Déconnecter Instagram
            </button>
          ) : (
            <>
              <p>
                La connexion Instagram est réservée aux comptes Creator ou
                Business.
              </p>
              <button
                disabled={!!busy}
                onClick={() => void action("instagram")}
              >
                Connecter Instagram
              </button>
            </>
          ))}
        {remote.connected && instagram && !instagram.configured && (
          <p>
            La connexion Instagram n’est pas encore disponible. Le partage
            iPhone reste utilisable.
          </p>
        )}
      </section>
      <section aria-label="Connexion Grok">
        <h4>Grok · {grok?.connected ? "connecté" : "non connecté"}</h4>
        <p>
          Autorisez Grok à consulter et enregistrer des références Saver. Les
          groupes suggérés restent soumis à votre validation.
        </p>
        {remote.connected && (
          <>
            {grok?.connected ? (
              <button
                onClick={async () => {
                  try {
                    await remote.reader("/api/connections/grok", "DELETE", {});
                    await load();
                    setMessage(
                      "Grok déconnecté. Vos références sont conservées.",
                    );
                  } catch {
                    setMessage("Déconnexion non confirmée. Réessayez.");
                  }
                }}
              >
                Déconnecter Grok
              </button>
            ) : (
              <a
                className="primary"
                href="https://grok.com/connectors"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void openGrok()}
              >
                Connecter Grok
              </a>
            )}
          </>
        )}
      </section>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
