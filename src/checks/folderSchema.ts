import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles } from '../utils.js';

const CATEGORY = 'folderSchema';

export function checkFolderSchema(root: string): CheckResult[] {
  const results: CheckResult[] = [];

  // has_src_dir: src/, lib/, or app/ present
  const hasSrcDir =
    fs.existsSync(path.join(root, 'src')) ||
    fs.existsSync(path.join(root, 'lib')) ||
    fs.existsSync(path.join(root, 'app'));

  results.push({
    category: CATEGORY,
    name: 'has_src_dir',
    passed: hasSrcDir,
    severity: 'high',
    detail: hasSrcDir
      ? 'Source directory (src/, lib/, or app/) found.'
      : 'No source directory found. Expected src/, lib/, or app/.',
  });

  // has_tests_dir: tests/ or __tests__ present
  const hasTestsDir =
    fs.existsSync(path.join(root, 'tests')) ||
    fs.existsSync(path.join(root, '__tests__')) ||
    fs.existsSync(path.join(root, 'test'));

  results.push({
    category: CATEGORY,
    name: 'has_tests_dir',
    passed: hasTestsDir,
    severity: 'high',
    detail: hasTestsDir
      ? 'Test directory found.'
      : 'No test directory found. Expected tests/, test/, or __tests__/.',
  });

  // reasonable_depth: max nesting depth <= 5
  const allFiles = walkFiles(root);
  let maxDepth = 0;
  let deepestFile = '';
  for (const f of allFiles) {
    const rel = path.relative(root, f);
    const depth = rel.split(path.sep).length - 1;
    if (depth > maxDepth) {
      maxDepth = depth;
      deepestFile = rel;
    }
  }
  const depthOk = maxDepth <= 5;

  results.push({
    category: CATEGORY,
    name: 'reasonable_depth',
    passed: depthOk,
    severity: 'low',
    detail: depthOk
      ? `Max nesting depth is ${maxDepth} (≤5).`
      : `Max nesting depth is ${maxDepth} (>5). Deep nesting increases cognitive load.`,
    fileHint: deepestFile || undefined,
  });

  return results;
}
