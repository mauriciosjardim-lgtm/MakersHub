import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PORTAL_ACCENT_COLOR,
  type PortalDeliverable,
  portalAccentColor,
  portalDeliverableAfterDecision,
} from "@/lib/portal-cliente";

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

describe("portalAccentColor", () => {
  test("aplica a cor persistida para o cliente", () => {
    expect(portalAccentColor("  #2563eb  ")).toBe("#2563eb");
    expect(portalAccentColor("oklch(0.65 0.22 295)")).toBe("oklch(0.65 0.22 295)");
  });

  test("mantém a cor padrão quando nenhuma foi configurada", () => {
    expect(portalAccentColor(null)).toBe(DEFAULT_PORTAL_ACCENT_COLOR);
    expect(portalAccentColor("  ")).toBe(DEFAULT_PORTAL_ACCENT_COLOR);
  });
});
