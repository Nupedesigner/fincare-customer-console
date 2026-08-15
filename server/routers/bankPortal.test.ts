import { describe, expect, it } from "vitest";

const bankScopedSql = (bankId: number) => ({ bankId, where: `bankId = ${bankId}` });

describe("bank portal tenant boundary", () => {
  it("always supplies the active bank identifier as a required query scope", () => {
    expect(bankScopedSql(47)).toEqual({ bankId: 47, where: "bankId = 47" });
  });
});
