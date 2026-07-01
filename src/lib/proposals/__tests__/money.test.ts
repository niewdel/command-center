import { describe, expect, it } from "vitest";
import { centsToDollarsInput, parseDollarsToCents } from "@/lib/proposals/money";

describe("parseDollarsToCents", () => {
  it("parses a plain integer", () => {
    expect(parseDollarsToCents("1234")).toBe(123400);
  });

  it("parses commas and a dollar sign", () => {
    expect(parseDollarsToCents("$1,234.50")).toBe(123450);
    expect(parseDollarsToCents("1,234.50")).toBe(123450);
  });

  it("handles blanks and whitespace as zero", () => {
    expect(parseDollarsToCents("")).toBe(0);
    expect(parseDollarsToCents("   ")).toBe(0);
  });

  it("handles invalid input as zero", () => {
    expect(parseDollarsToCents("abc")).toBe(0);
    expect(parseDollarsToCents("$-")).toBe(0);
    expect(parseDollarsToCents("1.2.3")).toBe(0);
    expect(parseDollarsToCents(".")).toBe(0);
  });

  it("rounds sub-cent precision", () => {
    expect(parseDollarsToCents("1.005")).toBe(0); // more than 2 decimals -> rejected as invalid, treated as 0
    expect(parseDollarsToCents("0.1")).toBe(10);
  });

  it("round-trips with centsToDollarsInput", () => {
    expect(centsToDollarsInput(123450)).toBe("1234.5");
    expect(parseDollarsToCents(centsToDollarsInput(123450))).toBe(123450);
    expect(centsToDollarsInput(0)).toBe("0");
    expect(centsToDollarsInput(600000)).toBe("6000");
  });
});
