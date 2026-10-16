import { it, expect, vi } from "vitest";
import { Writable } from "node:stream";
const state = vi.hoisted(() => ({ response: null as Response | null }));
vi.mock("../server/service.js", () => ({ handle: async () => state.response }));
vi.mock("../server/store.js", async (original) => ({
  ...(await original<any>()),
  database: () => ({}),
}));
vi.mock("../server/security.js", () => ({
  configuration: () => ({ role: "app", app: "https://app.example" }),
}));
import handler from "../api/index";
it("streams a video larger than the buffered Vercel response limit with backpressure", async () => {
  let sent = 0,
    written = 0;
  const chunk = new Uint8Array(64 * 1024).fill(23);
  state.response = new Response(
    new ReadableStream({
      pull(controller) {
        if (sent++ < 96) controller.enqueue(chunk);
        else controller.close();
      },
    }),
    { headers: { "content-type": "video/mp4" } },
  );
  const res = new Writable({
    highWaterMark: 1024,
    write(buffer, _encoding, callback) {
      written += buffer.length;
      setImmediate(callback);
    },
  }) as Writable & { setHeader: ReturnType<typeof vi.fn>; statusCode: number };
  res.setHeader = vi.fn();
  await handler(
    {
      url: "/api/media/" + "a".repeat(64),
      headers: { host: "app.example" },
      method: "GET",
    } as any,
    res as any,
  );
  expect(res.statusCode).toBe(200);
  expect(written).toBe(6 * 1024 * 1024);
  expect(res.setHeader).toHaveBeenCalledWith("content-type", "video/mp4");
});
