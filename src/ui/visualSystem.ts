import visualSystem from '../../assets/source/visual-system.json';

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

export function applyVisualSystem(root: HTMLElement): void {
  for (const [name, value] of Object.entries(visualSystem.palette)) {
    root.style.setProperty(`--hh-${toKebabCase(name)}`, value);
  }

  for (const [name, value] of Object.entries(visualSystem.metrics)) {
    root.style.setProperty(`--hh-${toKebabCase(name)}`, `${String(value)}px`);
  }

  root.dataset.visualSystemVersion = String(visualSystem.version);
}

export function getVisualAssetUrl(fileName: string): string {
  return `/assets/generated/${fileName}`;
}
