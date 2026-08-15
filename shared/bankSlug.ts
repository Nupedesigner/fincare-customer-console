export function normalizeBankSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/g, "");
}

export function needsBankEnvironment(context: unknown | null | undefined, hasContextError: boolean): boolean {
  return hasContextError || context === null;
}
