import type { GameHudController } from '../../ui/gameHud.js';
import type { NextDayPresentationPort } from './requestNextDayCoordinator.js';

export function createHudDayPresentationPort(
  hud: Pick<GameHudController, 'root' | 'setDay'>,
): NextDayPresentationPort {
  return Object.freeze({
    present: (_previous, next, events) => {
      hud.setDay(next.farm.day);
      hud.root.dataset.dayTransitionEvents = String(events.length);
      hud.root.dataset.dayTransitionStatus = 'complete';
    },
  });
}
