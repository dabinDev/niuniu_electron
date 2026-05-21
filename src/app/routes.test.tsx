import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { usePreferencesStore } from "./preferencesStore";
import { RequireAdminTools } from "./routes";

describe("RequireAdminTools", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      accessActivation: {
        accessId: "user_access",
        accessMode: "invite",
        accessRole: "user",
        activatedAt: "2026-05-21T09:00:00Z",
        activationSecret: "secret",
        machineCode: "NN-USER",
        machineCodeVersion: "win-v1"
      }
    });
  });

  it("redirects non-admin activations away from the task center route", () => {
    renderWithRouter(<RequireAdminTools><div>任务中心内容</div></RequireAdminTools>);

    expect(screen.queryByText("任务中心内容")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/overview");
  });

  it("renders task center content for admin activations", () => {
    usePreferencesStore.setState({
      accessActivation: {
        accessId: "admin_access",
        accessMode: "invite",
        accessRole: "admin",
        activatedAt: "2026-05-21T09:00:00Z",
        activationSecret: "secret",
        machineCode: "NN-ADMIN",
        machineCodeVersion: "win-v1"
      }
    });

    renderWithRouter(<RequireAdminTools><div>任务中心内容</div></RequireAdminTools>);

    expect(screen.getByText("任务中心内容")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/jobs");
  });
});

function renderWithRouter(children: ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/jobs"]}>
      <Routes>
        <Route path="/overview" element={<LocationEcho />} />
        <Route path="/jobs" element={<>{children}<LocationEcho /></>} />
      </Routes>
    </MemoryRouter>
  );
}

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}
