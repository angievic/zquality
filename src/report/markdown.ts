import fs from 'node:fs';
import path from 'node:path';
import type { ZqualityResult } from '../types.js';

export async function writeMarkdownReport(result: ZqualityResult, outputDir: string): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [];
  lines.push(`# Zquality Report`);
  lines.push('');
  lines.push(`**Project:** ${result.root}`);
  lines.push(`**Score:** ${result.score}/100 — Grade: **${result.grade}**`);
  lines.push(`**Files scanned:** ${result.filesScanned}`);
  lines.push(`**Date:** ${result.createdAt}`);
  lines.push('');

  if (result.criticalFailures.length > 0) {
    lines.push('## Critical Failures');
    for (const f of result.criticalFailures) {
      lines.push(`- ❌ \`${f}\``);
    }
    lines.push('');
  }

  if (result.positives.length > 0) {
    lines.push('## Qué está bien');
    for (const p of result.positives) {
      lines.push(`- ✅ ${p}`);
    }
    lines.push('');
  }

  if (result.recommendations.length > 0) {
    lines.push('## Mejoras recomendadas');
    result.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  lines.push('## Category Scores');
  for (const cat of result.categoryScores) {
    const bar = '█'.repeat(Math.round(cat.score / 10)) + '░'.repeat(10 - Math.round(cat.score / 10));
    lines.push(`- **${cat.name}**: ${cat.score}/100 \`${bar}\` (${cat.passed}/${cat.total} passed)`);
  }
  lines.push('');

  lines.push('## Full Checklist');
  lines.push('');
  lines.push('| Category | Check | Status | Severity | Detail |');
  lines.push('|----------|-------|--------|----------|--------|');
  for (const check of result.checks) {
    const status = check.passed ? '✅' : '❌';
    const detail = check.detail + (check.fileHint ? ` \`${check.fileHint}\`` : '');
    lines.push(`| ${check.category} | ${check.name} | ${status} | ${check.severity} | ${detail} |`);
  }

  const content = lines.join('\n');
  const outPath = path.join(outputDir, 'zquality-report.md');
  fs.writeFileSync(outPath, content, 'utf8');
  return outPath;
}
