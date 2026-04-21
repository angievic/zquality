export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CheckResult = {
  category: string;
  name: string;
  passed: boolean;
  severity: Severity;
  detail: string;
  fileHint?: string;
};

export type CategoryScore = {
  name: string;
  score: number; // 0-100
  passed: number;
  total: number;
};

export type RiskItem = {
  type: 'circular_import' | 'redundant_code' | 'dead_export' | 'high_coupling' | 'copy_paste';
  severity: Severity;
  detail: string;
  files: string[]; // affected file paths (relative to root)
};

export type ZqualityResult = {
  root: string;
  score: number; // 0-100 weighted
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  healthScore: number; // 0-100, based on codeHealth checks only
  risks: RiskItem[];   // structured list of detected code risks
  checks: CheckResult[];
  categoryScores: CategoryScore[];
  criticalFailures: string[];
  recommendations: string[]; // top 5
  positives: string[]; // passed critical/high checks
  filesScanned: number;
  createdAt: string;
};

export type ZqualityOptions = {
  outputDir?: string;
  upload?: boolean;
  projectName?: string;
  zpulseProjectId?: string;
};
