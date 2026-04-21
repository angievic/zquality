import fs from 'node:fs';
import path from 'node:path';
import type { ZqualityResult } from '../types.js';

export async function writeJsonReport(result: ZqualityResult, outputDir: string): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, 'zquality-result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  return outPath;
}
