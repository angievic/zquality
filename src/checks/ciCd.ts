import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';
import { readFileSafe } from '../utils.js';

const CATEGORY = 'ciCd';

export function checkCiCd(root: string): CheckResult[] {
  const results: CheckResult[] = [];

  // ci_config_present
  const githubWorkflowsDir = path.join(root, '.github', 'workflows');
  const gitlabCiPath = path.join(root, '.gitlab-ci.yml');
  const jenkinsfilePath = path.join(root, 'Jenkinsfile');
  const circleCiPath = path.join(root, '.circleci', 'config.yml');
  const travisPath = path.join(root, '.travis.yml');
  const bitbucketPath = path.join(root, 'bitbucket-pipelines.yml');

  let ciConfigFile = '';
  let ciFiles: string[] = [];

  if (fs.existsSync(githubWorkflowsDir)) {
    try {
      const files = fs.readdirSync(githubWorkflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
      if (files.length > 0) {
        ciConfigFile = `.github/workflows/${files[0]}`;
        ciFiles = files.map((f) => path.join(githubWorkflowsDir, f));
      }
    } catch {
      // ignore
    }
  }

  if (!ciConfigFile) {
    if (fs.existsSync(gitlabCiPath)) { ciConfigFile = '.gitlab-ci.yml'; ciFiles = [gitlabCiPath]; }
    else if (fs.existsSync(jenkinsfilePath)) { ciConfigFile = 'Jenkinsfile'; ciFiles = [jenkinsfilePath]; }
    else if (fs.existsSync(circleCiPath)) { ciConfigFile = '.circleci/config.yml'; ciFiles = [circleCiPath]; }
    else if (fs.existsSync(travisPath)) { ciConfigFile = '.travis.yml'; ciFiles = [travisPath]; }
    else if (fs.existsSync(bitbucketPath)) { ciConfigFile = 'bitbucket-pipelines.yml'; ciFiles = [bitbucketPath]; }
  }

  const hasCiConfig = !!ciConfigFile;
  results.push({
    category: CATEGORY,
    name: 'ci_config_present',
    passed: hasCiConfig,
    severity: 'high',
    detail: hasCiConfig
      ? `CI configuration found: ${ciConfigFile}.`
      : 'No CI configuration found (.github/workflows, .gitlab-ci.yml, Jenkinsfile, etc.).',
  });

  // ci_runs_tests: at least one workflow mentions test/pytest/jest/vitest
  const TEST_KEYWORDS = /\b(test|pytest|jest|vitest|mocha|cargo test|go test|rspec)\b/i;
  let ciRunsTests = false;
  for (const ciFile of ciFiles) {
    const content = readFileSafe(ciFile);
    if (TEST_KEYWORDS.test(content)) {
      ciRunsTests = true;
      break;
    }
  }

  results.push({
    category: CATEGORY,
    name: 'ci_runs_tests',
    passed: ciRunsTests,
    severity: 'high',
    detail: ciRunsTests
      ? 'CI configuration includes test execution.'
      : hasCiConfig
        ? 'CI config found but no test step detected. Ensure your pipeline runs tests.'
        : 'No CI configuration found, so tests cannot be verified.',
  });

  // dockerfile_present
  const dockerfilePath = path.join(root, 'Dockerfile');
  const dockerfileDevPath = path.join(root, 'Dockerfile.dev');
  const dockerComposePath = path.join(root, 'docker-compose.yml');
  const dockerComposeYamlPath = path.join(root, 'docker-compose.yaml');

  const hasDocker =
    fs.existsSync(dockerfilePath) ||
    fs.existsSync(dockerfileDevPath) ||
    fs.existsSync(dockerComposePath) ||
    fs.existsSync(dockerComposeYamlPath);

  results.push({
    category: CATEGORY,
    name: 'dockerfile_present',
    passed: hasDocker,
    severity: 'medium',
    detail: hasDocker
      ? 'Docker configuration found (Dockerfile or docker-compose.yml).'
      : 'No Dockerfile or docker-compose.yml found. Containerization aids reproducibility.',
  });

  return results;
}
