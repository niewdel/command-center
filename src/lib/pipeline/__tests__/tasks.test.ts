import { describe, it, expect } from "vitest";
import { getTaskBucket, isTaskOverdue } from "../tasks";

const NOW = new Date("2026-07-01T12:00:00Z");

describe("getTaskBucket", () => {
  it("buckets a task with no due date", () => {
    expect(getTaskBucket({ due_date: null }, NOW)).toBe("no_due_date");
  });

  it("buckets a past-due task as overdue", () => {
    expect(getTaskBucket({ due_date: "2026-06-01T00:00:00Z" }, NOW)).toBe("overdue");
  });

  it("buckets a task due later today as today", () => {
    expect(getTaskBucket({ due_date: "2026-07-01T23:00:00Z" }, NOW)).toBe("today");
  });

  it("buckets a task due in 3 days as upcoming", () => {
    expect(getTaskBucket({ due_date: "2026-07-04T00:00:00Z" }, NOW)).toBe("upcoming");
  });

  it("buckets a task due in 10 days as later", () => {
    expect(getTaskBucket({ due_date: "2026-07-11T00:00:00Z" }, NOW)).toBe("later");
  });
});

describe("isTaskOverdue", () => {
  it("flags a not-done task due in the past", () => {
    expect(isTaskOverdue({ due_date: "2026-06-01T00:00:00Z", done: false }, NOW)).toBe(true);
  });

  it("does not flag a done task even if past due", () => {
    expect(isTaskOverdue({ due_date: "2026-06-01T00:00:00Z", done: true }, NOW)).toBe(false);
  });

  it("does not flag a task with no due date", () => {
    expect(isTaskOverdue({ due_date: null, done: false }, NOW)).toBe(false);
  });
});
