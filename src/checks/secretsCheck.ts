import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'secretsCheck';

// Skip binary/lock/generated files for secrets scanning
const SKIP_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.lock', '.sum', '.mod', '.map',
]);

function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXTS.has(ext)) return false;
  const base = path.basename(filePath);
  // Skip binary-like files
  if (base === 'package-lock.json' || base === 'yarn.lock' || base === 'pnpm-lock.yaml') return false;
  return true;
}

type SecretMatch = { file: string; line: number; pattern: string };

function scanForPattern(root: string, allFiles: string[], regex: RegExp, patternName: string): SecretMatch | null {
  for (const f of allFiles) {
    if (!shouldScanFile(f)) continue;
    const content = readFileSafe(f);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i]!)) {
        return { file: path.relative(root, f), line: i + 1, pattern: patternName };
      }
    }
  }
  return null;
}

export function checkSecrets(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  // no_api_keys: generic API key patterns
  const apiKeyRegex = /api[_-]?key\s*[=:]\s*["'][^"']{8,}["']/i;
  const apiKeyMatch = scanForPattern(root, allFiles, apiKeyRegex, 'api_key');

  // Also check for OpenAI/Anthropic key pattern
  const openaiKeyRegex = /sk-[A-Za-z0-9]{20,}/;
  const openaiMatch = apiKeyMatch ?? scanForPattern(root, allFiles, openaiKeyRegex, 'openai_key');

  const noApiKeys = !openaiMatch;
  results.push({
    category: CATEGORY,
    name: 'no_api_keys',
    passed: noApiKeys,
    severity: 'critical',
    detail: noApiKeys
      ? 'No hardcoded API keys detected.'
      : `Potential hardcoded API key found (pattern: ${openaiMatch!.pattern}).`,
    fileHint: noApiKeys ? undefined : `${openaiMatch!.file}:${openaiMatch!.line}`,
  });

  // no_aws_keys: AWS access key patterns
  const awsKeyRegex = /AKIA[A-Z0-9]{16}/;
  const awsSecretRegex = /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["'][^"']{8,}["']/i;
  const awsMatch =
    scanForPattern(root, allFiles, awsKeyRegex, 'aws_access_key') ??
    scanForPattern(root, allFiles, awsSecretRegex, 'aws_secret');

  const noAwsKeys = !awsMatch;
  results.push({
    category: CATEGORY,
    name: 'no_aws_keys',
    passed: noAwsKeys,
    severity: 'critical',
    detail: noAwsKeys
      ? 'No hardcoded AWS keys detected.'
      : `Potential hardcoded AWS key found (pattern: ${awsMatch!.pattern}).`,
    fileHint: noAwsKeys ? undefined : `${awsMatch!.file}:${awsMatch!.line}`,
  });

  // no_github_tokens: GitHub personal access tokens
  const ghpRegex = /ghp_[A-Za-z0-9]{36}/;
  const githubClassicRegex = /github[_-]?token\s*[=:]\s*["'][^"']{8,}["']/i;
  const ghMatch =
    scanForPattern(root, allFiles, ghpRegex, 'github_pat') ??
    scanForPattern(root, allFiles, githubClassicRegex, 'github_token');

  // Also check for AIza (Google API key) here
  const aizaRegex = /AIza[A-Za-z0-9_-]{35}/;
  const googleMatch = ghMatch ?? scanForPattern(root, allFiles, aizaRegex, 'google_api_key');

  const noGithubTokens = !googleMatch;
  results.push({
    category: CATEGORY,
    name: 'no_github_tokens',
    passed: noGithubTokens,
    severity: 'critical',
    detail: noGithubTokens
      ? 'No hardcoded GitHub tokens or Google API keys detected.'
      : `Potential hardcoded token found (pattern: ${googleMatch!.pattern}).`,
    fileHint: noGithubTokens ? undefined : `${googleMatch!.file}:${googleMatch!.line}`,
  });

  return results;
}
