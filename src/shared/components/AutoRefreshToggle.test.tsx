import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutoRefreshToggle } from "./AutoRefreshToggle";

describe("AutoRefreshToggle", () => {
  it("renders the paused state and toggles refresh on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<AutoRefreshToggle enabled={false} intervalLabel="5秒" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /自动刷新 已暂停/ })).toHaveClass("is-paused");

    await user.click(screen.getByRole("button", { name: /自动刷新 已暂停/ }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders the active interval state", () => {
    render(<AutoRefreshToggle enabled intervalLabel="5秒" onChange={() => undefined} />);

    expect(screen.getByRole("button", { name: /自动刷新 5秒/ })).toHaveClass("is-live");
  });
});
