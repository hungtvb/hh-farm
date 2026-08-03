import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public/assets/generated');
const manifest = JSON.parse(
  await readFile(path.join(outputDir, 'manifest.json'), 'utf8'),
);
const ids = new Set();
let totalBytes = 0;

for (const entry of manifest.entries) {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(entry.id)) {
    throw new Error(`Invalid asset ID: ${entry.id}`);
  }

  if (ids.has(entry.id)) {
    throw new Error(`Duplicate asset ID: ${entry.id}`);
  }
  ids.add(entry.id);

  if (!/^[a-z0-9-]+\.svg$/.test(entry.file)) {
    throw new Error(`Invalid asset filename: ${entry.file}`);
  }

  if (!['center', 'bottom-center'].includes(entry.anchor)) {
    throw new Error(`Invalid anchor for ${entry.id}: ${entry.anchor}`);
  }

  const filePath = path.join(outputDir, entry.file);
  const fileStat = await stat(filePath);
  const content = await readFile(filePath, 'utf8');

  if (!content.includes('<svg') || !content.includes('</svg>')) {
    throw new Error(`Invalid SVG: ${entry.file}`);
  }

  totalBytes += fileStat.size;
}

if (totalBytes > manifest.budgetBytes) {
  throw new Error(
    `Visual asset budget exceeded: ${totalBytes} > ${manifest.budgetBytes}`,
  );
}

console.log(
  `Validated ${manifest.entries.length} visual assets (${totalBytes} bytes / ${manifest.budgetBytes} budget).`,
);
