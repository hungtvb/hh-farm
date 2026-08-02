import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const FORBIDDEN_MARKERS = [
  'HH Farm · IndexedDB save spike',
  'seed-recovery',
  'corrupted-current',
  'writeRawSaveSlotForDiagnostics',
];

async function listFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryUrl)));
    } else {
      files.push(entryUrl);
    }
  }

  return files;
}

const files = await listFiles(DIST_DIRECTORY);
const bundleFiles = files.filter((fileUrl) =>
  ['.html', '.js', '.css'].includes(fileUrl.pathname.slice(fileUrl.pathname.lastIndexOf('.'))),
);

for (const fileUrl of bundleFiles) {
  const content = await readFile(fileUrl, 'utf8');

  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      throw new Error(
        `Production bundle leaked save diagnostics marker "${marker}" in ${join('dist', fileUrl.pathname.split('/dist/')[1] ?? '')}.`,
      );
    }
  }
}

console.log(
  `Verified ${bundleFiles.length} production bundle files: save diagnostics are absent.`,
);
