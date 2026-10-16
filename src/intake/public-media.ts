// Recovery for previously imported public CDN links, without X session access.
export async function fetchPublicMedia(value: string): Promise<Blob> {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !["pbs.twimg.com", "video.twimg.com"].includes(u.hostname) ||
    /[?&](token|auth|access_token|secret)=/i.test(u.search)
  )
    throw Error("La reprise directe est limitée aux médias publics X.");
  const r = await fetch(u.href, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("Le fichier source n’est plus accessible.");
  const mime = (r.headers.get("content-type") || "").split(";")[0];
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
    ].includes(mime)
  )
    throw Error("Type de média non pris en charge.");
  const limit = (mime === "video/mp4" ? 24 : 8) * 1024 * 1024;
  if (Number(r.headers.get("content-length")) > limit)
    throw Error("Ce fichier dépasse la limite de copie locale.");
  const reader = r.body?.getReader();
  if (!reader) throw Error("Fichier vide.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw Error("Ce fichier dépasse la limite de copie locale.");
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!size) throw Error("Fichier vide.");
  return new Blob(chunks, { type: mime });
}
