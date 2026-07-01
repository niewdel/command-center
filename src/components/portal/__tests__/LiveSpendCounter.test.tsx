// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LiveSpendCounter } from "../LiveSpendCounter";
import { buildReportData, emptyReportData } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("LiveSpendCounter", () => {
  it("counts up to the target spend on mount", async () => {
    render(<LiveSpendCounter ads={buildReportData().ads} />);

    // Before any animation frames run, the counter starts at 0.
    expect(screen.getByTestId("live-spend-value")).toHaveTextContent("$0");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByTestId("live-spend-value")).toHaveTextContent("$875");
  });

  it("jumps straight to the target when the user prefers reduced motion", async () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMediaMock);

    render(<LiveSpendCounter ads={buildReportData().ads} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByTestId("live-spend-value")).toHaveTextContent("$875");
    vi.unstubAllGlobals();
  });

  it("shows a graceful empty state when ads aren't configured", () => {
    render(<LiveSpendCounter ads={emptyReportData().ads} />);
    expect(screen.getByText("No ads running yet")).toBeInTheDocument();
    expect(screen.queryByTestId("live-spend-value")).not.toBeInTheDocument();
  });

  it("shows a reconnect message when ads need reconnecting", () => {
    render(
      <LiveSpendCounter
        ads={{ state: "needs_reconnect", metrics: null }}
      />
    );
    expect(
      screen.getByText("Google Ads needs reconnecting")
    ).toBeInTheDocument();
  });
});
