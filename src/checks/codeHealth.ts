/**
 * codeHealth checks — structural risk analysis.
 *
 * These go deeper than surface-level patterns to detect actual risk signals:
 * circular imports, redundant/copy-pasted code, dead exports, and high coupling.
 */
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'codeHealth';
const CODE_EXTS = new Set(['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs', '.py']);

// ── Helpers ─────────────────────────────────────────────────────────────────

function isCodeFile(f: string): boolean {
  return CODE_EXTS.has(path.extname(f).toLowerCase());
}

/**
 * Extract imported module paths from a file's content.
 * Handles ES imports, require(), and Python imports.
 */
function extractImports(content: string, filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  const imported: string[] = [];

  if (ext === '.py') {
    // Python: "from X import Y" and "import X"
    const pyFrom = content.matchAll(/^\s*from\s+(\.{0,2}[\w./]+)\s+import/gm);
    const pyImport = content.matchAll(/^\s*import\s+([\w.]+)/gm);
    for (const m of pyFrom) if (m[1]) imported.push(m[1]);
    for (const m of pyImport) if (m[1]) imported.push(m[1]);
  } else {
    // JS/TS: import ... from 'X' and require('X')
    const esImports = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
    const requires = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const m of esImports) if (m[1]) imported.push(m[1]);
    for (const m of requires) if (m[1]) imported.push(m[1]);
  }

  return imported;
}

/** Resolve a relative import to an absolute path (best-effort). */
function resolveImport(importPath: string, fromFile: string, root: string): string | null {
  if (!importPath.startsWith('.')) return null; // external module
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importPath);
  // Try with and without extension
  const candidates = [
    resolved,
    resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '.jsx',
    path.join(resolved, 'index.ts'), path.join(resolved, 'index.js'),
  ];
  // Return normalized path relative to root so cycles are detectable
  for (const c of candidates) {
    if (c.startsWith(root)) return c;
  }
  return resolved.startsWith(root) ? resolved : null;
}

// ── Check 1: Circular imports ────────────────────────────────────────────────

function detectCircularImports(
  root: string,
  files: string[],
): { found: boolean; cycle: string[] } {
  // Build adjacency map: absPath → [absPath]
  const graph = new Map<string, string[]>();
  for (const f of files) {
    if (!isCodeFile(f)) continue;
    const content = readFileSafe(f);
    const imports = extractImports(content, f)
      .map(imp => resolveImport(imp, f, root))
      .filter((r): r is string => r !== null);
    graph.set(f, imports);
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string>();

  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    for (const neighbor of graph.get(node) ?? []) {
      if (!graph.has(neighbor)) continue; // external file
      if (color.get(neighbor) === GRAY) {
        // Found cycle — reconstruct it
        const cycle: string[] = [neighbor];
        let cur: string | undefined = node;
        while (cur && cur !== neighbor) {
          cycle.unshift(cur);
          cur = parent.get(cur);
        }
        cycle.unshift(neighbor);
        return cycle.map(p => path.relative(root, p));
      }
      if (!color.get(neighbor)) {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result) return result;
      }
    }
    color.set(node, BLACK);
    return null;
  }

  for (const f of graph.keys()) {
    if (!color.get(f)) {
      const cycle = dfs(f);
      if (cycle) return { found: true, cycle };
    }
  }
  return { found: false, cycle: [] };
}

// ── Check 2: Redundant / copy-pasted code ───────────────────────────────────

/** Normalize a line for comparison: trim + collapse whitespace */
function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ').toLowerCase();
}

function detectRedundancy(
  root: string,
  files: string[],
): { found: boolean; count: number; example: string } {
  const BLOCK_SIZE = 6; // lines per block
  const MIN_DUPLICATES = 3; // minimum duplicate blocks to flag

  // hash → [file:lineStart]
  const blockIndex = new Map<string, string[]>();

  for (const f of files) {
    if (!isCodeFile(f)) continue;
    const content = readFileSafe(f);
    const lines = content.split('\n').map(normalizeLine).filter(l => l.length > 5); // skip blank/trivial
    if (lines.length < BLOCK_SIZE) continue;

    const rel = path.relative(root, f);
    for (let i = 0; i <= lines.length - BLOCK_SIZE; i++) {
      const block = lines.slice(i, i + BLOCK_SIZE).join('\n');
      if (!blockIndex.has(block)) blockIndex.set(block, []);
      blockIndex.get(block)!.push(`${rel}:${i + 1}`);
    }
  }

  // Count blocks that appear in more than one file
  let totalDuplicateBlocks = 0;
  let exampleBlock = '';
  let exampleLocations: string[] = [];

  for (const [, locations] of blockIndex) {
    const uniqueFiles = new Set(locations.map(l => l.split(':')[0]));
    if (uniqueFiles.size >= 2) {
      totalDuplicateBlocks++;
      if (!exampleBlock) {
        exampleLocations = locations.slice(0, 2);
        exampleBlock = locations[0] ?? '';
      }
    }
  }

  const found = totalDuplicateBlocks >= MIN_DUPLICATES;
  return {
    found,
    count: totalDuplicateBlocks,
    example: exampleLocations.length > 0 ? exampleLocations.join(', ') : '',
  };
}

// ── Check 3: Dead exports ────────────────────────────────────────────────────

function detectDeadExports(
  root: string,
  files: string[],
): { found: boolean; examples: string[] } {
  const tsJsFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
  });

  // Collect all named exports (not default, not re-exports)
  const exports: Array<{ name: string; file: string }> = [];
  const NAMED_EXPORT = /^export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/gm;
  const RE_EXPORT = /^export\s+\{/;

  for (const f of tsJsFiles) {
    const content = readFileSafe(f);
    for (const m of content.matchAll(NAMED_EXPORT)) {
      if (m[1] && m[1] !== 'default') {
        exports.push({ name: m[1], file: f });
      }
    }
  }

  if (exports.length === 0) return { found: false, examples: [] };

  // Build a single string of all imports across all files
  const allImportContent = tsJsFiles.map(f => readFileSafe(f)).join('\n');

  const dead: string[] = [];
  for (const exp of exports) {
    // Check if this name is imported anywhere (rough heuristic)
    const importedPattern = new RegExp(`\\b${exp.name}\\b`);
    const fileContent = readFileSafe(exp.file);
    // Count occurrences in all OTHER files
    const otherContent = allImportContent.replace(fileContent, '');
    if (!importedPattern.test(otherContent)) {
      dead.push(`${path.relative(root, exp.file)}: ${exp.name}`);
    }
    if (dead.length >= 5) break; // limit to 5 examples
  }

  // Only flag if >10% of exports are dead (to avoid false positives on entry points)
  const threshold = Math.max(3, Math.round(exports.length * 0.1));
  return {
    found: dead.length >= threshold,
    examples: dead.slice(0, 3),
  };
}

// ── Check 4: High coupling (god files) ──────────────────────────────────────

function detectHighCoupling(
  root: string,
  files: string[],
): { found: boolean; file: string; importCount: number } {
  const COUPLING_THRESHOLD = 15;
  let worstFile = '';
  let worstCount = 0;

  for (const f of files) {
    if (!isCodeFile(f)) continue;
    const content = readFileSafe(f);
    const imports = extractImports(content, f).filter(i => i.startsWith('.')); // internal only
    const unique = new Set(imports).size;
    if (unique > COUPLING_THRESHOLD && unique > worstCount) {
      worstCount = unique;
      worstFile = path.relative(root, f);
    }
  }

  return {
    found: worstCount > COUPLING_THRESHOLD,
    file: worstFile,
    importCount: worstCount,
  };
}

// ── Check 5: Copy-paste patterns (same function name in many files) ──────────

function detectCopyPastePatterns(
  root: string,
  files: string[],
): { found: boolean; examples: string[] } {
  // Find function/method names that appear in 3+ different files (likely copy-pasted)
  const funcFiles = new Map<string, Set<string>>();
  const FUNC_DEF = /(?:function|def)\s+(\w{4,})\s*\(/g;

  for (const f of files) {
    if (!isCodeFile(f)) continue;
    const content = readFileSafe(f);
    const rel = path.relative(root, f);
    for (const m of content.matchAll(FUNC_DEF)) {
      if (!m[1]) continue;
      const name = m[1];
      // Skip common utility names
      if (['main', 'init', 'setup', 'test', 'run', 'handler', 'render'].includes(name)) continue;
      if (!funcFiles.has(name)) funcFiles.set(name, new Set());
      funcFiles.get(name)!.add(rel);
    }
  }

  const duplicates: string[] = [];
  for (const [name, fileSet] of funcFiles) {
    if (fileSet.size >= 3) {
      duplicates.push(`\`${name}\` in ${fileSet.size} files`);
    }
    if (duplicates.length >= 3) break;
  }

  return {
    found: duplicates.length >= 2,
    examples: duplicates,
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

export function checkCodeHealth(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  // 1 — Circular imports
  const circular = detectCircularImports(root, allFiles);
  results.push({
    category: CATEGORY,
    name: 'no_circular_deps',
    passed: !circular.found,
    severity: 'high',
    detail: circular.found
      ? `Circular dependency detected: ${circular.cycle.join(' → ')}`
      : 'No circular imports detected.',
    fileHint: circular.found ? circular.cycle[0] : undefined,
  });

  // 2 — Redundant code blocks
  const redundancy = detectRedundancy(root, allFiles);
  results.push({
    category: CATEGORY,
    name: 'no_redundant_code',
    passed: !redundancy.found,
    severity: 'medium',
    detail: redundancy.found
      ? `${redundancy.count} duplicate code blocks found across multiple files.`
      : 'No significant code duplication detected.',
    fileHint: redundancy.found ? redundancy.example : undefined,
  });

  // 3 — Dead exports
  const dead = detectDeadExports(root, allFiles);
  results.push({
    category: CATEGORY,
    name: 'no_dead_exports',
    passed: !dead.found,
    severity: 'low',
    detail: dead.found
      ? `Potentially unused exports detected: ${dead.examples.join('; ')}`
      : 'No obvious dead exports detected.',
    fileHint: dead.found ? dead.examples[0] : undefined,
  });

  // 4 — High coupling
  const coupling = detectHighCoupling(root, allFiles);
  results.push({
    category: CATEGORY,
    name: 'low_coupling',
    passed: !coupling.found,
    severity: 'medium',
    detail: coupling.found
      ? `High coupling: \`${coupling.file}\` imports ${coupling.importCount} internal modules.`
      : 'No over-coupled files detected (all files import ≤15 internal modules).',
    fileHint: coupling.found ? coupling.file : undefined,
  });

  // 5 — Copy-paste patterns
  const copyPaste = detectCopyPastePatterns(root, allFiles);
  results.push({
    category: CATEGORY,
    name: 'no_copy_paste_patterns',
    passed: !copyPaste.found,
    severity: 'medium',
    detail: copyPaste.found
      ? `Copy-paste pattern: same function name in 3+ files (${copyPaste.examples.join(', ')}).`
      : 'No obvious copy-paste function patterns detected.',
  });

  return results;
}
