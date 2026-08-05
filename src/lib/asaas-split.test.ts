import { describe, expect, test } from "bun:test";
import {
  SPLIT_EXTERNAL_REFERENCE,
  SPLIT_WALLET_PRIMARY,
  SPLIT_WALLET_SECONDARY,
  corpoCobrancaCartao,
  corpoCobrancaPix,
  splitDaCobranca,
} from "./asaas-split";

const cartao = {
  holderName: "Cliente Teste",
  number: "4111111111111111",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
};

const titular = {
  name: "Cliente Teste",
  email: "cliente@example.test",
  cpfCnpj: "12345678909",
  postalCode: "01310100",
  addressNumber: "100",
  phone: "11999999999",
};

const comum = { customerId: "cus_1", dueDate: "2026-08-05" };

const checkoutPix = corpoCobrancaPix(comum);
const upgradePix = corpoCobrancaPix({ ...comum, externalReference: "user-uuid" });
const checkoutCartao = corpoCobrancaCartao({
  ...comum,
  remoteIp: "203.0.113.7",
  creditCard: cartao,
  creditCardHolderInfo: titular,
});

// É assim que criarCobranca monta o corpo final: builder + split.
const enviados = [checkoutPix, upgradePix, checkoutCartao].map((corpo) => ({
  ...corpo,
  split: splitDaCobranca(),
}));

describe("split das cobranças", () => {
  test("os três pontos que criam cobrança repassam os mesmos 40%", () => {
    for (const corpo of enviados) {
      expect(corpo.value).toBe(97);
      expect(corpo.split).toEqual([
        {
          walletId: "1a42abc7-caaf-4ea3-a2a1-19bafc9cdcee",
          percentualValue: 40,
          externalReference: SPLIT_EXTERNAL_REFERENCE,
          description: expect.any(String),
        },
      ]);
    }
  });

  test("o repasse é percentual sobre o netValue, nunca valor fixo", () => {
    // fixedValue trocaria a base de cálculo (netValue vira valor cheio) e
    // quebraria o acordo 60/40 sem o Asaas devolver erro nenhum.
    for (const corpo of enviados) {
      for (const split of corpo.split) {
        expect(split).not.toHaveProperty("fixedValue");
        expect(split).not.toHaveProperty("totalFixedValue");
      }
    }
  });

  test("a carteira da própria conta nunca entra no split", () => {
    // O Asaas recusa com 400 "Não é permitido split para sua própria carteira."
    // Os 60% do primário ficam na conta emissora por diferença.
    const rateio = splitDaCobranca();
    expect(rateio).toHaveLength(1);
    expect(rateio.map((s) => s.walletId)).not.toContain(SPLIT_WALLET_PRIMARY);
    expect(rateio[0].walletId).toBe(SPLIT_WALLET_SECONDARY);
    expect(rateio.reduce((soma, s) => soma + s.percentualValue, 0)).toBe(40);
  });

  test("o split não carrega nenhum dado do comprador", () => {
    const serializado = JSON.stringify(splitDaCobranca());
    expect(serializado).not.toContain(cartao.number);
    expect(serializado).not.toContain(cartao.ccv);
    expect(serializado).not.toContain(titular.cpfCnpj);
    expect(serializado).not.toContain(titular.email);
  });

  test("o upgrade mantém o vínculo cobrança↔usuário e o checkout não inventa um", () => {
    expect(upgradePix.externalReference).toBe("user-uuid");
    expect(checkoutPix).not.toHaveProperty("externalReference");
  });

  test("o cartão preserva os dados exigidos pelo antifraude", () => {
    expect(checkoutCartao.billingType).toBe("CREDIT_CARD");
    expect(checkoutCartao.remoteIp).toBe("203.0.113.7");
    expect(checkoutCartao.creditCard).toEqual(cartao);
    expect(checkoutCartao.creditCardHolderInfo).toEqual(titular);
  });

  test("o Pix não vaza campos de cartão", () => {
    expect(checkoutPix.billingType).toBe("PIX");
    expect(checkoutPix).not.toHaveProperty("creditCard");
    expect(checkoutPix).not.toHaveProperty("creditCardHolderInfo");
  });
});
