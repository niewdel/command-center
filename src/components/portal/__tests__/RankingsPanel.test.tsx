// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RankingsPanel } from "../RankingsPanel";
import { buildReportData, emptyReportData } from "./fixtures";

afterEach(cleanup);

describe("RankingsPanel", () => {
  it("renders ranking counts and movers", () => {
    render(<RankingsPanel data={buildReportData()} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("seo agency")).toBeInTheDocument();
    expect(screen.getByText("marketing help")).toBeInTheDocument();
  });

  it("shows an empty state when rank tracking isn't set up", () => {
    render(<RankingsPanel data={emptyReportData()} />);
    expect(
      screen.getByText("Rank tracking isn't set up yet.")
    ).toBeInTheDocument();
  });
});
