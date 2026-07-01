// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WhatWeDid } from "../WhatWeDid";
import { buildReportData, emptyReportData } from "./fixtures";

afterEach(cleanup);

describe("WhatWeDid", () => {
  it("renders resolved issues as a changelog", () => {
    render(<WhatWeDid data={buildReportData()} />);
    expect(screen.getByText("Fixed broken checkout link")).toBeInTheDocument();
    expect(screen.getByText("Compressed hero images")).toBeInTheDocument();
  });

  it("shows an empty state when nothing has been resolved yet", () => {
    render(<WhatWeDid data={emptyReportData()} />);
    expect(
      screen.getByText("We're just getting started.")
    ).toBeInTheDocument();
  });
});
