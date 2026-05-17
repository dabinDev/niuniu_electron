import { describe, expect, it } from "vitest";
import { signApiRequest } from "./requestSigning";

describe("signApiRequest", () => {
  it("creates the signed access headers expected by api_server", async () => {
    const headers = await signApiRequest({
      accessId: "trial_123",
      activationSecret: "secret",
      body: new TextEncoder().encode('{"source":"ask_ai"}'),
      machineCode: "NN-MACHINE",
      method: "POST",
      nonce: "nonce-1",
      pathWithQuery: "/api/v1/ask-ai/generate",
      timestamp: "2026-05-17T02:00:00+00:00"
    });

    expect(headers).toEqual({
      "X-NN-Access-Id": "trial_123",
      "X-NN-Machine-Code": "NN-MACHINE",
      "X-NN-Timestamp": "2026-05-17T02:00:00+00:00",
      "X-NN-Nonce": "nonce-1",
      "X-NN-Signature": "f31c3c4dbf38516d5fa249092fac7e828fff46293800e81ae7db4b15ffbf4e7d"
    });
  });
});
