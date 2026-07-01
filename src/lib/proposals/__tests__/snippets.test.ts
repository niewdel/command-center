import { describe, expect, it } from "vitest";
import {
  PROPOSAL_SNIPPETS,
  PROPOSAL_SNIPPET_TOKENS,
  insertSnippetInto,
  snippetsByCategory,
} from "@/lib/proposals/snippets";

describe("proposal snippets", () => {
  it("has at least one snippet per documented category", () => {
    const categories = new Set(PROPOSAL_SNIPPETS.map((s) => s.category));
    expect(categories.has("grow_onto_it")).toBe(true);
    expect(categories.has("scope_honesty")).toBe(true);
    expect(categories.has("no_lock_in")).toBe(true);
    expect(categories.has("forced_choice")).toBe(true);
    expect(categories.has("direct_honesty")).toBe(true);
    expect(categories.has("outcome_headline")).toBe(true);
    expect(categories.has("reassurance")).toBe(true);
    expect(categories.has("approval_window")).toBe(true);
    expect(categories.has("liability")).toBe(true);
    expect(categories.has("footer")).toBe(true);
  });

  it("contains no em-dashes in any snippet text", () => {
    for (const s of PROPOSAL_SNIPPETS) {
      expect(s.text).not.toContain("—");
    }
  });

  it("at least one snippet uses a tokenized variable", () => {
    const hasToken = PROPOSAL_SNIPPETS.some((s) =>
      PROPOSAL_SNIPPET_TOKENS.some((token) => s.text.includes(token))
    );
    expect(hasToken).toBe(true);
  });

  it("groups snippets by category with human labels", () => {
    const groups = snippetsByCategory();
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.snippets.every((s) => s.category === group.category)).toBe(true);
    }
    const total = groups.reduce((sum, g) => sum + g.snippets.length, 0);
    expect(total).toBe(PROPOSAL_SNIPPETS.length);
  });

  it("insertSnippetInto appends with a separating space", () => {
    expect(insertSnippetInto("", "Hello")).toBe("Hello");
    expect(insertSnippetInto("Hello", "world")).toBe("Hello world");
    expect(insertSnippetInto("Hello ", "world")).toBe("Hello world");
    expect(insertSnippetInto("Hello\n", "world")).toBe("Hello\nworld");
  });
});
