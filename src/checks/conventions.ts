import path from 'node:path';
import fs from 'node:fs';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'conventions';

function isKebab(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}

function isCamel(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name);
}

function isPascal(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

export function checkConventions(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  // consistent_naming: detect mix of kebab-case and camelCase in same dir
  const dirFileNames = new Map<string, string[]>();
  for (const f of allFiles) {
    const dir = path.dirname(f);
    const base = path.basename(f, path.extname(f));
    if (!dirFileNames.has(dir)) dirFileNames.set(dir, []);
    dirFileNames.get(dir)!.push(base);
  }

  let inconsistentDir = '';
  for (const [dir, names] of dirFileNames) {
    if (names.length < 3) continue;
    const kebabCount = names.filter(isKebab).length;
    const camelCount = names.filter((n) => isCamel(n) || isPascal(n)).length;
    if (kebabCount > 0 && camelCount > 0 && Math.min(kebabCount, camelCount) >= 2) {
      inconsistentDir = path.relative(root, dir) || '.';
      break;
    }
  }

  const namingOk = !inconsistentDir;
  results.push({
    category: CATEGORY,
    name: 'consistent_naming',
    passed: namingOk,
    severity: 'low',
    detail: namingOk
      ? 'File naming appears consistent within directories.'
      : 'Mixed naming conventions (kebab-case and camelCase/PascalCase) detected in same directory.',
    fileHint: inconsistentDir || undefined,
  });

  // prefer_const: check .ts/.js files don't use `var`
  const tsJsFiles = allFiles.filter((f) => {
    const ext = path.extname(f);
    return ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx';
  });

  let varFile = '';
  let varCount = 0;
  for (const f of tsJsFiles) {
    const content = readFileSafe(f);
    const matches = content.match(/\bvar\s+\w+/g);
    if (matches && matches.length > varCount) {
      varCount = matches.length;
      varFile = `${path.relative(root, f)} (${matches.length} var usages)`;
    }
  }

  const preferConst = varCount === 0;
  results.push({
    category: CATEGORY,
    name: 'prefer_const',
    passed: preferConst,
    severity: 'low',
    detail: preferConst
      ? 'No var declarations found. Using const/let is preferred.'
      : `var declarations found. Prefer const/let over var (${varCount} usages).`,
    fileHint: preferConst ? undefined : varFile,
  });

  // manageable_todos: TODO/FIXME count < 10
  let todoCount = 0;
  let todoFile = '';
  for (const f of allFiles) {
    const ext = path.extname(f);
    if (!['.ts', '.js', '.tsx', '.jsx', '.py', '.md'].includes(ext)) continue;
    const content = readFileSafe(f);
    const matches = content.match(/\b(TODO|FIXME|HACK|XXX)\b/g);
    if (matches) {
      todoCount += matches.length;
      if (!todoFile) todoFile = path.relative(root, f);
    }
  }

  const todoOk = todoCount < 10;
  results.push({
    category: CATEGORY,
    name: 'manageable_todos',
    passed: todoOk,
    severity: 'low',
    detail: todoOk
      ? `${todoCount} TODO/FIXME comments found (acceptable: <10).`
      : `${todoCount} TODO/FIXME comments found. Consider creating issues to track technical debt.`,
    fileHint: todoOk ? undefined : todoFile,
  });

  return results;
}
