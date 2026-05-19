import fs from 'node:fs';
import { getCurrentFlowReportPaths } from './html-step-report';

/**
 * After the full ordered suite, exit with code 1 if any section failed
 * (even though individual Playwright tests completed without throwing).
 */
export default async function globalTeardown(): Promise<void> {
  const paths = getCurrentFlowReportPaths();
  if (!paths || !fs.existsSync(paths.statePath)) return;

  const state = JSON.parse(fs.readFileSync(paths.statePath, 'utf8')) as { overall?: string };
  if (state.overall === 'failed') {
    console.error(
      `\nFlow suite finished with one or more failed sections. See ${paths.htmlPath}`,
    );
    process.exitCode = 1;
  }
}
