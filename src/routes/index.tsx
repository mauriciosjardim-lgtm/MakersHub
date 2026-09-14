import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "MakersHub" }],
  }),
  component: lazyRouteComponent(
    () => import("@/components/dashboard/dashboard-route"),
    "Dashboard",
  ),
});
