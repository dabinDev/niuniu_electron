import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ExportActions } from "./ExportActions";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async (_node: HTMLElement, options: Record<string, unknown>) => {
    if (typeof options.filter !== "function") {
      throw new Error("missing export filter");
    }
    return "data:image/png;base64,exported";
  })
}));

describe("ExportActions", () => {
  it("captures images with export styling and hides toolbar controls from the image", async () => {
    const copyImageDataUrl = vi.fn(async () => ({ message: "图片已复制到剪贴板", success: true }));
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: { copyImageDataUrl }
    });
    const targetRef = createRef<HTMLElement>();

    render(
      <>
        <section data-theme="dark" ref={targetRef}>
          <div className="export-actions">工具栏</div>
          <h1>牛牛节点</h1>
        </section>
        <ExportActions payload={{ ok: true }} targetRef={targetRef} title="牛牛节点" />
      </>
    );

    await userEvent.click(screen.getByRole("button", { name: /复制图片/ }));

    await waitFor(() => expect(copyImageDataUrl).toHaveBeenCalledWith("data:image/png;base64,exported"));
    expect(targetRef.current).not.toHaveClass("export-capture");
    expect(screen.getByText("图片已复制到剪贴板")).toBeInTheDocument();
  });
});
