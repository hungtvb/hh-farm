import {
  resolveNextDay,
  type DayTransitionEvent,
  type DayTransitionFailure,
  type DayTransitionState,
} from '../../domain/day/dayTransition.js';
import type { FarmingContentPort } from '../../domain/farming/farmingPorts.js';

export type NextDayStatePort = Readonly<{
  read: () => DayTransitionState;
  commit: (state: DayTransitionState) => void;
}>;

export type NextDayCriticalSavePort = Readonly<{
  flush: (candidate: DayTransitionState) => Promise<void>;
}>;

export type NextDayPresentationPort = Readonly<{
  present: (
    previous: DayTransitionState,
    next: DayTransitionState,
    events: readonly DayTransitionEvent[],
  ) => Promise<void> | void;
}>;

export type RequestNextDayResult =
  | Readonly<{ status: 'transition_in_progress' }>
  | Readonly<{
      status: 'domain_rejected';
      failure: DayTransitionFailure;
    }>
  | Readonly<{
      status: 'save_failed';
      error: string;
    }>
  | Readonly<{
      status: 'completed';
      state: DayTransitionState;
      events: readonly DayTransitionEvent[];
      presentationError?: string;
    }>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class RequestNextDayCoordinator {
  private transitionInProgress = false;

  public constructor(
    private readonly content: FarmingContentPort,
    private readonly statePort: NextDayStatePort,
    private readonly savePort: NextDayCriticalSavePort,
    private readonly presentationPort: NextDayPresentationPort,
  ) {}

  public async requestNextDay(): Promise<RequestNextDayResult> {
    if (this.transitionInProgress) {
      return Object.freeze({ status: 'transition_in_progress' });
    }

    this.transitionInProgress = true;

    try {
      const previous = this.statePort.read();
      const transition = resolveNextDay(previous, this.content);

      if (!transition.ok) {
        return Object.freeze({
          status: 'domain_rejected',
          failure: transition,
        });
      }

      try {
        await this.savePort.flush(transition.state);
      } catch (error) {
        return Object.freeze({
          status: 'save_failed',
          error: describeError(error),
        });
      }

      this.statePort.commit(transition.state);

      try {
        await this.presentationPort.present(
          previous,
          transition.state,
          transition.events,
        );
      } catch (error) {
        return Object.freeze({
          status: 'completed',
          state: transition.state,
          events: transition.events,
          presentationError: describeError(error),
        });
      }

      return Object.freeze({
        status: 'completed',
        state: transition.state,
        events: transition.events,
      });
    } finally {
      this.transitionInProgress = false;
    }
  }
}
