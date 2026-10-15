import { useEffect, useState } from "react";
import type { RemoteSaver } from "../remote-saver";
import { GoogleAccount } from "./GoogleAccount";
import { XConnection } from "./XConnection";
type InstagramStatus = {
  configured: boolean;
  connected: boolean;
  username: string;
  accountType: string;
  permissions: string[];
  lastImportAt: null;
  error: string | null;
  blocker: string | null;
};
export function ConnectedAccounts({ remote }: { remote: RemoteSaver }) {
  const [status, setStatus] = useState<InstagramStatus | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!remote.connected) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await remote.reader<InstagramStatus>("/api/instagram/status"));
    } catch {
      setError("État Instagram indisponible. Aucun import annoncé.");
    }
  }
  useEffect(() => {
    void load();
  }, [remote.connected]);
  async function action(path: string) {
    setBusy(true);
    setError("");
    try {
      const result = await remote.reader<{ url?: string; revoked?: boolean }>(
        path,
        "POST",
        {},
      );
      if (result.url) {
        const url = new URL(result.url);
        if (
          url.origin !== "https://www.instagram.com" ||
          url.pathname !== "/oauth/authorize"
        )
          throw Error("Adresse Instagram refusée.");
        location.assign(url.href);
      } else {
        setMessage(
          result.revoked
            ? "Autorisation Instagram révoquée ; références conservées."
            : "Connexion supprimée de Saver. Révoquez aussi A.D dans Instagram : la révocation distante n’a pas été confirmée.",
        );
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion non confirmée.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="connected-accounts">
      <summary>Comptes connectés</summary>
      <GoogleAccount remote={remote} />
      <XConnection remote={remote} />
      <section aria-label="Compte Instagram">
        <h4>
          Instagram ·{" "}
          {status?.connected
            ? "connecté · @" + status.username
            : "non connecté"}
        </h4>
        <p>
          Instagram Login est réservé aux comptes professionnels Creator ou
          Business. L’API ne permet pas d’importer vos publications
          enregistrées. Le partage iPhone vers Saver reste disponible.
        </p>
        {!remote.connected ? (
          <p>Connectez votre Saver privé pour gérer Instagram.</p>
        ) : (
          <>
            <p>
              Permissions accordées :{" "}
              {status?.permissions.join(", ") || "aucune"}. Dernier import :
              aucun — import des enregistrements non disponible.
            </p>
            {status?.blocker && <p role="status">{status.blocker}</p>}
            {status?.error && (
              <p role="alert">Dernière erreur Instagram : {status.error}</p>
            )}
            {status?.configured && !status.connected && (
              <button
                disabled={busy}
                onClick={() => void action("/api/instagram/connect")}
              >
                Connecter mon compte Instagram professionnel
              </button>
            )}
            {(status?.connected ||
              status?.error === "instagram_reauthorization_required") && (
              <button
                disabled={busy}
                onClick={() => void action("/api/instagram/disconnect")}
              >
                Déconnecter Instagram sans supprimer mes références
              </button>
            )}
          </>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert">
            {error}
            <button onClick={() => void load()}>Réessayer Instagram</button>
          </p>
        )}
      </section>
    </details>
  );
}
