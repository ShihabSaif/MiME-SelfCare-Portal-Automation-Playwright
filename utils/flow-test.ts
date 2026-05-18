/**
 * Logs a section failure without failing the Playwright test run,
 * so chained projects can continue executing.
 */
export function logFlowFailure(section: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${section}] Flow step failed (continuing suite): ${message}`);
}
