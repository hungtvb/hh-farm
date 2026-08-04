import { defineConfig, type Plugin } from 'vite';

type DeploymentEnvironment =
  | 'local'
  | 'preview'
  | 'production'
  | 'test';

type BuildInfo = Readonly<{
  appVersion: string;
  gitSha: string;
  gitRef: string;
  builtAt: string;
  deploymentEnvironment: DeploymentEnvironment;
  deploymentUrl: string | null;
}>;

function readNonEmptyEnvironmentValue(
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function resolveDeploymentEnvironment(mode: string): DeploymentEnvironment {
  const explicit = readNonEmptyEnvironmentValue(
    'HH_FARM_DEPLOYMENT_ENVIRONMENT',
  );

  if (
    explicit === 'local' ||
    explicit === 'preview' ||
    explicit === 'production' ||
    explicit === 'test'
  ) {
    return explicit;
  }

  if (mode === 'e2e') {
    return 'test';
  }

  if (process.env.CF_PAGES === '1') {
    return process.env.CF_PAGES_BRANCH === 'main' ? 'production' : 'preview';
  }

  return 'local';
}

function resolveBuildInfo(mode: string): BuildInfo {
  return {
    appVersion:
      readNonEmptyEnvironmentValue('HH_FARM_APP_VERSION', 'npm_package_version') ??
      '0.0.0-local',
    gitSha:
      readNonEmptyEnvironmentValue(
        'HH_FARM_GIT_SHA',
        'CF_PAGES_COMMIT_SHA',
        'GITHUB_SHA',
      ) ?? 'local',
    gitRef:
      readNonEmptyEnvironmentValue(
        'HH_FARM_GIT_REF',
        'CF_PAGES_BRANCH',
        'GITHUB_HEAD_REF',
        'GITHUB_REF_NAME',
      ) ?? 'local',
    builtAt:
      readNonEmptyEnvironmentValue('HH_FARM_BUILD_TIME') ??
      new Date().toISOString(),
    deploymentEnvironment: resolveDeploymentEnvironment(mode),
    deploymentUrl:
      readNonEmptyEnvironmentValue(
        'HH_FARM_DEPLOYMENT_URL',
        'CF_PAGES_URL',
      ) ?? null,
  };
}

function createBuildMetadataPlugin(buildInfo: BuildInfo): Plugin {
  return {
    name: 'hh-farm-build-metadata',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildInfo = resolveBuildInfo(mode);

  return {
    base: './',
    define: {
      __HH_FARM_BUILD_INFO__: JSON.stringify(buildInfo),
    },
    plugins: [createBuildMetadataPlugin(buildInfo)],
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      emptyOutDir: true,
    },
  };
});
