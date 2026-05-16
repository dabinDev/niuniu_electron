import { normalizeApiBaseUrl } from "./apiBaseUrl";

export type Fetcher = typeof fetch;
export type JsonRecord = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(options: { baseUrl?: string; fetcher?: Fetcher } = {}) {
    this.baseUrl = normalizeApiBaseUrl(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async getMap(path: string): Promise<JsonRecord> {
    const data = await this.request(path, { method: "GET" });
    return isRecord(data) ? data : {};
  }

  async getList(path: string): Promise<unknown[]> {
    const data = await this.request(path, { method: "GET" });
    return Array.isArray(data) ? data : [];
  }

  async postMap(path: string, data?: unknown, receiveTimeoutMs?: number): Promise<JsonRecord> {
    const response = await this.request(path, {
      body: JSON.stringify(data ?? {}),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: receiveTimeoutMs ? AbortSignal.timeout(receiveTimeoutMs) : undefined
    });
    return isRecord(response) ? response : {};
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetcher(this.toUrl(path), init);
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(text || response.statusText, response.status, text);
    }
    if (text.trim().length === 0) {
      return null;
    }
    return JSON.parse(text) as unknown;
  }

  private toUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
}

export const apiClient = new ApiClient();

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
