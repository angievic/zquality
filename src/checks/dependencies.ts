import fs from 'node:fs';
import path from 'node:path';
import type { CheckResult } from '../types.js';

const CATEGORY = 'dependencies';

const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Pipfile.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
  'Cargo.lock',
];

export function checkDependencies(root: string): CheckResult[] {
  const results: CheckResult[] = [];

  // has_package_manifest: package.json with "version" field OR pyproject.toml OR Cargo.toml
  const pkgJsonPath = path.join(root, 'package.json');
  const pyprojectPath = path.join(root, 'pyproject.toml');
  const cargoPath = path.join(root, 'Cargo.toml');
  const pipfilePath = path.join(root, 'Pipfile');
  const requirementsPath = path.join(root, 'requirements.txt');

  let hasManifest = false;
  let manifestHint = '';

  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
      if (pkg.version) {
        hasManifest = true;
        manifestHint = 'package.json with version field';
      } else {
        hasManifest = true;
        manifestHint = 'package.json found (no version field)';
      }
    } catch {
      hasManifest = true;
      manifestHint = 'package.json (parse error)';
    }
  } else if (fs.existsSync(pyprojectPath)) {
    hasManifest = true;
    manifestHint = 'pyproject.toml';
  } else if (fs.existsSync(cargoPath)) {
    hasManifest = true;
    manifestHint = 'Cargo.toml';
  } else if (fs.existsSync(pipfilePath)) {
    hasManifest = true;
    manifestHint = 'Pipfile';
  } else if (fs.existsSync(requirementsPath)) {
    hasManifest = true;
    manifestHint = 'requirements.txt';
  }

  results.push({
    category: CATEGORY,
    name: 'has_package_manifest',
    passed: hasManifest,
    severity: 'medium',
    detail: hasManifest
      ? `Package manifest found: ${manifestHint}.`
      : 'No package manifest found (package.json, pyproject.toml, Cargo.toml, etc.).',
  });

  // lockfile_present
  const lockfileFound = LOCKFILES.find((lf) => fs.existsSync(path.join(root, lf)));
  results.push({
    category: CATEGORY,
    name: 'lockfile_present',
    passed: !!lockfileFound,
    severity: 'high',
    detail: lockfileFound
      ? `Lockfile found: ${lockfileFound}.`
      : 'No lockfile found. Lockfiles ensure reproducible installs.',
  });

  // no_wildcard_versions: no "*" versions in package.json dependencies
  let wildcardFound = false;
  let wildcardHint = '';
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
      const checkDeps = (deps: unknown, section: string) => {
        if (!deps || typeof deps !== 'object') return;
        for (const [name, ver] of Object.entries(deps as Record<string, string>)) {
          if (ver === '*' || ver === 'latest') {
            wildcardFound = true;
            wildcardHint = `${section}.${name}: "${ver}"`;
          }
        }
      };
      checkDeps(pkg.dependencies, 'dependencies');
      checkDeps(pkg.devDependencies, 'devDependencies');
      checkDeps(pkg.peerDependencies, 'peerDependencies');
    } catch {
      // ignore
    }
  }

  results.push({
    category: CATEGORY,
    name: 'no_wildcard_versions',
    passed: !wildcardFound,
    severity: 'medium',
    detail: !wildcardFound
      ? 'No wildcard (*) or "latest" version ranges found.'
      : 'Wildcard or "latest" version range found. Pin versions for reproducibility.',
    fileHint: wildcardFound ? wildcardHint : undefined,
  });

  return results;
}
