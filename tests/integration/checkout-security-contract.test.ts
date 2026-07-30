import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/api/asaas.functions.ts", "utf8");

describe("checkout security contract", () => {
  test("binds upgrade charges to the authenticated user", () => {
    expect(source).toContain("externalReference: context.userId");
    expect(source).toContain("extRef !== context.userId");
    expect(source).toContain("emailCobranca !== email");
  });

  test("never persists checkout passwords", () => {
    expect(source).not.toMatch(/senha:\s+(?:data\.)?senha/);
    expect(source).not.toMatch(/password:\s+data\.password[\s\S]{0,300}pending_orders/);
    expect(source).toContain("activation_secret_hash: activationSecretHash");
  });

  test("does not log card, password, token, or recovery-link values", () => {
    const logCalls = source.match(/console\.(?:log|error|warn)\([^\n]*/g) ?? [];
    expect(logCalls.join("\n")).not.toMatch(
      /creditCard|card\.number|ccv|senhaParaCriacao|action_link|Bearer \$\{|access_token:/,
    );
  });
});
