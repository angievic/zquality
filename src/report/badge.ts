import fs from 'node:fs';
import path from 'node:path';
import type { ZqualityResult } from '../types.js';

function badgeColor(grade: string): string {
  if (grade === 'A') return '#16a34a'; // green
  if (grade === 'B') return '#2563eb'; // blue
  if (grade === 'C') return '#ca8a04'; // yellow
  if (grade === 'D') return '#ea580c'; // orange
  return '#dc2626'; // red
}

export async function writeBadge(result: ZqualityResult, outputDir: string): Promise<string> {
  fs.mkdirSync(outputDir, { recursive: true });

  const label = 'zquality';
  const message = `${result.grade} ${result.score}/100`;
  const color = badgeColor(result.grade);

  // Flat badge in shields.io style
  const labelWidth = label.length * 6 + 20;
  const messageWidth = message.length * 7 + 20;
  const totalWidth = labelWidth + messageWidth;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${Math.round(labelWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${Math.round(labelWidth / 2)}" y="14">${label}</text>
    <text x="${labelWidth + Math.round(messageWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + Math.round(messageWidth / 2)}" y="14">${message}</text>
  </g>
</svg>`;

  const outPath = path.join(outputDir, 'badge.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  return outPath;
}
