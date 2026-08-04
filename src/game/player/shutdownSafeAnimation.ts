export type ShutdownSafeAnimationHost = Readonly<{
  anims?: Readonly<{
    stop: () => unknown;
  }>;
}>;

export function stopAnimationOnShutdown(
  host: ShutdownSafeAnimationHost,
): void {
  host.anims?.stop();
}
