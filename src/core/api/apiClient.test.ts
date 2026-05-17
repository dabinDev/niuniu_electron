import { describe, expect, it, vi } from "vitest";
import { normalizeApiBaseUrl } from "./apiBaseUrl";
import { ApiClient } from "./apiClient";

describe("normalizeApiBaseUrl", () => {
  it("uses the default local API when input is empty", () => {
    expect(normalizeApiBaseUrl("")).toBe("http://127.0.0.1:18081");
    expect(normalizeApiBaseUrl(undefined)).toBe("http://127.0.0.1:18081");
  });

  it("trims user supplied API URLs and removes trailing slashes", () => {
    expect(normalizeApiBaseUrl("  http://localhost:19000///  ")).toBe("http://localhost:19000");
  });
});

describe("ApiClient", () => {
  it("fetches maps from the configured base URL", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new ApiClient({ baseUrl: "http://127.0.0.1:18081", fetcher: fetchMock });

    await expect(client.getMap("/api/v1/overview")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18081/api/v1/overview",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("adds signed access headers to api requests when activation is available", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new ApiClient({
      accessProvider: () => ({
        accessId: "invite_123",
        accessMode: "invite",
        activatedAt: "2026-05-17T02:00:00+00:00",
        activationSecret: "secret",
        machineCode: "NN-MACHINE",
        machineCodeVersion: "win-v1"
      }),
      baseUrl: "http://127.0.0.1:18081",
      fetcher: fetchMock,
      nonceFactory: () => "nonce-1",
      timestampFactory: () => "2026-05-17T02:00:00+00:00"
    });

    await client.postMap("/api/v1/ask-ai/generate", { source: "ask_ai" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18081/api/v1/ask-ai/generate",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-NN-Access-Id": "invite_123",
          "X-NN-Machine-Code": "NN-MACHINE",
          "X-NN-Nonce": "nonce-1",
          "X-NN-Signature": expect.stringMatching(/^[a-f0-9]{64}$/)
        }),
        method: "POST"
      })
    );
  });
});
