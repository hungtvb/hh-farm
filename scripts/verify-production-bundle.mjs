import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const FORBIDDEN_MARKERS = [
  'HH Farm · IndexedDB save spike',
  'seed-recovery',
  'corrupted-current',
  'writeRawSaveSlotForDiagnostics',
];

/**
 * @param {URL} directoryUrl
 * @returns {Promise<URL[]>}
 */
async function listFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  /** @type {URL[]} */
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? '/' : ''}`,
      directoryUrl,
    );

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryUrl)));
    } else {
      files.push(entryUrl);
    }
  }

  return files;
}

const files = await listFiles(DIST_DIRECTORY);
const bundleFiles = files.filter((fileUrl) => {
  const extension = fileUrl.pathname.slice(fileUrl.pathname.lastIndexOf('.'));
  return ['.html', '.js', '.css'].includes(extension);
});

for (const fileUrl of bundleFiles) {
  const content = await readFile(fileUrl, 'utf8');

  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      const relativePath = fileUrl.pathname.split('/dist/')[1] ?? '';
      throw new Error(
        `Production bundle leaked save diagnostics marker "${marker}" in ${join('dist', relativePath)}.`,
      );
    }
  }
}

console.log(
  `Verified ${bundleFiles.length} production bundle files: save diagnostics are absent.`,
);
