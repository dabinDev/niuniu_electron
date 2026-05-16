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
});
