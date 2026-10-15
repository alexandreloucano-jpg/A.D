import type { RemoteSaver } from "./remote-saver";
export function AccountSettings({
  remote,
  syncError,
}: {
  remote: RemoteSaver;
  syncError: string;
}) {
  return (
    <section aria-label="Mon compte">
      <h3>Mon compte</h3>
      {remote.connected ? (
        <>
          <p>
            Vous êtes connecté. Vos références Saver sont privées et
            sauvegardées automatiquement.
          </p>
          <button onClick={() => void remote.logout()}>Se déconnecter</button>
        </>
      ) : (
        <>
          <p>Non connecté</p>
          <p>Connectez-vous pour retrouver vos références sur vos appareils.</p>
          <a className="primary" href="/api/auth/google/login">
            Se connecter avec Google
          </a>
          <details>
            <summary>Autre méthode de connexion</summary>
            <a href="/api/auth/login">Se connecter avec GitHub</a>
          </details>
        </>
      )}
      {syncError && <p role="status">{syncError}</p>}
      {remote.error && (
        <p role="status">
          La sauvegarde distante est momentanément indisponible. Vos références
          sur cet appareil sont conservées.
        </p>
      )}
    </section>
  );
}
