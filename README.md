# zquality

Tech-lead code quality reviewer — architecture, conventions, tests, docs, and security.

Analyzes any codebase with 30 heuristic checks across 10 categories and produces a score 0–100 with grade A–F.

## Install

```bash
npm install -g zquality
```

## Usage

```bash
zquality analyze <path> [--output <dir>] [--upload] [--project-name <name>]
```

### Options

| Flag | Description |
|------|-------------|
| `--output <dir>` | Write reports to directory (default: `./zquality-output`) |
| `--upload` | Upload results to Zpulse platform |
| `--project-name <name>` | Project name for upload |
| `--zpulse-project-id <id>` | Zpulse project UUID |

## What it checks (30 checks, 10 categories)

| Category | Checks |
|----------|--------|
| **folderSchema** | src/lib/app dir, tests dir, nesting depth |
| **complexity** | Large functions, nesting depth, file size |
| **archPatterns** | Barrel exports, circular imports, DB in UI |
| **conventions** | Naming consistency, prefer const, TODO count |
| **dependencies** | Lockfile, manifest, no wildcard versions |
| **testCoverage** | Test files present, test ratio ≥20%, test config |
| **docsQuality** | README.md, comments ratio, CHANGELOG/ADR |
| **secretsCheck** | No API keys, AWS keys, GitHub tokens |
| **ciCd** | CI config, tests in CI, Dockerfile |
| **errorHandling** | try/catch in I/O, no empty catch, error messages |

## Grade mapping

| Score | Grade |
|-------|-------|
| ≥90 | A |
| ≥75 | B |
| ≥60 | C |
| ≥40 | D |
| <40 | F |

## Output files

- `zquality-result.json` — Full JSON result
- `zquality-report.md` — Markdown report
- `report.html` — Self-contained HTML report with score badge and category bars
- `badge.svg` — Shields.io-style SVG badge

## Environment variables (for upload)

```
ZPULSE_API_URL       # Platform URL
ZPULSE_BOT_TOKEN     # Bot token for authentication
ZPULSE_PROJECT_ID    # Zpulse project UUID (optional)
```

## GitHub Actions

See [`examples/github-actions/zbot-zquality.yml`](examples/github-actions/zbot-zquality.yml) for a ready-to-use workflow that runs on PRs and weekly.

## Programmatic API

```typescript
import { runZquality } from 'zquality';

const result = await runZquality('./my-project', {
  outputDir: './reports',
  projectName: 'my-project',
});

console.log(result.grade, result.score);
```

## License

MIT
