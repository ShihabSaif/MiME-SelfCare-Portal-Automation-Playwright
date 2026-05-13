const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const preferredPort = Number(process.env.PLAYWRIGHT_REPORT_PORT || 9324);

const defaultTestCmd =
  'npx playwright test tests/recharge-wallet.spec.ts --project=chromium --workers=1 --headed';
const testCommand = process.argv.slice(2).join(' ').trim() || defaultTestCmd;

let reportOpened = false;

function openChromeUrl(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', 'chrome', url], {
      cwd: projectRoot,
      shell: true,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  const chromeCandidates = ['google-chrome', 'chromium', 'chromium-browser'];
  for (const bin of chromeCandidates) {
    const child = spawn(bin, [url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    if (!child.pid) continue;
    return;
  }

  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function startReportServerAndOpenChrome(port) {
  spawn('npx', ['playwright', 'show-report', '--port', String(port)], {
    cwd: projectRoot,
    shell: true,
    detached: true,
    stdio: 'ignore',
  }).unref();

  const url = `http://127.0.0.1:${port}`;
  setTimeout(() => openChromeUrl(url), 2000);
}

function openReportInChrome() {
  if (reportOpened) return;
  reportOpened = true;

  console.log('\nOpening Playwright HTML report in Chrome...');

  for (let port = preferredPort; port < preferredPort + 10; port += 1) {
    startReportServerAndOpenChrome(port);
    break;
  }
}

function scheduleExitAfterReport(code) {
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => {
  console.log('\nExecution interrupted. Opening report in Chrome...');
  openReportInChrome();
  scheduleExitAfterReport(130);
});

process.on('SIGTERM', () => {
  console.log('\nExecution terminated. Opening report in Chrome...');
  openReportInChrome();
  scheduleExitAfterReport(143);
});

try {
  const testResult = spawnSync(testCommand, {
    shell: true,
    stdio: 'inherit',
    cwd: projectRoot,
  });

  if (testResult.error) {
    console.error('Test execution failed to start:', testResult.error.message);
  }
} finally {
  openReportInChrome();
}
