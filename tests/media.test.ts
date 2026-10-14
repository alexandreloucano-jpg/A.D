import { expect, it } from "vitest";
import { directImageUrl } from "../src/media";
it("previews only actual direct image URLs, preserving query strings", () => {
  for (const extension of [
    "png",
    "jpg",
    "jpeg",
    "svg",
    "webp",
    "gif",
    "avif",
  ]) {
    const url = `https://example.org/photo.${extension}?size=800`;
    expect(directImageUrl(url)).toBe(url);
  }
});
it("never guesses thumbnails, executable URLs, credentials or image-looking queries", () => {
  for (const url of [
    undefined,
    "not a url",
    "https://example.org/article",
    "https://example.org/post?image=photo.png",
    "javascript:alert(1)",
    "file:///image.jpg",
    "https://user:secret@example.org/image.jpg",
  ])
    expect(directImageUrl(url)).toBeNull();
});
