import type { ZqualityResult } from './types.js';

export async function uploadToZpulse(
  result: ZqualityResult,
  opts: {
    apiUrl: string;
    botToken: string;
    projectName: string;
    zpulseProjectId?: string;
  },
): Promise<void> {
  const url = `${opts.apiUrl.replace(/\/$/, '')}/api/zpulse/zquality-runs`;

  const body = {
    project_name: opts.projectName,
    zpulse_project_id: opts.zpulseProjectId,
    score: result.score,
    grade: result.grade,
    files_scanned: result.filesScanned,
    critical_failures: result.criticalFailures,
    recommendations: result.recommendations,
    positives: result.positives,
    report: result,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.botToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
}
