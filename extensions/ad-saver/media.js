// Public X CDN only. Never forward session cookies or captured X headers.
export function allowedMedia(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["pbs.twimg.com", "video.twimg.com"].includes(u.hostname) &&
      !/[?&](token|auth|access_token|secret)=/i.test(u.search)
    );
  } catch {
    return false;
  }
}
export async function fetchMedia(url) {
  if (!allowedMedia(url)) throw Error("Média hors des domaines X autorisés.");
  const r = await fetch(url, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw Error("Le média source est indisponible.");
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
  const limit = mime === "video/mp4" ? 24 * 1024 * 1024 : 8 * 1024 * 1024;
  if (Number(r.headers.get("content-length")) > limit)
    throw Error("Média trop volumineux pour ce transfert local.");
  const reader = r.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw Error("Média trop volumineux pour ce transfert local.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!size) throw Error("Fichier média vide.");
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  let binary = "";
  for (let i = 0; i < all.length; i += 16384)
    binary += String.fromCharCode(...all.subarray(i, i + 16384));
  return { mime, base64: btoa(binary) };
}
