import './styles.css';

async function bootstrap(): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  if (params.has('save-spike')) {
    const { runSaveSpikeHarness } = await import('./dev/saveSpikeHarness');
    await runSaveSpikeHarness();
    return;
  }

  const { createGame } = await import('./game/bootstrap/createGame');
  createGame('game-root');
}

void bootstrap();
