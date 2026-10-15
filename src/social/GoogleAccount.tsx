import { useEffect, useState } from "react";
import type { RemoteSaver } from "../remote-saver";
type Status = {
  configured: boolean;
  linked: boolean;
  canLink: boolean;
  authMethod?: string;
  lastRead?: {
    verified: boolean;
    checkedAt: string;
    referenceCount: number;
    sampleUuid: string | null;
  };
};
export function GoogleAccount({
  remote,
  loginOnly = false,
}: {
  remote: RemoteSaver;
  loginOnly?: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/auth/google/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      setStatus(await r.json());
    } catch {
      setError("État de connexion Google indisponible.");
    }
  }
  useEffect(() => {
    void load();
  }, [remote.connected]);
  async function action(path: string) {
    setBusy(true);
    setError("");
    try {
      const result = await remote.reader<{ url?: string }>(path, "POST", {});
      if (result.url) {
        const url = new URL(result.url);
        if (
          url.origin !== "https://accounts.google.com" ||
          url.pathname !== "/o/oauth2/v2/auth"
        )
          throw Error("Adresse Google refusée.");
        location.assign(url.href);
      } else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion non confirmée.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Compte Google">
      {!loginOnly && (
        <h4>Google · {status?.linked ? "lié au propriétaire" : "non lié"}</h4>
      )}
      {!status && !error && <p>Vérification de la configuration Google…</p>}
      {status && !status.configured && (
        <p>
          Google non configuré. GitHub reste disponible pour la connexion
          propriétaire.
        </p>
      )}
      {!remote.connected && status && !status.configured && (
        <button disabled>Continuer avec Google</button>
      )}
      {!remote.connected && status?.configured && (
        <>
          <a className="primary" href="/api/auth/google/login">
            Continuer avec Google
          </a>
          <p>
            Avant la première connexion Google, connectez-vous avec GitHub et
            liez votre compte Google dans Saver.
          </p>
        </>
      )}
      {remote.connected && !loginOnly && (
        <>
          <p>
            Permissions : identité OpenID uniquement. Aucun accès à Gmail, Drive
            ou aux contacts. Aucun import de bibliothèque.
          </p>
          {status?.authMethod === "google" && status.lastRead?.verified && (
            <p role="status">
              Connecté via Google · lecture Saver vérifiée :{" "}
              {status.lastRead.referenceCount} référence(s), le{" "}
              {new Date(status.lastRead.checkedAt).toLocaleString("fr-FR")}.
            </p>
          )}
          {!status?.linked && (
            <button
              disabled={busy || !status?.configured || !status.canLink}
              onClick={() => void action("/api/auth/google/link")}
            >
              Lier Google à mon propriétaire GitHub
            </button>
          )}
          {status?.linked && (
            <button
              disabled={busy || !status.canLink}
              onClick={() => {
                if (
                  confirm(
                    "Délier Google et fermer ses sessions ? Vos références seront conservées.",
                  )
                )
                  void action("/api/auth/google/unlink");
              }}
            >
              Délier Google et révoquer ses sessions
            </button>
          )}
          {status && !status.canLink && (
            <p>Reconnectez-vous avec GitHub pour modifier la liaison Google.</p>
          )}
        </>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Réessayer Google</button>
        </p>
      )}
    </section>
  );
}
