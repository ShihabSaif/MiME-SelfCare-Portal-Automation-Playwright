import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export type StepStatus = 'success' | 'failed' | 'neutral';

export interface ReportStep {
  section: string;
  title: string;
  imageFile: string;
  status: StepStatus;
  timestampIso: string;
  url: string;
}

function formatTimestampForFilename(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export class HtmlStepReport {
  private readonly reportDir: string;
  private readonly htmlFileName: string;
  private readonly stateFilePath: string;
  private readonly sectionName: string;
  private stepIndex = 0;
  private finalized = false;

  constructor(baseDir = 'test-results', sectionName = 'General') {
    this.reportDir = path.join(baseDir, 'flow-report-shared');
    this.htmlFileName = 'flow-report.html';
    this.stateFilePath = path.join(this.reportDir, 'report-state.json');
    this.sectionName = sectionName;
    fs.mkdirSync(this.reportDir, { recursive: true });
    this.ensureState();
  }

  get htmlPath(): string {
    return path.join(this.reportDir, this.htmlFileName);
  }

  reset(): void {
    this.stepIndex = 0;
    const initial: ReportState = {
      generatedAtIso: new Date().toISOString(),
      sections: {},
      steps: [],
      overall: 'incomplete',
    };
    fs.writeFileSync(this.stateFilePath, JSON.stringify(initial, null, 2), 'utf8');
  }

  async addStep(page: Page, title: string, status: StepStatus = 'success'): Promise<void> {
    const state = this.readState();
    this.stepIndex = state.steps.length + 1;
    const imageFile = `step-${String(this.stepIndex).padStart(2, '0')}.png`;
    const imagePath = path.join(this.reportDir, imageFile);
    await page
      .screenshot({
        path: imagePath,
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
      })
      .catch(() => undefined);
    state.steps.push({
      section: this.sectionName,
      title,
      imageFile,
      status,
      timestampIso: new Date().toISOString(),
      url: page.url(),
    });
    this.writeState(state);
  }

  finalize(overall: 'passed' | 'failed' | 'incomplete'): void {
    if (this.finalized) return;
    this.finalized = true;

    const state = this.readState();
    state.sections[this.sectionName] = overall;
    state.overall = this.computeOverall(state.sections);
    this.writeState(state);

    const orderedSections = [
      'Login',
      'Recharge',
      'Service',
      'Wallet Transfer',
      'Payment History',
      'Inventory',
      'Complains',
      'My Profile',
    ];

    const sectionRows = orderedSections
      .map((sectionName) => {
        const sectionSteps = state.steps.filter((s) => s.section === sectionName);
        if (sectionSteps.length === 0) return '';
        const sectionStatus = state.sections[sectionName] || 'incomplete';
        const rows = sectionSteps
          .map(
            (s, i) => `
    <section class="step">
      <details>
        <summary>
          <span class="status-icon status-icon-${s.status}">${statusIcon(s.status)}</span>
          <span class="summary-title">${i + 1}. ${escapeHtml(s.title)}</span>
          <span class="badge badge-${s.status}">${s.status}</span>
        </summary>
        <div class="details-body">
          <p class="step-meta"><strong>Time:</strong> ${escapeHtml(s.timestampIso)}</p>
          <p class="step-meta"><strong>URL:</strong> <code>${escapeHtml(s.url || '(unknown)')}</code></p>
          <a href="${escapeHtml(s.imageFile)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(s.imageFile)}" alt="${escapeHtml(s.title)}" loading="lazy" />
          </a>
        </div>
      </details>
    </section>`,
          )
          .join('\n');
        return `
  <section class="section-block">
    <h2>${escapeHtml(sectionName)} <span class="overall overall-${sectionStatus}">${sectionStatus}</span></h2>
    ${rows}
  </section>`;
      })
      .join('\n');

    const orphanRows = state.steps
      .filter((s) => !orderedSections.includes(s.section))
      .map(
        (s, i) => `
    <section class="step">
      <details>
        <summary>
          <span class="status-icon status-icon-${s.status}">${statusIcon(s.status)}</span>
          <span class="summary-title">${i + 1}. ${escapeHtml(s.title)}</span>
          <span class="badge badge-${s.status}">${s.status}</span>
        </summary>
        <div class="details-body">
          <p class="step-meta"><strong>Time:</strong> ${escapeHtml(s.timestampIso)}</p>
          <p class="step-meta"><strong>URL:</strong> <code>${escapeHtml(s.url || '(unknown)')}</code></p>
          <a href="${escapeHtml(s.imageFile)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(s.imageFile)}" alt="${escapeHtml(s.title)}" loading="lazy" />
          </a>
        </div>
      </details>
    </section>`,
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Flow report — ${escapeHtml(this.htmlFileName)}</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #111; }
    body { max-width: 960px; margin: 0 auto; padding: 1.5rem; background: #f6f7f9; }
    h1 { font-size: 1.35rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .overall { display: inline-block; padding: 0.35rem 0.75rem; border-radius: 6px; font-weight: 600; margin-bottom: 1rem; }
    .overall-passed { background: #d1fae5; color: #065f46; }
    .overall-failed { background: #fee2e2; color: #991b1b; }
    .overall-incomplete { background: #fef3c7; color: #92400e; }
    .step { background: #fff; border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 1px 3px rgb(0 0 0 / 0.08); overflow: hidden; }
    details { padding: 0.85rem 1rem; }
    details[open] { background: #fff; }
    summary { cursor: pointer; display: flex; align-items: center; gap: 0.6rem; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    .summary-title { font-size: 1rem; font-weight: 600; flex: 1; }
    .status-icon { width: 1.35rem; height: 1.35rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; }
    .status-icon-success { background: #d1fae5; color: #065f46; }
    .status-icon-failed { background: #fee2e2; color: #991b1b; }
    .status-icon-neutral { background: #e5e7eb; color: #374151; }
    .badge { display: inline-block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #e5e7eb; color: #374151; }
    .details-body { margin-top: 0.8rem; border-top: 1px solid #e5e7eb; padding-top: 0.8rem; }
    .step-meta { margin: 0.2rem 0; font-size: 0.9rem; color: #374151; }
    .details-body img { max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 0.6rem; }
  </style>
</head>
<body>
  <h1>Automation flow report</h1>
  <p class="meta">Generated: ${escapeHtml(state.generatedAtIso)}<br />Folder: <code>${escapeHtml(this.reportDir)}</code></p>
  <p><span class="overall overall-${state.overall}">Overall: ${state.overall}</span></p>
  ${sectionRows || '<p>No steps recorded.</p>'}
  ${orphanRows ? `<h2>Other</h2>${orphanRows}` : ''}
</body>
</html>`;

    fs.writeFileSync(path.join(this.reportDir, this.htmlFileName), html, 'utf8');
    console.log(`\nCustom HTML report written: ${path.join(this.reportDir, this.htmlFileName)}`);
  }

  private ensureState(): void {
    if (fs.existsSync(this.stateFilePath)) return;
    this.reset();
  }

  private readState(): ReportState {
    this.ensureState();
    const raw = fs.readFileSync(this.stateFilePath, 'utf8');
    return JSON.parse(raw) as ReportState;
  }

  private writeState(state: ReportState): void {
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private computeOverall(sections: Record<string, 'passed' | 'failed' | 'incomplete'>): 'passed' | 'failed' | 'incomplete' {
    const values = Object.values(sections);
    if (values.includes('failed')) return 'failed';
    if (values.includes('incomplete')) return 'incomplete';
    return values.length > 0 ? 'passed' : 'incomplete';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusIcon(status: StepStatus): string {
  if (status === 'success') return '✓';
  if (status === 'failed') return '✕';
  return '•';
}

interface ReportState {
  generatedAtIso: string;
  sections: Record<string, 'passed' | 'failed' | 'incomplete'>;
  steps: ReportStep[];
  overall: 'passed' | 'failed' | 'incomplete';
}
