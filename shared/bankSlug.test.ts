import { describe, expect, it } from "vitest";
import { normalizeBankSlug } from "./bankSlug";
import { needsBankEnvironment } from "./bankSlug";

describe("normalizeBankSlug", () => {
  it("creates a valid workspace identifier from a conventional bank name", () => {
    expect(normalizeBankSlug("Qorebank Nigeria")).toBe("qorebank-nigeria");
  });

  it("removes unsafe punctuation and repeated separators", () => {
    expect(normalizeBankSlug("  Qorebox / FinCare!  ")).toBe("qorebox-fincare");
  });

  it("routes an unassigned or failed bank-context lookup to workspace setup", () => {
    expect(needsBankEnvironment(null, false)).toBe(true);
    expect(needsBankEnvironment(undefined, true)).toBe(true);
    expect(needsBankEnvironment({ bankId: 8 }, false)).toBe(false);
  });
});
