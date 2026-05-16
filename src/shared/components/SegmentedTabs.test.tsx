import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "./SegmentedTabs";

describe("SegmentedTabs", () => {
  it("renders count badges and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SegmentedTabs
        activeKey="hot"
        items={[
          { key: "hot", label: "热点", count: 12 },
          { key: "timeline", label: "时间线", count: 3 }
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("tablist")).toHaveClass("segmented-animated");
    expect(screen.getByRole("button", { name: /热点 12/ })).toHaveClass("on");
    expect(screen.getByRole("button", { name: /热点 12/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("12")).toHaveClass("segmented-count");

    await user.click(screen.getByRole("button", { name: /时间线 3/ }));

    expect(onChange).toHaveBeenCalledWith("timeline");
  });

  it("sets a moving indicator style for the active tab", () => {
    Object.defineProperties(HTMLElement.prototype, {
      offsetLeft: { configurable: true, get: () => 18 },
      offsetWidth: { configurable: true, get: () => 72 }
    });

    render(
      <SegmentedTabs
        activeKey="timeline"
        items={[
          { key: "hot", label: "热点", count: 12 },
          { key: "timeline", label: "时间线", count: 3 }
        ]}
        onChange={() => undefined}
      />
    );

    expect(screen.getByRole("tablist")).toHaveStyle({
      "--tab-indicator-width": "72px",
      "--tab-indicator-x": "18px"
    });
  });
});
