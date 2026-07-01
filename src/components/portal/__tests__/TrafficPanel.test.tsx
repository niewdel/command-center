// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TrafficPanel } from "../TrafficPanel";
import { buildReportData, emptyReportData } from "./fixtures";

afterEach(cleanup);

describe("TrafficPanel", () => {
  it("renders traffic metrics", () => {
    render(<TrafficPanel data={buildReportData()} />);
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("Where Visitors Come From")).toBeInTheDocument();
  });

  it("shows an empty state when traffic isn't connected", () => {
    render(<TrafficPanel data={emptyReportData()} />);
    expect(
      screen.getByText("Traffic isn't connected yet.")
    ).toBeInTheDocument();
  });
});
