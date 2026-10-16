import { normalizeIntake, uniqueIntake, type IntakeItem } from "./model";
function csv(raw: string): string[][] {
  const first = raw.split(/\r?\n/, 1)[0];
  const delimiter = ["\t", ";", ","].sort(
    (a, b) => first.split(b).length - first.split(a).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else field += c;
    } else if (c === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
    if (rows.length > 2001 || field.length > 200000)
      throw Error("Fichier trop volumineux.");
  }
  if (quoted)
    throw Error(
      "CSV incomplet : une cellule entre guillemets n’est pas fermée.",
    );
  row.push(field);
  if (row.some((s) => s.trim())) rows.push(row);
  return rows;
}
const key = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function mapped(value: unknown): IntakeItem {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Référence invalide dans le fichier.");
  const record = value as Record<string, unknown>,
    data =
      record.tweet && typeof record.tweet === "object"
        ? (record.tweet as Record<string, unknown>)
        : record;
  const columns = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [key(k), v]),
  );
  const find = (aliases: string[]) =>
    aliases
      .map((k) => columns[k])
      .find((v) => v !== undefined && v !== null && v !== "");
  const str = (v: unknown) =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  const sourceId = str(find(["tweetid", "postid", "idstr"]));
  const url = str(
    find([
      "url",
      "link",
      "lien",
      "tweeturl",
      "posturl",
      "sourceurl",
      "statusurl",
    ]),
  );
  const rawTags = find([
    "tags",
    "folders",
    "folder",
    "collections",
    "categories",
  ]);
  const tags = (
    Array.isArray(rawTags)
      ? rawTags
      : typeof rawTags === "string"
        ? rawTags.split(/[;,|]/)
        : []
  )
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  const rawMedia = Array.isArray(data.media)
    ? (data.media as Record<string, unknown>[])
    : [];
  const rawVideos = find(["videos"]);
  const videos = Array.isArray(rawVideos)
    ? rawVideos.filter((v): v is string => typeof v === "string")
    : rawMedia
        .filter((m) => ["video", "animated_gif"].includes(String(m.type)))
        .flatMap((m) => {
          const variants = Array.isArray(m.variants)
            ? (m.variants as {
                url?: string;
                content_type?: string;
                bitrate?: number;
              }[])
            : [];
          const mp4 = variants
            .filter(
              (v) =>
                v.content_type === "video/mp4" && typeof v.url === "string",
            )
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
          return mp4.length
            ? [mp4.find((v) => (v.bitrate || 0) >= 256000)?.url || mp4[0].url!]
            : [];
        });
  const images =
    find(["images", "mediaurls", "imageurl", "mediaurl"]) ||
    rawMedia
      .map((m) => (m.type === "photo" ? m.url : m.thumbnail_url))
      .filter((v) => typeof v === "string");
  const imageList = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? images.split(/[\s|]+/)
      : [];
  const published = str(
    find(["publishedat", "tweetcreatedat", "postpublishedat"]),
  );
  const sourceDate = str(
    find(["createdat", "date", "savedat", "bookmarkedat"]),
  );
  const rawNotes = find(["notes", "note", "annotation"]);
  const notes = (
    Array.isArray(rawNotes)
      ? rawNotes
      : typeof rawNotes === "string"
        ? [rawNotes]
        : []
  ).filter((n): n is string => typeof n === "string" && !!n.trim());
  return normalizeIntake({
    title: str(find(["title", "titre", "name"])),
    videos: videos.slice(0, 4),
    ...(data.author &&
    typeof data.author === "object" &&
    typeof (data.author as Record<string, unknown>).screen_name === "string"
      ? {
          author: String(
            (data.author as Record<string, unknown>).screen_name,
          ).slice(0, 200),
        }
      : {}),
    originalText: str(
      find(["originaltext", "fulltext", "text", "content"]),
    ).slice(0, 200000),
    text: str(
      find([
        "fulltext",
        "tweettext",
        "posttext",
        "text",
        "content",
        "description",
        "tweet",
      ]),
    ).slice(0, 10000),
    url:
      url ||
      (/^\d+$/.test(sourceId) ? "https://x.com/i/web/status/" + sourceId : ""),
    tags,
    notes,
    images: imageList
      .filter((s): s is string => typeof s === "string")
      .slice(0, 8),
    ...(published ? { publishedAt: new Date(published).toISOString() } : {}),
    ...(sourceDate ? { sourceDate: sourceDate.slice(0, 100) } : {}),
  });
}
export function parseBookmarkFile(
  raw: string,
  name: string,
): ReturnType<typeof uniqueIntake> {
  if (raw.length > 12_000_000) throw Error("Fichier limité à 12 Mo.");
  raw = raw.replace(/^\uFEFF/, "").trim();
  if (!raw) throw Error("Ce fichier est vide.");
  let values: unknown[];
  if (/\.json$/i.test(name) || /^[\[{]/.test(raw)) {
    const data = JSON.parse(raw);
    if (
      data?.version === 1 &&
      Array.isArray(data.projects) &&
      Array.isArray(data.tasks)
    )
      throw Error(
        "Ce fichier est une sauvegarde A.D. Utilisez Sauvegarde et restauration pour conserver ses UUID et projets.",
      );
    const list = Array.isArray(data)
      ? data
      : ["bookmarks", "references", "tweets", "data", "items"]
          .map((k) => data?.[k])
          .find(Array.isArray);
    if (!Array.isArray(list))
      throw Error(
        "JSON attendu : une liste de références ou une propriété bookmarks, tweets, items ou data.",
      );
    values = list;
  } else if (/\.html?$/i.test(name) || /^<!DOCTYPE|^<html|^<DL/i.test(raw)) {
    const template = document.createElement("template");
    template.innerHTML = raw;
    values = [...template.content.querySelectorAll("a[href]")].map((a) => ({
      url: a.getAttribute("href"),
      title: a.textContent || "",
    }));
  } else {
    const rows = csv(raw);
    if (rows.length < 2)
      throw Error(
        "CSV attendu : une ligne de colonnes et au moins une publication.",
      );
    const headers = rows.shift()!;
    if (new Set(headers.map(key)).size !== headers.length)
      throw Error("Colonnes CSV dupliquées.");
    values = rows.map((cells) =>
      Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""])),
    );
  }
  if (values.length > 2000) throw Error("Import limité à 2 000 références.");
  const items: IntakeItem[] = [],
    errors: string[] = [];
  values.forEach((v, i) => {
    try {
      items.push(mapped(v));
    } catch {
      errors.push("Ligne " + (i + 1) + " : lien ou contenu non reconnu.");
    }
  });
  if (errors.length)
    throw Error(
      errors.slice(0, 3).join(" ") +
        " Corrigez le fichier avant de l’importer : aucune ligne n’a été enregistrée.",
    );
  if (!items.length) throw Error("Aucune référence trouvée.");
  return uniqueIntake(items);
}
