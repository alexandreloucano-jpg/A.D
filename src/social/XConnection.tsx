import { useEffect, useRef, useState } from "react";
import type { RemoteSaver } from "../remote-saver";
import type { XStatus } from "./model";
export function XConnection({ remote }: { remote: RemoteSaver }) {
  const [status, setStatus] = useState<XStatus | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function load() {
    if (!remote.connected) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await remote.reader<XStatus>("/api/x/status"));
    } catch {
      setError("État de connexion X indisponible. Aucun import annoncé.");
    }
  }
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération X non confirmée.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function sync() {
    await run(async () => {
      const saved = await remote.reader<{ verified: boolean; ids: string[] }>(
        "/api/x/sync",
        "POST",
        {},
      );
      if (!saved.verified) throw Error("Relecture des signets non confirmée.");
      await remote.refresh();
      setMessage(saved.ids.length + " signet(s) relu(s) avec UUID persistant.");
    });
  }
  useEffect(() => {
    void load();
  }, [remote.connected]);
  return (
    <details className="x-connection">
      <summary>
        X ·{" "}
        {status?.connected ? "connecté · @" + status.username : "non connecté"}
      </summary>
      <p>
        Connexion officielle en lecture seule. Vos signets ne deviennent ni des
        préférences confirmées ni des tâches.
      </p>
      {!remote.connected ? (
        <p>Connectez-vous au Saver privé dans les réglages pour relier X.</p>
      ) : !status ? (
        <button onClick={() => void load()}>Vérifier la connexion X</button>
      ) : (
        <>
          <p>
            Permissions accordées : {status.permissions?.join(", ") || "aucune"}
            .
          </p>
          <p>
            Dernier import :{" "}
            {status.lastSyncAt
              ? new Date(status.lastSyncAt).toLocaleString("fr-FR")
              : "aucun"}
            .
          </p>
          {status.error && (
            <p role="alert">Dernière erreur X : {status.error}</p>
          )}
          {!status.configured && (
            <p role="status">
              {status.blocker} Aucune connexion X ni import réel n’est
              actuellement disponible.
            </p>
          )}
          {!status.connected && status.configured && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await remote.reader<{ url: string }>(
                    "/api/x/connect",
                    "POST",
                    {},
                  );
                  const url = new URL(result.url);
                  if (
                    url.origin !== "https://x.com" ||
                    url.pathname !== "/i/oauth2/authorize"
                  )
                    throw Error("Adresse X refusée.");
                  location.assign(url.href);
                })
              }
            >
              Autoriser la lecture de mes signets X
            </button>
          )}
          {status.connected && (
            <>
              <p>
                Dernière synchronisation :{" "}
                {status.lastSyncAt
                  ? new Date(status.lastSyncAt).toLocaleString("fr-FR")
                  : "pas encore effectuée"}
                .{" "}
                {status.catchingUp ? "Historique en cours de rattrapage." : ""}
              </p>
              <button
                disabled={busy || status.retryAt > Date.now()}
                onClick={() => void sync()}
              >
                Importer jusqu’à 5 signets
              </button>
              <p>
                Import volontaire uniquement, cinq signets maximum par action.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await remote.reader<{
                      disconnected: boolean;
                      revoked: boolean;
                    }>("/api/x/disconnect", "POST", {});
                    setMessage(
                      r.revoked
                        ? "Connexion X révoquée ; références conservées."
                        : "Connexion locale supprimée. Révoquez aussi A.D dans les applications connectées X ; la révocation distante n’a pas été confirmée.",
                    );
                  })
                }
              >
                Déconnecter X sans supprimer mes références
              </button>
            </>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Actualiser l’état X</button>
        </p>
      )}
    </details>
  );
}
