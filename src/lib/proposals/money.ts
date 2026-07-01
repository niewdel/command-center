// src/lib/proposals/money.ts
//
// Pure dollars <-> cents helpers for the builder's line-item amount inputs
// (Task P4). Users type dollars ("1,234.50"); the API and pricing engine
// only ever see integer cents.

/**
 * Parse a dollars input string (may include a leading `$`, thousands
 * commas, and up to 2 decimal places) into integer cents. Returns 0 for
 * blank/invalid input rather than throwing, since this feeds a controlled
 * form field that should never crash on a stray keystroke.
 */
export function parseDollarsToCents(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;

  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d{1,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-" || cleaned === ".") {
    return 0;
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;

  return Math.round(value * 100);
}

/** Integer cents -> a plain dollars string suitable for a controlled input's value, e.g. 123450 -> "1234.5". */
export function centsToDollarsInput(cents: number): string {
  if (!Number.isFinite(cents)) return "0";
  const dollars = cents / 100;
  // Avoid floating point noise (e.g. 12.1 -> 12.099999999999998) while still
  // dropping a trailing ".00" for whole-dollar amounts.
  return String(Math.round(dollars * 100) / 100);
}
