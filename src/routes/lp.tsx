import { createFileRoute } from "@tanstack/react-router";
import { SalesLandingPage } from "@/components/landing/sales-landing-page";

export const Route = createFileRoute("/lp")({
  head: () => ({
    meta: [
      {
        title: "MakersHub — Sua produtora organizada do comercial à entrega",
      },
      {
        name: "description",
        content:
          "Centralize propostas, clientes, projetos, agenda e financeiro em um sistema criado para produtoras audiovisuais.",
      },
    ],
  }),
  component: SalesLandingPage,
});
