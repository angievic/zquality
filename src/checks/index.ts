import type { CheckResult } from '../types.js';
import { checkFolderSchema } from './folderSchema.js';
import { checkComplexity } from './complexity.js';
import { checkArchPatterns } from './archPatterns.js';
import { checkConventions } from './conventions.js';
import { checkDependencies } from './dependencies.js';
import { checkTestCoverage } from './testCoverage.js';
import { checkDocsQuality } from './docsQuality.js';
import { checkSecrets } from './secretsCheck.js';
import { checkCiCd } from './ciCd.js';
import { checkErrorHandling } from './errorHandling.js';

export function runAllChecks(root: string): CheckResult[] {
  const checks: CheckResult[] = [
    ...checkFolderSchema(root),
    ...checkComplexity(root),
    ...checkArchPatterns(root),
    ...checkConventions(root),
    ...checkDependencies(root),
    ...checkTestCoverage(root),
    ...checkDocsQuality(root),
    ...checkSecrets(root),
    ...checkCiCd(root),
    ...checkErrorHandling(root),
  ];
  return checks;
}
