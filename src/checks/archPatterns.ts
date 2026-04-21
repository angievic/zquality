import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'archPatterns';

export function checkArchPatterns(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  // barrel_exports: index.ts/index.js present in subdirectories
  const subdirs = (() => {
    try {
      return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !['node_modules', '.git', 'dist', '.next'].includes(e.name))
        .map((e) => e.name);
    } catch {
      return [] as string[];
    }
  })();

  let barrelCount = 0;
  for (const sub of subdirs) {
    const subPath = path.join(root, sub);
    try {
      const entries = fs.readdirSync(subPath);
      if (
        entries.some((e) => e === 'index.ts' || e === 'index.js' || e === 'index.tsx')
      ) {
        barrelCount++;
      }
    } catch {
      // skip
    }
  }

  const hasBarrels = subdirs.length === 0 || barrelCount > 0;
  results.push({
    category: CATEGORY,
    name: 'barrel_exports',
    passed: hasBarrels,
    severity: 'low',
    detail: hasBarrels
      ? `Barrel exports (index files) found in ${barrelCount} subdirectory/ies.`
      : 'No barrel export files (index.ts/index.js) found in subdirectories.',
  });

  // no_obvious_circular: same filename not imported twice in same file
  const tsJsFiles = allFiles.filter((f) => {
    const ext = path.extname(f);
    return ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx';
  });

  let circularHint = '';
  let foundCircular = false;
  for (const f of tsJsFiles) {
    const content = readFileSafe(f);
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g) ?? [];
    const seen = new Map<string, number>();
    for (const m of importMatches) {
      const mod = m.replace(/from\s+['"]/, '').replace(/['"]$/, '');
      const base = path.basename(mod);
      seen.set(base, (seen.get(base) ?? 0) + 1);
    }
    for (const [mod, count] of seen) {
      if (count > 1 && !mod.startsWith('@')) {
        foundCircular = true;
        circularHint = `${path.relative(root, f)} imports '${mod}' ${count} times`;
        break;
      }
    }
    if (foundCircular) break;
  }

  results.push({
    category: CATEGORY,
    name: 'no_obvious_circular',
    passed: !foundCircular,
    severity: 'medium',
    detail: !foundCircular
      ? 'No obvious duplicate imports detected.'
      : 'Potential circular import hint: same module imported multiple times in a file.',
    fileHint: foundCircular ? circularHint : undefined,
  });

  // no_db_in_ui: UI components not importing database/SQL patterns
  const uiFiles = allFiles.filter((f) => {
    const rel = path.relative(root, f).toLowerCase();
    return (
      rel.includes('component') ||
      rel.includes('ui/') ||
      rel.includes('/ui') ||
      rel.includes('pages/') ||
      rel.includes('views/') ||
      rel.match(/\.(tsx|jsx)$/) != null
    );
  });

  const DB_PATTERNS = /\b(pool\.query|sequelize\.|mongoose\.|prisma\.|typeorm|knex\(|sql`|pg\.connect|createClient\(|getPool\()/;
  let dbInUiFile = '';
  for (const f of uiFiles) {
    const content = readFileSafe(f);
    if (DB_PATTERNS.test(content)) {
      dbInUiFile = path.relative(root, f);
      break;
    }
  }

  results.push({
    category: CATEGORY,
    name: 'no_db_in_ui',
    passed: !dbInUiFile,
    severity: 'high',
    detail: !dbInUiFile
      ? 'No database patterns found in UI component files.'
      : 'Database/SQL patterns found in a UI component file. Separation of concerns issue.',
    fileHint: dbInUiFile || undefined,
  });

  return results;
}
