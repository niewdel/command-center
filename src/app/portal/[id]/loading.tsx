import { Skeleton } from "@/components/ui/skeleton";

// Bare-shell skeleton for the Customer Portal. No sidebar/nav to account
// for (middleware already strips the operator chrome for this route), so
// this mirrors the portal page's own max-width container.
export default function Loading() {
  return (
    <main className="min-h-dvh bg-background px-6 py-8 md:px-10">
      <div className="max-w-5xl mx-auto animate-pulse">
        <Skeleton className="h-6 w-32 mb-8" />
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-4 w-40 mb-10" />
        <Skeleton className="h-9 w-56 rounded-full mb-8" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
