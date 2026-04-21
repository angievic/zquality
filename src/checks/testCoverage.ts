import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles } from '../utils.js';

const CATEGORY = 'testCoverage';

const SOURCE_EXTS = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.go']);
const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /test_.*\.py$/,
  /_test\.py$/,
  /_test\.go$/,
  /test_.*\.rs$/,
];

function isTestFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return TEST_PATTERNS.some((p) => p.test(base));
}

function isSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  if (!SOURCE_EXTS.has(ext)) return false;
  if (isTestFile(filePath)) return false;
  const base = path.basename(filePath);
  // Exclude config files
  if (/\.(config|setup|fixture|mock)\.(ts|js)$/.test(base)) return false;
  return true;
}

const TEST_CONFIGS = [
  'jest.config.js',
  'jest.config.ts',
  'jest.config.mjs',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'pytest.ini',
  'setup.cfg',
  'conftest.py',
  '.mocharc.js',
  '.mocharc.yml',
  'karma.conf.js',
];

export function checkTestCoverage(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  const testFiles = allFiles.filter(isTestFile);
  const sourceFiles = allFiles.filter(isSourceFile);

  // test_files_present
  results.push({
    category: CATEGORY,
    name: 'test_files_present',
    passed: testFiles.length > 0,
    severity: 'critical',
    detail: testFiles.length > 0
      ? `${testFiles.length} test file(s) found.`
      : 'No test files found. Tests are essential for code quality.',
  });

  // test_ratio_ok: test files / source files >= 20%
  const ratio = sourceFiles.length > 0 ? testFiles.length / sourceFiles.length : 0;
  const ratioOk = ratio >= 0.2;
  results.push({
    category: CATEGORY,
    name: 'test_ratio_ok',
    passed: ratioOk,
    severity: 'high',
    detail: ratioOk
      ? `Test ratio is ${Math.round(ratio * 100)}% (${testFiles.length} tests / ${sourceFiles.length} source files, ≥20%).`
      : `Test ratio is ${Math.round(ratio * 100)}% (${testFiles.length} tests / ${sourceFiles.length} source files). Target: ≥20%.`,
  });

  // test_config_present
  const testConfigFound = TEST_CONFIGS.find((cfg) => fs.existsSync(path.join(root, cfg)));

  // Also check pyproject.toml for [tool.pytest]
  let hasPyprojectPytest = false;
  const pyprojectPath = path.join(root, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      if (content.includes('[tool.pytest') || content.includes('[tool.pytest.ini_options]')) {
        hasPyprojectPytest = true;
      }
    } catch {
      // ignore
    }
  }

  const hasTestConfig = !!testConfigFound || hasPyprojectPytest;
  results.push({
    category: CATEGORY,
    name: 'test_config_present',
    passed: hasTestConfig,
    severity: 'medium',
    detail: hasTestConfig
      ? `Test framework config found: ${testConfigFound ?? 'pyproject.toml [tool.pytest]'}.`
      : 'No test framework config found (jest.config, vitest.config, pytest.ini, etc.).',
  });

  return results;
}
