import './styles.css';
import { exposeBuildInfo } from './build/buildInfo';

async function bootstrap(): Promise<void> {
  exposeBuildInfo();

  const params = new URLSearchParams(window.location.search);
  const saveSpikeEnabled = import.meta.env.MODE === 'e2e';

  if (saveSpikeEnabled && params.has('save-spike')) {
    const { runSaveSpikeHarness } = await import('./dev/saveSpikeHarness');
    await runSaveSpikeHarness();
    return;
  }

  const { createGame } = await import('./game/bootstrap/createGame');
  createGame('game-root');
}

void bootstrap();
