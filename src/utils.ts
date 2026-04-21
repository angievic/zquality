import fs from 'node:fs';
import path from 'node:path';

/**
 * Walk a directory recursively and return all file paths.
 * Skips node_modules, .git, dist, __pycache__, .venv, venv, .next
 */
export function walkFiles(dir: string, _depth = 0): string[] {
  const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    '.venv',
    'venv',
    '.next',
    '.cache',
    'coverage',
    '.tox',
  ]);

  if (_depth > 10) return [];

  let results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkFiles(full, _depth + 1));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Read a file safely, returning empty string on error.
 */
export function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get directory depth of a path relative to root.
 */
export function nestingDepth(filePath: string, root: string): number {
  const rel = path.relative(root, filePath);
  return rel.split(path.sep).length - 1;
}

/**
 * Get all immediate subdirectories of a directory.
 */
export function getSubdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}
