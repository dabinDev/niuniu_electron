import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { JobsPage } from "./JobsPage";

const jobsPage = {
  generated_at: "2026-05-14 15:10:00",
  summary: {
    enabled_jobs: 1,
    failed_jobs: 0,
    healthy_jobs: 1,
    total_jobs: 1
  },
  services: [
    {
      kind: "api",
      name: "接口服务",
      probe_target: "http://127.0.0.1:8000/health",
      ready: true,
      running: true
    }
  ],
  jobs: [
    {
      enabled: true,
      health: "healthy",
      job_code: "limit_review",
      last_rows_written: 42,
      last_started_at: "2026-05-14 14:59:00",
      last_status: "completed",
      name: "涨停复盘采集",
      schedule_mode: "manual",
      trigger_allowed: true
    }
  ],
  recent_runs: [
    {
      duration_ms: 1260,
      job_code: "limit_review",
      message: "写入 42 行",
      rows_written: 42,
      run_id: "run-1",
      started_at: "2026-05-14 14:59:00",
      status: "completed"
    }
  ]
};

describe("JobsPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a readable scheduler workspace and triggers an allowed job", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/internal/jobs/limit_review/trigger")) {
        return jsonResponse({ status: "queued" });
      }
      if (requestUrl.includes("/internal/jobs/page")) {
        return jsonResponse(jobsPage);
      }
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("服务状态")).toBeInTheDocument();
    const workspace = screen.getByLabelText("任务调度控制台");
    expect(workspace).toHaveClass("jobs-control-deck");
    expect(screen.getByText("服务监控")).toBeInTheDocument();
    expect(screen.getByText("任务调度")).toBeInTheDocument();
    expect(screen.getByText("运行记录")).toBeInTheDocument();
    expect(screen.queryByText("Service Monitor")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheduler")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Runs")).not.toBeInTheDocument();
    expect(screen.getByText("接口服务")).toBeInTheDocument();
    const serviceItem = screen.getByText("接口服务").closest(".job-service-item");
    expect(serviceItem).toBeTruthy();
    if (!serviceItem) throw new Error("service item missing");
    expect(within(serviceItem as HTMLElement).getByText("接口")).toBeInTheDocument();
    expect(within(serviceItem as HTMLElement).getByText("http://127.0.0.1:8000/health")).toBeInTheDocument();
    expect(screen.getAllByText(/手动触发/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/manual/)).not.toBeInTheDocument();
    expect(screen.getByText("涨停复盘采集")).toBeInTheDocument();
    expect(screen.getByText("上次状态：完成")).toBeInTheDocument();
    expect(container.querySelector(".job-service-item.is-ok")).toBeTruthy();
    expect(container.querySelector(".task-item.is-ok .task-meta-grid")).toBeTruthy();
    expect(container.querySelector(".task-item .task-trigger-cell")).toBeTruthy();
    expect(container.querySelector(".jobs-runs-toolbar")).toHaveTextContent("最近 1 条");
    const taskCount = screen.getByText("写入").closest(".task-count");
    expect(taskCount).toBeTruthy();
    if (!taskCount) throw new Error("task count missing");
    expect(within(taskCount as HTMLElement).getByText("42")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "触发" }));

    await waitFor(() => expect(screen.getByText("limit_review 已触发")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/internal/jobs/limit_review/trigger"),
      expect.objectContaining({ method: "POST" })
    );
  }, 15000);
});

function renderWithClient(fetchMock: typeof fetch) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  return render(
    <QueryClientProvider client={client}>
      <JobsPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
