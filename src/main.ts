import './styles.css';
import { exposeBuildInfo } from './build/buildInfo';
import { mountGameHud } from './ui/gameHud';

async function bootstrap(): Promise<void> {
  exposeBuildInfo();

  const params = new URLSearchParams(window.location.search);
  const saveSpikeEnabled = import.meta.env.MODE === 'e2e';

  if (saveSpikeEnabled && params.has('save-spike')) {
    const { runSaveSpikeHarness } = await import('./dev/saveSpikeHarness');
    await runSaveSpikeHarness();
    return;
  }

  const appRoot = document.querySelector<HTMLElement>('#app');
  if (appRoot === null) {
    throw new Error('Missing #app root for HH Farm.');
  }

  mountGameHud(appRoot);

  const { createGame } = await import('./game/bootstrap/createGame');
  createGame('game-root');
}

void bootstrap();
