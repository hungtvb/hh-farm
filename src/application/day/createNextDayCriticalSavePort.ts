import type { FarmSaveRepository } from '../save/farmSaveRepository.js';
import type { FarmPlayerPosition } from '../../domain/save/farmSave.js';
import type { NextDayCriticalSavePort } from './requestNextDayCoordinator.js';

export function createNextDayCriticalSavePort(
  repository: FarmSaveRepository,
  getPlayerPosition: () => FarmPlayerPosition,
): NextDayCriticalSavePort {
  return Object.freeze({
    flush: async (candidate) => {
      await repository.save({
        farm: candidate.farm,
        field: candidate.field,
        player: getPlayerPosition(),
      });
    },
  });
}
