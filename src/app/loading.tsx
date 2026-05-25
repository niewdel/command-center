import { SkeletonPage } from "@/components/ui/skeleton";

// Renders instantly during route segment loads — Next.js streams this while
// the next page's client chunk is fetched and hydrated. Without it the user
// sees the previous page frozen, or a blank shell, on every navigation.
export default function Loading() {
  return <SkeletonPage />;
}
