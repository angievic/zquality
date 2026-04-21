import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'complexity';
const CODE_EXTS = new Set(['.ts', '.js', '.py', '.tsx', '.jsx']);

function countFunctionLines(content: string): { maxLines: number; hint: string } {
  const lines = content.split('\n');
  // Simple heuristic: track blocks starting with function/def/=>/arrow
  const funcStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (
      /^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/.test(line) ||
      /^(async\s+)?\w+\s*\(.*\)\s*\{/.test(line) ||
      /^\s*def\s+\w+\(/.test(line)
    ) {
      funcStarts.push(i);
    }
  }

  let maxLines = 0;
  let hintLine = 0;
  for (const start of funcStarts) {
    // Look ahead up to 200 lines for the end
    let braceDepth = 0;
    let end = start;
    let inFunc = false;
    for (let j = start; j < Math.min(start + 200, lines.length); j++) {
      const l = lines[j]!;
      for (const ch of l) {
        if (ch === '{') { braceDepth++; inFunc = true; }
        if (ch === '}') braceDepth--;
      }
      if (inFunc && braceDepth <= 0) { end = j; break; }
    }
    const len = end - start + 1;
    if (len > maxLines) { maxLines = len; hintLine = start + 1; }
  }

  return { maxLines, hint: hintLine > 0 ? `line ${hintLine}` : '' };
}

function maxNestingDepth(content: string): { depth: number; line: number } {
  const lines = content.split('\n');
  const IF_FOR = /^\s*(if|for|while|else|elif|try|except|with|switch|case)\b/;
  let maxDepth = 0;
  let maxLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (IF_FOR.test(line)) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const depth = Math.floor(leadingSpaces / 2);
      if (depth > maxDepth) { maxDepth = depth; maxLine = i + 1; }
    }
  }
  return { depth: maxDepth, line: maxLine };
}

export function checkComplexity(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root).filter((f) => CODE_EXTS.has(path.extname(f)));

  // no_large_functions: no functions > 50 lines
  let largeFuncFile = '';
  let largeFuncLines = 0;
  for (const f of allFiles) {
    const content = readFileSafe(f);
    const { maxLines, hint } = countFunctionLines(content);
    if (maxLines > 50 && maxLines > largeFuncLines) {
      largeFuncLines = maxLines;
      largeFuncFile = `${path.relative(root, f)} (${hint}, ${maxLines} lines)`;
    }
  }
  const noLargeFunctions = largeFuncLines <= 50;
  results.push({
    category: CATEGORY,
    name: 'no_large_functions',
    passed: noLargeFunctions,
    severity: 'medium',
    detail: noLargeFunctions
      ? 'No functions exceeding 50 lines found.'
      : `Function exceeding 50 lines detected (${largeFuncLines} lines).`,
    fileHint: noLargeFunctions ? undefined : largeFuncFile,
  });

  // acceptable_nesting: no nesting depth > 4
  let deepNestFile = '';
  let deepNestDepth = 0;
  for (const f of allFiles) {
    const content = readFileSafe(f);
    const { depth, line } = maxNestingDepth(content);
    if (depth > 4 && depth > deepNestDepth) {
      deepNestDepth = depth;
      deepNestFile = `${path.relative(root, f)}:${line} (depth ~${depth})`;
    }
  }
  const nestingOk = deepNestDepth <= 4;
  results.push({
    category: CATEGORY,
    name: 'acceptable_nesting',
    passed: nestingOk,
    severity: 'medium',
    detail: nestingOk
      ? 'No excessive nesting detected (depth ≤4).'
      : `Excessive nesting detected (depth ~${deepNestDepth}).`,
    fileHint: nestingOk ? undefined : deepNestFile,
  });

  // reasonable_file_size: no files > 300 lines
  let largeFile = '';
  let largeFileLines = 0;
  for (const f of allFiles) {
    const content = readFileSafe(f);
    const lineCount = content.split('\n').length;
    if (lineCount > 300 && lineCount > largeFileLines) {
      largeFileLines = lineCount;
      largeFile = `${path.relative(root, f)} (${lineCount} lines)`;
    }
  }
  const fileSizeOk = largeFileLines <= 300;
  results.push({
    category: CATEGORY,
    name: 'reasonable_file_size',
    passed: fileSizeOk,
    severity: 'low',
    detail: fileSizeOk
      ? 'No files exceeding 300 lines found.'
      : `File exceeding 300 lines detected (${largeFileLines} lines).`,
    fileHint: fileSizeOk ? undefined : largeFile,
  });

  return results;
}
