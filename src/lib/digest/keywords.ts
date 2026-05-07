import { readFileSync } from "fs";
import { join } from "path";

let cached: string[] | null = null;

export function loadNicheKeywords(): string[] {
  if (cached) return cached;

  try {
    const path = join(process.cwd(), "leddyai", "niche-keywords.md");
    const content = readFileSync(path, "utf-8");
    cached = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.replace(/^["']|["']$/g, ""));
    return cached;
  } catch {
    cached = [
      "claude code",
      "claude",
      "anthropic",
      "mcp server",
      "ai agent",
      "ai automation",
      "prompt engineering",
      "cursor",
    ];
    return cached;
  }
}
