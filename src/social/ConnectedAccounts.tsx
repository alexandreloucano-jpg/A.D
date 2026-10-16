import { ChevronDown, Link2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RemoteSaver } from "../remote-saver";
import {
  CONNECTION_LABELS,
  type ConnectionState,
  type ConnectionStatus,
} from "./model";
type Social = ConnectionStatus & { importAllowed?: boolean };
const MCP_URL =
  "https://ad-saver-scout-gateway-alexandreloucano-3399.vercel.app/mcp";
function stateOf(status: Social | null): ConnectionState {
  return (
    status?.state ||
    (!status
      ? "error"
      : !status.configured
        ? "not_configured"
        : status.connected
          ? "connected"
          : "ready")
  );
}
const failure = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Vérification interrompue. Réessayez.";
export function ConnectedAccounts({
  remote,
  onCapture,
}: {
  remote: RemoteSaver;
  onCapture: () => void;
}) {
  const [accounts, setAccounts] = useState<Record<string, Social | null>>({
    x: null,
    instagram: null,
    grok: null,
  });
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const panel = useRef<HTMLDetailsElement>(null);
  const current = useRef(remote),
    sequence = useRef(0);
  current.current = remote;
  useEffect(() => {
    if (
      new URLSearchParams(location.hash.split("?")[1] || "").get(
        "connections",
      ) === "1" &&
      panel.current
    )
      panel.current.open = true;
  }, []);
  const load = useCallback(async () => {
    const run = ++sequence.current;
    if (!current.current.connected) {
      setAccounts({ x: null, instagram: null, grok: null });
      return;
    }
    const results = await Promise.allSettled([
      current.current.reader<Social>("/api/x/status"),
      current.current.reader<Social>("/api/instagram/status"),
      current.current.reader<Social>("/api/connections/grok"),
    ]);
    if (run !== sequence.current || !current.current.connected) return;
    setAccounts(
      Object.fromEntries(
        ["x", "instagram", "grok"].map((name, index) => {
          const result = results[index];
          return [
            name,
            result.status === "fulfilled"
              ? result.value
              : {
                  configured: false,
                  connected: false,
                  state: "error",
                  error: failure(result.reason),
                },
          ];
        }),
      ),
    );
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      sequence.current++;
    };
  }, [remote.connected, load]);
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
        if (url.origin !== allowed)
          throw Error(
            "Connexion refusée. Actualisez les connexions puis réessayez.",
          );
        location.assign(url.href);
      } else {
        setMessage(
          result.revoked
            ? "Compte déconnecté. Vos références sont conservées."
            : "Compte déconnecté dans Saver. La révocation auprès du service n’a pas été confirmée ; retirez aussi l’accès dans ce service.",
        );
        await load();
      }
    } catch (e) {
      setMessage(failure(e));
    } finally {
      setBusy("");
    }
  }
  async function importX() {
    setBusy("x");
    setMessage("");
    try {
      const result = await remote.reader<{
        verified: boolean;
        ids: string[];
        received: number;
        catchingUp: boolean;
      }>("/api/x/sync", "POST", { limit: 5 });
      if (!result.verified || result.ids.length > 5)
        throw Error(
          "La relecture n’a pas été confirmée. Vos références sont conservées.",
        );
      await remote.refresh();
      await load();
      setMessage(
        `${result.ids.length} signet(s) vérifié(s) dans Saver.${result.catchingUp ? " Vous pouvez lancer la page suivante." : ""}`,
      );
    } catch (e) {
      setMessage(failure(e));
      await load();
    } finally {
      setBusy("");
    }
  }
  async function openGrok() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setMessage(
        "Adresse copiée. Dans Grok, ajoutez A.D aux connecteurs personnalisés, collez cette adresse puis autorisez Saver. Un premier échange sera nécessaire pour confirmer la connexion.",
      );
    } catch {
      setMessage(
        "Dans Grok, utilisez cette adresse de connecteur : " + MCP_URL,
      );
    }
  }
  const x = accounts.x,
    instagram = accounts.instagram,
    grok = accounts.grok;
  function label(status: Social | null) {
    return !remote.connected
      ? "connexion A.D requise"
      : status
        ? CONNECTION_LABELS[stateOf(status)]
        : "vérification en cours";
  }
  function heading(service: string, status: Social | null) {
    return (
      <h4 aria-label={service + " · " + label(status)}>
        <span className="connection-provider">{service}</span>
        <span
          className={
            "connection-badge connection-badge--" +
            (status ? stateOf(status) : "loading")
          }
        >
          {label(status)}
        </span>
      </h4>
    );
  }
  function problem(status: Social | null) {
    if (!status || !["error", "expired"].includes(stateOf(status))) return null;
    return (
      <p role="alert">
        {status.state === "expired"
          ? "L’accès doit être renouvelé. Reconnectez ce service ; vos références sont conservées."
          : status.error && !/^[a-z_]+$/.test(status.error)
            ? status.error
            : "Le service n’a pas confirmé l’opération. Actualisez les connexions, puis réessayez."}
        {status.diagnosticId && <> Diagnostic : {status.diagnosticId}.</>}
      </p>
    );
  }
  return (
    <details className="connected-accounts" ref={panel}>
      <summary>
        <span className="connection-summary-title">
          <Link2 size={17} aria-hidden="true" />
          <span>Mes connexions</span>
        </span>
        <span className="connection-overview" aria-hidden="true">
          {(
            [
              ["X", x],
              ["Instagram", instagram],
              ["Grok", grok],
            ] as const
          ).map(([name, status]) => (
            <span
              key={String(name)}
              className={
                "connection-mini connection-mini--" +
                (remote.connected && status ? stateOf(status) : "loading")
              }
            >
              {String(name)}
            </span>
          ))}
        </span>
        <ChevronDown
          className="connection-chevron"
          size={17}
          aria-hidden="true"
        />
      </summary>
      {!remote.connected ? (
        <p>
          <a className="primary" href="/api/auth/google/login">
            Se connecter avec Google
          </a>
        </p>
      ) : (
        <div className="connection-account-line">
          <p>
            <span className="connection-owner-status">Compte A.D connecté</span>
            <span>Chaque service conserve son autorisation distincte.</span>
          </p>
          <button disabled={!!busy} onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden="true" />
            Actualiser les connexions
          </button>
        </div>
      )}
      <div className="connection-grid">
        <section aria-label="Connexion X">
          {heading("X", x)}
          <p>
            Import volontaire de cinq signets maximum à la fois. Aucune
            synchronisation automatique.
          </p>
          {problem(x)}
          {remote.connected && x && stateOf(x) === "not_configured" && (
            <p>
              La connexion X n’est pas encore disponible : l’accès développeur
              et les crédits API du service restent à autoriser.
            </p>
          )}
          {remote.connected && x?.configured && (
            <>
              {x.connected ? (
                <>
                  <p>
                    Permissions : lecture des signets et maintien de la
                    connexion. Aucun droit de publication.
                  </p>
                  <p>
                    {x.lastSyncAt
                      ? "Dernier import vérifié : " +
                        new Date(x.lastSyncAt).toLocaleString("fr-FR")
                      : "Aucun signet importé."}
                  </p>
                  {!x.importAllowed && (
                    <p>
                      L’import est suspendu tant que les crédits API X ne sont
                      pas autorisés pour le service.
                    </p>
                  )}
                  <button
                    disabled={!!busy || !x.importAllowed}
                    onClick={() => void importX()}
                  >
                    Importer jusqu’à 5 signets
                  </button>
                </>
              ) : (
                <button disabled={!!busy} onClick={() => void action("x")}>
                  {x.hasAccount ? "Reconnecter X" : "Connecter X"}
                </button>
              )}
              {(x.hasAccount || x.connected) && (
                <button
                  disabled={!!busy}
                  onClick={() => void action("x", true)}
                >
                  Déconnecter X
                </button>
              )}
            </>
          )}
        </section>
        <section aria-label="Connexion Instagram">
          {heading("Instagram", instagram)}
          <p>
            L’import des publications enregistrées n’est pas disponible sur
            Instagram. Partagez ou ajoutez un lien ou du texte dans Saver ;
            aucune connexion Instagram n’est nécessaire pour cet ajout.
          </p>
          <button onClick={onCapture}>Ajouter une publication Instagram</button>
          {problem(instagram)}
          {remote.connected &&
            instagram &&
            stateOf(instagram) === "not_configured" && (
              <p>
                La connexion professionnelle Instagram n’est pas configurée.
                L’ajout manuel reste disponible.
              </p>
            )}
          {remote.connected && instagram?.configured && (
            <>
              <p>
                Compte Creator ou Business uniquement. Permission : profil
                professionnel de base. Aucun import de favoris.
              </p>
              {!instagram.connected && (
                <button
                  disabled={!!busy}
                  onClick={() => void action("instagram")}
                >
                  {instagram.hasAccount
                    ? "Reconnecter Instagram"
                    : "Connecter Instagram"}
                </button>
              )}
              {(instagram.hasAccount || instagram.connected) && (
                <button
                  disabled={!!busy}
                  onClick={() => void action("instagram", true)}
                >
                  Déconnecter Instagram
                </button>
              )}
            </>
          )}
        </section>
        <section aria-label="Connexion Grok">
          {heading("Grok", grok)}
          <p>
            Lecture et sauvegarde dans Saver uniquement. Une proposition de Grok
            exige votre validation avant sauvegarde.
          </p>
          {problem(grok)}
          {grok?.state === "verification_required" && (
            <p>
              Autorisation reçue. Grok doit proposer une référence, attendre
              votre validation, puis la sauvegarder et la relire pour confirmer
              la connexion.
            </p>
          )}
          {remote.connected && grok?.configured && (
            <>
              {!grok.connected && (
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
              {(grok.hasAccount || grok.connected) && (
                <button
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy("grok");
                    try {
                      await remote.reader(
                        "/api/connections/grok",
                        "DELETE",
                        {},
                      );
                      await load();
                      setMessage(
                        "Grok déconnecté. Vos références sont conservées.",
                      );
                    } catch (e) {
                      setMessage(failure(e));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  Déconnecter Grok
                </button>
              )}
            </>
          )}
        </section>
      </div>
      {message && (
        <p className="connection-feedback" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
