// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeadsPanel } from "../LeadsPanel";
import { buildReportData, emptyReportData } from "./fixtures";

afterEach(cleanup);

describe("LeadsPanel", () => {
  it("renders totals and channel breakdown", () => {
    render(<LeadsPanel data={buildReportData()} />);
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("Call clicks")).toBeInTheDocument();
    expect(screen.getByText("Paid Search")).toBeInTheDocument();
  });

  it("renders nothing when leads data is null", () => {
    const { container } = render(<LeadsPanel data={emptyReportData()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
