import { it, expect } from "vitest";
import {
  publicAddress,
  sourceUrl,
  fetchSource,
  extractContent,
} from "../server/extraction";
it("blocks loopback, metadata, private, link-local, mapped IPv6 and unsafe URL forms", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.2",
    "100.64.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
  ])
    expect(publicAddress(address), address).toBe(false);
  expect(publicAddress("1.1.1.1")).toBe(true);
  for (const url of [
    "http://example.org",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]/",
    "https://example.org:8443",
    "https://user:password@example.org",
    "file:///etc/passwd",
  ])
    expect(() => sourceUrl(url), url).toThrow();
});
it("rejects DNS results containing ANY private address before making a request", async () => {
  const resolver = async () => [
    { address: "1.1.1.1", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ];
  await expect(
    fetchSource("https://example.org", resolver as any),
  ).rejects.toMatchObject({ code: "source_private_address_rejected" });
});
it("extracts actual article text in an inert document and keeps the declared publication date", async () => {
  const html =
    '<html><head><meta property="article:published_time" content="2020-01-02T00:00:00Z"></head><body><article><h1>Fixture</h1><p>' +
    "Actual article text, with exact words and a source. ".repeat(25) +
    '</p><script>throw Error("must never run")</script></article></body></html>';
  const article = await extractContent(
    Buffer.from(html),
    "text/html",
    "https://example.org",
  );
  expect(article.text).toContain("Actual article text");
  expect(article.text).not.toContain("must never run");
  expect(article.publishedAt).toBe("2020-01-02T00:00:00.000Z");
});
it("reads a genuine PDF text layer without inventing content", async () => {
  const stream = "BT /F1 12 Tf 72 720 Td (Saver exact PDF fixture.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(pdf);
  pdf +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const result = await extractContent(
    Buffer.from(pdf),
    "application/pdf",
    "https://example.org/file.pdf",
  );
  expect(result.kind).toBe("pdf");
  expect(result.text).toContain("Saver exact PDF fixture.");
  expect(result.pages).toBe(1);
}, 20000);
it("rejects invalid PDFs and empty text rather than synthesizing an article", async () => {
  await expect(
    extractContent(
      Buffer.from("not a pdf"),
      "application/pdf",
      "https://example.org",
    ),
  ).rejects.toMatchObject({ code: "source_pdf_invalid" });
  await expect(
    extractContent(Buffer.from("   "), "text/plain", "https://example.org"),
  ).rejects.toMatchObject({ code: "source_empty" });
});
