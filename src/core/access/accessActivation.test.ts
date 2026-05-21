import { describe, expect, it, vi } from "vitest";
import { activateAccess, applyTrialAccess } from "./accessActivation";

describe("access activation role normalization", () => {
  it("stores admin access_role from invitation activation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      access_id: "admin_access",
      access_role: "admin",
      access_type: "invite",
      activated_at: "2026-05-21T00:00:00Z",
      activation_secret: "secret",
      machine_code: "NN-ADMIN",
      machine_code_version: "win-v1"
    })));

    await expect(activateAccess({
      accessCode: "admin-code",
      apiBaseUrl: "http://api.test",
      machine: { machineCode: "NN-ADMIN", version: "win-v1" },
      mode: "invite"
    })).resolves.toMatchObject({
      accessId: "admin_access",
      accessMode: "invite",
      accessRole: "admin"
    });
  });

  it("defaults missing or unknown trial roles to user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      access_id: "trial_access",
      access_role: "guest",
      access_type: "trial",
      activated_at: "2026-05-21T00:00:00Z",
      activation_secret: "secret",
      machine_code: "NN-TRIAL",
      machine_code_version: "win-v1"
    })));

    await expect(applyTrialAccess({
      apiBaseUrl: "http://api.test",
      machine: { machineCode: "NN-TRIAL", version: "win-v1" }
    })).resolves.toMatchObject({
      accessId: "trial_access",
      accessMode: "trial",
      accessRole: "user"
    });
  });
});

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200 });
}
