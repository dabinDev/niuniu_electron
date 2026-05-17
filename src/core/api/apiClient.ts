import { normalizeApiBaseUrl } from "./apiBaseUrl";
import { bodyToBytes, signApiRequest, type AccessCredential } from "../access/requestSigning";

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
  private readonly accessProvider?: () => AccessCredential | null | undefined;
  private readonly nonceFactory: () => string;
  private readonly timestampFactory: () => string;

  constructor(options: {
    accessProvider?: () => AccessCredential | null | undefined;
    baseUrl?: string;
    fetcher?: Fetcher;
    nonceFactory?: () => string;
    timestampFactory?: () => string;
  } = {}) {
    this.baseUrl = normalizeApiBaseUrl(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.accessProvider = options.accessProvider;
    this.nonceFactory = options.nonceFactory ?? (() => crypto.randomUUID());
    this.timestampFactory = options.timestampFactory ?? (() => new Date().toISOString());
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
    const signedInit = await this.withAccessHeaders(path, init);
    const response = await this.fetcher(this.toUrl(path), signedInit);
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

  private async withAccessHeaders(path: string, init: RequestInit): Promise<RequestInit> {
    const credential = this.accessProvider?.();
    if (!credential || !this.requiresAccess(path)) {
      return init;
    }
    const headers = await signApiRequest({
      accessId: credential.accessId,
      activationSecret: credential.activationSecret,
      body: bodyToBytes(init.body),
      machineCode: credential.machineCode,
      method: init.method ?? "GET",
      nonce: this.nonceFactory(),
      pathWithQuery: this.pathWithQuery(path),
      timestamp: this.timestampFactory()
    });
    return {
      ...init,
      headers: {
        ...headers,
        ...(init.headers as Record<string, string> | undefined)
      }
    };
  }

  private requiresAccess(path: string): boolean {
    const pathname = this.pathWithQuery(path).split("?", 1)[0];
    return pathname.startsWith("/api/v1/") && pathname !== "/api/v1/access/activate";
  }

  private pathWithQuery(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path);
      return `${url.pathname}${url.search}`;
    }
    return path.startsWith("/") ? path : `/${path}`;
  }
}

export const apiClient = new ApiClient();

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
