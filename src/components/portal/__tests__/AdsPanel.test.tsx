// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AdsPanel } from "../AdsPanel";
import { buildReportData, emptyReportData } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("AdsPanel", () => {
  it("renders ad metrics and the spend counter", async () => {
    render(<AdsPanel data={buildReportData()} />);
    expect(screen.getByText("Top Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Brand Search")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId("live-spend-value")).toHaveTextContent("$875");
  });

  it("shows an empty state when ads aren't configured", () => {
    render(<AdsPanel data={emptyReportData()} />);
    expect(screen.getByText("No ads running yet.")).toBeInTheDocument();
  });
});
