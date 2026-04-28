import type { FixPlan, FixItem, CategoryFixPlan } from "./fix-plan";

// Renders a FixPlan as a markdown prompt that can be pasted into Claude Code.
// The prompt frames the audit findings as concrete tasks for an engineering
// agent working in the user's repo: it tells Claude to inspect the codebase,
// match each finding to the relevant files, and apply the fixes.

const PRIORITY_ORDER: Record<FixItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function renderFix(fix: FixItem, idx: number): string {
  return [
    `${idx + 1}. **${fix.finding}** _(priority: ${fix.priority}, difficulty: ${fix.difficulty}, ~${fix.timeEstimate})_`,
    `   - Fix: ${fix.fix}`,
    `   - Why it matters: ${fix.impact}`,
  ].join("\n");
}

function renderCategory(cat: CategoryFixPlan): string {
  if (cat.fixes.length === 0) return "";
  const sorted = [...cat.fixes].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
  const header = `### ${cat.category_name} — current ${cat.currentScore}/100, target ${cat.targetScore}/100`;
  const items = sorted.map(renderFix).join("\n\n");
  return `${header}\n\n${items}`;
}

export function generateClaudePrompt(plan: FixPlan): string {
  const totalFixes = plan.categories.reduce((sum, c) => sum + c.fixes.length, 0);

  const intro = [
    `# Site audit fix plan — ${plan.siteName}`,
    "",
    `**Site:** ${plan.url}`,
    `**Audit date:** ${plan.auditDate}`,
    `**Current score:** ${plan.currentScore}/100`,
    `**Projected score after fixes:** ${plan.projectedScore}/100 (+${plan.projectedScore - plan.currentScore})`,
    `**Total fixes:** ${totalFixes}`,
    "",
    "---",
    "",
    "## Your task",
    "",
    `Act as a senior web engineer. The audit findings below describe issues with the live site at ${plan.url}. The site's source code is in this repo.`,
    "",
    "For each finding:",
    "1. Locate the relevant files in the codebase (use Grep / Glob to search)",
    "2. Apply the fix exactly as described (or propose a better one if the description is generic)",
    "3. Verify the change doesn't break existing pages or styles",
    "",
    "Work in priority order: critical → high → medium → low. Skip any item that is already addressed in the codebase. After each category, summarize what changed.",
    "",
    "Do not commit or push — leave the changes staged for review.",
    "",
    "---",
    "",
  ].join("\n");

  let body = "";
  if (plan.quickWins.length > 0) {
    body += "## Quick wins (do these first)\n\n";
    body += plan.quickWins.map(renderFix).join("\n\n");
    body += "\n\n---\n\n";
  }

  body += "## All findings by category\n\n";
  body += plan.categories
    .map(renderCategory)
    .filter((s) => s.length > 0)
    .join("\n\n");

  return intro + body;
}
