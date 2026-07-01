// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ScoreHero } from "../ScoreHero";
import { buildReportData, emptyReportData } from "./fixtures";

afterEach(cleanup);

describe("ScoreHero", () => {
  it("renders the overall score and delta", () => {
    render(<ScoreHero data={buildReportData()} />);
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText(/since the start of this period/)).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("shows a getting-started empty state when there's no score yet", () => {
    render(<ScoreHero data={emptyReportData()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
  });
});
