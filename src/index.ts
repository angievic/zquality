import path from 'node:path';
import { walkFiles } from './utils.js';
import { runAllChecks } from './checks/index.js';
import type { CheckResult, CategoryScore, ZqualityResult, ZqualityOptions, RiskItem } from './types.js';

export type { CheckResult, CategoryScore, ZqualityResult, ZqualityOptions };
export type { Severity } from './types.js';

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

function computeScore(checks: CheckResult[]): number {
  const total = checks.reduce((sum, c) => sum + (SEVERITY_WEIGHTS[c.severity] ?? 0), 0);
  if (total === 0) return 100;
  const passed = checks
    .filter((c) => c.passed)
    .reduce((sum, c) => sum + (SEVERITY_WEIGHTS[c.severity] ?? 0), 0);
  return Math.round((passed / total) * 100);
}

function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function computeCategoryScores(checks: CheckResult[]): CategoryScore[] {
  const byCategory = new Map<string, CheckResult[]>();
  for (const c of checks) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  const scores: CategoryScore[] = [];
  for (const [name, cats] of byCategory) {
    const total = cats.reduce((sum, c) => sum + (SEVERITY_WEIGHTS[c.severity] ?? 0), 0);
    const passedWeight = cats
      .filter((c) => c.passed)
      .reduce((sum, c) => sum + (SEVERITY_WEIGHTS[c.severity] ?? 0), 0);
    const score = total === 0 ? 100 : Math.round((passedWeight / total) * 100);
    scores.push({
      name,
      score,
      passed: cats.filter((c) => c.passed).length,
      total: cats.length,
    });
  }
  return scores.sort((a, b) => a.name.localeCompare(b.name));
}

function buildRecommendations(checks: CheckResult[]): string[] {
  const failed = checks.filter((c) => !c.passed);
  // Sort by severity weight descending, then by name
  failed.sort(
    (a, b) =>
      (SEVERITY_WEIGHTS[b.severity] ?? 0) - (SEVERITY_WEIGHTS[a.severity] ?? 0) ||
      a.name.localeCompare(b.name),
  );
  return failed.slice(0, 5).map((c) => `[${c.severity.toUpperCase()}] ${c.category}/${c.name}: ${c.detail}`);
}

function buildPositives(checks: CheckResult[]): string[] {
  return checks
    .filter((c) => c.passed && (c.severity === 'critical' || c.severity === 'high'))
    .map((c) => `${c.category}/${c.name}: ${c.detail}`);
}

function computeHealthScore(checks: CheckResult[]): number {
  const healthChecks = checks.filter((c) => c.category === 'codeHealth');
  return computeScore(healthChecks);
}

function buildRisks(checks: CheckResult[]): RiskItem[] {
  const healthChecks = checks.filter((c) => c.category === 'codeHealth' && !c.passed);
  const typeMap: Record<string, RiskItem['type']> = {
    no_circular_deps: 'circular_import',
    no_redundant_code: 'redundant_code',
    no_dead_exports: 'dead_export',
    low_coupling: 'high_coupling',
    no_copy_paste_patterns: 'copy_paste',
  };
  return healthChecks.map((c) => ({
    type: typeMap[c.name] ?? 'redundant_code',
    severity: c.severity,
    detail: c.detail,
    files: c.fileHint ? [c.fileHint] : [],
  }));
}

export async function runZquality(
  root: string,
  opts: ZqualityOptions = {},
): Promise<ZqualityResult> {
  const absRoot = path.resolve(root);
  const checks = runAllChecks(absRoot);
  const score = computeScore(checks);
  const grade = computeGrade(score);
  const categoryScores = computeCategoryScores(checks);

  const criticalFailures = checks
    .filter((c) => !c.passed && c.severity === 'critical')
    .map((c) => `${c.category}/${c.name}`);

  const recommendations = buildRecommendations(checks);
  const positives = buildPositives(checks);

  const allFiles = walkFiles(absRoot);
  const filesScanned = allFiles.length;

  const healthScore = computeHealthScore(checks);
  const risks = buildRisks(checks);

  const result: ZqualityResult = {
    root: absRoot,
    score,
    grade,
    healthScore,
    risks,
    checks,
    categoryScores,
    criticalFailures,
    recommendations,
    positives,
    filesScanned,
    createdAt: new Date().toISOString(),
  };

  if (opts.outputDir) {
    const { writeJsonReport } = await import('./report/json.js');
    const { writeMarkdownReport } = await import('./report/markdown.js');
    const { writeHtmlReport } = await import('./report/html.js');
    const { writeBadge } = await import('./report/badge.js');

    await writeJsonReport(result, opts.outputDir);
    await writeMarkdownReport(result, opts.outputDir);
    await writeHtmlReport(result, opts.outputDir);
    await writeBadge(result, opts.outputDir);
  }

  if (opts.upload) {
    const { uploadToZpulse } = await import('./upload.js');
    const apiUrl = process.env.ZPULSE_API_URL ?? '';
    const botToken = process.env.ZPULSE_BOT_TOKEN ?? '';
    const projectName = opts.projectName ?? path.basename(absRoot);
    const zpulseProjectId = opts.zpulseProjectId ?? process.env.ZPULSE_PROJECT_ID;
    if (apiUrl && botToken) {
      await uploadToZpulse(result, { apiUrl, botToken, projectName, zpulseProjectId });
    } else {
      console.warn('[zquality] ZPULSE_API_URL or ZPULSE_BOT_TOKEN not set; skipping upload.');
    }
  }

  return result;
}
