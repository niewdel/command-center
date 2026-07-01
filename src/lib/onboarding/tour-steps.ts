import type { TourStep } from "@/types/onboarding";

// 6-step CRM tour (research: docs/superpowers/research/2026-07-01-crm-best-of-breed-blueprint.md
// "Onboarding walkthrough"). Keep it short — 3-step tours finish at ~72%,
// 7-step tours drop to ~16%. Voice: outcome-first, no em-dashes.
export const CRM_TOUR_STEPS: TourStep[] = [
  {
    element: '[data-tour="pipeline-board"]',
    title: "Your pipeline, at a glance",
    body: "Every deal lives on this board. Drag a card to move it to the next stage, no forms to fill out.",
    side: "top",
  },
  {
    element: '[data-tour="quick-add"]',
    title: "Add a deal in seconds",
    body: "Start here whenever a new opportunity comes in. Title, company, and value is all you need to get going.",
    side: "bottom",
  },
  {
    element: '[data-tour="deal-card"]',
    title: "Open a deal for the full picture",
    body: "Click any card to see its timeline, contacts, tasks, and next action, all in one place.",
    side: "right",
  },
  {
    element: '[data-tour="needs-attention"]',
    title: "Never lose a deal to silence",
    body: "Deals with no next action get flagged here. Set a next action and they drop off this list.",
    side: "bottom",
  },
  {
    element: '[data-tour="my-day"]',
    title: "My Day keeps you on track",
    body: "Today's tasks and overdue next actions, in one short list. Start every morning here.",
    side: "bottom",
  },
  {
    element: '[data-tour="dashboard"]',
    title: "Watch the forecast move",
    body: "Weighted pipeline value, win rate, and activity volume, updated as you work the deals.",
    side: "bottom",
  },
];
