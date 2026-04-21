import fs from 'node:fs';
import path from 'node:path';
import type { ZqualityResult } from '../types.js';

function gradeColor(grade: string): string {
  if (grade === 'A') return '#16a34a';
  if (grade === 'B') return '#2563eb';
  if (grade === 'C') return '#ca8a04';
  if (grade === 'D') return '#ea580c';
  return '#dc2626';
}

function severityColor(severity: string): string {
  if (severity === 'critical') return '#fee2e2';
  if (severity === 'high') return '#fef3c7';
  if (severity === 'medium') return '#dbeafe';
  if (severity === 'low') return '#f3f4f6';
  return '#f9fafb';
}

function severityTextColor(severity: string): string {
  if (severity === 'critical') return '#991b1b';
  if (severity === 'high') return '#92400e';
  if (severity === 'medium') return '#1e40af';
  if (severity === 'low') return '#374151';
  return '#6b7280';
}

function scoreBarColor(score: number): string {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#ca8a04';
  return '#dc2626';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function writeHtmlReport(result: ZqualityResult, outputDir: string): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });

  const gc = gradeColor(result.grade);

  const categoryBars = result.categoryScores
    .map((cat) => {
      const color = scoreBarColor(cat.score);
      return `
      <div class="cat-bar">
        <div class="cat-bar-header">
          <span class="cat-name">${escapeHtml(cat.name)}</span>
          <span class="cat-score" style="color:${color}">${cat.score}/100</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${cat.score}%;background:${color}"></div>
        </div>
        <div class="cat-meta">${cat.passed}/${cat.total} checks passed</div>
      </div>`;
    })
    .join('');

  const positivesHtml =
    result.positives.length > 0
      ? result.positives
          .map((p) => `<li class="positive-item">✅ ${escapeHtml(p)}</li>`)
          .join('')
      : '<li class="no-items">No critical/high checks passed.</li>';

  const recommendationsHtml =
    result.recommendations.length > 0
      ? result.recommendations
          .map((r, i) => `<li class="rec-item"><span class="rec-num">${i + 1}</span>${escapeHtml(r)}</li>`)
          .join('')
      : '<li class="no-items">No recommendations — great job!</li>';

  const checksTableRows = [...result.checks]
    .sort((a, b) => {
      const catDiff = a.category.localeCompare(b.category);
      if (catDiff !== 0) return catDiff;
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
    })
    .map((c) => {
      const bg = c.passed ? '' : 'background:#fff5f5';
      const sevBg = severityColor(c.severity);
      const sevTxt = severityTextColor(c.severity);
      const detail = escapeHtml(c.detail) + (c.fileHint ? ` <code class="file-hint">${escapeHtml(c.fileHint)}</code>` : '');
      return `<tr style="${bg}">
        <td class="td-cat">${escapeHtml(c.category)}</td>
        <td class="td-name"><code>${escapeHtml(c.name)}</code></td>
        <td class="td-status">${c.passed ? '✅' : '❌'}</td>
        <td class="td-sev"><span class="sev-badge" style="background:${sevBg};color:${sevTxt}">${escapeHtml(c.severity)}</span></td>
        <td class="td-detail">${detail}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Zquality Report — ${escapeHtml(path.basename(result.root))}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #111; background: #fafaf9; padding: 32px 16px; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 24px; border-bottom: 2px solid #000; padding-bottom: 24px; margin-bottom: 32px; }
    .grade-badge { width: 80px; height: 80px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; background: ${gc}; color: #fff; }
    .grade-letter { font-size: 36px; font-weight: 900; line-height: 1; }
    .grade-score { font-size: 12px; font-weight: 700; opacity: 0.9; }
    .header-text h1 { font-size: 24px; font-weight: 800; }
    .header-text p { font-size: 12px; color: #555; margin-top: 4px; }
    .meta { font-size: 11px; color: #888; margin-top: 8px; }
    h2 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #666; margin-bottom: 12px; }
    .section { margin-bottom: 40px; }
    .positive-list, .rec-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .positive-item { font-size: 13px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 8px 12px; }
    .rec-item { font-size: 13px; color: #1e293b; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; display: flex; gap: 12px; align-items: flex-start; }
    .rec-num { font-weight: 800; color: #ea580c; flex-shrink: 0; min-width: 20px; }
    .no-items { font-size: 13px; color: #888; padding: 8px 12px; }
    .cat-bars { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }
    .cat-bar-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .cat-name { font-size: 12px; color: #444; text-transform: capitalize; }
    .cat-score { font-size: 12px; font-weight: 700; font-family: monospace; }
    .bar-track { height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 9999px; transition: width 0.3s ease; }
    .cat-meta { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #888; border-bottom: 2px solid #e5e7eb; }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .td-cat { color: #555; text-transform: capitalize; }
    .td-name code { font-family: 'SF Mono', monospace; font-size: 11px; }
    .td-status { text-align: center; }
    .sev-badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; }
    .td-detail { color: #444; line-height: 1.5; max-width: 300px; }
    .file-hint { font-family: monospace; font-size: 10px; color: #888; display: block; margin-top: 2px; }
    .critical-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .critical-badge { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="grade-badge">
        <span class="grade-letter">${escapeHtml(result.grade)}</span>
        <span class="grade-score">${result.score}/100</span>
      </div>
      <div class="header-text">
        <h1>Zquality Report</h1>
        <p>${escapeHtml(result.root)}</p>
        <p class="meta">${result.filesScanned} files scanned &middot; ${escapeHtml(result.createdAt)}</p>
      </div>
    </div>

    ${result.criticalFailures.length > 0 ? `
    <div class="section">
      <h2>Critical Failures</h2>
      <div class="critical-list">
        ${result.criticalFailures.map((f) => `<span class="critical-badge">${escapeHtml(f)}</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <h2>Qué está bien</h2>
      <ul class="positive-list">${positivesHtml}</ul>
    </div>

    <div class="section">
      <h2>Mejoras recomendadas</h2>
      <ol class="rec-list">${recommendationsHtml}</ol>
    </div>

    <div class="section">
      <h2>Category Scores</h2>
      <div class="cat-bars">${categoryBars}</div>
    </div>

    <div class="section">
      <h2>Full Checklist</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Check</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${checksTableRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

  const outPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}
