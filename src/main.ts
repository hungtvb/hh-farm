import './styles.css';
import './ui/mobileLayout.css';
import './ui/inventoryUi.css';
import './ui/shopUi.css';
import './ui/farmLoopUi.css';
import './ui/settingsUi.css';
import './ui/accessibilityUi.css';
import { exposeBuildInfo } from './build/buildInfo';
import { mountGameExperience } from './ui/mountGameExperience';

async function bootstrap(): Promise<void> {
  exposeBuildInfo();

  const params = new URLSearchParams(window.location.search);
  const e2eEnabled = import.meta.env.MODE === 'e2e';

  if (e2eEnabled && params.has('save-spike')) {
    const { runSaveSpikeHarness } = await import('./dev/saveSpikeHarness');
    await runSaveSpikeHarness();
    return;
  }

  const appRoot = document.querySelector<HTMLElement>('#app');
  if (appRoot === null) {
    throw new Error('Missing #app root for HH Farm.');
  }

  const experience = await mountGameExperience(appRoot);

  if (e2eEnabled && params.has('day-spike')) {
    const { runDayTransitionHarness } = await import(
      './dev/dayTransitionHarness'
    );
    await runDayTransitionHarness(experience.hud);
    return;
  }

  const { createGame } = await import('./game/bootstrap/createGame');
  createGame('game-root');
}

void bootstrap();
