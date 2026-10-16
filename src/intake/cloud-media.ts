import type { RemoteSaver } from "../remote-saver";
import { ensureLocalAsset, readLocalCopies } from "./local-archive";
export interface CloudMedia {
  sourceUrl: string;
  sha256: string;
  mime: string;
  size: number;
  verified: boolean;
  url: string | null;
}
export async function syncCloudMedia(
  ids: string[],
  remote: RemoteSaver,
  progress: (text: string) => void,
) {
  const copies = (await readLocalCopies(ids)).filter((c) => !!c);
  const total = copies.reduce((n, c) => n + c.media.length, 0);
  if (!total) return { saved: 0, failed: 0, total: 0 };
  const status = await remote.reader<{ configured: boolean }>(
    "/api/media/status",
  );
  if (!status.configured)
    throw Error(
      "Stockage privé des fichiers indisponible. Les copies locales restent intactes.",
    );
  let saved = 0,
    failed = 0;
  for (const copy of copies) {
    const previous = await remote.reader<{ items: CloudMedia[] }>(
      "/api/media/reference/" + copy.id,
    );
    for (const media of copy.media) {
      try {
        if (
          previous.items.some((m) => m.sourceUrl === media.url && m.verified)
        ) {
          saved++;
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 550));
        const local = await ensureLocalAsset(copy.id, media.url);
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await local.blob.arrayBuffer(),
            ),
          ),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        const asset = await remote.reader<{
          pathname: string;
          verified: boolean;
        }>("/api/media/prepare", "POST", {
          referenceId: copy.id,
          sourceUrl: media.url,
          sha256: hash,
          size: local.blob.size,
          mime: local.blob.type,
        });
        if (!asset.verified) {
          const session = await fetch("/api/session", {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!session.ok)
            throw Error("Session expirée. Reconnectez-vous puis reprenez.");
          const auth = await session.json();
          try {
            const { upload } = await import("@vercel/blob/client");
            await upload(asset.pathname, local.blob, {
              access: "private",
              handleUploadUrl: "/api/media/upload",
              clientPayload: JSON.stringify({ sha256: hash }),
              contentType: local.blob.type,
              headers: { "x-ad-csrf": auth.csrf },
              multipart: false,
            });
          } catch {
            // A previous attempt may already have written the immutable object; confirmation is authoritative.
          }
        }
        const receipt = await remote.reader<{
          sha256: string;
          bytes: number;
          verified: boolean;
        }>("/api/media/" + hash + "/confirm", "POST", {});
        if (
          !receipt.verified ||
          receipt.sha256 !== hash ||
          receipt.bytes !== local.blob.size
        )
          throw Error("Fichier non confirmé.");
        saved++;
      } catch (e) {
        failed++;
        const message =
          e instanceof Error ? e.message : "Copie du fichier interrompue.";
        if (
          /media_free_storage_full|media-files|rate_limited|quota|Session expirée|stockage gratuit/i.test(
            message,
          )
        )
          throw Error(
            "Copie interrompue par la limite du stockage gratuit ou de transfert. Les fichiers locaux restent conservés ; reprise disponible.",
          );
      } finally {
        progress(
          `Fichiers privés vérifiés : ${saved}/${total} · ${failed} non confirmé(s)`,
        );
      }
    }
  }
  if (failed)
    throw Error(
      `${saved}/${total} fichiers sauvegardés en privé ; ${failed} non récupéré(s). Les originaux restent conservés. Relancez pour reprendre.`,
    );
  return { saved, failed, total };
}
