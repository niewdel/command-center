import { Expense } from "@/types/database";

export function computeNextPaymentDate(expense: Expense): string | null {
  if (!expense.due_day) return null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  if (expense.billing_cycle === "monthly") {
    // Try this month first
    let nextDate = new Date(currentYear, currentMonth, Math.min(expense.due_day, daysInMonth(currentYear, currentMonth)));
    if (nextDate <= today) {
      // Already passed this month, go to next
      nextDate = new Date(currentYear, currentMonth + 1, Math.min(expense.due_day, daysInMonth(currentYear, currentMonth + 1)));
    }
    return nextDate.toISOString().split("T")[0];
  }

  if (expense.billing_cycle === "yearly") {
    // Assume due_day is the day of the month, use the month from last_paid_date or current month
    let nextDate = new Date(currentYear, currentMonth, Math.min(expense.due_day, daysInMonth(currentYear, currentMonth)));
    if (nextDate <= today) {
      nextDate = new Date(currentYear + 1, currentMonth, Math.min(expense.due_day, daysInMonth(currentYear + 1, currentMonth)));
    }
    return nextDate.toISOString().split("T")[0];
  }

  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getUpcomingExpenses(expenses: Expense[], daysAhead: number): Expense[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return expenses.filter((e) => {
    if (!e.next_payment_date) return false;
    const payDate = new Date(e.next_payment_date + "T00:00:00");
    return payDate >= today && payDate <= cutoff && !e.is_paid;
  });
}

export function isDueSoon(expense: Expense): "overdue" | "due-soon" | "upcoming" | null {
  if (!expense.next_payment_date) return null;
  if (expense.is_paid) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const payDate = new Date(expense.next_payment_date + "T00:00:00");
  const daysUntil = Math.ceil((payDate.getTime() - today.getTime()) / 86400000);

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= (expense.remind_days_before || 3)) return "due-soon";
  if (daysUntil <= 7) return "upcoming";
  return null;
}

export function formatDaysUntil(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}
