import { mkdir, writeFile } from "node:fs/promises";
await mkdir("gateway-dist", { recursive: true });
await writeFile(
  "gateway-dist/service.txt",
  "Dedicated A.D Saver MCP service. Requests are authorized by the API.\n",
);
