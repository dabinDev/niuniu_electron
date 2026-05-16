import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dev server contract", () => {
  it("keeps the design preview pinned to http://127.0.0.1:5173", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
    const viteConfig = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfig).toContain("host: \"127.0.0.1\"");
    expect(viteConfig).toContain("port: 5173");
    expect(viteConfig).toContain("strictPort: true");
    expect(packageJson.scripts.dev).toContain("--host 127.0.0.1");
    expect(packageJson.scripts.dev).toContain("--port 5173");
    expect(packageJson.scripts.dev).toContain("--strictPort");
    expect(packageJson.scripts.preview).toContain("--host 127.0.0.1");
    expect(packageJson.scripts.preview).toContain("--port 5173");
    expect(packageJson.scripts.preview).toContain("--strictPort");
  });

  it("ships a Flutter service worker cleanup file for production cutover", () => {
    const cleanupWorker = readFileSync(resolve(process.cwd(), "public/flutter_service_worker.js"), "utf8");

    expect(cleanupWorker).toContain("self.registration.unregister()");
    expect(cleanupWorker).toContain("caches.delete");
  });
});
