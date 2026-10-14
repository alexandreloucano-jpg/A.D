/** A preview is possible only when the saved URL itself identifies image media.
 * Never guess thumbnails or scrape third-party pages. The record stays unchanged.
 */
export function directImageUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)
      ? value
      : null;
  } catch {
    return null;
  }
}
