import fs from 'node:fs';
import path from 'node:path';

/**
 * After the full ordered suite, exit with code 1 if any section failed
 * (even though individual Playwright tests completed without throwing).
 */
export default async function globalTeardown(): Promise<void> {
  const statePath = path.join('test-results', 'flow-report-shared', 'report-state.json');
  if (!fs.existsSync(statePath)) return;

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as { overall?: string };
  if (state.overall === 'failed') {
    console.error(
      '\nFlow suite finished with one or more failed sections. See test-results/flow-report-shared/flow-report.html',
    );
    process.exitCode = 1;
  }
}
