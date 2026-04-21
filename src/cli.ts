#!/usr/bin/env node
import { program } from 'commander';
import path from 'node:path';
import { runZquality } from './index.js';

program
  .name('zquality')
  .description('Tech-lead code quality reviewer — architecture, conventions, tests, docs, security')
  .version('0.1.0');

program
  .command('analyze <path>')
  .description('Analyze a project for code quality')
  .option('--output <dir>', 'Output directory for reports')
  .option('--upload', 'Upload results to Zpulse (requires ZPULSE_API_URL, ZPULSE_BOT_TOKEN)')
  .option('--project-name <name>', 'Project name for upload')
  .option('--zpulse-project-id <id>', 'Zpulse project UUID to associate run with')
  .action(
    async (
      targetPath: string,
      opts: {
        output?: string;
        upload?: boolean;
        projectName?: string;
        zpulseProjectId?: string;
      },
    ) => {
      const absPath = path.resolve(targetPath);
      console.log(`[zquality] Analyzing: ${absPath}`);

      const outputDir = opts.output ?? path.join(process.cwd(), 'zquality-output');
      const projectName = opts.projectName ?? path.basename(absPath);
      const zpulseProjectId = opts.zpulseProjectId ?? process.env.ZPULSE_PROJECT_ID;

      try {
        const result = await runZquality(absPath, {
          outputDir,
          upload: Boolean(opts.upload),
          projectName,
          zpulseProjectId,
        });

        console.log('');
        console.log(`  Grade: ${result.grade}   Score: ${result.score}/100`);
        console.log(`  Files scanned: ${result.filesScanned}`);
        console.log(`  Checks: ${result.checks.filter((c) => c.passed).length}/${result.checks.length} passed`);
        if (result.criticalFailures.length > 0) {
          console.log(`  Critical failures: ${result.criticalFailures.join(', ')}`);
        }
        console.log('');
        console.log(`  Reports written to: ${outputDir}`);
        if (opts.upload) {
          console.log('  Results uploaded to Zpulse.');
        }

        // Exit with non-zero if grade is F
        if (result.grade === 'F') {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error('[zquality] Error:', err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    },
  );

program.parse();
