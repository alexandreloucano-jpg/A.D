import { useCallback, useEffect, useRef, useState } from "react";
import { referenceSchema, type Reference } from "./domain";
async function response<T>(r: Response): Promise<T> {
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Error(
      "Service Saver indisponible. Les données locales restent intactes.",
    );
  const body = await r.json();
  if (!r.ok)
    throw Error(
      r.status === 401
        ? "Reconnectez-vous pour accéder au Saver privé."
        : r.status === 409
          ? "Cet UUID existe avec un contenu différent. Aucune donnée distante remplacée."
          : r.status === 429
            ? "Quota atteint. Réessayez dans une minute ; votre brouillon est conservé."
            : "Service Saver indisponible. Réessayez ; votre brouillon reste conservé.",
    );
  return body as T;
}
export function useRemoteSaver() {
  const [references, setReferences] = useState<Reference[]>([]),
    [connected, setConnected] = useState(false),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const csrf = useRef("");
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const auth = await fetch("/api/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (auth.status === 401) {
        setAvailable(true);
        setConnected(false);
        csrf.current = "";
        setReferences([]);
        return;
      }
      if (
        !auth.ok ||
        !auth.headers.get("content-type")?.includes("application/json")
      ) {
        setAvailable(false);
        return;
      }
      const session = await response<{ csrf: string; authenticated: boolean }>(
        auth,
      );
      if (!session.authenticated)
        throw Error("Session propriétaire non confirmée.");
      csrf.current = session.csrf;
      setAvailable(true);
      const all: Reference[] = [];
      let after = "";
      const seen = new Set<string>();
      do {
        const page = await response<{
          references: unknown[];
          next: string | null;
        }>(
          await fetch(
            "/api/saver" + (after ? "?after=" + encodeURIComponent(after) : ""),
            { cache: "no-store", credentials: "same-origin" },
          ),
        );
        all.push(...page.references.map((row) => referenceSchema.parse(row)));
        after = page.next || "";
        if (after && seen.has(after))
          throw Error("Pagination interrompue. Réessayez.");
        seen.add(after);
        if (all.length > 10000)
          throw Error("Bibliothèque trop volumineuse pour cette vue.");
      } while (after);
      setReferences(all);
      setConnected(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement Saver interrompu.");
    } finally {
      inFlight.current = false;
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!connected) return;
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 30000);
    return () => {
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
  }, [connected, refresh]);
  async function write(path: string, value: unknown) {
    return fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-ad-csrf": csrf.current,
      },
      body: JSON.stringify(value),
    });
  }
  async function save(reference: Reference) {
    if (!connected || !csrf.current)
      throw Error(
        "Connectez le Saver privé avant de sauvegarder sur le serveur.",
      );
    const acknowledgement = await response<{
      reference: unknown;
      verified: boolean;
    }>(await write("/api/saver", reference));
    if (!acknowledgement.verified)
      throw Error("Sauvegarde non confirmée. Conservez le brouillon.");
    const read = await response<{ reference: unknown }>(
      await fetch("/api/saver/" + reference.id, {
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    const verified = referenceSchema.parse(read.reference);
    if (
      JSON.stringify(verified) !==
      JSON.stringify(referenceSchema.parse(reference))
    )
      throw Error(
        "La relecture serveur ne correspond pas. Votre brouillon est conservé.",
      );
    setReferences((rows) => [
      ...rows.filter((row) => row.id !== verified.id),
      verified,
    ]);
    return verified;
  }
  async function migrate(rows: Reference[]) {
    if (!connected) throw Error("Connexion propriétaire requise.");
    setBusy(true);
    setError("");
    try {
      for (let index = 0; index < rows.length; index += 20) {
        const receipt = await response<{
          results: { id: string; verified: boolean }[];
        }>(
          await write("/api/migrate", {
            references: rows.slice(index, index + 20),
          }),
        );
        if (receipt.results.some((row) => !row.verified))
          throw Error(
            "Migration partielle : un UUID existe avec un contenu différent ou sa relecture a échoué. Les copies locales sont intactes ; réessayez après vérification.",
          );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await response(await write("/api/auth/logout", {}));
    csrf.current = "";
    setConnected(false);
    setReferences([]);
  }
  async function revoke(clientId: string) {
    await response(await write("/api/scout/revoke", { clientId }));
  }
  async function client(name: string, redirects: string[]) {
    return response<{
      client_id: string;
      client_secret: string;
      authorization_endpoint: string;
      token_endpoint: string;
      resource: string;
    }>(await write("/api/scout/clients", { name, redirects }));
  }
  async function reader<T>(
    path: string,
    method = "GET",
    value?: unknown,
  ): Promise<T> {
    if (!connected)
      throw Error(
        "Connectez votre Saver privé pour enregistrer et relire les annotations serveur.",
      );
    return response<T>(
      await fetch(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-ad-csrf": csrf.current,
        },
        body: value === undefined ? undefined : JSON.stringify(value),
      }),
    );
  }
  return {
    reader,
    references,
    connected,
    available,
    busy,
    error,
    refresh,
    save,
    migrate,
    logout,
    revoke,
    client,
  };
}
export type RemoteSaver = ReturnType<typeof useRemoteSaver>;
export function RemoteSaverSettings({
  remote,
  localReferences,
  backup,
}: {
  remote: RemoteSaver;
  localReferences: Reference[];
  backup: () => void;
}) {
  const [message, setMessage] = useState(""),
    [callback, setCallback] = useState(""),
    [clientId, setClientId] = useState(""),
    [credentials, setCredentials] = useState<Awaited<
      ReturnType<RemoteSaver["client"]>
    > | null>(null);
  async function run(fn: () => Promise<void>) {
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Opération interrompue. Réessayez.",
      );
    }
  }
  return (
    <section className="private-saver-settings">
      <h3>Saver privé</h3>
      <p>
        {remote.connected
          ? "Session propriétaire active. Les nouvelles captures Saver sont sauvegardées et relues sur le serveur. Projets et signaux restent locaux."
          : remote.available
            ? "Connectez-vous avec le compte GitHub propriétaire pour accéder aux références partagées avec Grok."
            : "Service distant non configuré ou indisponible. Les données locales restent accessibles."}
      </p>
      {remote.available && !remote.connected && (
        <a className="primary" href="/api/auth/login">
          Connecter mon Saver privé
        </a>
      )}
      <button onClick={() => void remote.refresh()}>
        Réessayer la connexion / actualiser
      </button>
      {remote.connected && (
        <>
          <p>
            {remote.references.length} référence(s) serveur. Aucune donnée
            historique Sites importée.
          </p>
          <button
            onClick={() =>
              void run(async () => {
                await remote.logout();
                setCredentials(null);
                setMessage("Session fermée.");
              })
            }
          >
            Déconnecter cet appareil
          </button>
          <details>
            <summary>Migrer mes références locales sans les effacer</summary>
            <p>
              Une copie locale est exportée avant l’envoi. Les UUID sont
              conservés ; aucun enregistrement distant différent ne sera écrasé.{" "}
              {localReferences.length} référence(s) à vérifier.
            </p>
            <button
              disabled={remote.busy || !localReferences.length}
              onClick={() =>
                void run(async () => {
                  backup();
                  await remote.migrate(localReferences);
                  setMessage(
                    "Migration relue sur le serveur. Les copies locales sont conservées.",
                  );
                })
              }
            >
              {remote.busy
                ? "Migration en cours…"
                : "Exporter puis copier vers le Saver privé"}
            </button>
          </details>
          <details>
            <summary>Configurer le client Grok Scout</summary>
            <p>
              Saisissez uniquement l’URL de retour OAuth affichée par Grok et
              préalablement autorisée côté serveur.
            </p>
            <label>
              URL de retour vérifiée
              <input
                type="url"
                value={callback}
                onChange={(e) => setCallback(e.target.value)}
              />
            </label>
            <button
              disabled={!callback}
              onClick={() =>
                void run(async () =>
                  setCredentials(
                    await remote.client("A.D | Grok Scout", [callback]),
                  ),
                )
              }
            >
              Créer un client Saver dédié
            </button>
            {credentials && (
              <div>
                <p>
                  Ces identifiants sont affichés uniquement dans votre session
                  privée. Copiez-les dans Grok, puis fermez ce panneau.
                </p>
                <label>
                  Client ID
                  <input readOnly value={credentials.client_id} />
                </label>
                <label>
                  Client secret
                  <input
                    readOnly
                    type="password"
                    value={credentials.client_secret}
                  />
                </label>
                <label>
                  Endpoint MCP
                  <input readOnly value={credentials.resource} />
                </label>
                <label>
                  Autorisation
                  <input readOnly value={credentials.authorization_endpoint} />
                </label>
                <label>
                  Jeton
                  <input readOnly value={credentials.token_endpoint} />
                </label>
                <button onClick={() => setCredentials(null)}>
                  Masquer les identifiants
                </button>
              </div>
            )}
            <label>
              Client ID à révoquer
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </label>
            <button
              disabled={!clientId}
              onClick={() =>
                void run(async () => {
                  await remote.revoke(clientId);
                  setMessage(
                    "Client révoqué. Ses jetons ne peuvent plus accéder au Saver.",
                  );
                })
              }
            >
              Révoquer ce client Grok
            </button>
          </details>
        </>
      )}
      {(message || remote.error) && (
        <p role="status">{message || remote.error}</p>
      )}
    </section>
  );
}
