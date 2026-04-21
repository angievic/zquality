import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'errorHandling';

const IO_PATTERNS_JS = /\b(fetch\(|readFile|writeFile|readFileSync|writeFileSync|connect\(|createConnection|axios\.|got\(|http\.get|https\.get)\b/;
const IO_PATTERNS_PY = /\b(requests\.|urllib\.|open\(|connect\(|socket\.|aiohttp\.|httpx\.)\b/;

const TRY_CATCH_JS = /\btry\s*\{/;
const TRY_EXCEPT_PY = /\btry\s*:/;

const EMPTY_CATCH_JS = /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/;
const EMPTY_CATCH_BARE = /catch\s*\{[\s]*\}/;
const EMPTY_EXCEPT_PY = /except\s*(?:[A-Za-z.]+)?\s*:\s*\n\s*pass\b/;

const ERROR_MSG_JS = /\b(console\.error|console\.warn|logger\.(error|warn)|throw\s+new\s+Error|reject\(|Error\()\b/;
const ERROR_MSG_PY = /\b(logging\.(error|warning|exception)|raise\s+\w+Error|print\s*\(\s*["']error|logger\.(error|warning))\b/;

export function checkErrorHandling(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  const jsFiles = allFiles.filter((f) => {
    const ext = path.extname(f);
    return ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx';
  });
  const pyFiles = allFiles.filter((f) => path.extname(f) === '.py');

  // try_catch_in_io: files doing I/O should have try/catch
  let ioWithoutTry = '';
  for (const f of jsFiles) {
    const content = readFileSafe(f);
    if (IO_PATTERNS_JS.test(content) && !TRY_CATCH_JS.test(content)) {
      ioWithoutTry = path.relative(root, f);
      break;
    }
  }
  if (!ioWithoutTry) {
    for (const f of pyFiles) {
      const content = readFileSafe(f);
      if (IO_PATTERNS_PY.test(content) && !TRY_EXCEPT_PY.test(content)) {
        ioWithoutTry = path.relative(root, f);
        break;
      }
    }
  }

  const hasTryCatchInIo = !ioWithoutTry;
  results.push({
    category: CATEGORY,
    name: 'try_catch_in_io',
    passed: hasTryCatchInIo,
    severity: 'high',
    detail: hasTryCatchInIo
      ? 'I/O operations appear to have error handling (try/catch).'
      : 'I/O operations found without try/catch error handling.',
    fileHint: hasTryCatchInIo ? undefined : ioWithoutTry,
  });

  // no_empty_catch: no bare catch{} or except: pass
  let emptyCatchFile = '';
  for (const f of jsFiles) {
    const content = readFileSafe(f);
    if (EMPTY_CATCH_JS.test(content) || EMPTY_CATCH_BARE.test(content)) {
      emptyCatchFile = path.relative(root, f);
      break;
    }
  }
  if (!emptyCatchFile) {
    for (const f of pyFiles) {
      const content = readFileSafe(f);
      if (EMPTY_EXCEPT_PY.test(content)) {
        emptyCatchFile = path.relative(root, f);
        break;
      }
    }
  }

  const noEmptyCatch = !emptyCatchFile;
  results.push({
    category: CATEGORY,
    name: 'no_empty_catch',
    passed: noEmptyCatch,
    severity: 'high',
    detail: noEmptyCatch
      ? 'No empty catch blocks detected.'
      : 'Empty catch block detected. Swallowing errors silently hides bugs.',
    fileHint: noEmptyCatch ? undefined : emptyCatchFile,
  });

  // error_messages_present: error logging/throwing patterns present
  const allCodeFiles = [...jsFiles, ...pyFiles];
  let hasErrorMessages = false;
  for (const f of allCodeFiles) {
    const content = readFileSafe(f);
    const ext = path.extname(f);
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext) && ERROR_MSG_JS.test(content)) {
      hasErrorMessages = true;
      break;
    }
    if (ext === '.py' && ERROR_MSG_PY.test(content)) {
      hasErrorMessages = true;
      break;
    }
  }

  results.push({
    category: CATEGORY,
    name: 'error_messages_present',
    passed: hasErrorMessages,
    severity: 'medium',
    detail: hasErrorMessages
      ? 'Error logging/throwing patterns found in the codebase.'
      : 'No error logging or throwing patterns found. Ensure errors are surfaced properly.',
  });

  return results;
}
