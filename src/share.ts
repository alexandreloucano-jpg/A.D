import { safeUrl } from "./domain";
export type SharedCapture = {
  url: string;
  title: string;
  content: string;
  shared: true;
};
export function parseSharedCapture(hash: string): SharedCapture | null {
  const query = new URLSearchParams(hash.split("?")[1] || "");
  if (query.get("share") !== "1") return null;
  const content = query.get("text") || "",
    title = query.get("title") || "",
    explicit = query.get("url") || "";
  if (content.length > 10000 || title.length > 200 || explicit.length > 4096)
    throw Error(
      "Le partage dépasse la taille autorisée. Copiez un lien ou un extrait plus court.",
    );
  const extracted = content
    .match(/https?:\/\/[^\s<>]+/)?.[0]
    ?.replace(/[),.;!?]+$/, "");
  const url = explicit || extracted || "";
  if (url && !safeUrl.safeParse(url).success)
    throw Error("Le partage doit utiliser un lien HTTP(S) sans identifiants.");
  if (!url && !content.trim() && !title.trim())
    throw Error("Ce partage ne contient ni lien ni texte.");
  return { url, title, content, shared: true };
}
