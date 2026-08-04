const [deploymentUrlArgument, expectedSha, expectedEnvironment] =
  process.argv.slice(2);

const deploymentUrl = new URL(deploymentUrlArgument);
const deploymentBaseUrl = new URL(deploymentUrl);
if (!deploymentBaseUrl.pathname.endsWith('/')) {
  deploymentBaseUrl.pathname = `${deploymentBaseUrl.pathname}/`;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function fetchRequired(url) {
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'cache-control': 'no-cache' },
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(
        `${url.href} returned HTTP ${String(response.status)}.`,
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to fetch ${deploymentBaseUrl.href}.`);
}

const indexResponse = await fetchRequired(deploymentBaseUrl);
const indexHtml = await indexResponse.text();

if (!indexHtml.includes('<div id="game-root"></div>')) {
  throw new Error('Deployed index.html is not the HH Farm application shell.');
}

const versionResponse = await fetchRequired(
  new URL('version.json', deploymentBaseUrl),
);
/** @type {unknown} */
const versionMetadata = JSON.parse(await versionResponse.text());

if (!isRecord(versionMetadata)) {
  throw new Error('Deployed version.json is not an object.');
}

if (versionMetadata.gitSha !== expectedSha) {
  throw new Error(
    `Deployed gitSha ${String(versionMetadata.gitSha)} does not match ${expectedSha}.`,
  );
}

if (versionMetadata.deploymentEnvironment !== expectedEnvironment) {
  throw new Error(
    `Deployed environment ${String(versionMetadata.deploymentEnvironment)} does not match ${expectedEnvironment}.`,
  );
}

await fetchRequired(new URL('maps/farm-test.json', deploymentBaseUrl));

/** @type {Set<string>} */
const assetReferences = new Set();
const assetPattern = /(?:src|href)="([^"#?]+)"/gu;

for (const match of indexHtml.matchAll(assetPattern)) {
  const assetPath = match[1];

  if (!assetPath.startsWith('data:')) {
    assetReferences.add(new URL(assetPath, deploymentBaseUrl).href);
  }
}

if (assetReferences.size === 0) {
  throw new Error('Deployed index.html did not reference any build assets.');
}

for (const assetUrl of assetReferences) {
  await fetchRequired(new URL(assetUrl));
}

console.log(
  `Verified ${deploymentBaseUrl.href}: ${expectedEnvironment} build ${expectedSha} and ${String(assetReferences.size)} referenced assets loaded.`,
);
