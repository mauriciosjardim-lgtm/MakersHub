import { describe, expect, test } from "bun:test";
import {
  isValidClientAdjustmentTimecode,
  maskClientAdjustmentTimecode,
  normalizeClientAdjustmentTimecode,
  parseClientAdjustmentFeedback,
} from "@/lib/client-adjustments";

describe("máscara de tempo dos ajustes", () => {
  test("formata automaticamente minutos, segundos e horas", () => {
    expect(maskClientAdjustmentTimecode("0008")).toBe("00:08");
    expect(maskClientAdjustmentTimecode("123456")).toBe("12:34:56");
    expect(maskClientAdjustmentTimecode("01m08s")).toBe("01:08");
  });

  test("completa valores curtos ao finalizar o campo", () => {
    expect(normalizeClientAdjustmentTimecode("8")).toBe("00:08");
    expect(normalizeClientAdjustmentTimecode("108")).toBe("01:08");
  });

  test("rejeita segundos e minutos internos fora do intervalo", () => {
    expect(isValidClientAdjustmentTimecode("00:59")).toBe(true);
    expect(isValidClientAdjustmentTimecode("01:08:42")).toBe(true);
    expect(isValidClientAdjustmentTimecode("00:60")).toBe(false);
    expect(isValidClientAdjustmentTimecode("01:72:10")).toBe(false);
  });
});

describe("parseClientAdjustmentFeedback", () => {
  test("converte os pontos estruturados enviados pelo portal", () => {
    expect(
      parseClientAdjustmentFeedback(
        [
          "AJUSTES SOLICITADOS",
          "1. [00:08] Reduzir o tamanho do logo.",
          "2. [Geral] Corrigir a grafia do nome.",
        ].join("\n"),
      ),
    ).toEqual([
      { time: "00:08", change: "Reduzir o tamanho do logo." },
      { change: "Corrigir a grafia do nome." },
    ]);
  });

  test("mantém feedbacks antigos fora do formato estruturado", () => {
    expect(parseClientAdjustmentFeedback("O cliente pediu uma nova abertura.")).toBeNull();
  });

  test("ignora estruturas vazias ou inválidas", () => {
    expect(parseClientAdjustmentFeedback("AJUSTES SOLICITADOS")).toBeNull();
    expect(parseClientAdjustmentFeedback(null)).toBeNull();
  });
});
