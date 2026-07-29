import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "MakersHub — Sua produtora organizada do comercial à entrega" }],
  }),
  component: lazyRouteComponent(
    () => import("@/components/dashboard/dashboard-route"),
    "Dashboard",
  ),
});
