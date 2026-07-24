import { describe, expect, test } from "bun:test";
import { type PortalDeliverable, portalDeliverableAfterDecision } from "@/lib/portal-cliente";

const pendingReview: PortalDeliverable = {
  id: "review-1",
  kind: "review",
  title: "Filme principal",
  type: "video",
  status: "revisao",
  url: "https://example.com/video",
  notes: null,
};

describe("portalDeliverableAfterDecision", () => {
  test("promove o mesmo material aprovado para entrega", () => {
    const decidedAt = "2026-07-24T20:30:00.000Z";
    const delivery = portalDeliverableAfterDecision(
      pendingReview,
      "approved",
      undefined,
      decidedAt,
    );

    expect(delivery).toMatchObject({
      id: pendingReview.id,
      kind: "delivery",
      status: "aprovado",
      url: pendingReview.url,
      decided_at: decidedAt,
      client_feedback: null,
    });
  });

  test("mantém pedidos de ajuste no fluxo de revisão", () => {
    const review = portalDeliverableAfterDecision(
      pendingReview,
      "changes_requested",
      "  Ajustar a trilha  ",
      "2026-07-24T20:31:00.000Z",
    );

    expect(review).toMatchObject({
      id: pendingReview.id,
      kind: "review",
      status: "ajustes",
      client_feedback: "Ajustar a trilha",
    });
  });
});
