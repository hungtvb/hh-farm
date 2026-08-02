export type DeploymentEnvironment =
  | 'local'
  | 'preview'
  | 'production'
  | 'test';

export type BuildInfo = Readonly<{
  appVersion: string;
  gitSha: string;
  gitRef: string;
  builtAt: string;
  deploymentEnvironment: DeploymentEnvironment;
  deploymentUrl: string | null;
}>;

declare const __HH_FARM_BUILD_INFO__: BuildInfo;

export const buildInfo: BuildInfo = Object.freeze({
  ...__HH_FARM_BUILD_INFO__,
});

export function exposeBuildInfo(): void {
  const root = document.documentElement;

  root.dataset.appVersion = buildInfo.appVersion;
  root.dataset.gitSha = buildInfo.gitSha;
  root.dataset.gitRef = buildInfo.gitRef;
  root.dataset.deploymentEnvironment = buildInfo.deploymentEnvironment;
}
