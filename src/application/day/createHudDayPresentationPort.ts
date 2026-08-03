import type { NextDayPresentationPort } from './requestNextDayCoordinator.js';

export type DayHudPort = Readonly<{
  setDay: (day: number) => void;
  markDayTransitionComplete: (eventCount: number) => void;
}>;

export function createHudDayPresentationPort(
  hud: DayHudPort,
): NextDayPresentationPort {
  return Object.freeze({
    present: (_previous, next, events) => {
      hud.setDay(next.farm.day);
      hud.markDayTransitionComplete(events.length);
    },
  });
}
