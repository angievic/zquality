import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { walkFiles, readFileSafe } from '../utils.js';

const CATEGORY = 'docsQuality';

export function checkDocsQuality(root: string): CheckResult[] {
  const results: CheckResult[] = [];
  const allFiles = walkFiles(root);

  // readme_present: README.md present and > 200 chars
  const readmePath = path.join(root, 'README.md');
  const readmeAltPath = path.join(root, 'readme.md');
  const readmeExists = fs.existsSync(readmePath) || fs.existsSync(readmeAltPath);
  let readmeLength = 0;
  if (readmeExists) {
    const content = readFileSafe(fs.existsSync(readmePath) ? readmePath : readmeAltPath);
    readmeLength = content.length;
  }
  const readmeOk = readmeExists && readmeLength > 200;
  results.push({
    category: CATEGORY,
    name: 'readme_present',
    passed: readmeOk,
    severity: 'high',
    detail: readmeOk
      ? `README.md found with ${readmeLength} characters.`
      : readmeExists
        ? `README.md found but too short (${readmeLength} chars). Expand to >200 chars.`
        : 'No README.md found. Documentation is essential for maintainability.',
  });

  // comments_ratio: inline comment ratio > 5% of code lines
  const codeFiles = allFiles.filter((f) => {
    const ext = path.extname(f);
    return ['.ts', '.js', '.tsx', '.jsx', '.py'].includes(ext);
  });

  let totalCodeLines = 0;
  let totalCommentLines = 0;
  for (const f of codeFiles) {
    const content = readFileSafe(f);
    const lines = content.split('\n');
    totalCodeLines += lines.length;
    const commentLines = lines.filter((l) => {
      const trimmed = l.trim();
      return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('"""') ||
        trimmed.startsWith("'''")
      );
    });
    totalCommentLines += commentLines.length;
  }

  const commentRatio = totalCodeLines > 0 ? totalCommentLines / totalCodeLines : 0;
  const commentsOk = commentRatio >= 0.05;
  results.push({
    category: CATEGORY,
    name: 'comments_ratio',
    passed: commentsOk,
    severity: 'low',
    detail: commentsOk
      ? `Comment ratio is ${Math.round(commentRatio * 100)}% (≥5%).`
      : `Comment ratio is ${Math.round(commentRatio * 100)}% (<5%). Add inline documentation.`,
  });

  // changelog_or_adr: CHANGELOG.md or ADR directory
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const changelogAltPath = path.join(root, 'CHANGELOG');
  const adrPath = path.join(root, 'docs/adr');
  const adrPath2 = path.join(root, 'adr');
  const adrPath3 = path.join(root, 'docs/decisions');

  const hasChangelog = fs.existsSync(changelogPath) || fs.existsSync(changelogAltPath);
  const hasAdr = fs.existsSync(adrPath) || fs.existsSync(adrPath2) || fs.existsSync(adrPath3);
  const hasChangelogOrAdr = hasChangelog || hasAdr;

  results.push({
    category: CATEGORY,
    name: 'changelog_or_adr',
    passed: hasChangelogOrAdr,
    severity: 'low',
    detail: hasChangelogOrAdr
      ? `Documentation found: ${hasChangelog ? 'CHANGELOG.md' : ''}${hasChangelog && hasAdr ? ' + ' : ''}${hasAdr ? 'ADR directory' : ''}.`
      : 'No CHANGELOG.md or ADR (Architecture Decision Records) directory found.',
  });

  return results;
}
